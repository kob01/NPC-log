/**
 * AI 超级记忆 - 接口封装
 * 说明：使用独立 axios 实例（不走全局 request 拦截器），
 * 避免 code:1（如"AI 未配置"）被全局拦截器弹红色错误提示，
 * 由调用方自行决定 UI 降级策略。
 *
 * 「只看自己」范围（逐请求 X-Only-Mine 头）：
 * - 分析类接口（问答/摘要/标签/年度回顾/人物图谱/地图足迹）恒带 X-Only-Mine，只统计本人数据；
 * - searchMemory 例外：它被移动端列表页（/m）的搜索框复用，范围要跟随列表筛选，故由调用方传 scope（all/mine/others/private）。
 */
import axios from 'axios'

import type { AxiosInstance } from 'axios'

import { API_PREFIX, ONLY_MINE_HEADER, TOKEN, VIEW_SCOPE_HEADER } from '@/utils/config'
import { getLocalInfo } from '@/utils/local'

import type { ScopeValue } from '@/utils/onlyMine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 记忆搜索结果单条 */
export interface MemorySearchItem {
  id: number
  time: string
  event: string
  type: string
  summary: string
  tags: string[]
  persons: string[]
  position: string
  address: string
  lng: number | null
  lat: number | null
  firstThumb: string | null
  score: number
}

/** 记忆搜索结果 */
export interface MemorySearchResult {
  list: MemorySearchItem[]
  total: number
}

/** AI 问答引用来源 */
export interface MemoryAskReference {
  id: number
  time: string
  event: string
  summary: string
}

/** AI 问答结果 */
export interface MemoryAskResult {
  answer: string
  references: MemoryAskReference[]
}

/** 月度摘要结果 */
export interface MemorySummaryResult {
  period: string
  summary: string
  keywords: string[]
  generatedAt: string | null
  cached: boolean
}

/** 标签计数项 */
export interface TagCountItem {
  tag: string
  count: number
}

/** 标签列表结果 */
export interface MemoryTagsResult {
  tags: TagCountItem[]
}

/** 年度回顾结果（统计聚合 + AI 年度总结，AI 未配置时 summary 为空但统计可用） */
export interface YearReportResult {
  year: number
  years: number[]
  eventCount: number
  monthCount: number
  summary: string
  keywords: string[]
  cached: boolean
  aiConfigured: boolean
  topTags: { tag: string; count: number }[]
  topPersons: { person: string; count: number }[]
  typeDist: { type: string; count: number }[]
  locatedCount: number
  months: { month: string; count: number; summary: string }[]
}

/** 人物图谱单个人物 */
export interface PersonItem {
  person: string
  count: number
  firstTime: string | null
  lastTime: string | null
  topTags: { tag: string; count: number }[]
}

/** 人物时间线结果 */
export interface PersonTimelineResult {
  person: string
  total: number
  years: { year: string; count: number }[]
  list: MemorySearchItem[]
}

/** 足迹撒点 */
export interface FootprintPoint {
  id: number
  time: string | null
  event: string
  type: string
  tags: string[]
  position: string
  address: string
  lng: number
  lat: number
  firstThumb: string | null
}

/** 地图足迹结果 */
export interface FootprintsResult {
  total: number
  years: { year: string; count: number }[]
  points: FootprintPoint[]
}

/** 统一响应结构 */
export interface MemoryResponse<T> {
  code: number
  message?: string
  data: T
}

// ---------------------------------------------------------------------------
// 独立 axios 实例（仅注入 token，不做全局错误弹窗）
// ---------------------------------------------------------------------------

const memoryRequest: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 60 * 1000,
})

memoryRequest.interceptors.request.use((config) => {
  // 生产临时指向本地 node 服务时，统一拼接 API 绝对前缀（与全局实例保持一致）
  if (API_PREFIX && typeof config.url === 'string' && config.url.startsWith('/')) {
    config.url = `${API_PREFIX}${config.url}`
  }
  const token = getLocalInfo<string>(TOKEN) || ''
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // 「只看自己」不再全局注入：改由各接口按需带 ONLY_MINE_HEADER（见下方各 API 函数）
  return config
})

/** 分析类接口恒定携带的「只看自己」请求头 */
const MINE_HEADERS = { [ONLY_MINE_HEADER]: '1' }

/** 按查看范围构造逐请求头：mine→X-Only-Mine；others/private→X-View-Scope；all→无 */
function scopeHeaders(scope?: ScopeValue): Record<string, string> | undefined {
  if (scope === 'others' || scope === 'private') return { [VIEW_SCOPE_HEADER]: scope }
  if (scope === 'mine') return { [ONLY_MINE_HEADER]: '1' }
  return undefined
}

// ---------------------------------------------------------------------------
// API 函数
// ---------------------------------------------------------------------------

