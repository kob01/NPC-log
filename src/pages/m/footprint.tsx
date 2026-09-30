/**
 * 移动端地图足迹（/m/footprint）
 * - 撒点复用 components/FootprintMap（与桌面端同一套高德逻辑），高度按视口收缩
 * - 下方单列卡片流，点击进 /m/detail；地图不可用时只留列表，不白屏
 */
import { SearchOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Select, Spin, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { FootprintsResult } from '@/servers/content/memory'

import FootprintMap from '@/components/FootprintMap'
import NavLinks from '@/components/NavLinks'
import { getFootprints } from '@/servers/content/memory'
import { resolveFileUrl } from '@/utils/config'

const MobileFootprint = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [data, setData] = useState<FootprintsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState<string | undefined>(undefined)
  const [tag, setTag] = useState('')
  const [mapError, setMapError] = useState('')

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
  }

  // 首次加载 + 年份切换后重拉
  useEffect(() => {
    load(year, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const points = data?.points || []

  return (
    <div className='max-w-768px mx-auto px-3 py-3'>
      {/* 过滤条 */}
      <div className='flex items-center gap-2 mb-3'>
        <Select
          allowClear
          className='shrink-0'
          style={{ width: 116 }}
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
          className='flex-1'
          placeholder={t('content.logTagFilter')}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onPressEnter={() => load(year, tag)}
        />
        <Button className='shrink-0' type='primary' icon={<SearchOutlined />} loading={loading} onClick={() => load(year, tag)} />
      </div>

      <div className='text-12px text-gray-400 mb-2'>{data ? `${data.total} ${t('content.footprintCount')}` : ''}</div>

      {mapError && <Alert type='warning' showIcon message={mapError} className='mb-3' />}

      <Spin spinning={loading}>
        {/* 地图：手机上按视口高度收缩，避免占满屏幕 */}
        {points.length > 0 && !mapError && (
          <div className='mb-3 overflow-hidden'>
            <FootprintMap
              points={points}
              height={Math.round(window.innerHeight * 0.42)}
              detailHref={(id) => `/m/detail?id=${id}`}
              onDegrade={setMapError}
            />
          </div>
        )}

        {points.length
          ? points.map((p) => (
              <div
                key={p.id}
                role='button'
                tabIndex={0}
                onClick={() => navigate(`/m/detail?id=${p.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/m/detail?id=${p.id}`)}
                className='
                mb-2 p-2 rounded-10px bg-white cursor-pointer
                shadow-0_1px_4px_rgba(0,0,0,0.06)
                flex gap-2 active:bg-gray-50
              '
              >
                {p.firstThumb ? <img src={resolveFileUrl(p.firstThumb)} alt='' className='w-52px h-52px object-cover rounded-6px shrink-0' /> : null}
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-14px font-bold text-gray-800 truncate flex-1'>{p.event}</span>
                    <span className='text-11px text-gray-400 shrink-0'>{p.time}</span>
                  </div>
                  <div className='mt-1 flex items-center justify-between gap-2'>
                    <div className='flex flex-wrap gap-1 overflow-hidden'>
                      {p.tags.slice(0, 3).map((tg) => (
                        <Tag key={tg} color='blue' className='!mr-0' style={{ fontSize: 11 }}>
                          {tg}
                        </Tag>
                      ))}
                    </div>
                    <span className='shrink-0' onClick={(e) => e.stopPropagation()}>
                      <NavLinks lng={p.lng} lat={p.lat} position={p.position} address={p.address} compact />
                    </span>
                  </div>
                </div>
              </div>
            ))
          : !loading && <Empty className='mt-60px' image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.footprintEmpty')} />}
      </Spin>
    </div>
  )
}

export default MobileFootprint
