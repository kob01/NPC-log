/**
 * 地图足迹页（/content/footprint）
 * - 撒点逻辑复用 components/FootprintMap（移动端 /m/footprint 同一套实现）
 * - 按年/标签过滤，地图不可用时降级为列表视图
 */
import { EnvironmentOutlined, ReloadOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Input, Select, Space, Spin, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { CardData } from '@/components/ShareCard/templates'
import type { FootprintsResult } from '@/servers/content/memory'

import BasicContent from '@/components/Content/BasicContent'
import FootprintMap from '@/components/FootprintMap'
import NavLinks from '@/components/NavLinks'
import ShareCardModal from '@/components/ShareCard'
import { useCommonStore } from '@/hooks/useCommonStore'
import { useMobileRedirect } from '@/hooks/useMobileRedirect'
import { getFootprints } from '@/servers/content/memory'
import { resolveFileUrl } from '@/utils/config'
import { checkPermission } from '@/utils/permissions'

const Page = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { permissions } = useCommonStore()

  const [data, setData] = useState<FootprintsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState<string | undefined>(undefined)
  const [tag, setTag] = useState('')
  const [mapError, setMapError] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  // 手机访问足迹页时切到移动版（地图高度自适应 + 单列列表）
  const toMobile = useMobileRedirect('/m/footprint')

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
    if (toMobile) {
      return
    }
    load(year, tag)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const allTags = Array.from(new Set((data?.points || []).flatMap((p) => p.tags))).slice(0, 50)

  // 高频标签→话题（供分享卡）
  const topHashtags = useMemo(() => {
    const counter = new Map<string, number>()
    ;(data?.points || []).forEach((p) => p.tags.forEach((tg) => counter.set(tg, (counter.get(tg) || 0) + 1)))
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tg]) => (tg.startsWith('#') ? tg : `#${tg}`))
  }, [data])

  const footprintCardData: CardData = {
    type: t('content.footprintTitle'),
    time: year || '',
    event: t('content.footprintShareTitle'),
    copy: {
      title: t('content.footprintShareTitle'),
      body: t('content.footprintShareBody', {
        count: data?.total ?? 0,
        year: year ? ` · ${year}` : '',
      }),
      hashtags: topHashtags,
    },
  }

  // 已判定走移动版，等重定向生效，不再拉取数据
  if (toMobile) {
    return null
  }

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
          {data?.points?.length ? (
            <Button type='primary' icon={<ShareAltOutlined />} onClick={() => setShareOpen(true)}>
              {t('content.shareBtn')}
            </Button>
          ) : null}
        </Space>
      </Space>

      {mapError ? <Alert type='warning' showIcon message={mapError} className='mb-3' /> : <span />}

      <Spin spinning={loading}>
        <div>
          {data?.points?.length ? (
            <>
              {/* 地图容器（Key 未配置/加载失败时隐藏，回退列表） */}
              {!mapError && (
                <div className='mb-4'>
                  <FootprintMap points={data.points} detailHref={(id) => `/content/log/option?id=${id}`} onDegrade={setMapError} />
                </div>
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
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/content/log/option?id=${p.id}`)}
                      className='
                      flex gap-2 p-2 rounded-8px cursor-pointer
                      hover:bg-gray-50 border border-gray-100
                    '
                    >
                      {p.firstThumb ? (
                        <img src={resolveFileUrl(p.firstThumb)} alt='' className='w-48px h-48px object-cover rounded-6px shrink-0' />
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
                            <NavLinks lng={p.lng} lat={p.lat} position={p.position} address={p.address} compact />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            !loading && <Empty className='mt-60px' image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.footprintEmpty')} />
          )}
        </div>
      </Spin>

      {/* 足迹统计分享卡 */}
      <ShareCardModal open={shareOpen} onClose={() => setShareOpen(false)} type='footprint' data={footprintCardData} />
    </BasicContent>
  )
}

export default Page
