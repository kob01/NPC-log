import axios from 'axios'

import type { RequestInterceptors, CreateRequestConfig, ServerResult } from './types'
import type { AxiosResponse, AxiosInstance, InternalAxiosRequestConfig, AxiosRequestConfig } from 'axios'

// 带上去重键的请求配置：去重键在请求拦截器里算一次并回写到 config 上，
// 响应侧直接取同一份，避免“请求拼了参数、响应只按 url 删除”导致两边键不一致
interface TrackedConfig extends InternalAxiosRequestConfig {
  __dedupeKey?: string
}

class AxiosRequest {
  // axios 实例
  instance: AxiosInstance
  // 拦截器对象
  interceptorsObj?: RequestInterceptors<AxiosResponse>
  // 存放取消请求控制器Map
  abortControllerMap: Map<string, AbortController>

  constructor(config: CreateRequestConfig) {
    this.instance = axios.create(config)
    // 初始化存放取消请求控制器Map
    this.abortControllerMap = new Map()
    this.interceptorsObj = config.interceptors
    // 拦截器执行顺序 接口请求 -> 实例请求 -> 全局请求 -> 实例响应 -> 全局响应 -> 接口响应
    this.instance.interceptors.request.use(
      (res: TrackedConfig) => {
        const controller = new AbortController()
        res.signal = controller.signal
        const key = this.buildRequestKey(res)
        res.__dedupeKey = key

        // 如果存在则删除该请求
        if (this.abortControllerMap.get(key)) {
          console.warn('取消重复请求：', key)
          this.cancelRequest(key)
        } else {
          this.abortControllerMap.set(key, controller)
        }

        return res
      },
      (err: object) => err,
    )

    // 使用实例拦截器
    this.instance.interceptors.request.use(this.interceptorsObj?.requestInterceptors, this.interceptorsObj?.requestInterceptorsCatch)
    this.instance.interceptors.response.use(this.interceptorsObj?.responseInterceptors, this.interceptorsObj?.responseInterceptorsCatch)
    // 全局响应拦截器保证最后执行
    this.instance.interceptors.response.use(
      // 因为我们接口的数据都在res.data下，所以我们直接返回res.data
      (res: AxiosResponse) => {
        // 被取消的请求会以 err 对象形式走到这里，取不到去重键就跳过
        const key = (res?.config as TrackedConfig)?.__dedupeKey
        if (key) {
          this.abortControllerMap.delete(key)
        }
        return res.data
      },
      (err: object) => err,
    )
  }
  /**
   * 构造请求去重键（method + url + query + 请求体字段）
   * @param config - 请求配置
   */
  buildRequestKey(config: AxiosRequestConfig) {
    let key = config.method || ''

    if (config.url) {
      key += `^${config.url}`
    }

    // 如果存在参数
    if (config.params) {
      for (const item in config.params) {
        key += `&${item}=${config.params[item]}`
      }
    }

    // 如果存在post数据
    const data = config.data
    if (typeof data === 'string' && data[0] === '{' && data[data.length - 1] === '}') {
      const obj = JSON.parse(data)
      for (const item in obj) {
        key += `#${item}=${obj[item]}`
      }
    }

    return key
  }
  /**
   * 取消全部请求
   */
  cancelAllRequest() {
    for (const [, controller] of this.abortControllerMap) {
      controller.abort()
    }
    this.abortControllerMap.clear()
  }
  /**
   * 取消指定的请求
   * @param url - 待取消的请求URL
   */
  cancelRequest(url: string | string[]) {
    const urlList = Array.isArray(url) ? url : [url]
    for (const _url of urlList) {
      this.abortControllerMap.get(_url)?.abort()
      this.abortControllerMap.delete(_url)
    }
  }
  /**
   * get请求
   * @param url - 链接
   * @param options - 参数
   */
  get<T = object>(url: string, options = {}) {
    return this.instance.get(url, options) as Promise<ServerResult<T>>
  }
  /**
   * post请求
   * @param url - 链接
   * @param options - 参数
   */
  post<T = object>(url: string, options = {}, config?: AxiosRequestConfig<object>) {
    return this.instance.post(url, options, config) as Promise<ServerResult<T>>
  }
  /**
   * put请求
   * @param url - 链接
   * @param options - 参数
   */
  put<T = object>(url: string, options = {}, config?: AxiosRequestConfig<object>) {
    return this.instance.put(url, options, config) as Promise<ServerResult<T>>
  }
  /**
   * delete请求
   * @param url - 链接
   * @param options - 参数
   */
  delete<T = object>(url: string, options = {}) {
    return this.instance.delete(url, options) as Promise<ServerResult<T>>
  }
}

export default AxiosRequest
