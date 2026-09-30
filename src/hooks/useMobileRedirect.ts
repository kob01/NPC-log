import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { MOBILE_HOME } from '@/utils/config'
import { shouldUseMobileView } from '@/utils/device'

/**
 * 手机访问桌面页时自动重定向到移动版
 *
 * 收敛在页面初始化最前面使用：判定为移动版时直接返回，
 * 让调用方跳过列表数据拉取/表单初始化，省掉一次必然被丢弃的请求。
 *
 * 判定只做一次（惰性 state）：避免用户在页面上把窗口拖窄就被踢到移动版，
 * 正在填写的表单会凭空丢失；需要变更时通过「桌面版/移动版」手动入口切换。
 *
 * @param target - 移动版目标路径
 * @returns 是否已判定要走移动版（true 时调用方应跳过后续初始化）
 */
export function useMobileRedirect(target: string = MOBILE_HOME): boolean {
  const navigate = useNavigate()
  const [toMobile] = useState(() => shouldUseMobileView())

  useEffect(() => {
    if (toMobile) {
      navigate(target, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toMobile])

  return toMobile
}
