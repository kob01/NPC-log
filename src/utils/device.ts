import { MOBILE_MAX_WIDTH } from '@/utils/config'

/**
 * 设备类型识别（以 UA 为主判据，视口和指针类型只做兜底）
 *
 * 为什么不单用 window.innerWidth 判定「是不是手机」：
 * 视口只反映“窗口有多宽”，不反映“用什么设备在看”。
 * - 手机勾选“电脑模式”后视口变成 980px 左右 → 纯视口判定会漏掉真手机；
 * - PC 把浏览器窗口拖窄 → 纯视口判定会把桌面误判成手机；
 * - iPad 竖屏恒定 768px → 纯视口判定会把平板赶进为手机做的精简页。
 * 所以主判据用 UA 特征，视口仅在 UA 完全识别不出（魔改内核）时兜底，
 * 并用 pointer: fine（存在鼠标）排除桌面窄窗口。
 */

/** “强制桌面版”标记（存 sessionStorage 而非 localStorage：只对本次会话生效，避免误判后用户再也回不到移动版） */
const DESKTOP_MODE_KEY = 'npc_desktop_mode'

/** 手机 UA 特征（不含平板）：iPhone/iPod/BlackBerry 等，Android 需再靠 “; Mobile” 片段区分 */
const PHONE_UA = /iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone/i

/** 平板 UA 特征：iPad、各类 Tablet 标识 */
const TABLET_UA = /iPad|Tablet/i

/** 读取 UA（非浏览器环境下返回空串） */
function getUa(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
}

/** 触控点数量，用于识别伪装成 Mac 的 iPadOS */
function getMaxTouchPoints(): number {
  if (typeof navigator === 'undefined') {
    return 0
  }
  return navigator.maxTouchPoints || 0
}

/** 是否存在精确指针（鼠标/触控板）；触屏设备为 false */
function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return true
  }
  return window.matchMedia('(pointer: fine)').matches
}

/** 是否为手机（不含平板） */
export function isPhoneDevice(): boolean {
  const ua = getUa()
  if (!ua) {
    return false
  }
  if (PHONE_UA.test(ua)) {
    return true
  }
  // Android 手机与平板共用 UA：手机带 “; Mobile”，平板没有该片段
  return /Android/i.test(ua) && /Mobile/i.test(ua)
}

/** 是否为平板 */
export function isTabletDevice(): boolean {
  const ua = getUa()
  if (!ua) {
    return false
  }
  if (TABLET_UA.test(ua)) {
    return true
  }
  if (/Android/i.test(ua)) {
    // Android 平板：没有 “; Mobile” 片段
    return !/Mobile/i.test(ua)
  }
  // iPadOS 13+ 默认请求桌面版站点，UA 变成 Macintosh，只能靠触控点识别（真 Mac 为 0）
  return /Macintosh/i.test(ua) && getMaxTouchPoints() > 1
}

/** 是否为移动设备（手机或平板），供导航唤起等场景使用 */
export function isMobileDevice(): boolean {
  return isPhoneDevice() || isTabletDevice()
}

/** 当前视口是否窄于移动阈值（用于弹窗、地图等尺寸自适应） */
export function isNarrowViewport(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.innerWidth <= MOBILE_MAX_WIDTH
}

/** 用户是否在本会话主动选择了「桌面版」 */
export function isDesktopModeForced(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.sessionStorage.getItem(DESKTOP_MODE_KEY) === '1'
}

/**
 * 设置/取消「强制桌面版」，供移动端的“桌面版”入口与桌面的“移动版”入口调用
 * @param forced - true 表示本次会话锁定桌面版
 */
export function setDesktopModeForced(forced: boolean) {
  if (typeof window === 'undefined') {
    return
  }
  if (forced) {
    window.sessionStorage.setItem(DESKTOP_MODE_KEY, '1')
  } else {
    window.sessionStorage.removeItem(DESKTOP_MODE_KEY)
  }
}

/**
 * 当前是否应使用移动版页面
 * 优先级：用户显式选择 > 平板 > 手机 UA > 视口兜底
 */
export function shouldUseMobileView(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  // 用户在移动端里点过“桌面版”，本次会话不再自动跳转
  if (isDesktopModeForced()) {
    return false
  }
  // 平板屏幕足够大，保留桌面响应式布局（移动版功能不全）
  if (isTabletDevice()) {
    return false
  }
  if (isPhoneDevice()) {
    return true
  }
  // UA 识别失败（部分国产浏览器魔改 UA）时的兜底：窄视口 + 触屏指针
  return isNarrowViewport() && !hasFinePointer()
}
