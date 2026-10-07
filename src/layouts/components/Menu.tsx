import { BellOutlined, CompassOutlined, HistoryOutlined, ThunderboltFilled } from '@ant-design/icons'
import { Icon } from '@iconify/react'
import { Badge, Menu } from 'antd'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'

import styles from '../index.module.less'

import type { SideMenu } from '#/public'
import type { AppDispatch } from '@/stores'
import type { MenuProps } from 'antd'

import Logo from '@/assets/images/logo.svg'
import { useCommonStore } from '@/hooks/useCommonStore'
import { filterMenus, getMenuByKey, getMenuName, getOpenMenuByMenus, handleFilterMenus, splitPath } from '@/menus/utils/helper'
import { getPendingCount } from '@/servers/system/organization'
import { setOpenKeys, setSelectedKeys, toggleCollapsed } from '@/stores/menu'
import { addTabs, setNav, setActiveKey, setMenuClick } from '@/stores/tabs'
import { HOME_PATH } from '@/utils/config'
import { setTitle } from '@/utils/helper'
import { checkPermission } from '@/utils/permissions'

// “我的组织”菜单 key，用于挂载待审批红点
const ORG_MY_KEY = '/org/my'
// 待审批轮询间隔（60 秒）
const PENDING_POLL_MS = 60000

interface RawMenuItem {
  key?: string
  label?: ReactNode
  children?: RawMenuItem[]
  [prop: string]: unknown
}

/**
 * 递归为“我的组织”菜单项注入待审批数量徽标
 * @param list - 原始菜单项
 * @param count - 待审批数量
 */
const withPendingBadge = (list: RawMenuItem[], count: number): RawMenuItem[] =>
  list.map((item) => {
    if (item.key === ORG_MY_KEY && count > 0) {
      return {
        ...item,
        label: (
          <Badge count={count} size='small' overflowCount={99} offset={[6, -2]}>
            <span>{item.label}</span>
          </Badge>
        ),
      }
    }
    if (item.children?.length) {
      return { ...item, children: withPendingBadge(item.children, count) }
    }
    return item
  })

