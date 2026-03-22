import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCommonStore } from '@/hooks/useCommonStore'
import { useToken } from '@/hooks/useToken'
import { getFirstMenu } from '@/menus/utils/helper'

const Page = () => {
  const [getToken] = useToken()
  const { permissions, menuList } = useCommonStore()
  const token = getToken()
  const navigate = useNavigate()

  /** 跳转第一个有效菜单路径 */
  const goFirstMenu = useCallback(() => {
    const firstMenu = getFirstMenu(menuList, permissions)
    navigate(firstMenu)
  }, [menuList, navigate, permissions])

  useEffect(() => {
    if (!token) {
      return navigate('/login')
    }

    // 跳转第一个有效菜单路径
    goFirstMenu()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return <div />
}

export default Page
