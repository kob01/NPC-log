import { DeleteOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space, Tag } from 'antd'
import { useTranslation } from 'react-i18next'

import type { LinkPlatform } from '@/servers/content/event'
import type { ClipboardEvent } from 'react'

/** 受控值：单条作品链接 */
export interface LinkListValue {
  platform: LinkPlatform
  url: string
  title?: string
}

export interface LinkListProps {
  /** 受控值 */
  value?: LinkListValue[]
  /** 值变更回调 */
  onChange?: (value: LinkListValue[]) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 最多链接数，默认不限制 */
  maxCount?: number
}

/** 从任意文本（含分享文案）中提取首个 http(s) 链接 */
export function extractUrl(text: string): string | null {
  if (!text) {
    return null
  }
  const matched = text.match(/https?:\/\/[^\s，,、"'<>）)]+/i)
  return matched ? matched[0].replace(/[.,;!?]+$/, '') : null
}

/** 按域名推断平台 */
export function inferPlatform(url: string): LinkPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (/(^|\.)douyin\.com$|iesdouyin\.com/.test(host)) {
      return 'douyin'
    }
    if (/(^|\.)xiaohongshu\.com$|xhslink\.com/.test(host)) {
      return 'xiaohongshu'
    }
  } catch {
    // 非法 URL，按其他处理
  }
  return 'other'
}

/** 基本 URL 校验：必须以 http:// 或 https:// 开头 */
export function isValidLinkUrl(url: string): boolean {
  return /^https?:\/\/.+/i.test((url || '').trim())
}

/**
 * 作品链接列表（可增删，粘贴自动识别平台）
 * - 受控 value/onChange，可接入 BasicForm 或 antd Form.Item
 */
const LinkList = (props: LinkListProps) => {
  const { value, onChange, disabled = false, maxCount } = props
  const { t } = useTranslation()

  const list = value || []

  // 平台下拉选项
  const platformOptions: { label: string; value: LinkPlatform }[] = [
    { label: t('content.platformDouyin'), value: 'douyin' },
    { label: t('content.platformXiaohongshu'), value: 'xiaohongshu' },
    { label: t('content.platformOther'), value: 'other' },
  ]

  /** 提交新值 */
  const emit = (next: LinkListValue[]) => {
    onChange?.(next)
  }

  /**
   * 更新某一行字段
   * @param index - 行索引
   * @param patch - 变更字段
   */
  const updateRow = (index: number, patch: Partial<LinkListValue>) => {
    const next = list.map((item, i) => (i === index ? { ...item, ...patch } : item))
    emit(next)
  }

  /** 新增一行 */
  const onAdd = () => {
    if (maxCount !== undefined && list.length >= maxCount) {
      return
    }
    emit([...list, { platform: 'other', url: '', title: '' }])
  }

  /**
   * 删除某一行
   * @param index - 行索引
   */
  const onRemove = (index: number) => {
    emit(list.filter((_, i) => i !== index))
  }

  /**
   * 粘贴自动识别：从分享文案/URL 中提取链接并推断平台
   * @param index - 行索引
   * @param e - 粘贴事件
   */
  const onPaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    const url = extractUrl(text)
    if (url) {
      e.preventDefault()
      updateRow(index, { url, platform: inferPlatform(url) })
    }
  }

  /**
   * URL 输入变化：填入时若明显匹配抖音/小红书域名则自动纠正平台
   * @param index - 行索引
   * @param url - 输入值
   */
  const onUrlChange = (index: number, url: string) => {
    const current = list[index]
    const detected = inferPlatform(url)
    const patch: Partial<LinkListValue> = { url }
    if (detected !== 'other' && current?.platform === 'other') {
      patch.platform = detected
    }
    updateRow(index, patch)
  }

  return (
    <div style={{ width: '100%' }}>
      <Space direction='vertical' style={{ width: '100%' }} size={8}>
        {list.map((item, index) => {
          const urlError = !!item.url && !isValidLinkUrl(item.url)
          return (
            // eslint-disable-next-line react/no-array-index-key
            <Space key={index} align='start' style={{ width: '100%' }} wrap>
              <Select<LinkPlatform>
                value={item.platform}
                options={platformOptions}
                disabled={disabled}
                style={{ width: 110 }}
                onChange={(platform) => updateRow(index, { platform })}
              />
              <Input
                value={item.url}
                disabled={disabled}
                status={urlError ? 'error' : undefined}
                placeholder={t('content.linkUrlPlaceholder')}
                style={{ width: 260 }}
                onChange={(e) => onUrlChange(index, e.target.value)}
                onPaste={(e) => onPaste(index, e)}
              />
              <Input
                value={item.title}
                disabled={disabled}
                placeholder={t('content.linkTitlePlaceholder')}
                style={{ width: 180 }}
                onChange={(e) => updateRow(index, { title: e.target.value })}
              />
              {!disabled && <Button type='text' danger icon={<DeleteOutlined />} onClick={() => onRemove(index)} />}
              {urlError && <div style={{ color: '#ff4d4f', fontSize: 12, width: '100%' }}>{t('content.linkUrlInvalid')}</div>}
            </Space>
          )
        })}
      </Space>

      {!disabled && (maxCount === undefined || list.length < maxCount) && (
        <Button type='dashed' icon={<PlusOutlined />} onClick={onAdd} style={{ marginTop: list.length ? 8 : 0, width: '100%' }}>
          {t('content.linkAdd')}
        </Button>
      )}
    </div>
  )
}

/** 平台标签颜色 */
const PLATFORM_COLOR: Record<LinkPlatform, string> = {
  douyin: '#161823',
  xiaohongshu: '#ff2442',
  other: '#8c8c8c',
}

export interface LinkListReadonlyProps {
  /** 链接列表 */
  links?: LinkListValue[] | null
  /** 无数据时展示的占位符 */
  emptyText?: string
}

/**
 * 只读展示模式：平台图标 + 标题，点击新窗口打开
 * 供列表/详情/移动端复用（H5 下这类链接可唤起对应 App）
 */
export const LinkListReadonly = (props: LinkListReadonlyProps) => {
  const { links, emptyText = '-' } = props
  const { t } = useTranslation()

  if (!links || links.length === 0) {
    return <span>{emptyText}</span>
  }

  const platformLabel = (platform: LinkPlatform) => {
    if (platform === 'douyin') {
      return t('content.platformDouyin')
    }
    if (platform === 'xiaohongshu') {
      return t('content.platformXiaohongshu')
    }
    return t('content.platformOther')
  }

  return (
    <Space direction='vertical' size={4}>
      {links.map((item, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <a key={index} href={item.url} target='_blank' rel='noopener noreferrer' style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Tag color={PLATFORM_COLOR[item.platform] || '#8c8c8c'} style={{ marginRight: 0 }}>
            <LinkOutlined /> {platformLabel(item.platform)}
          </Tag>
          <span>{item.title || item.url}</span>
        </a>
      ))}
    </Space>
  )
}

export default LinkList
