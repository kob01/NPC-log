import { MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Icon } from '@iconify/react'
import { App, Dropdown, Tooltip } from 'antd'
import { useAliveController } from 'react-activation'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import Nav from './Nav'
import styles from '../index.module.less'

import type { AppDispatch } from '@/stores'
import type { MenuProps } from 'antd'

import Avatar from '@/assets/images/avatar.png'
import Fullscreen from '@/components/Fullscreen'
import Github from '@/components/Github'
import GlobalSearch from '@/components/GlobalSearch'
import I18n from '@/components/I18n'
import Theme from '@/components/Theme'
import { useCommonStore } from '@/hooks/useCommonStore'
import { useToken } from '@/hooks/useToken'
import { logout } from '@/servers/login'
import { toggleCollapsed, setMenuList } from '@/stores/menu'
import { closeAllTab, setActiveKey } from '@/stores/tabs'
import { clearInfo } from '@/stores/user'
import { MOBILE_HOME } from '@/utils/config'
import { isDesktopModeForced, isPhoneDevice, setDesktopModeForced } from '@/utils/device'

type MenuKey = 'logout'

const Header = () => {
  const [, , removeToken] = useToken()
  const { t } = useTranslation()
  const { clear } = useAliveController()
  const { modal } = App.useApp()
  const { isCollapsed, isMaximize, username, nav } = useCommonStore()
  const dispatch: AppDispatch = useDispatch()
  const navigate = useNavigate()

  // 下拉菜单内容
  const items: MenuProps['items'] = [
    {
      key: 'logout',
      label: <span>{t('public.signOut')}</span>,
      icon: <LogoutOutlined className='mr-1' />,
    },
  ]

  /** 点击菜单 */
  const onClick: MenuProps['onClick'] = (e) => {
    switch (e.key as MenuKey) {
      case 'logout':
        handleLogout()
        break

      default:
        break
    }
  }

  /** 退出登录 */
  const handleLogout = () => {
    modal.confirm({
      title: t('public.kindTips'),
      icon: <ExclamationCircleOutlined />,
      content: t('public.signOutMessage'),
      onOk() {
        logout()
        setTimeout(() => {
          dispatch(clearInfo())
          dispatch(closeAllTab())
          dispatch(setActiveKey(''))
          // 菜单数据源存于 store，不清空的话：下一个账号（权限不同）登录后，
          // layout 因 userId 已由登录响应回填而不会重拉菜单，侧边栏会停留在上一个账号的入口
          dispatch(setMenuList([]))
          clear() // 清除keepalive缓存
          removeToken()
          navigate('/login')
        }, 0)
      },
    })
  }

  // 手机用户点了“桌面版”后会被标记留在桌面，这里给出一个回到移动版的入口
  const showMobileEntry = isDesktopModeForced() && isPhoneDevice()

  /** 回到移动版：清除强制桌面标记，否则桌面页会被 useMobileRedirect 再次拦回 */
  const handleBackMobile = () => {
    setDesktopModeForced(false)
    navigate(MOBILE_HOME, { replace: true })
  }

  /** 右侧组件抽离减少重复渲染 */
  const RightRender = () => (
    <div className='flex items-center'>
      <Github />
      <GlobalSearch />
      {showMobileEntry && (
        <Tooltip title={t('content.backToMobile')}>
          <div className='flex items-center justify-center text-lg mr-3 cursor-pointer' onClick={handleBackMobile}>
            <Icon icon='gridicons-mobile' />
          </div>
        </Tooltip>
      )}
      <Fullscreen />
      <I18n />
      <Theme />
      <Dropdown className='min-w-50px' menu={{ items, onClick }}>
        <div className='ant-dropdown-link flex items-center cursor-pointer' onClick={(e) => e.preventDefault()}>
          <img src={Avatar} width={27} height={27} alt='Avatar' className='rounded-1/2 overflow-hidden object-cover bg-light-500' />
          <span className='ml-2 text-15px min-w-50px truncate'>{username || ''}</span>
        </div>
      </Dropdown>
    </div>
  )

  /** icon渲染 */
  const IconRender = () => (
    <div className='text-lg cursor-pointer' onClick={() => dispatch(toggleCollapsed(!isCollapsed))}>
      {isCollapsed && <MenuUnfoldOutlined />}
      {!isCollapsed && <MenuFoldOutlined />}
    </div>
  )

  return (
    <>
      <header
        className={`
          border-bottom
          flex
          items-center
          justify-between
          px-6
          py-6px
          box-border
          transition-all
          ${styles.headerDriver}
          ${isMaximize ? styles.none : ''}
        `}
      >
        <div className='flex item-center'>
          <IconRender />

          <Nav className='ml-15px' list={nav} />
        </div>

        <RightRender />
      </header>
    </>
  )
}

export default Header
