import { ONLY_MINE_KEY } from '@/utils/config'
import { getLocalInfo, setLocalInfo } from '@/utils/local'

/**
 * 日志列表「查看范围」筛选（不再是全局开关）
 *
 * 为什么存 localStorage 而不进 redux：列表页（/content/log）与移动端列表（/m）
 * 都要读它作为列表/导出请求的范围，读本地缓存是最轻的共享方式；
 * 切换 UI 在 /content/log 页面（三态 Segmented），展示态由页面自行维护。
 *
 * 作用范围（仅列表）：mine → 逐请求带 X-Only-Mine: 1；others → 带 X-View-Scope: others
 * （在可见范围内再排除自己，即只看组织内他人）。AI 回忆/年度回顾/人物图谱/地图足迹等
 * 分析页不受此影响，始终只统计本人数据（servers/content/memory.ts 里恒定带 X-Only-Mine）。
 */

/** 列表查看范围 */
export type ScopeValue = 'all' | 'mine' | 'others'

/**
 * 获取查看范围（默认 all）
 * 兼容旧的布尔存储：true → 'mine'，其余 → 'all'
 */
export function getFilterScope(): ScopeValue {
  const v = getLocalInfo<ScopeValue | boolean>(ONLY_MINE_KEY)
  if (v === 'mine' || v === 'others') return v
  return v === true ? 'mine' : 'all'
}

/**
 * 设置查看范围
 * @param scope - 'all' | 'mine' | 'others'
 */
export function setFilterScope(scope: ScopeValue) {
  // 过期时间传 null：这是用户的长期偏好，按默认 2 天过期会被悄悄清掉
  setLocalInfo(ONLY_MINE_KEY, scope || 'all', null)
}