const LayoutMenu = () => {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const dispatch: AppDispatch = useDispatch()
  const [menus, setMenus] = useState<SideMenu[]>([])
  // 待审批申请总数（我管理的组织），驱动“我的组织”红点
  const [pendingCount, setPendingCount] = useState(0)
  // 获取当前语言
  const currentLanguage = i18n.language

  const { isMaximize, isCollapsed, isPhone, openKeys, selectedKeys, permissions, menuList } = useCommonStore()

  // 处理默认展开（按菜单树匹配，保证“超级记忆”这类父级key与子路由不同前缀的菜单不会收起）
  useEffect(() => {
    const newOpenKey = getOpenMenuByMenus(menus, pathname)
    if (!isPhone && !isCollapsed) {
      dispatch(setOpenKeys(newOpenKey))
      dispatch(setSelectedKeys(pathname))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, menus])

  /**
   * 设置浏览器标签
   * @param list - 菜单列表
   * @param path - 路径
   */
  const handleSetTitle = useCallback((list: SideMenu[], path: string) => {
    const title = getMenuName(list, path, i18n.language)
    if (title) {
      setTitle(t, title)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    handleSetTitle(menuList, pathname)
  }, [pathname, menuList, handleSetTitle])

  /**
   * 转换菜单icon格式
   * @param menus - 菜单
   */
  const filterMenuIcon = useCallback((menus: SideMenu[]) => {
    for (let i = 0; i < menus.length; i++) {
      if (menus[i]?.icon) {
        menus[i].icon = <Icon icon={menus[i].icon as string} />
      }

      if (menus[i]?.children?.length) {
        filterMenuIcon(menus[i].children as SideMenu[])
      }
    }
  }, [])

  // 过滤没权限菜单
  useEffect(() => {
    if (permissions.length > 0) {
      const newMenus = filterMenus(menuList, permissions)
      filterMenuIcon(newMenus)
      // 超级记忆家族（回忆/年度回顾/人物图谱/地图足迹）：同“NPC存档”一样硬编码前置（不依赖 note_menus），
      // 权限由后端 NORMAL_PERMISSIONS 下发 /content/* 控制，人人可用
      newMenus.unshift({
        icon: <ThunderboltFilled />,
        label: t('content.aiGroupTitle'),
        labelEn: 'Super Memory',
        key: '/content/ai',
        children: [
          {
            label: t('content.memoryTitle'),
            labelEn: 'AI Memory',
            key: '/content/memory',
            rule: '/content/memory',
          },
          {
            label: t('content.reportTitle'),
            labelEn: 'Annual Review',
            key: '/content/report',
            rule: '/content/report',
          },
          {
            label: t('content.personsTitle'),
            labelEn: 'People Graph',
            key: '/content/persons',
            rule: '/content/persons',
          },
          {
            label: t('content.footprintTitle'),
            labelEn: 'Footprints',
            key: '/content/footprint',
            rule: '/content/footprint',
          },
        ],
      })
      newMenus.unshift({
        icon: <CompassOutlined />,
        label: t('content.logTitle'),
        labelEn: 'NPC Save',
        key: '/content/log',
        rule: '/content/log',
      })
      // 定时提醒：单列顶级项（紧跟 NPC 存档），不放进「超级记忆」组 —— 它不是 AI 能力，
      // 而是「到点能不能推出去」的运维视图，语义上与回顾/图谱不同组
      newMenus.splice(1, 0, {
        icon: <BellOutlined />,
        label: t('content.reminderTitle'),
        labelEn: 'Reminders',
        key: '/content/reminder',
        rule: '/content/reminder',
      })
      // 访问记录：管理员专属（权限位来自后端 ADMIN_EXTRA_PERMISSIONS）。
      // 上面这批硬编码前置项是 filterMenus 之后插进来的，本身不会再按权限筛，
      // 所以必须在这里手动判一次；而菜单只是入口，真正的门是接口上的 adminOnly（回查库）
      if (checkPermission('/content/visit', permissions)) {
        newMenus.splice(2, 0, {
          icon: <HistoryOutlined />,
          label: t('content.visitTitle'),
          labelEn: 'Visit Log',
          key: '/content/visit',
          rule: '/content/visit',
        })
      }

      setMenus(newMenus || [])
    }
  }, [filterMenuIcon, permissions, currentLanguage, menuList])

  // 轮询待审批申请数，使管理员不打开页面也能感知新申请
  useEffect(() => {
    if (permissions.length === 0) {
      return
    }
    let active = true
    const fetchCount = async () => {
      try {
        const { code, data } = await getPendingCount()
        if (active && Number(code) === 200) {
          setPendingCount(Number(data) || 0)
        }
      } catch (error) {
        console.error('获取待审批申请数失败:', error)
      }
    }
    fetchCount()
    const timer = setInterval(fetchCount, PENDING_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [permissions.length])

  /**
   * 处理跳转
   * @param path - 路径
   * @param fromMenu - 是否从菜单点击
   */
  const goPath = (path: string, fromMenu = false) => {
    navigate(path)
    const menuByKeyProps = { menus, permissions, key: path }
    const newTab = getMenuByKey(menuByKeyProps)
    if (newTab) {
      dispatch(setActiveKey(newTab.key))
      dispatch(setNav(newTab.nav))
      dispatch(addTabs(newTab))
      // 标记是从菜单点击进入，需要刷新数据
      dispatch(setMenuClick(fromMenu))
    }
  }

  /**
   * 点击菜单
   * @param e - 菜单事件
   */
  const onClick: MenuProps['onClick'] = (e) => {
    goPath(e.key, true) // true 表示从菜单点击进入，需要刷新数据
    if (isPhone) {
      hiddenMenu()
    }
  }

  /**
   * 对比当前展开目录是否是同一层级
   * @param arr - 当前展开目录
   * @param lastArr - 最后展开的目录
   */
  const diffOpenMenu = (arr: string[], lastArr: string[]) => {
    let result = true

    for (let j = 0; j < arr.length; j++) {
      if (arr[j] !== lastArr[j]) {
        result = false
        break
      }
    }

    return result
  }

  /**
   * 展开/关闭回调
   * @param openKeys - 展开键值
   */
  const onOpenChange = (openKeys: string[]) => {
    const newOpenKey: string[] = []
    let last = '' // 最后一个目录结构

    // 当目录有展开值
    if (openKeys.length > 0) {
      last = openKeys[openKeys.length - 1]
      const lastArr: string[] = splitPath(last)
      newOpenKey.push(last)

      // 对比当前展开目录是否是同一层级
      for (let i = openKeys.length - 2; i >= 0; i--) {
        const arr = splitPath(openKeys[i])
        const hasOpenKey = diffOpenMenu(arr, lastArr)
        if (hasOpenKey) {
          newOpenKey.unshift(openKeys[i])
        }
      }
    }

    dispatch(setOpenKeys(newOpenKey))
  }

  /** 点击logo */
  const onClickLogo = () => {
    goPath(HOME_PATH, true) // true 表示从菜单点击进入，需要刷新数据
    if (isPhone) {
      hiddenMenu()
    }
  }

  /** 隐藏菜单 */
  const hiddenMenu = () => {
    dispatch(toggleCollapsed(true))
  }

  // 注入待审批红点后的菜单项
  const menuItems = useMemo(
    () => withPendingBadge(handleFilterMenus(menus) as unknown as RawMenuItem[], pendingCount) as unknown as MenuProps['items'],
    [menus, pendingCount],
  )

  return (
    <>
      <div
        className={`
          transition-all
          overflow-auto
          z-2
          ${styles.menu}
          ${isCollapsed ? styles.menuClose : ''}
          ${isMaximize || (isPhone && isCollapsed) ? styles.menuNone : ''}
          ${isPhone ? '!z-1002' : ''}
        `}
      >
        <div
          className={`
            text-white
            flex
            content-center
            px-5
            py-2
            cursor-pointer
            ${isCollapsed ? 'justify-center' : ''}
          `}
          onClick={onClickLogo}
        >
          <img src={Logo} width={30} height={30} className='object-contain' alt='logo' />

          <span
            className={`
            text-white
            ml-3
            text-xl
            font-bold
            truncate
            ${isCollapsed ? 'hidden' : ''}
          `}
          >
            {/* {t('public.currentName')} */}
            NPC存档
          </span>
        </div>

        <Menu
          className='z-1000'
          selectedKeys={[selectedKeys]}
          openKeys={openKeys}
          mode='inline'
          theme='dark'
          inlineCollapsed={isCollapsed}
          items={menuItems}
          onClick={onClick}
          onOpenChange={onOpenChange}
        />
      </div>

      {isPhone && !isCollapsed && (
        <div
          className={`
            ${styles.cover}
            fixed
            w-full
            h-full
            bg-gray-500
            bg-opacity-10
            z-1001
          `}
          onClick={hiddenMenu}
        />
      )}
    </>
  )
}

export default LayoutMenu
