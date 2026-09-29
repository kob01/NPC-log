/**
 * 地图足迹页（/content/footprint）
 * - 高德 JS API 撒点所有带坐标的日记（GCJ-02），按年/标签过滤
 * - 未配置 Key / 加载失败：优雅降级为列表视图，不白屏
 * - 点击标记弹 InfoWindow 展示摘要与导航入口
 */
import { EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Input, Select, Space, Spin, Tag, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { FootprintPoint, FootprintsResult } from '@/servers/content/memory'

import BasicContent from '@/components/Content/BasicContent'
import NavLinks from '@/components/NavLinks'
import { useCommonStore } from '@/hooks/useCommonStore'
import { getFootprints } from '@/servers/content/memory'
import { isAmapConfigured, loadAmap } from '@/utils/amap'
import { resolveFileUrl } from '@/utils/config'
import { checkPermission } from '@/utils/permissions'

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

const Page = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { permissions } = useCommonStore()

  const [data, setData] = useState<FootprintsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState<string | undefined>(undefined)
  const [tag, setTag] = useState('')
  const [mapError, setMapError] = useState('')

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<AmapMap | null>(null)
  const infoWindow = useRef<AmapInfoWindow | null>(null)
  const markersRef = useRef<AmapMarker[]>([])

  /** 拉取足迹数据 */
  const load = async (y?: string, tg?: string) => {
    try {
      setLoading(true)
      setMapError('')
      const {
        code,
        data: resp,
        message: msg,
      } = await getFootprints({
        year: y,
        tag: tg || undefined,
      })
      if (Number(code) === 200 && resp) {
        setData(resp)
      } else {
        setMapError(msg || t('content.footprintLoadFailed'))
      }
    } catch (error) {
      console.error('获取地图足迹失败:', error)
      setMapError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  useEffect(() => {
    load(year, tag)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  /** 渲染撒点（数据变化或首次加载后） */
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!data?.points?.length) {
        return
      }
      if (!isAmapConfigured()) {
        setMapError(t('content.amapNotConfigured'))
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

        const points = data.points
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
          setMapError(t('content.mapLoadFailed'))
        }
      }
    }
    render()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  /** 卸载时销毁地图实例 */
  useEffect(
    () => () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
        mapInstance.current = null
      }
    },
    []
  )

  /**
   * 打开信息窗
   */
  const openInfo = (AMap: AmapObject, map: AmapMap, p: FootprintPoint) => {
    const thumb = resolveFileUrl(p.firstThumb)
    const html = `
      <div style="max-width:240px;padding:4px">
        <div style="font-weight:600;margin-bottom:4px">${p.event || ''}</div>
        <div style="font-size:12px;color:#888;margin-bottom:4px">${p.time || ''}</div>
        ${thumb ? `<img src="${thumb}" style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>` : ''}
        <div style="font-size:12px;color:#555;margin-bottom:4px">${p.address || p.position || ''}</div>
        <a href="/content/log/option?id=${p.id}" style="font-size:12px;color:#1677ff">${t('content.footprintViewDetail')}</a>
      </div>
    `
    if (!infoWindow.current) {
      infoWindow.current = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -12) }) as AmapInfoWindow
    }
    const win = infoWindow.current
    win.setContent(html)
    win.open(map, [p.lng, p.lat])
  }

  const allTags = Array.from(new Set((data?.points || []).flatMap((p) => p.tags))).slice(0, 50)

  return (
    <BasicContent isPermission={checkPermission('/content/footprint/index', permissions)}>
      <Space className='w-full flex items-center justify-between mb-4'>
        <Typography.Title level={4} className='mt-0 mb-0'>
          <EnvironmentOutlined /> {t('content.footprintTitle')}
          {data && (
            <Typography.Text type='secondary' style={{ fontSize: 13, marginLeft: 8 }}>
              {data.total} {t('content.footprintCount')}
            </Typography.Text>
          )}
        </Typography.Title>
        <Space>
          <Select
            allowClear
            style={{ width: 120 }}
            placeholder={t('content.footprintAllYears')}
            value={year}
            onChange={(v) => setYear(v)}
            options={(data?.years || []).map((y) => ({
              label: `${y.year} (${y.count})`,
              value: y.year,
            }))}
          />
          <Input
            allowClear
            style={{ width: 150 }}
            placeholder={t('content.logTagFilter')}
            value={tag}
            list='footprint-tag-list'
            onChange={(e) => setTag(e.target.value)}
            onPressEnter={() => load(year, tag)}
          />
          <datalist id='footprint-tag-list'>
            {allTags.map((tg) => (
              <option key={tg} value={tg} />
            ))}
          </datalist>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(year, tag)}>
            {t('public.reload')}
          </Button>
        </Space>
      </Space>

      {mapError ? <Alert type='warning' showIcon message={mapError} className='mb-3' /> : <span />}

      <Spin spinning={loading}>
        <div>
          {data?.points?.length ? (
            <>
              {/* 地图容器（Key 未配置/加载失败时隐藏，回退列表） */}
              {!mapError && (
                <div
                  ref={mapRef}
                  className='w-full rounded-8px mb-4'
                  style={{ height: 460, background: '#f5f5f5' }}
                />
              )}

              {/* 列表视图（同时作为无地图时的降级） */}
              <Card size='small' title={t('content.footprintList')}>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                  {data.points.map((p) => (
                    <div
                      key={p.id}
                      role='button'
                      tabIndex={0}
                      onClick={() => navigate(`/content/log/option?id=${p.id}`)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && navigate(`/content/log/option?id=${p.id}`)
                      }
                      className='
                      flex gap-2 p-2 rounded-8px cursor-pointer
                      hover:bg-gray-50 border border-gray-100
                    '
                    >
                      {p.firstThumb ? (
                        <img
                          src={resolveFileUrl(p.firstThumb)}
                          alt=''
                          className='w-48px h-48px object-cover rounded-6px shrink-0'
                        />
                      ) : null}
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center justify-between gap-2'>
                          <Typography.Text strong ellipsis className='flex-1'>
                            {p.event}
                          </Typography.Text>
                          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                            {p.time}
                          </Typography.Text>
                        </div>
                        <div className='flex items-center justify-between mt-1'>
                          <Space size={[4, 4]} wrap>
                            {p.tags.slice(0, 3).map((tg) => (
                              <Tag key={tg} color='blue' style={{ marginRight: 0, fontSize: 11 }}>
                                {tg}
                              </Tag>
                            ))}
                          </Space>
                          <span onClick={(e) => e.stopPropagation()}>
                            <NavLinks
                              lng={p.lng}
                              lat={p.lat}
                              position={p.position}
                              address={p.address}
                              compact
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            !loading && (
              <Empty
                className='mt-60px'
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('content.footprintEmpty')}
              />
            )
          )}
        </div>
      </Spin>
    </BasicContent>
  )
}

export default Page
