/**
 * 移动端详情页（/m/detail?id=）
 * - 大图浏览：Image.PreviewGroup 点击全屏
 * - 地点卡片：有坐标时提供高德驾车/公交/步行导航入口（唤起 App / 网页版）
 * - 底部编辑入口：跳 /m/edit，与桌面端共用同一套表单逻辑
 */
import { EditOutlined, EnvironmentOutlined, LeftOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Image, Spin, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import type { EventImageDetail } from '@/servers/content/event'

import NavLinks from '@/components/NavLinks'
import ShareCardModal from '@/components/ShareCard'
import { getNPCEventById } from '@/servers/content/event'
import { EMPTY_VALUE, resolveFileUrl } from '@/utils/config'
import { isMobileDevice } from '@/utils/device'
import { buildAmapNavigationUrl } from '@/utils/nav'

interface DetailData {
  time?: string
  event?: string
  type?: string
  content?: string
  rating?: string
  experience?: string
  position?: string
  address?: string | null
  lng?: number | null
  lat?: number | null
  witness?: string
  author?: string
  summary?: string
  tags?: string[]
  persons?: string[]
  images?: EventImageDetail[]
  links?: { id?: number; platform: string; url: string; title?: string }[]
  /** 随日志留存的录音（小程序录音录入产生） */
  audioUrl?: string | null
  audioDuration?: number | null
}

const MobileDetail = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // 用 useLocation 读 search（与桌面页一致，兼容未来 hash 路由）
  const { search } = useLocation()
  const id = new URLSearchParams(search).get('id')

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const { code, data: resp } = await getNPCEventById(id)
        if (Number(code) === 200 && resp) {
          setData(resp as DetailData)
        } else {
          setNotFound(true)
        }
      } catch (error) {
        console.error('加载详情失败:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className='flex justify-center items-center h-60vh'>
        <Spin tip={t('content.mobileLoading')} />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className='text-center mt-100px text-gray-500'>
        <p>{t('content.mobileNotFound')}</p>
        <button className='text-blue-500 bg-transparent border-none text-14px' onClick={() => navigate('/m')}>
          {t('content.mobileBackTimeline')}
        </button>
      </div>
    )
  }

  const images = (data.images || []).map((img) => resolveFileUrl(img.url || img.thumbUrl))
  const audioSrc = resolveFileUrl(data.audioUrl)
  const hasCoord = data.lng != null && data.lat != null
  const toNumber = (v: unknown) => Number(v)

  return (
    <div className='max-w-768px mx-auto px-3 py-3'>
      {/* 返回条 */}
      <div
        role='button'
        tabIndex={0}
        className='inline-flex items-center text-14px text-gray-600 mb-2 cursor-pointer'
        onClick={() => navigate('/m')}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/m')}
      >
        <LeftOutlined className='mr-1' /> {t('content.mobileBackTimeline')}
      </div>

      {/* 标题 + 元信息 */}
      <h2 className='text-18px font-bold text-gray-800 mt-1 mb-1'>{data.event || EMPTY_VALUE}</h2>
      <div className='flex flex-wrap items-center gap-2 text-12px text-gray-400 mb-3'>
        {data.type && (
          <Tag color='blue' style={{ marginRight: 0 }}>
            {data.type}
          </Tag>
        )}
        <span>{data.time || EMPTY_VALUE}</span>
        {data.author && <span>@{data.author}</span>}
        <button
          type='button'
          onClick={() => setShareOpen(true)}
          className='ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-12px text-white bg-blue-500 border-none cursor-pointer'
        >
          <ShareAltOutlined /> {t('content.shareBtn')}
        </button>
      </div>

      {/* AI 摘要 */}
      {data.summary && (
        <div className='p-3 mb-3 rounded-10px bg-blue-50 text-13px text-gray-700'>
          <span className='font-bold text-blue-500 mr-1'>{t('content.memoryAiSummary')}</span>
          {data.summary}
        </div>
      )}

      {/* 大图浏览 */}
      {images.length > 0 && (
        <div className='mb-3 rounded-10px overflow-hidden'>
          <Image.PreviewGroup>
            {images.length === 1 ? (
              <Image src={images[0]} alt='' className='w-full object-cover' style={{ maxHeight: '60vh' }} />
            ) : (
              <div className='grid grid-cols-3 gap-2'>
                {images.map((src, idx) => (
                  <Image key={`${src}-${idx}`} src={src} alt='' className='w-full aspect-square object-cover' style={{ borderRadius: 8 }} />
                ))}
              </div>
            )}
          </Image.PreviewGroup>
        </div>
      )}

      {/* 录音回放（小程序语音日志随条留存的录音；口语录音无字幕可提） */}
      {audioSrc && (
        <div className='p-3 mb-3 rounded-10px bg-gray-50'>
          <div className='text-12px font-bold text-gray-400 mb-1'>{t('content.mobileAudio')}</div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioSrc} controls preload='none' style={{ width: '100%', height: 40, display: 'block' }} />
        </div>
      )}

      {/* 正文区块 */}
      <Section title={t('content.mobileContent')} text={data.content} />
      <Section title={t('content.mobileExperience')} text={data.experience} />
      {data.rating && <Section title={t('content.mobileRating')} text={data.rating} />}
      {data.witness && <Section title={t('content.mobileWitness')} text={data.witness} />}

      {/* 标签 / 人物 */}
      {((data.tags || []).length > 0 || (data.persons || []).length > 0) && (
        <div className='flex flex-wrap gap-1 mt-3'>
          {(data.tags || []).map((tag) => (
            <Tag key={tag} color='geekblue' style={{ marginRight: 0 }}>
              {tag}
            </Tag>
          ))}
          {(data.persons || []).map((p) => (
            <Tag key={p} color='purple' style={{ marginRight: 0 }}>
              {p}
            </Tag>
          ))}
        </div>
      )}

      {/* 地点卡片：手机点击即唤起高德导航 */}
      {(hasCoord || data.position || data.address) && (
        <div className='mt-4 p-3 rounded-10px bg-white shadow-0_1px_4px_rgba(0,0,0,0.06)'>
          <div className='flex items-center text-13px font-bold text-gray-700 mb-2'>
            <EnvironmentOutlined className='mr-1 text-red-400' /> {t('content.mobileLocationCard')}
          </div>
          <div className='text-13px text-gray-600'>
            {data.position || data.address || EMPTY_VALUE}
            {data.address && data.position && data.address !== data.position && <div className='text-12px text-gray-400 mt-1'>{data.address}</div>}
          </div>
          {hasCoord ? (
            <div className='mt-3 flex flex-col gap-2'>
              {/* 手机端：主模式直达导航；其余模式备选 */}
              {isMobileDevice() ? (
                <>
                  <NavBtn
                    href={buildAmapNavigationUrl({
                      lng: toNumber(data.lng),
                      lat: toNumber(data.lat),
                      name: data.position || data.address,
                      mode: 'car',
                    })}
                    label={t('content.navDrive')}
                    primary
                  />
                  <div className='flex gap-2'>
                    <NavBtn
                      href={buildAmapNavigationUrl({
                        lng: toNumber(data.lng),
                        lat: toNumber(data.lat),
                        name: data.position || data.address,
                        mode: 'bus',
                      })}
                      label={t('content.navBus')}
                    />
                    <NavBtn
                      href={buildAmapNavigationUrl({
                        lng: toNumber(data.lng),
                        lat: toNumber(data.lat),
                        name: data.position || data.address,
                        mode: 'walk',
                      })}
                      label={t('content.navWalk')}
                    />
                  </div>
                </>
              ) : (
                <NavLinks lng={data.lng} lat={data.lat} position={data.position} address={data.address} />
              )}
            </div>
          ) : (
            <div className='mt-2'>
              <NavLinks position={data.position} address={data.address} />
            </div>
          )}
        </div>
      )}

      {/* 编辑入口 */}
      <div className='mt-5 pt-3 border-t border-gray-200'>
        <button
          type='button'
          onClick={() => navigate(`/m/edit?id=${id}`)}
          className='
            w-full flex items-center justify-center gap-1 py-2
            rounded-8px text-14px bg-blue-500 text-white
            border-none cursor-pointer
          '
        >
          <EditOutlined />
          {t('content.mobileEditBtn')}
        </button>
      </div>

      {/* 社媒分享卡片弹窗 */}
      <ShareCardModal open={shareOpen} onClose={() => setShareOpen(false)} data={{ ...data, id: id ?? undefined, images: data.images }} />
    </div>
  )
}

/**
 * 文本区块（空值不渲染）
 */
const Section = ({ title, text }: { title: string; text?: string }) => {
  if (!text) {
    return null
  }
  return (
    <div className='mb-3'>
      <div className='text-12px font-bold text-gray-400 mb-1'>{title}</div>
      <div className='text-14px text-gray-700 whitespace-pre-wrap'>{text}</div>
    </div>
  )
}

/**
 * 高德导航按钮（URI 深链，callnative=1 手机唤起 App）
 */
const NavBtn = ({ href, label, primary }: { href: string; label: string; primary?: boolean }) => (
  <a
    href={href}
    target='_blank'
    rel='noopener noreferrer'
    className={`
      flex-1 text-center py-2 rounded-8px text-14px no-underline
      ${primary ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}
    `}
  >
    {label}
  </a>
)

export default MobileDetail
