import axios from 'axios'

import type { FormData } from '#/form'
import type { PageServerResult, PaginationData } from '#/public'

import { request } from '@/servers/request'
import { FILE_API, TOKEN } from '@/utils/config'
import { getLocalInfo } from '@/utils/local'

enum API {
  URL = '/api/event',
}

/** 作品链接平台 */
export type LinkPlatform = 'douyin' | 'xiaohongshu' | 'other'

/** 日志图片项（提交用） */
export interface EventImageItem {
  url: string
  thumbUrl?: string
  sort?: number
}

/** 日志图片项（详情/列表返回，带 id） */
export interface EventImageDetail extends EventImageItem {
  id?: number
}

/** 作品链接项（提交用） */
export interface EventLinkItem {
  platform: LinkPlatform
  url: string
  title?: string
}

/** 作品链接项（详情/列表返回，带 id） */
export interface EventLinkDetail extends EventLinkItem {
  id?: number
}

/** 日志新增/编辑提交数据 */
export interface EventPayload {
  id?: string
  time?: string
  event?: string
  type?: string
  content?: string
  rating?: string
  feeling?: string
  experience?: string
  position?: string
  witness?: string
  visibility?: number
  visibleOrgIds?: number[]
  // 地点坐标（GCJ-02），由 EXIF 自动识别，可为空
  lng?: number | null
  lat?: number | null
  address?: string | null
  // AI 标签/人物，前端可传，后端亦会自行抽取
  tags?: string[] | null
  persons?: string[] | null
  // 随日志一起全量覆盖式保存
  images?: EventImageItem[] | null
  links?: EventLinkItem[] | null
}

/** 列表单条返回数据（在日志基础字段上追加媒体聚合字段） */
export interface EventListItem extends FormData {
  id: string
  is_mine?: boolean
  firstThumb?: string | null
  imageCount?: number
  firstLink?: EventLinkDetail | null
  linkCount?: number
  tags?: string[]
  summary?: string
  address?: string | null
  lng?: number | null
  lat?: number | null
  aiStatus?: number
}

/**
 * 获取分页数据
 * @param data - 请求数据
 */
export function getNPCEventPage(data: Partial<FormData> & PaginationData) {
  return request.get<PageServerResult<EventListItem[]>>(`${API.URL}/list`, {
    params: data,
  })
}

/**
 * 获取所有数据（导出用）
 * @param data - 请求数据
 */
export function getAllNPCEvents(data: Partial<FormData>) {
  return request.get<FormData[]>(`${API.URL}/export`, {
    params: data,
  })
}

/**
 * 根据ID获取数据
 * @param id - ID
 */
export function getNPCEventById(id: string) {
  return request.get<FormData>(`${API.URL}/detail?id=${id}`)
}

/**
 * 新增数据
 * @param data - 请求数据
 */
export function createNPCEvent(data: FormData & Partial<EventPayload>) {
  return request.post(API.URL, data)
}

/**
 * 修改数据
 * @param data - 请求数据
 */
export function updateNPCEvent(data: FormData & Partial<EventPayload>) {
  return request.put(`${API.URL}`, data)
}

/**
 * 删除
 * @param id - 删除id值
 */
export function deleteNPCEvent(id: string) {
  return request.delete(`${API.URL}?id=${id}`)
}

/**
 * 批量获取多条日志的图片（移动端时间线缩略图用）
 * 复用单条详情接口并发拉取，前端限制 ids 长度；
 * 后端未提供批量图片接口，此处并发控制在 6 个以内避免惊群。
 * @param ids - 日志ID列表
 * @returns eventId → images 的映射
 */
export async function getNPCEventImages(
  ids: (string | number)[]
): Promise<Record<string, EventImageDetail[]>> {
  const result: Record<string, EventImageDetail[]> = {}
  const queue = [...ids]
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift()
      if (id === undefined || id === null) {
        continue
      }
      try {
        const { code, data } = await getNPCEventById(String(id))
        if (Number(code) === 200) {
          result[String(id)] = (data?.images as EventImageDetail[]) || []
        }
      } catch (error) {
        console.error(`获取日志 ${id} 图片失败:`, error)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, ids.length) }, worker))
  return result
}

/**
 * 上传单张图片（压缩后由调用方传入 Blob）
 * 说明：不复用共享 request 实例，避免其"重复请求取消"逻辑在并发上传时误伤；
 * 单独用 axios 携带 Authorization 直传，返回相对路径 { url, thumbUrl }。
 * @param file - 已压缩的图片 Blob/File
 * @param fileName - 文件名（可选）
 */
export async function uploadEventImage(
  file: Blob,
  fileName = 'image.webp'
): Promise<{ url: string; thumbUrl: string }> {
  const form = new FormData()
  form.append('file', file, fileName)
  const token = getLocalInfo<string>(TOKEN) || ''
  const { data } = await axios.post<{
    code: number
    message?: string
    errno?: number
    data?: { url: string; thumbUrl?: string }
  }>(FILE_API, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (Number(data?.code) !== 200 || !data?.data?.url) {
    throw new Error(data?.message || '图片上传失败')
  }
  return { url: data.data.url, thumbUrl: data.data.thumbUrl || data.data.url }
}

/* ------------------------------------------------------------------ *
 * 以下为独立的图片/链接关联接口封装（备用）
 * 本任务优先使用"随日志一起提交 images/links"的内联方式，
 * 这些独立接口仅在需要单独增删某条媒体时使用。
 * ------------------------------------------------------------------ */

/**
 * 为日志新增图片（独立接口，备用）
 * @param eventId - 日志ID
 * @param images - 图片列表
 */
export function addEventImages(eventId: string, images: EventImageItem[]) {
  return request.post(`${API.URL}/images`, { eventId, images })
}

/**
 * 删除日志图片（独立接口，备用）
 * @param id - 图片记录ID
 */
export function deleteEventImage(id: string | number) {
  return request.delete(`${API.URL}/images?id=${id}`)
}

/**
 * 为日志新增作品链接（独立接口，备用）
 * @param eventId - 日志ID
 * @param links - 链接列表
 */
export function addEventLinks(eventId: string, links: EventLinkItem[]) {
  return request.post(`${API.URL}/links`, { eventId, links })
}

/**
 * 删除日志作品链接（独立接口，备用）
 * @param id - 链接记录ID
 */
export function deleteEventLink(id: string | number) {
  return request.delete(`${API.URL}/links?id=${id}`)
}
