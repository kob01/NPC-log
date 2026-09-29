import { ONLY_MINE_KEY } from '@/utils/config'
import { getLocalInfo, setLocalInfo } from '@/utils/local'

/**
 * “只看自己日志”全局开关
 *
 * 为什么存 localStorage 而不进 redux：两个 axios 实例（全局 request、
 * memory 专用实例）的请求拦截器都要读它，拦截器里引 store 会形成循环依赖，
 * 读本地缓存是最轻的共享方式；开关 UI 在 /content/log 页面，展示态由页面自行维护。
 *
 * 作用范围（全局）：开关打开后请求头带上 X-Only-Mine: 1，后端在所有走可见性判定的
 * 查询里只返回本人日志 —— 日志列表/导出、移动端列表、AI 记忆检索与问答、
 * 月度/年度摘要、热门标签、人物图谱、地图足迹，避免他人日志混入影响个人分析。
 */

/** 获取开关状态（默认关闭） */
export function getOnlyMine(): boolean {
  return getLocalInfo<boolean>(ONLY_MINE_KEY) === true
}

/**
 * 设置开关状态
 * @param onlyMine - 是否只看自己的日志
 */
export function setOnlyMine(onlyMine: boolean) {
  // 过期时间传 null：这是用户的长期偏好，按默认 2 天过期会被悄悄清掉
  setLocalInfo(ONLY_MINE_KEY, onlyMine, null)
}
