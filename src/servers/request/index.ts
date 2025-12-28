import { message } from '@/utils/staticAntd'
import { getLocalInfo, removeLocalInfo } from '@/utils/local'
import { TOKEN } from '@/utils/config'
import axios from 'axios'
import AxiosRequest from './request'

// 请求配置
export const request = creteRequest()

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
        return res
      },
      // 请求拦截超时
      requestInterceptorsCatch(err) {
        message.error('请求超时！')
        return err
      },
      // 接口响应拦截
      responseInterceptors(res) {
        const { data } = res
        // 权限不足
        if (data?.code === 401) {
          message.error('权限不足，请重新登录！')
          removeLocalInfo(TOKEN)
          setTimeout(() => {
            window.location.href = '/'
          }, 1000)
          handleError(data?.message)
          return res
        }

        // 错误处理
        if (data?.code !== 200) {
          handleError(data?.message)
          return res
        }

        return res
      },
      responseInterceptorsCatch(err) {
        const { response } = err
        if (response.status === 401) {
          message.error('登录过期，请重新登录！')
          removeLocalInfo(TOKEN)
          setTimeout(() => {
            window.location.href = '/'
          }, 1000)
          handleError('登录过期，请重新登录！')
          return
        }
        // 取消重复请求则不报错
        if (axios.isCancel(err)) {
          err.data = err.data || {}
          return err
        }

        handleError('服务器错误！')
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
  console.error('错误信息:', error)
  message.error({
    content: content || error || '服务器错误',
    key: 'error',
  })
}

/**
 * 取消请求
 * @param url - 链接
 */
export const cancelRequest = (url: string | string[]) => {
  return request.cancelRequest(url)
}

/** 取消全部请求 */
export const cancelAllRequest = () => {
  return request.cancelAllRequest()
}
