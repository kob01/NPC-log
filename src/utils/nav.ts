/**
 * 导航深链工具（纯字符串拼接，零 SDK）
 * 支持高德 URI API、Apple Maps、Google Maps
 */
import { gcj02towgs84 } from 'coordtransform'

/** 导航模式 */
export type NavMode = 'car' | 'bus' | 'walk' | 'ride'

export interface NavTarget {
  lng: number | null | undefined
  lat: number | null | undefined
  name?: string | null
  mode?: NavMode
}

/**
 * 构建高德导航 URI（精确坐标）
 */
export function buildAmapNavigationUrl({ lng, lat, name, mode = 'car' }: NavTarget): string {
  if (lng == null || lat == null) {
    return ''
  }
  const encodedName = encodeURIComponent(name || '目的地')
  return `https://uri.amap.com/navigation?to=${lng},${lat},${encodedName}&mode=${mode}&coordinate=gaode&callnative=1`
}

/**
 * 构建高德标注 URI（在地图上显示一个点）
 */
export function buildAmapMarkerUrl({ lng, lat, name }: NavTarget): string {
  if (lng == null || lat == null) {
    return ''
  }
  const encodedName = encodeURIComponent(name || '标记点')
  return `https://uri.amap.com/marker?location=${lng},${lat}&name=${encodedName}&coordinate=gaode&src=npc-log&callnative=1`
}

/**
 * 构建高德搜索 URI（无坐标时用关键词搜索）
 */
export function buildAmapSearchUrl(keyword: string): string {
  if (!keyword) {
    return ''
  }
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&src=npc-log&callnative=1`
}

/**
 * 构建兜底导航链接（Apple Maps / Google Maps，使用 WGS-84 坐标）
 * 注意：Apple/Google 使用 WGS-84，需从 GCJ-02 转换
 */
export function buildFallbackNavUrls({ lng, lat, name }: NavTarget): {
  google: string
  apple: string
} {
  if (lng == null || lat == null) {
    return { google: '', apple: '' }
  }
  // GCJ-02 → WGS-84
  const [wgsLng, wgsLat] = gcj02towgs84(lng, lat)
  const encodedName = encodeURIComponent(name || '')

  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${wgsLat},${wgsLng}${encodedName ? `&destination_place_id=${encodedName}` : ''}`,
    apple: `https://maps.apple.com/?daddr=${wgsLat},${wgsLng}&dirflg=d${encodedName ? `&q=${encodedName}` : ''}`,
  }
}

/**
 * 获取最佳导航 URL（根据是否有坐标选择策略）
 * - 有坐标：高德精确导航
 * - 无坐标但有关键词：高德搜索
 * - 都没有：返回空
 */
export function getBestNavUrl({ lng, lat, name, mode = 'car' }: NavTarget): string {
  if (lng != null && lat != null) {
    return buildAmapNavigationUrl({ lng, lat, name, mode })
  }
  if (name) {
    return buildAmapSearchUrl(name)
  }
  return ''
}
