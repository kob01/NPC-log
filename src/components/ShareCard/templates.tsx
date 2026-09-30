/**
 * 分享卡片模板注册表
 * - 每张卡片是固定尺寸（宽 360px）的纯展示 DOM，用内联样式渲染，
 *   以便 html-to-image 导出时不依赖外部样式表（Tailwind/Uno class 复制不可靠）。
 * - Phase 1 仅实现 single；summary / footprint 暂复用 single 布局，Phase 2 再各自细化。
 */
import { useEffect, useState } from 'react'

import type { FC, CSSProperties } from 'react'

import { resolveFileUrl } from '@/utils/config'

/** 分享卡片图片项 */
export interface ShareCardImage {
  url?: string
  thumbUrl?: string
}

/** AI 改写后的社媒文案 */
export interface ShareCopy {
  title?: string
  body?: string
  hashtags?: string[]
}

/** 卡片承载的数据（单篇日记详情 + AI 文案） */
export interface CardData {
  id?: string
  time?: string
  event?: string
  type?: string
  content?: string
  summary?: string
  feeling?: string
  position?: string | null
  address?: string | null
  tags?: string[]
  persons?: string[]
  images?: ShareCardImage[]
  author?: string
  copy?: ShareCopy
}

export type CardType = 'single' | 'summary' | 'footprint'

export interface TemplateProps {
  data: CardData
  /** 导出因图片跨域失败时降级隐藏图片 */
  hideImages?: boolean
  /** 水印文案（来自 i18n） */
  watermark: string
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: 360,
    boxSizing: 'border-box',
    background: 'linear-gradient(160deg, #fdfbfb 0%, #ebedee 100%)',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
    color: '#2c3e50',
  },
  /** 横图在上：全宽自然高度，不用 objectFit（html-to-image 导出时会忽略它导致拉伸） */
  coverH: { width: '100%', height: 'auto', display: 'block' },
  /** 竖图在左：图文双栏 */
  vWrap: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 8px' },
  vImg: { width: 108, height: 'auto', display: 'block', borderRadius: 10, flexShrink: 0 },
  vText: { flex: 1, minWidth: 0 },
  body: { padding: '18px 20px 8px' },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 8,
  },
  typeTag: {
    background: '#e8f3ff',
    color: '#1677ff',
    borderRadius: 10,
    padding: '1px 8px',
    fontSize: 12,
  },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1.4, margin: '4px 0 10px' },
  text: { fontSize: 14, lineHeight: 1.7, color: '#4a5568', whiteSpace: 'pre-wrap', margin: 0 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0 4px' },
  tag: { color: '#1677ff', fontSize: 13 },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px 18px',
    marginTop: 12,
    borderTop: '1px solid rgba(0,0,0,0.06)',
    fontSize: 12,
    color: '#a0aec0',
  },
  place: { display: 'flex', alignItems: 'center', gap: 4, color: '#e05a5a' },
}

/** 单篇日记分享卡：横图在上、竖图在左，均保持原图宽高比不拉伸 */
export const SingleCard: FC<TemplateProps> = ({ data, hideImages, watermark }) => {
  const cover = (data.images || [])
    .map((img) => resolveFileUrl(img.url || img.thumbUrl))
    .filter(Boolean)[0]
  const title = data.copy?.title || data.event || ''
  const body = data.copy?.body || data.summary || (data.content || '').slice(0, 200) || ''
  const hashtags = data.copy?.hashtags || []
  const place = data.position || data.address || ''

  // 预加载探测封面横竖（加载前默认横图）
  const [vertical, setVertical] = useState(false)
  useEffect(() => {
    if (!cover) {
      setVertical(false)
      return
    }
    let alive = true
    const probe = new Image()
    probe.onload = () => {
      if (alive) {
        setVertical(probe.naturalHeight > probe.naturalWidth)
      }
    }
    probe.onerror = () => {
      if (alive) {
        setVertical(false)
      }
    }
    probe.src = cover
    return () => {
      alive = false
    }
  }, [cover])

  const textBlock = (
    <>
      <div style={styles.meta}>
        {data.type && <span style={styles.typeTag}>{data.type}</span>}
        <span>{data.time || ''}</span>
      </div>
      {title && <div style={styles.title}>{title}</div>}
      {body && <p style={styles.text}>{body}</p>}
      {hashtags.length > 0 && (
        <div style={styles.tags}>
          {hashtags.map((h, i) => (
            <span key={`${h}-${i}`} style={styles.tag}>
              {h}
            </span>
          ))}
        </div>
      )}
    </>
  )

  const footer = (
    <div style={styles.footer}>
      <span>{data.author ? `@${data.author}` : ''}</span>
      <div style={styles.place}>
        {place && <span>📍 {place}</span>}
        <span style={{ marginLeft: 8, color: '#c0c6cf' }}>{watermark}</span>
      </div>
    </div>
  )

  const showCover = !hideImages && !!cover

  if (showCover && vertical) {
    // 竖图在左，文案排在右侧
    return (
      <div style={styles.card}>
        <div style={styles.vWrap}>
          <img style={styles.vImg} src={cover} alt='' />
          <div style={styles.vText}>{textBlock}</div>
        </div>
        {footer}
      </div>
    )
  }

  // 横图在上（或无图/隐藏图）
  return (
    <div style={styles.card}>
      {showCover && <img style={styles.coverH} src={cover} alt='' />}
      <div style={styles.body}>{textBlock}</div>
      {footer}
    </div>
  )
}

/**
 * 模板注册表：Phase 2 为 summary / footprint 提供独立实现时替换对应项即可。
 * 当前 summary / footprint 复用 single 布局。
 */
export const CARD_TEMPLATES: Record<CardType, FC<TemplateProps>> = {
  single: SingleCard,
  summary: SingleCard,
  footprint: SingleCard,
}
