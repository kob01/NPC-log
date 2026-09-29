import axios from 'axios'

import AxiosRequest from './request'

import { ONLY_MINE_HEADER, TOKEN } from '@/utils/config'
import { getLocalInfo, removeLocalInfo } from '@/utils/local'
import { getOnlyMine } from '@/utils/onlyMine'
import { message } from '@/utils/staticAntd'

// 请求配置
export const request = creteRequest()

// 用于存储最近显示的错误消息，防止重复弹出
const recentErrors = new Map<string, number>()
const ERROR_COOLDOWN = 3000 // 错误消息冷却时间（毫秒）

/**
 * 创建请求
 */
function creteRequest() {
  return new AxiosRequest({
    baseURL: '',
    timeout: 180 * 1000,
    interceptors: {
      // 接口请求拦截
      requestInterceptors(res) {
        const token = getLocalInfo(TOKEN) || ''
        if (res?.headers && token) {
          res.headers.Authorization = `Bearer ${token}`
        }
        // “只看自己日志”开关：全局注入，后端在所有可见性查询中统一生效
        if (res?.headers && getOnlyMine()) {
          res.headers[ONLY_MINE_HEADER] = '1'
        }
        return res
      },
      // 请求拦截超时
      requestInterceptorsCatch(err) {
        message.error({ content: '请求超时！', duration: 3 })
        return err
      },
      // 接口响应拦截
      responseInterceptors(res) {
        const { data } = res
        // 业务失败统一弹提示。
        // 注意：body 里的 code:401 只会来自登录/注册接口（账密错误、账号被禁用），
        // 属于“本次登录失败”而不是“当前会话过期”。此前在这里当作会话过期处理，
        // 会额外弹「权限不足，请重新登录！」并 1s 后整页跳转，把刚填的表单冲掉。
        // 真正的登录态失效由下方 responseInterceptorsCatch 按 HTTP 401 统一处理。
        if (data?.code !== 200) {
          handleError(data?.message)
          return res
        }

        return res
      },
      responseInterceptorsCatch(err) {
        // 网络层错误（后端未启动/断网）时 err.response 为 undefined，
        // 直接解构读取 status 会抛 TypeError 并导致界面完全无提示
        const status = err?.response?.status
        if (status === 401) {
          message.error({ content: '登录过期，请重新登录！', duration: 3 })
          removeLocalInfo(TOKEN)
          setTimeout(() => {
            window.location.href = '/'
          }, 1000)
          handleError('登录过期，请重新登录！')
          return err
        }
        // 取消重复请求则不报错
        if (axios.isCancel(err)) {
          err.data = err.data || {}
          return err
        }

        // 优先透出后端返回的业务错误文案，便于定位问题
        const serverMessage = err?.response?.data?.message
        handleError(
          status ? serverMessage || `请求失败（${status}）` : '网络异常，请检查服务是否可用！'
        )
        return err
      },
    },
  })
}

/**
 * 异常处理
 * @param error - 错误信息
 * @param content - 自定义内容
 */
const handleError = (error: string, content?: string) => {
  const errorMessage = content || error || '服务器错误'
  const now = Date.now()

  // 检查相同错误消息是否在冷却期内
  const lastShown = recentErrors.get(errorMessage)
  if (lastShown && now - lastShown < ERROR_COOLDOWN) {
    // 在冷却期内，不显示重复错误
    console.warn('重复错误消息被忽略:', errorMessage)
    return
  }

  // 记录错误消息显示时间
  recentErrors.set(errorMessage, now)

  // 清理过期的错误记录
  for (const [msg, time] of recentErrors.entries()) {
    if (now - time > ERROR_COOLDOWN) {
      recentErrors.delete(msg)
    }
  }

  console.error('错误信息:', error)
  message.error({
    content: errorMessage,
    key: `error-${errorMessage}`,
    duration: 3,
  })
}

/**
 * 取消请求
 * @param url - 链接
 */
export const cancelRequest = (url: string | string[]) => request.cancelRequest(url)

/** 取消全部请求 */
export const cancelAllRequest = () => request.cancelAllRequest()
