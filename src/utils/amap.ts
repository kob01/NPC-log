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
const PLUGINS = [
  'AMap.AutoComplete',
  'AMap.Geocoder',
  'AMap.PlaceSearch',
  'AMap.Marker',
  'AMap.ToolBar',
  'AMap.Geolocation',
]

/** 加载超时（毫秒） */
const LOAD_TIMEOUT = 10000

/** 单例缓存 */
let amapInstance: typeof AMap | null = null
let loadPromise: Promise<typeof AMap> | null = null

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
export function loadAmap(): Promise<typeof AMap> {
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

  loadPromise = new Promise<typeof AMap>((resolve, reject) => {
    const timer = setTimeout(() => {
      loadPromise = null
      reject(new Error('AMap load timeout'))
    }, LOAD_TIMEOUT)

    AMapLoader.load({
      key: AMAP_KEY,
      version: '2.0',
      plugins: PLUGINS,
    })
      .then((AMap) => {
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
