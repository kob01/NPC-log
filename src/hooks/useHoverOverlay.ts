import { useCallback, useState } from 'react'
import { useUnactivate } from 'react-activation'

import type { MouseEvent, MouseEventHandler } from 'react'

/**
 * hover 类浮层（Tooltip / Popover）的受控开关：页面退到后台时自动收起
 *
 * 列表页被 KeepAlive 缓存时组件并不会卸载，而 antd 的浮层门户挂在 document.body 上：
 * 触发元素被搬进隐藏容器后再也收不到 mouseleave，于是
 * ① 点「编辑」跳走后，那枚「编辑」气泡一直悬在屏幕上；
 * ② 返回列表页时 react-freeze 解冻，把缓存期间攒下的更新补渲染出来，表现为旧气泡闪一下。
 * 所以浮层必须受控，并在 unactivate（此时还没进入冻结，状态更新能正常落地）时强制归位为关闭。
 *
 * @returns open/onOpenChange 直接透传给 Tooltip；withHide 用于包一层点击，点完即收
 */
export function useHoverOverlay() {
  const [open, setOpen] = useState(false)

  // 不在 KeepAlive 内（如移动端页面）时，useUnactivate 内部会自行跳过
  useUnactivate(() => setOpen(false))

  /**
   * 点击时先收起浮层再执行原处理：跳转/弹确认框都不该再顶着一个气泡
   * @param handler - 原有点击处理
   */
  const withHide = useCallback(
    (handler?: MouseEventHandler<HTMLElement>) => (event: MouseEvent<HTMLElement>) => {
      setOpen(false)
      handler?.(event)
    },
    [],
  )

  return { open, onOpenChange: setOpen, withHide }
}
