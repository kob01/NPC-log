/**
 * 高德地图 JS API 统一管理
 * - 单例加载，失败兜底不白屏
 * - 未配置 Key 时所有功能优雅降级
 */
import * as AMapLoader from '@amap/amap-jsapi-loader'

/** 高德 Key（从环境变量读取） */
const AMAP_KEY = (import.meta.env.VITE_AMAP_KEY || '').trim()
/** 高德安全密钥 */
const AMAP_SECURITY_CODE = (import.meta.env.VITE_AMAP_SECURITY_CODE || '').trim()

/** 需要加载的插件列表 */
const PLUGINS = ['AMap.AutoComplete', 'AMap.Geocoder', 'AMap.PlaceSearch', 'AMap.Marker', 'AMap.ToolBar', 'AMap.Geolocation']

/** 加载超时（毫秒） */
const LOAD_TIMEOUT = 10000

/**
 * 高德 JSAPI 命名空间对象（运行时挂在 window.AMap 上）的最小结构描述。
 *
 * 不能写 `typeof AMap`：AMap 只是脚本加载后注入的运行时全局，本项目没有它的类型声明——
 * @amap/amap-jsapi-loader 发布的 index.d.ts 仅导出 load（返回 Promise<any>），
 * 其自带的 declare var AMap 留在未发布的 src/global.d.ts 里；tsconfig 的 types
 * 也只列了 vite/client 与 node，即便安装 @types/amap-js-api 也不会被自动引入。
 *
 * 项目中真正用到的构造函数在此按真实签名声明，其余成员走索引签名，
 * 调用方仍可用 `as unknown as 自己的接口` 收窄到具体实例结构（见 LocationPicker / FootprintMap）。
 */
export interface AmapNamespace {
  [key: string]: unknown
  Map: new (container: HTMLElement | string, opts?: Record<string, unknown>) => unknown
  Marker: new (opts?: Record<string, unknown>) => unknown
  Pixel: new (x: number, y: number) => unknown
  Geocoder: new (opts?: { extensions?: string; radius?: number }) => unknown
  AutoComplete: new (opts?: { city?: string }) => unknown
  PlaceSearch: new (opts?: { city?: string; citylimit?: boolean }) => unknown
  ToolBar: new (opts?: Record<string, unknown>) => unknown
  Geolocation: new (opts?: Record<string, unknown>) => unknown
  /** 按需加载插件：AMap.plugin(name, callback) */
  plugin: (names: string | string[], callback: () => void) => void
}

/** 单例缓存 */
let amapInstance: AmapNamespace | null = null
let loadPromise: Promise<AmapNamespace> | null = null

/**
 * 判断高德是否已配置（Key 非空）
 */
export function isAmapConfigured(): boolean {
  return AMAP_KEY.length > 0
}

/**
 * 加载高德 JS API（带单例缓存与超时兜底）
 * - 未配置 Key 时直接 reject
 * - 加载失败/超时后 reject，不会让页面白屏
 */
export function loadAmap(): Promise<AmapNamespace> {
  if (amapInstance) {
    return Promise.resolve(amapInstance)
  }
  if (!isAmapConfigured()) {
    return Promise.reject(new Error('AMap key not configured'))
  }
  if (loadPromise) {
    return loadPromise
  }

  // 设置安全密钥（必须在 load 之前）
  ;(window as unknown as Record<string, unknown>)._AMapSecurityConfig = {
    securityJsCode: AMAP_SECURITY_CODE,
  }

  loadPromise = new Promise<AmapNamespace>((resolve, reject) => {
    const timer = setTimeout(() => {
      loadPromise = null
      reject(new Error('AMap load timeout'))
    }, LOAD_TIMEOUT)

    AMapLoader.load({
      key: AMAP_KEY,
      version: '2.0',
      plugins: PLUGINS,
    })
      .then((AMap: AmapNamespace) => {
        clearTimeout(timer)
        amapInstance = AMap
        resolve(AMap)
      })
      .catch((err) => {
        clearTimeout(timer)
        loadPromise = null
        reject(err)
      })
  })

  return loadPromise
}

/**
 * 重置加载状态（用于测试或热更新）
 */
export function resetAmap(): void {
  amapInstance = null
  loadPromise = null
}
