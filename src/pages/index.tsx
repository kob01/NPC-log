import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { useToken } from '@/hooks/useToken'
import { HOME_PATH } from '@/utils/config'

const Page = () => {
  const [getToken] = useToken()
  const token = getToken()
  const navigate = useNavigate()

  /** 跳转首页 */
  const goHome = useCallback(() => {
    navigate(HOME_PATH)
  }, [navigate])

  useEffect(() => {
    if (!token) {
      return navigate('/login')
    }

    // 跳转默认首页
    goHome()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return <div />
}

export default Page
