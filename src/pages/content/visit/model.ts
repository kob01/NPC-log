/**
 * 访问记录页的展示口径
 *
 * 单独一个 model.ts 与 /content/reminder 同一形态：页面只管排版，
 * 「一个值该显示成什么」的判断全部收在这里，免得同一个 status 在两处渲染成两种说法。
 *
 * 三条硬约定（都对应着后端表里真实存在的坑）：
 * 1. **null 与 0 是两回事**：durationSec 为 null 是「不知道几点走的」，
 *    显示成「未知」；显示成 0 秒会把「被杀进程」伪装成「点开就退」。
 * 2. **时间只做字符串切片**：不 new Date 解析。数据库墙钟与浏览器时区不一致时，
 *    解析一次就把整列时间挪几个小时，而这一页的全部价值就在时间上。
 * 3. **场景值文案只是辅助**：scene_label 来自端上映射表，未命中写的是「场景N」；
 *    真正的判据永远是 scene 这个数字。
 */
import type { VisitEnvVersion, VisitItem } from '@/servers/content/visit'
import type { TFunction } from 'i18next'

/** 状态码 → 文案键与颜色（与后端 note_app_visit.status 一一对应） */
export const STATUS_META: Record<number, { key: string; color: string }> = {
  1: { key: 'content.visitStatusRunning', color: 'gold' },
  2: { key: 'content.visitStatusClosed', color: 'green' },
  3: { key: 'content.visitStatusInterrupted', color: 'default' },
}

/** 版本环境 → 文案键与颜色：这一列直接决定「看到的是不是线上真数据」 */
export const ENV_META: Record<VisitEnvVersion, { key: string; color: string }> = {
  develop: { key: 'content.visitEnvDevelop', color: 'orange' },
  trial: { key: 'content.visitEnvTrial', color: 'blue' },
  release: { key: 'content.visitEnvRelease', color: 'geekblue' },
}

/** 小程序页面路径 → 中文页名键（routes 与 NPC-log_wx/app.json 的 pages 顺序一致） */
const PAGE_LABEL_KEYS: Record<string, string> = {
  timeline: 'content.pageTimeline',
  memory: 'content.pageMemory',
  footprint: 'content.pageFootprint',
  profile: 'content.pageProfile',
  account: 'content.pageAccount',
  login: 'content.pageLogin',
  password: 'content.pagePassword',
  'wx-register': 'content.pageWxRegister',
  detail: 'content.pageDetail',
  edit: 'content.pageEdit',
  report: 'content.pageReport',
  persons: 'content.pagePersons',
  org: 'content.pageOrg',
  reminders: 'content.pageReminders',
  m: 'content.pageMobileHome',
}

/**
 * 'pages/timeline/timeline' → 「存档」
 * 认不出来的路径原样回显：宁可让管理员看到一串 route，也不要显示成错误的中文页名
 */
export function pageLabelOf(t: TFunction, route?: string): string {
  if (!route) {
    return ''
  }
  const seg = route.split('/').filter(Boolean)
  const name = seg.length > 1 ? seg[seg.length - 1] : seg[0]
  const key = PAGE_LABEL_KEYS[name]
  return key ? t(key) : route
}

/**
 * 'YYYY-MM-DD HH:mm:ss' → 'MM-DD HH:mm:ss'
 * 纯字符串切片（理由见文件头第 2 条）
 */
export function shortTime(value?: string, withYear = false): string {
  if (!value) {
    return '-'
  }
  if (withYear) {
    return value.slice(0, 19)
  }
  return value.length >= 19 ? value.slice(5, 19) : value
}

/**
 * 停留时长：秒 → 「1小时23分」/「45秒」/「未知」
 * null 走「未知」而不是 0；不足 1 分钟直接给秒，避免满屏「0分」
 */
export function durationText(t: TFunction, sec: number | null): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) {
    return t('content.visitDurationUnknown')
  }
  const n = Math.max(0, Math.round(sec))
  if (n < 60) {
    return t('content.visitDurationSec', { n })
  }
  if (n < 3600) {
    return t('content.visitDurationMin', { min: Math.round(n / 60) })
  }
  return t('content.visitDurationHour', { hour: Math.floor(n / 3600), min: Math.round((n % 3600) / 60) })
}

/** 时钟偏差：只用来一眼看出「本机时间被动过」，绝对值小于 2 分钟不值得占一列 */
export function clockDiffText(t: TFunction, ms: number | null): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) {
    return ''
  }
  const min = Math.round(ms / 60000)
  if (Math.abs(min) < 2) {
    return ''
  }
  return t('content.visitClockDiff', { min })
}

/** 一行是谁：昵称（库里当前值）优先，退回登录名快照，两者都没有就是匿名 */
export function userTextOf(t: TFunction, row: VisitItem): string {
  if (row.nickName) {
    return row.nickName
  }
  if (row.username) {
    return row.username
  }
  return t('content.visitAnonymous')
}

/** 设备一句话：品牌 型号 · 平台 系统；缺项自动跳过，不留孤零零的分隔符 */
export function deviceText(row: VisitItem): string {
  const model = [row.brand, row.model].filter(Boolean).join(' ')
  const os = [row.platform, row.osVersion].filter(Boolean).join(' ')
  return [model, os].filter(Boolean).join(' · ')
}

/**
 * 电量文案：null 不显示（老版本小程序没上报这一项）；
 * 充电中拼在同一个 Tag 里，「挂着充电一直开合」是这张表最值得看的形态之一
 */
export function batteryText(row: VisitItem): string {
  if (row.batteryLevel === null || row.batteryLevel === undefined) {
    return ''
  }
  return `${row.batteryLevel}%${row.batteryCharging === 1 ? ' ⚡' : ''}`
}

/** 详情里「这个字段到底有没有值」的统一判法：null/undefined/空串一律显示成破折号 */
export function orDash(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}
