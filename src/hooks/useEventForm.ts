import { message } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { FormData } from '#/form'
import type { ImageUploadValue } from '@/components/ImageUpload'
import type { LinkListValue } from '@/components/LinkList'
import type { LocationValue } from '@/components/LocationPicker'
import type { EventPayload } from '@/servers/content/event'

import { isValidLinkUrl } from '@/components/LinkList'
import { getNPCEventById, createNPCEvent, updateNPCEvent } from '@/servers/content/event'
import { getMyOrgs } from '@/servers/system/organization'

/** 新增日志的初始值 */
export const INIT_EVENT_FORM: FormData = {
  time: dayjs().format('YYYY-MM-DD HH:mm'),
  event: '',
  type: '',
  content: '',
  rating: '',
  feeling: '',
  experience: '',
  location: { position: null, address: null, lng: null, lat: null },
  witness: '',
  visibility: 0,
  visibleOrgIds: [],
  images: [],
  links: [],
}

/** AI 解析结果（只读展示，不参与提交） */
export interface EventAiInfo {
  summary?: string
  tags?: string[]
  persons?: string[]
  aiStatus?: number
}

/** 提交失败时暂存草稿，避免已填内容丢失 */
const DRAFT_KEY = 'values'

/** 安全解析本地草稿：空值/被写成 'null' 的脏数据都视为无草稿 */
function readDraft(): FormData | null {
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as FormData) : null
  } catch {
    return null
  }
}

/**
 * 日志新增/编辑的共享表单逻辑
 *
 * 桌面端 pages/content/log/option.tsx 与移动端 pages/m/edit.tsx 复用同一套
 * 数据装配与提交规则：后端契约里 position/lng/lat/address 是四个平铺字段，
 * 表单里却是一个 location 复合对象，来回转换只应有一处实现。
 *
 * @param id - 日志 id，为空表示新增
 */
export function useEventForm(id?: string | null) {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(false)
  const [data, setData] = useState<FormData>(INIT_EVENT_FORM)
  const [aiInfo, setAiInfo] = useState<EventAiInfo | null>(null)
  const [orgOptions, setOrgOptions] = useState<{ label: string; value: number }[]>([])
  // 是否已从照片 EXIF 自动识别到位置
  const [gpsTip, setGpsTip] = useState(false)
  // EXIF GPS 坐标（GCJ-02），传给 LocationPicker 的 initialCoordinate
  const [exifCoord, setExifCoord] = useState<{ lng: number; lat: number } | null>(null)

  // 加载“我加入的组织”（仅已通过）作为可见组织选项
  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const { code, data: resp } = await getMyOrgs()
        if (Number(code) === 200) {
          setOrgOptions(
            (resp || [])
              .filter((o: FormData) => Number(o.my_status) === 1)
              .map((o: FormData) => ({ label: o.org_name as string, value: o.id as number })),
          )
        }
      } catch (error) {
        console.error('获取我的组织失败:', error)
      }
    }
    loadOrgs()
  }, [])

  // 详情回填 / 新增初始化
  useEffect(() => {
    if (!id) {
      setData(INIT_EVENT_FORM)
      setAiInfo(null)
      // 新增场景下允许恢复上次提交失败留下的草稿
      const draft = readDraft()
      if (draft) {
        setData(draft)
      }
      return
    }
    const load = async () => {
      try {
        setLoading(true)
        const { code, data: resp } = await getNPCEventById(id)
        if (Number(code) !== 200 || !resp) {
          return
        }
        // 将后端返回的 position/lng/lat/address 组装为 location 复合对象
        const formData: FormData = { ...resp }
        formData.location = {
          position: resp.position || null,
          address: resp.address || null,
          lng: resp.lng != null ? Number(resp.lng) : null,
          lat: resp.lat != null ? Number(resp.lat) : null,
        } as LocationValue
        // 移除旧的分散字段，避免干扰
        delete formData.position
        delete formData.lng
        delete formData.lat
        delete formData.address
        setData(formData)
        // 抽出 AI 字段做只读展示（不回填表单，避免提交时误覆盖）
        setAiInfo({
          summary: (resp.summary as string) || '',
          tags: (resp.tags as string[]) || [],
          persons: (resp.persons as string[]) || [],
          aiStatus: Number(resp.aiStatus ?? 0),
        })
      } catch (error) {
        console.error('获取日志详情失败:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  /**
   * 照片 EXIF 识别到 GPS 时传给 LocationPicker
   * @param gps - GCJ-02 坐标
   */
  const handleGpsExtracted = useCallback((gps: { lng: number; lat: number }) => {
    setExifCoord(gps)
    setGpsTip(true)
  }, [])

  /** 清除 EXIF 提示（提交成功后调用） */
  const resetGpsTip = useCallback(() => setGpsTip(false), [])

  /**
   * 构造提交 payload：将 location 复合对象拆解为 position/lng/lat/address
   * @param values - 表单原始值
   */
  const buildPayload = (values: FormData): FormData & Partial<EventPayload> => {
    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') {
        return null
      }
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }
    const rawImages = (values.images as ImageUploadValue[] | undefined) || []
    const rawLinks = (values.links as LinkListValue[] | undefined) || []
    const images = rawImages
      .filter((item) => item && item.url)
      .map((item, index) => ({
        url: item.url,
        thumbUrl: item.thumbUrl || item.url,
        sort: item.sort ?? index,
      }))
    const links = rawLinks
      .filter((item) => item && item.url && item.url.trim())
      .map((item) => ({
        platform: item.platform,
        url: item.url.trim(),
        title: (item.title || '').trim(),
      }))

    // 拆解 location 复合对象
    const loc = (values.location as LocationValue | undefined) || {}

    // 移除 location 字段，替换为后端契约的四个字段
    const { location: _loc, ...rest } = values
    void _loc

    return {
      ...rest,
      position: loc.position || '',
      lng: toNum(loc.lng),
      lat: toNum(loc.lat),
      address: loc.address || null,
      images,
      links,
    }
  }

  /**
   * 提交新增/编辑
   * @param values - 表单返回值
   * @returns 是否提交成功（失败时已保存草稿并提示原因）
   */
  const submit = async (values: FormData): Promise<boolean> => {
    // 链接格式校验：存在非法 URL 则提示且不提交
    const rawLinks = (values.links as LinkListValue[] | undefined) || []
    const hasInvalidLink = rawLinks.some((item) => item?.url && item.url.trim() && !isValidLinkUrl(item.url.trim()))
    if (hasInvalidLink) {
      message.error(t('content.linkUrlInvalid'))
      return false
    }
    try {
      setLoading(true)
      const payload = buildPayload(values)
      const { code, message: msg } = id ? await updateNPCEvent({ ...payload, id }) : await createNPCEvent(payload)
      if (Number(code) !== 200) {
        return false
      }
      message.success(msg || t('public.successfulOperation'), 3)
      setGpsTip(false)
      localStorage.setItem(DRAFT_KEY, 'null')
      return true
    } catch {
      // 网络/接口异常：留存草稿，用户可重试
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    isLoading,
    data,
    aiInfo,
    orgOptions,
    gpsTip,
    exifCoord,
    handleGpsExtracted,
    resetGpsTip,
    submit,
  }
}
