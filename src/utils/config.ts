import type { TFunction } from 'i18next'

/**
 * @description: 配置项
 */
export const TITLE_SUFFIX = (t: TFunction) => t('public.currentName') // 标题后缀
export const TOKEN = 'NPC_token' // token名称
export const LANG = 'lang' // 语言
export const WATERMARK_PREFIX = 'admin' // 水印前缀
export const VERSION = 'admin_version' // 版本
export const EMPTY_VALUE = '-' // 空值显示
export const THEME_KEY = 'theme_key' // 主题
export const ONLY_MINE_KEY = 'npc_only_mine' // “只看自己日志”开关（本地缓存）
export const ONLY_MINE_HEADER = 'X-Only-Mine' // “只看自己日志”请求头（后端全局识别）

// 公共组件默认值
export const MAX_TAG_COUNT = 'responsive' // 最多显示多少个标签，responsive：自适应
export const FORM_REQUIRED = [{ required: true }] // 表单必填校验

// 日期格式化
export const DATE_FORMAT = 'YYYY-MM-DD'
export const TIME_FORMAT = 'YYYY-MM-DD hh:mm:ss'

// 初始化分页数据
export const INIT_PAGINATION = {
  page: 1,
  pageSize: 20,
}

// 环境判断
const ENV = import.meta.env.VITE_ENV as string
// 生成环境所用的接口
const URL = import.meta.env.VITE_BASE_URL as string
// 上传地址
export const FILE_API = `${ENV === 'development' ? '/api' : URL}/authority/file/upload-file`

// 静态资源（图片）地址前缀：dev 走 vite 代理（相对路径），prod 走线上地址
const FILE_URL_PREFIX = ENV === 'development' ? '' : URL || ''

/**
 * 解析后端返回的相对图片路径为可访问地址
 * @param path - 后端返回的相对路径（如 /uploads/2026/09/xxx.webp），也兼容完整 URL
 * @returns 可直接用于 img src 的地址，空值返回空串
 */
export function resolveFileUrl(path?: string | null): string {
  if (!path) {
    return ''
  }
  // 已是完整地址直接返回
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${FILE_URL_PREFIX}${normalized}`
}

// 新增/编辑标题
export const ADD_TITLE = (t: TFunction, title?: string) =>
  t('public.createTitle', { title: title ?? '' })
export const EDIT_TITLE = (t: TFunction, name: string, title?: string) =>
  `${t('public.editTitle', { title: title ?? '' })}${name ? `(${name})` : ''}`

// 密码规则
export const PASSWORD_RULE = (t: TFunction) => ({
  pattern: /^(?=.*\d)(?=.*[a-zA-Z])[\da-zA-Z~!@#$%^&*+\.\_\-*]{6,30}$/,
  message: t('login.passwordRuleMessage'),
})
