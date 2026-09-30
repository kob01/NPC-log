/**
 * 地图足迹撒点（高德 JS API，纯字符串深链，零后端依赖）
 * 桌面端 /content/footprint 与移动端 /m/footprint 共用
 * - 未配置 Key 或加载失败：通过 onDegrade 通知调用方降级为列表，不白屏
 * - 点击标记弹 InfoWindow，详情链接由 detailHref 决定跳桌面还是移动端
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { FootprintPoint } from '@/servers/content/memory'

import { isAmapConfigured, loadAmap } from '@/utils/amap'
import { resolveFileUrl } from '@/utils/config'

// 高德 SDK 对象的最小结构描述（项目未安装 @amap/maps 全局类型，避免 any）
interface AmapObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
interface AmapMarker extends AmapObject {
  on(event: string, handler: () => void): void
}
interface AmapMap extends AmapObject {
  add(obj: AmapObject | AmapObject[]): void
  remove(obj: AmapObject | AmapObject[]): void
  addControl(control: AmapObject): void
  setCenter(center: [number, number]): void
  setZoom(zoom: number): void
  setFitView(targets: AmapObject[], immediately?: boolean, avoid?: number[]): void
  destroy(): void
}
interface AmapInfoWindow extends AmapObject {
  setContent(html: string): void
  open(map: AmapMap, position: [number, number]): void
}

interface Props {
  /** 带坐标的日志点 */
  points: FootprintPoint[]
  /** 地图高度 */
  height?: number
  /** 详情链接构造（桌面指向编辑页，移动指向 /m/detail） */
  detailHref: (id: number) => string
  /** 地图不可用（Key 未配置/初始化失败）时的降级通知 */
  onDegrade?: (message: string) => void
}

const FootprintMap = (props: Props) => {
  const { points, height = 460, detailHref, onDegrade } = props
  const { t } = useTranslation()

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<AmapMap | null>(null)
  const infoWindow = useRef<AmapInfoWindow | null>(null)
  const markersRef = useRef<AmapMarker[]>([])
  // 用 ref 保存回调与文案，避免把它们放进 effect 依赖导致地图反复重建
  const degradeRef = useRef(onDegrade)
  degradeRef.current = onDegrade
  const copyRef = useRef({ notConfigured: '', loadFailed: '', viewDetail: '' })
  copyRef.current = {
    notConfigured: t('content.amapNotConfigured'),
    loadFailed: t('content.mapLoadFailed'),
    viewDetail: t('content.footprintViewDetail'),
  }

  /** 撒点（数据变化或首次加载后） */
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!points?.length) {
        return
      }
      if (!isAmapConfigured()) {
        degradeRef.current?.(copyRef.current.notConfigured)
        return
      }
      try {
        const AMap = await loadAmap()
        if (cancelled || !mapRef.current) {
          return
        }

        if (!mapInstance.current) {
          mapInstance.current = new (AMap as AmapObject).Map(mapRef.current, { zoom: 5 }) as AmapMap
          mapInstance.current.addControl(new (AMap as AmapObject).ToolBar() as AmapObject)
        }
        const map = mapInstance.current

        // 清空旧标记
        markersRef.current.forEach((m) => map.remove(m))
        markersRef.current = []

        points.forEach((p) => {
          const marker = new (AMap as AmapObject).Marker({
            position: [p.lng, p.lat],
            title: p.event,
            content: `<div style="width:14px;height:14px;border-radius:50%;background:#1677ff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            offset: new (AMap as AmapObject).Pixel(-7, -7),
            extData: p,
          }) as AmapMarker
          marker.on('click', () => openInfo(AMap, map, p))
          map.add(marker)
          markersRef.current.push(marker)
        })
        // 自适应视野
        if (points.length > 1) {
          map.setFitView(markersRef.current, false, [40, 40, 40, 40])
        } else {
          map.setCenter([points[0].lng, points[0].lat])
          map.setZoom(12)
        }
      } catch (error) {
        console.error('地图初始化失败:', error)
        if (!cancelled) {
          degradeRef.current?.(copyRef.current.loadFailed)
        }
      }
    }
    render()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  /** 卸载时销毁地图实例 */
  useEffect(
    () => () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
        mapInstance.current = null
      }
    },
    [],
  )

  /**
   * 打开信息窗
   * @param AMap - 高德 SDK 对象
   * @param map - 地图实例
   * @param p - 足迹点
   */
  const openInfo = (AMap: AmapObject, map: AmapMap, p: FootprintPoint) => {
    const thumb = resolveFileUrl(p.firstThumb)
    const html = `
      <div style="max-width:240px;padding:4px">
        <div style="font-weight:600;margin-bottom:4px">${p.event || ''}</div>
        <div style="font-size:12px;color:#888;margin-bottom:4px">${p.time || ''}</div>
        ${thumb ? `<img src="${thumb}" style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>` : ''}
        <div style="font-size:12px;color:#555;margin-bottom:4px">${p.address || p.position || ''}</div>
        <a href="${detailHref(p.id)}" style="font-size:12px;color:#1677ff">${copyRef.current.viewDetail}</a>
      </div>
    `
    if (!infoWindow.current) {
      infoWindow.current = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -12) }) as AmapInfoWindow
    }
    const win = infoWindow.current
    win.setContent(html)
    win.open(map, [p.lng, p.lat])
  }

  return <div ref={mapRef} className='w-full rounded-8px' style={{ height, background: '#f5f5f5' }} />
}

export default FootprintMap
