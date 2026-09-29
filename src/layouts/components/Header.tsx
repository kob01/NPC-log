import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  FormOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { App, Dropdown } from 'antd'
import { useRef } from 'react'
import { useAliveController } from 'react-activation'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import Nav from './Nav'
import UpdatePassword from './UpdatePassword'
import styles from '../index.module.less'

import type { PasswordModal } from './UpdatePassword'
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

type MenuKey = 'password' | 'logout'

const Header = () => {
  const [, , removeToken] = useToken()
  const { t } = useTranslation()
  const { clear } = useAliveController()
  const { modal } = App.useApp()
  const { isCollapsed, isMaximize, username, nav } = useCommonStore()
  // 是否窗口最大化
  const passwordRef = useRef<PasswordModal>(null)
  const dispatch: AppDispatch = useDispatch()
  const navigate = useNavigate()

  // 下拉菜单内容
  const items: MenuProps['items'] = [
    {
      key: 'password',
      label: <span>{t('public.changePassword')}</span>,
      icon: <FormOutlined className='mr-1' />,
    },
    {
      key: 'logout',
      label: <span>{t('public.signOut')}</span>,
      icon: <LogoutOutlined className='mr-1' />,
    },
  ]

  /** 点击菜单 */
  const onClick: MenuProps['onClick'] = (e) => {
    switch (e.key as MenuKey) {
      case 'password':
        passwordRef.current?.open()
        break

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

  /** 右侧组件抽离减少重复渲染 */
  const RightRender = () => (
    <div className='flex items-center'>
      <Github />
      <GlobalSearch />
      <Fullscreen />
      <I18n />
      <Theme />
      <Dropdown className='min-w-50px' menu={{ items, onClick }}>
        <div
          className='ant-dropdown-link flex items-center cursor-pointer'
          onClick={(e) => e.preventDefault()}
        >
          <img
            src={Avatar}
            width={27}
            height={27}
            alt='Avatar'
            className='rounded-1/2 overflow-hidden object-cover bg-light-500'
          />
          <span className='ml-2 text-15px min-w-50px truncate'>{username || 'south-admin'}</span>
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

      <UpdatePassword passwordRef={passwordRef} />
    </>
  )
}

export default Header