const MEMORY_API = '/api/memory'

/** AI 未配置时后端返回的业务错误关键字 */
const AI_NOT_CONFIGURED_HINT = 'AI 未配置'

/**
 * 判断接口错误是否为“AI 未配置”降级场景
 * 桌面与移动端共用：命中时应展示灰色提示而非红色报错
 * @param msg - 后端 message
 */
export const isAiNotConfigured = (msg?: string) => !!msg && msg.includes(AI_NOT_CONFIGURED_HINT)

/**
 * 记忆搜索（不依赖 AI 密钥，LIKE + 全文检索）
 * @param q - 搜索关键词
 * @param limit - 返回条数，默认8，钳制1~20
 * @param scope - 查看范围：AI 回忆页传 'mine'，列表页搜索按列表筛选传（all/mine/others/private）
 */
export async function searchMemory(q: string, limit = 8, scope?: ScopeValue): Promise<MemoryResponse<MemorySearchResult>> {
  const headers = scopeHeaders(scope)
  const { data } = await memoryRequest.get<MemoryResponse<MemorySearchResult>>(`${MEMORY_API}/search`, {
    params: { q, limit },
    ...(headers ? { headers } : {}),
  })
  return data
}

/**
 * AI 问答（依赖 AI 密钥，未配置时 code:1）——恒定只看自己
 * @param question - 问题
 * @param limit - 引用条数，默认8
 */
export async function askMemory(question: string, limit = 8): Promise<MemoryResponse<MemoryAskResult>> {
  const { data } = await memoryRequest.post<MemoryResponse<MemoryAskResult>>(
    `${MEMORY_API}/ask`,
    {
      question,
      limit,
    },
    {
      headers: MINE_HEADERS,
    },
  )
  return data
}

/**
 * 月度摘要（依赖 AI 密钥，未配置且当月有日志时 code:1）——恒定只看自己
 * @param month - 格式 YYYY-MM，缺省为当月
 */
export async function getMemorySummary(month?: string): Promise<MemoryResponse<MemorySummaryResult>> {
  const params = month ? { month } : {}
  const { data } = await memoryRequest.get<MemoryResponse<MemorySummaryResult>>(`${MEMORY_API}/summary`, { params, headers: MINE_HEADERS })
  return data
}

/**
 * 热门标签列表（不依赖 AI 密钥，但标签由 AI 抽取产生，未配置时可能为空）——恒定只看自己
 */
export async function getMemoryTags(): Promise<MemoryResponse<MemoryTagsResult>> {
  const { data } = await memoryRequest.get<MemoryResponse<MemoryTagsResult>>(`${MEMORY_API}/tags`, { headers: MINE_HEADERS })
  return data
}

/**
 * 年度回顾（统计部分不依赖 AI；AI 总结懒生成后缓存，重复请求命中缓存）——恒定只看自己
 * @param year - 年份 YYYY，缺省为当年
 */
export async function getYearReport(year?: number | string): Promise<MemoryResponse<YearReportResult>> {
  const params = year ? { year } : {}
  const { data } = await memoryRequest.get<MemoryResponse<YearReportResult>>(`${MEMORY_API}/report`, { params, headers: MINE_HEADERS })
  return data
}

/**
 * 人物图谱列表（按 event_persons 聚合，不依赖 AI 密钥但人物由 AI 抽取）——恒定只看自己
 */
export async function getMemoryPersons(): Promise<MemoryResponse<{ persons: PersonItem[] }>> {
  const { data } = await memoryRequest.get<MemoryResponse<{ persons: PersonItem[] }>>(`${MEMORY_API}/persons`, { headers: MINE_HEADERS })
  return data
}

/**
 * 某人相关日志时间线——恒定只看自己
 * @param name - 人物称呼（精确匹配 CSV 边界）
 * @param year - 可选年份过滤
 */
export async function getPersonTimeline(name: string, year?: number | string): Promise<MemoryResponse<PersonTimelineResult>> {
  const params: Record<string, string | number> = { name }
  if (year) {
    params.year = year
  }
  const { data } = await memoryRequest.get<MemoryResponse<PersonTimelineResult>>(`${MEMORY_API}/person`, { params, headers: MINE_HEADERS })
  return data
}

/**
 * 地图足迹（带坐标的可见日志）——恒定只看自己
 * @param filters.year - 年份
 * @param filters.tag - 标签关键词
 */
export async function getFootprints(
  filters: {
    year?: number | string
    tag?: string
  } = {},
): Promise<MemoryResponse<FootprintsResult>> {
  const { data } = await memoryRequest.get<MemoryResponse<FootprintsResult>>(`${MEMORY_API}/footprints`, { params: filters, headers: MINE_HEADERS })
  return data
}
