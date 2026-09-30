/**
 * 社媒分享卡片弹窗
 * - 打开时按所选平台调用后端 AI 改写文案，支持「换一版」重生成
 * - 「保存图片」用 html-to-image 把卡片 DOM 导出为 PNG 下载；
 *   若因图片跨域导致 tainted canvas 失败，自动降级为「不含照片版」重试
 * - 「复制文案」把标题 + 正文 + 话题标签拼成纯文本写入剪贴板
 */
import { Button, Modal, Segmented, Spin, message } from 'antd'
import { toPng } from 'html-to-image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CARD_TEMPLATES } from './templates'

import type { CardData, CardType } from './templates'
import type { ShareCopyResult, SocialPlatform } from '@/servers/content/event'

import { createShareLink, generateEventShareCopy } from '@/servers/content/event'

interface ShareCardModalProps {
  open: boolean
  onClose: () => void
  /** 卡片基础数据；type=single 时用 id 请求 AI 文案 */
  data: CardData
  /** 卡片模板类型，Phase 2 支持 summary / footprint */
  type?: CardType
  /** 自定义文案来源（供总结/足迹卡片复用）；不传则 single 默认用 data.id 请求日志接口 */
  getCopy?: (platform: SocialPlatform) => Promise<ShareCopyResult | null>
}

const ShareCardModal = ({ open, onClose, data, type = 'single', getCopy }: ShareCardModalProps) => {
  const { t } = useTranslation()
  const [platform, setPlatform] = useState<SocialPlatform>('xiaohongshu')
  const [copy, setCopy] = useState<CardData['copy']>()
  const [degraded, setDegraded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const nodeRef = useRef<HTMLDivElement>(null)

  const Template = CARD_TEMPLATES[type]

  const platformOptions = useMemo(
    () => [
      { label: t('content.platformXiaohongshu'), value: 'xiaohongshu' },
      { label: t('content.platformMoments'), value: 'moments' },
      { label: t('content.platformWeibo'), value: 'weibo' },
    ],
    [t],
  )

  const loadCopy = useCallback(
    async (target: SocialPlatform) => {
      // 无自定义来源且无 id（如足迹统计卡）→ 直接用传入的预置文案
      if (!getCopy && !data.id) {
        setCopy(data.copy)
        setDegraded(false)
        return
      }
      setLoading(true)
      try {
        let resp: ShareCopyResult | null = null
        if (getCopy) {
          resp = await getCopy(target)
        } else {
          const { code, data: r } = await generateEventShareCopy({
            id: String(data.id),
            platform: target,
          })
          if (Number(code) === 200 && r) {
            resp = r
          }
        }
        if (resp) {
          setCopy({ title: resp.title, body: resp.body, hashtags: resp.hashtags })
          setDegraded(!!resp.degraded)
        } else {
          message.error(t('content.shareLoadFailed'))
        }
      } catch (error) {
        console.error('生成分享文案失败:', error)
        message.error(t('content.shareLoadFailed'))
      } finally {
        setLoading(false)
      }
    },
    [data.id, data.copy, getCopy, t],
  )

  // 打开或切换平台时重新生成文案
  useEffect(() => {
    if (open) {
      loadCopy(platform)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, platform])

  const cardData: CardData = useMemo(() => ({ ...data, copy }), [data, copy])

  /** 组合纯文本文案 */
  const buildPlainText = () => {
    const parts = [copy?.title, copy?.body, (copy?.hashtags || []).join(' ')]
    return parts.filter(Boolean).join('\n\n')
  }

  const onCopyText = async () => {
    const text = buildPlainText()
    if (!text) {
      message.warning(t('content.shareLoadFailed'))
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      message.success(t('content.shareCopySuccess'))
    } catch (error) {
      console.error('复制失败:', error)
      message.error(t('content.shareLoadFailed'))
    }
  }

  /** 生成公开分享链接（仅单篇日志）并复制到剪贴板 */
  const onGenerateLink = async () => {
    if (!data.id) {
      return
    }
    try {
      const { code, data: resp, message: msg } = await createShareLink(String(data.id))
      if (Number(code) === 200 && resp?.link) {
        try {
          await navigator.clipboard.writeText(resp.link)
        } catch (err) {
          console.error('复制链接失败:', err)
        }
        message.success(t('content.shareLinkSuccess'))
      } else {
        message.error(msg || t('content.shareLoadFailed'))
      }
    } catch (error) {
      console.error('生成分享链接失败:', error)
      message.error(t('content.shareLoadFailed'))
    }
  }

  /** 把卡片 DOM 导出为 PNG dataURL；excludeImages=true 时同步过滤掉所有 <img>（跨域降级） */
  const exportPng = async (excludeImages: boolean) => {
    const node = nodeRef.current
    if (!node) {
      throw new Error('card node not ready')
    }
    const filter = excludeImages ? (n: HTMLElement) => !(n instanceof HTMLImageElement) : undefined
    return toPng(node, { cacheBust: true, pixelRatio: 2, filter })
  }

  const triggerDownload = (url: string) => {
    const a = document.createElement('a')
    a.download = `npc-share-${data.id || Date.now()}.png`
    a.href = url
    a.click()
  }

  /** 保存：先按含图导出，失败（多为图片跨域污染画布）则去图重试一次 */
  const onSaveImage = async () => {
    setSaving(true)
    try {
      triggerDownload(await exportPng(false))
      message.success(t('content.shareSaveOk'))
    } catch (error) {
      console.error('海报导出失败，尝试去图降级:', error)
      try {
        triggerDownload(await exportPng(true))
        message.success(t('content.shareSaveOk'))
      } catch (err2) {
        console.error('去图降级导出仍失败:', err2)
        message.error(t('content.shareSaveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onCancel={onClose} title={t('content.shareTitle')} footer={null} width={420} destroyOnClose>
      <div className='flex justify-center mb-3'>
        <Segmented options={platformOptions} value={platform} onChange={(val) => setPlatform(val as SocialPlatform)} />
      </div>

      {degraded && <div className='text-12px text-amber-500 text-center mb-2'>{t('content.shareDegraded')}</div>}

      {/* 卡片预览（外层可滚动，内层固定 360px 宽） */}
      <div className='flex justify-center overflow-auto py-2' style={{ maxHeight: '52vh' }}>
        <Spin spinning={loading} tip={t('content.shareGenerating')}>
          <div ref={nodeRef} style={{ display: 'inline-block' }}>
            <Template data={cardData} watermark={t('content.shareWatermark')} />
          </div>
        </Spin>
      </div>

      <div className='flex gap-2 mt-4'>
        <Button onClick={() => loadCopy(platform)} loading={loading}>
          {t('content.shareRegenerate')}
        </Button>
        <Button onClick={onCopyText}>{t('content.shareCopyText')}</Button>
        {type === 'single' && data.id && <Button onClick={onGenerateLink}>{t('content.shareLinkBtn')}</Button>}
        <Button type='primary' className='flex-1' onClick={onSaveImage} loading={saving}>
          {t('content.shareSaveImage')}
        </Button>
      </div>
    </Modal>
  )
}

export default ShareCardModal
