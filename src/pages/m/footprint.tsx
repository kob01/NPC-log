/**
 * 移动端地图足迹（/m/footprint）
 * - 撒点复用 components/FootprintMap（与桌面端同一套高德逻辑），高度按视口收缩
 * - 下方单列卡片流，点击进 /m/detail；地图不可用时只留列表，不白屏
 * - 区域筛选单独一行，且只在「有点带行政区」时出现（小程序录的与存量点没这个字段）
 */
import { SearchOutlined } from '@ant-design/icons'
import { Alert, Button, Cascader, Empty, Input, Select, Spin, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { FootprintsResult } from '@/servers/content/memory'

import FootprintMap from '@/components/FootprintMap'
import { getFootprints } from '@/servers/content/memory'
import { resolveFileUrl } from '@/utils/config'
import { regionOfPath, toCascaderOptions } from '@/utils/footprintRegion'

const MobileFootprint = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [data, setData] = useState<FootprintsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState<string | undefined>(undefined)
  const [tag, setTag] = useState('')
  // 区域存完整路径（Cascader 的受控值），发后端只取末档
  const [regionPath, setRegionPath] = useState<string[]>([])
  const [mapError, setMapError] = useState('')

  /** 拉取足迹数据 */
  const load = async (y?: string, tg?: string, rg?: string[]) => {
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
        region: regionOfPath(rg || []),
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

  // 首次加载 + 年份/区域切换后重拉（换年份依旧沿用手上的标签与区域）
  useEffect(() => {
    load(year, '', regionPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, regionPath])

  const points = data?.points || []
  const regionOptions = useMemo(() => toCascaderOptions(data?.regionOptions), [data?.regionOptions])

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
          onPressEnter={() => load(year, tag, regionPath)}
        />
        <Button className='shrink-0' type='primary' icon={<SearchOutlined />} loading={loading} onClick={() => load(year, tag, regionPath)} />
      </div>

      {/* 区域单独一行：窄屏上再挤进第一行会把标签输入框压到没法看；
          没点带行政区时整行不出现（而不是给一个点开是空的下拉） */}
      {regionOptions.length > 0 && (
        <Cascader
          allowClear
          changeOnSelect
          className='mb-3 w-full'
          placeholder={t('content.footprintAllRegions')}
          options={regionOptions}
          value={regionPath}
          onChange={(v) => setRegionPath((v || []).map(String))}
        />
      )}

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
                flex items-center gap-2 active:bg-gray-50
              '
              >
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-14px font-bold text-gray-800 truncate flex-1'>{p.event}</span>
                    <span className='text-11px text-gray-400 shrink-0'>{p.time}</span>
                  </div>
                  {/* 地址整行换行展示，宽度由 min-w-0 约束，不会把右侧缩略图挤窄 */}
                  {p.address || p.position ? <div className='mt-1 text-12px text-gray-500 break-words'>{p.address || p.position}</div> : null}
                  <div className='mt-1 flex flex-wrap gap-1 overflow-hidden'>
                    {p.tags.slice(0, 3).map((tg) => (
                      <Tag key={tg} color='blue' className='!mr-0' style={{ fontSize: 11 }}>
                        {tg}
                      </Tag>
                    ))}
                  </div>
                </div>
                {p.firstThumb ? <img src={resolveFileUrl(p.firstThumb)} alt='' className='w-52px h-52px object-cover rounded-6px shrink-0' /> : null}
              </div>
            ))
          : !loading && <Empty className='mt-60px' image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.footprintEmpty')} />}
      </Spin>
    </div>
  )
}

export default MobileFootprint
