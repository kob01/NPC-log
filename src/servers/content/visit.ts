/**
 * 小程序访问记录 - 接口封装（仅管理员）
 *
 * 数据来自 note_app_visit：小程序 App.onShow 上报一次「点开」插一行，
 * App.onHide 收尾回填同一行，所以「一次前台 = 一行」，点开次数就按 openTime 数。
 *
 * 两个必须记住的口径（页面上的展示规则都是从这两条推出来的）：
 * 1. **时间是数据库墙钟（+08:00）字符串**，前端只做切片展示，绝不 new Date 解析 ——
 *    浏览器与服务器时区不一致时，解析一次就把所有时间整体挪几个小时。
 * 2. **durationSec 可能为 null**：status=3（未等到关闭上报）的行是真的不知道结束时刻，
 *    后端故意留 NULL 而不是编一个时长；页面必须显示成「未知」而不是 0 秒。
 *
 * 列表接口不返回 raw_payload/ua 等大字段（一行几百字节，50 行一页就是白传几百 KB），
 * 点开详情时再按 id 单取一次 getVisitDetail。
 */
import type { PageServerResult, PaginationData } from '#/public'

import { request } from '@/servers/request'

enum API {
  URL = '/api/visit',
}

/** 行状态：1 前台进行中 / 2 已正常关闭 / 3 未等到关闭上报（被杀、断网、崩溃） */
export const VISIT_STATUS = {
  RUNNING: 1,
  CLOSED: 2,
  INTERRUPTED: 3,
} as const

/** 小程序版本环境（develop 开发版 / trial 体验版 / release 线上版） */
export type VisitEnvVersion = 'develop' | 'trial' | 'release'

/** 列表行（字段与后端 toListRow 一一对应） */
export interface VisitItem {
  id: number
  visitKey: string
  /** 登录账号ID；匿名行为 null */
  userId: number | null
  /** 登录名快照（账号注销后仍可读）；匿名行为空串 */
  username: string
  /** 昵称取的是库里的当前值，只用于帮管理员认出「这串账号是谁」 */
  nickName: string
  /** 0 普通 / 1 管理员（token 快照）；匿名行为 null，不是 0 */
  accountType: number | null
  isLogin: boolean
  status: number
  openTime: string
  closeTime: string
  /** 停留秒数；未关闭为 null */
  durationSec: number | null
  /** 服务端墙钟 - 端上时钟（毫秒）：绝对值大说明本机时间被改过或跨时区 */
  clockDiffMs: number | null
  coldStart: boolean
  foregroundIndex: number | null
  lastRoute: string
  scene: number | null
  sceneLabel: string
  launchPath: string
  hasShareTicket: boolean
  netType: string
  brand: string
  model: string
  platform: string
  osVersion: string
  envVersion: string
  mpVersion: string
  sdkVersion: string
  wxVersion: string
  batteryLevel: number | null
  /** 1 充电中 / 0 没充电 / null 没上报（老版本小程序） */
  batteryCharging: number | null
  theme: string
  language: string
  ip: string
}

/** 详情行：列表字段之外再补上大字段与设备细项 */
export interface VisitDetail extends VisitItem {
  createTime: string
  updateTime: string
  clientOpenMs: number | null
  launchQuery: string
  refAppid: string
  refExtraData: string
  chInfo: string
  deviceMemoryMb: number | null
  deviceOrientation: string
  screenWidth: number | null
  screenHeight: number | null
  windowWidth: number | null
  windowHeight: number | null
  pixelRatio: number | null
  statusBarHeight: number | null
  safeBottom: number | null
  brightness: number | null
  wifiEnabled: number | null
  locationEnabled: number | null
  appId: string
  ua: string
  requestId: string
  /** 端上原始报文：能解析就是对象，解不了原样给字符串 */
  rawPayload: Record<string, unknown> | string | null
}

/** 全表概览（不跟随筛选：这几块的职责是「这张表到底有没有数据」） */
export interface VisitSummary {
  total: number
  people: number
  anon: number
  running: number
  avgSec: number
}

/** 每日趋势的一行 */
export interface VisitTrendItem {
  day: string
  isToday: boolean
  opens: number
  people: number
  anon: number
  closed: number
  avgSec: number
}

/** 入口分布的一项 */
export interface VisitSceneItem {
  scene: number | null
  sceneLabel: string
  cnt: number
}

/** 管理端查询条件 */
export interface VisitAdminQuery extends PaginationData {
  userId?: number | string
  /** '1' 只看已登录 / '0' 只看匿名 */
  login?: '0' | '1' | ''
  status?: number | string
  scene?: number | string
  envVersion?: VisitEnvVersion | ''
  keyword?: string
  /** 'YYYY-MM-DD'（含当天） */
  from?: string
  to?: string
  /** 概览与趋势的回看天数 */
  days?: number
}

/** 管理端列表响应 */
export interface VisitAdminResult extends PageServerResult<VisitItem[]> {
  page: number
  pageSize: number
  days: number
  summary: VisitSummary
  today: VisitTrendItem
  trend: VisitTrendItem[]
  scenes: VisitSceneItem[]
  capability: {
    /** VISIT_TRACK_ENABLED：关掉时接口照回成功但不写库，页面必须把这件事说出来 */
    trackEnabled: boolean
    rlVisitPerMin: number
    staleMinutes: number
  }
}

/**
 * 访问记录分页列表（含概览/趋势/入口分布，四件一次并行拿齐）
 * @param data - 分页与筛选条件
 */
export function getVisitAdminPage(data: VisitAdminQuery) {
  return request.get<VisitAdminResult>(`${API.URL}/admin/list`, { params: data })
}

/**
 * 单行详情（列表里不拉的大字段在这里补上）
 * @param id - 记录 ID
 */
export function getVisitDetail(id: number) {
  return request.get<VisitDetail>(`${API.URL}/admin/detail`, { params: { id } })
}

/**
 * 删掉一行（只用于清探针/压测留下的脏行）
 * @param id - 记录 ID
 */
export function deleteVisit(id: number) {
  return request.post(`${API.URL}/admin/remove`, { id })
}
