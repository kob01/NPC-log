/**
 * 定时提醒 - 接口封装
 *
 * 后端把提醒状态算成数字（1 等待推送 / 2 待补收件条件 / 3 推送中 / 0 已结束或停用），
 * 前端直接比较数字，不维护字符串映射表；时间一律是服务器墙钟字符串
 * （'YYYY-MM-DD HH:mm:ss'），前端只做切片展示，不用 new Date 解析，
 * 否则浏览器与服务器时区不一致会把时间整体挪几个小时。
 *
 * 渠道（channel）决定一条提醒走哪个出口：
 * - wx 微信服务通知：需要账号绑过微信 + 小程序里攒下订阅额度；
 * - email 邮件：不消耗额度、不依赖绑定，所以 PC 也能直接建；
 * - both 两者都发：任一路失败都不拦另一路。
 */
import type { PageServerResult, PaginationData } from '#/public'

import { request } from '@/servers/request'

enum API {
  URL = '/api/reminder',
}

/** 重复规则（与后端 REPEAT_RULES 一一对应） */
export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

/** 下发渠道（与后端 CHANNELS 一一对应） */
export type ReminderChannel = 'wx' | 'email' | 'both'

/** 提醒状态码 */
export const REMINDER_STATUS = {
  OFF: 0,
  WAITING: 1,
  NEED_AUTH: 2,
  FIRING: 3,
} as const

/** 提醒单条（小程序与管理端共用同一份字段名） */
export interface ReminderItem {
  id: number
  title: string
  remark: string
  time: string
  repeat: ReminderRepeat
  /** 下发渠道；后端对历史数据（没这一列的行）一律归为 wx */
  channel: ReminderChannel
  /**
   * 行上单独填的收件邮箱；空串表示「跟随账号邮箱」。
   * 管理端视图里后端给的是已解析的实际收件人（两边语义差是故意的）
   */
  email: string
  status: number
  pushCount: number
  failCount: number
  lastPushTime: string
  lastError: string
  createTime: string
  eventId: number | null
  eventName: string
  /** 以下三列只有管理端跨用户视图才返回 */
  userId?: number
  username?: string
  nickName?: string
  wxBound?: boolean
  quota?: number
}

/**
 * 新建/编辑表单
 * time 缺省即「不改时间」（'YYYY-MM-DD HH:mm'）：后端的「必须晚于现在」只拦真改了时间的请求，
 * 编辑一条已过期的提醒时只带 title/remark 才改得动。
 * email 留空则跟随账号邮箱。
 */
export interface ReminderFormData {
  id?: number
  title: string
  time?: string
  repeat: ReminderRepeat
  remark?: string
  eventId?: number | null
  channel: ReminderChannel
  email?: string
}

/** 提醒页所需状态（模板 ID 只能由服务端下发：两边必须是同一个值） */
export interface ReminderConfig {
  enabled: boolean
  templateId: string
  state: string
  quota: number
  wxBound: boolean
  pending: number
  needAuth: number
  nextTime: string
  maxAdd: number
  hint: string
  /** 服务端 SMTP 是否可用（false 时邮件渠道只存不发） */
  mailEnabled: boolean
  /** 账号上的邮箱，用于表单预填（自己的邮箱，不是机密） */
  accountEmail: string
}

/** 管理端概览计数 */
export interface ReminderSummary {
  total: number
  waiting: number
  needAuth: number
  firing: number
  off: number
  /** 按渠道分组计数（看「邮件提醒到底有没有人用」） */
  channels: { wx: number; email: number; both: number }
}

/** 管理端列表响应（在分页之外多带概览与降级开关） */
export interface ReminderAdminResult extends PageServerResult<ReminderItem[]> {
  page: number
  pageSize: number
  summary: ReminderSummary
  capability: {
    pushReady: boolean
    mailReady: boolean
    schedulerEnabled: boolean
    state: string
  }
}

/** 管理端查询条件 */
export interface ReminderAdminQuery extends PaginationData {
  userId?: number | string
  status?: number | string
  channel?: ReminderChannel | ''
  keyword?: string
}

/** 测试下发的结果（kind 比文案更有诊断价值：noQuota / auth / rejected 等） */
export interface ReminderTestResult {
  ok: boolean
  kind?: string
  errcode?: number
  message?: string
  msgId?: string
  /** 邮件那一路回的是脱敏后的收件人 */
  to?: string
}

/**
 * 当前登录人的提醒状态（额度 / 绑定 / 待授权数 / 提示语）
 */
export function getReminderConfig() {
  return request.get<ReminderConfig>(`${API.URL}/config`)
}

/**
 * 当前登录人的提醒列表
 * @param withDone - 是否包含已结束/已停用的历史条目
 */
export function getMyReminders(withDone = true) {
  return request.get<ReminderItem[]>(`${API.URL}/list`, {
    params: withDone ? { withDone: 1 } : {},
  })
}

/**
 * 跨用户提醒列表（仅管理员；后端 adminOnly 会回查库校验账号类型）
 * @param data - 分页与筛选条件
 */
export function getReminderAdminPage(data: ReminderAdminQuery) {
  return request.get<ReminderAdminResult>(`${API.URL}/admin/list`, { params: data })
}

/**
 * 删除当前登录人的某条提醒
 * @param id - 提醒 ID
 */
export function deleteReminder(id: number) {
  return request.delete(`${API.URL}?id=${id}`)
}

/**
 * 新建提醒（邮件渠道不需要订阅授权，所以 PC 可以直接建；
 * 微信渠道建完后仍然要靠小程序补授权才会真的推送）
 * @param data - 表单数据
 */
export function createReminder(data: ReminderFormData) {
  return request.post<{ id: number }>(API.URL, data)
}

/**
 * 编辑提醒（只传需要改的字段；时间没改时不要带 time，否则后端会重新要求它在未来）
 * @param data - 含 id 的表单数据
 */
export function updateReminder(data: ReminderFormData & { id: number }) {
  return request.put<{ id: number }>(API.URL, data)
}

/**
 * 启停一条提醒
 * @param id - 提醒 ID
 * @param enabled - 是否启用
 */
export function setReminderStatus(id: number, enabled: boolean) {
  return request.post<{ id: number; status: number; time?: string }>(`${API.URL}/status`, { id, enabled })
}

/**
 * 立刻给自己发一条测试推送（验模板与字段映射，或验 SMTP 与收件地址）
 * @param channel - 要验哪个出口
 */
export function testReminder(channel: ReminderChannel = 'wx') {
  return request.post<ReminderTestResult>(`${API.URL}/test`, { channel })
}

/**
 * 管理员删除任意一条提醒（用于卡在「发送中」的孤儿行与误建数据）
 * @param id - 提醒 ID
 */
export function adminDeleteReminder(id: number) {
  return request.post(`${API.URL}/admin/remove`, { id })
}
