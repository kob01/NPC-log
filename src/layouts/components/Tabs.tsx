import { message, Tabs, Dropdown } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAliveController } from 'react-activation'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'

import { useCommonStore } from '@/hooks/useCommonStore'
import { getMenuByKey } from '@/menus/utils/helper'
import { setRefresh } from '@/stores/public'
import { setActiveKey, addTabs, closeTabs, setNav, toggleLock, switchTabsLang } from '@/stores/tabs'

import { useDropdownMenu } from '../hooks/useDropdownMenu'
import styles from '../index.module.less'
import TabMaximize from './TabMaximize'
import TabOptions from './TabOptions'
import TabRefresh from './TabRefresh'

import type { AppDispatch, RootState } from '@/stores'
import type { TabsProps } from 'antd'

// 回收已关闭标签缓存的延时（毫秒）：必须避开路由切换时 react-activation 搬运 DOM 的那几拍，
// 又不用太长——它只是清一份看不见的后台缓存，不影响用户看到的内容
const DROP_DELAY = 300

const LayoutTabs = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const uri = pathname + search
  const dispatch: AppDispatch = useDispatch()
  const { refresh, drop, getCachingNodes } = useAliveController()

  const [time, setTime] = useState<null | NodeJS.Timeout>(null)
  const [refreshTime, seRefreshTime] = useState<null | NodeJS.Timeout>(null)
  const isLock = useSelector((state: RootState) => state.tabs.isLock)
  // 选中的标签值
  const activeKey = useSelector((state: RootState) => state.tabs.activeKey)
  // 获取当前语言
  const currentLanguage = i18n.language

  const { tabs, permissions, isMaximize, menuList } = useCommonStore()

  /**
   * 添加标签
   * @param path - 路径
   */
  const handleAddTab = useCallback(
    (path = uri) => {
      // 当值为空时匹配路由
      if (permissions.length > 0) {
        if (path === '/') {
          return
        }
        const menuByKeyProps = {
          menus: menuList,
          permissions,
          key: path,
        }
        const newItems = getMenuByKey(menuByKeyProps)
        if (newItems?.key) {
          dispatch(setActiveKey(newItems.key))
          dispatch(setNav(newItems.nav))
          dispatch(addTabs(newItems))
        } else {
          dispatch(setActiveKey(path))
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [permissions, menuList],
  )

  useEffect(() => {
    handleAddTab()
  }, [handleAddTab, permissions, menuList])

  useEffect(() => {
    dispatch(switchTabsLang(currentLanguage))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage, tabs])

  useEffect(
    () => () => {
      if (time) {
        clearTimeout(time)
        setTime(null)
      }

      if (refreshTime) {
        clearTimeout(refreshTime)
        seRefreshTime(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    // 当选中贴标签不等于当前路由则跳转
    if (activeKey !== uri) {
      const key = isLock ? activeKey : uri
      handleAddTab(key)

      if (isLock) {
        navigate(key)
        dispatch(toggleLock(false))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, uri])

  /**
   * 处理更改
   * @param key - 唯一值
   */
  const onChange = (key: string) => {
    navigate(key)
  }

  /**
   * 删除标签
   * @param targetKey - 目标key值
   */
  const remove = (targetKey: string) => {
    dispatch(closeTabs(targetKey))
  }

  // 曾经挂过标签的缓存名：只回收“开过又关掉”的页面缓存，从未生成标签的路由（如带参数演示页）不去动它
  const tabKeys = useRef<Set<string>>(new Set())

  /**
   * 关闭标签时回收对应的 KeepAlive 缓存
   * react-activation 按 name（= 完整 uri，含 query）保活，关掉标签本身不会清缓存：
   * 同一个 id 的编辑页第二次进来会直接恢复上一次的表单内容，看起来像“详情接口返回了旧数据”，
   * 其实是页面没重新挂载（拉详情的 useEffect 依赖 id，缓存恢复时 id 未变也就不会再发请求）。
   *
   * 回收必须满两个条件，否则会闪屏：
   * 1）节点已经退到后台（name !== 当前 uri）——正显示的那个不能 drop；
   * 2）离开页面那次 DOM 搬运已经收尾——延后一拍再 drop。
   * 如果在“关当前标签”的那一轮里直接 drop，Keeper.drop 会把卸载动作挂到 unactivate 上，
   * 于是它插在旧页面 eject、新页面 inject 之间把 AliveScope forceUpdate 一次：
   * 内容区先空一下（黑屏），接着把列表页缓存里的 DOM（连上次悬浮过的 popover 浮层）抢插进来，然后跳转才落位。
   */
  useEffect(() => {
    const aliveKeys = tabs.map((item) => item.key)
    aliveKeys.forEach((key) => tabKeys.current.add(key))

    const orphans = (getCachingNodes?.() || []).filter(
      (node) => typeof node.name === 'string' && node.name !== uri && tabKeys.current.has(node.name) && !aliveKeys.includes(node.name),
    )
    if (!orphans.length) {
      return
    }

    // tabs / uri 再变会清掉这个定时器并重算 orphans，所以真正执行时页面已静置了一拍
    const timer = setTimeout(() => {
      orphans.forEach((node) => drop?.(node.name as string))
    }, DROP_DELAY)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, uri])

  /**
   * 处理编辑
   * @param targetKey - 目标key值
   * @param action - 动作
   */
  const onEdit: TabsProps['onEdit'] = (targetKey, action) => {
    if (action === 'remove') {
      remove(targetKey as string)
    }
  }

  /**
   * 点击重新加载
   * @param key - 点击值
   */
  const onClickRefresh = useCallback(
    (key = activeKey) => {
      // 如果key不是字符串格式则退出
      if (typeof key !== 'string') {
        return
      }

      // 定时器没有执行时运行
      if (!time) {
        dispatch(setRefresh(true))
        refresh(key)

        setTime(
          setTimeout(() => {
            message.success({
              content: t('public.refreshSuccessfully'),
              key: 'refresh',
            })
            dispatch(setRefresh(false))
            setTime(null)
          }, 100),
        )

        seRefreshTime(
          setTimeout(() => {
            seRefreshTime(null)
          }, 1000),
        )
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [activeKey, time],
  )

  // 渲染重新加载
  const RefreshRender = useMemo(() => <TabRefresh isRefresh={!!refreshTime} onClick={onClickRefresh} />, [refreshTime, onClickRefresh])

  // 渲染标签操作
  const TabOptionsRender = useMemo(() => <TabOptions activeKey={activeKey} handleRefresh={onClickRefresh} />, [activeKey, onClickRefresh])

  // 渲染最大化操作
  const TabMaximizeRender = useMemo(() => <TabMaximize />, [])

  // 标签栏功能
  const tabOptions = [{ element: RefreshRender }, { element: TabOptionsRender }, { element: TabMaximizeRender }]

  // 下拉菜单
  const dropdownMenuParams = { activeKey, handleRefresh: onClickRefresh }
  const [items, onClick] = useDropdownMenu(dropdownMenuParams)

  /** 二次封装标签 */
  const renderTabBar: TabsProps['renderTabBar'] = (tabBarProps, DefaultTabBar) => (
    <DefaultTabBar {...tabBarProps}>
      {(node) => (
        <Dropdown
          key={node.key}
          menu={{
            items: items(node.key as string),
            onClick: (e) => onClick(e.key, node.key as string),
          }}
          trigger={['contextMenu']}
        >
          <div className='mr-1px'>{node}</div>
        </Dropdown>
      )}
    </DefaultTabBar>
  )

  return (
    <div
      className={`
      flex
      items-center
      justify-between
      mx-2
      transition-all
      ${isMaximize ? styles.conMaximize : ''}
    `}
    >
      {tabs.length > 0 ? (
        <Tabs
          hideAdd
          className='w-full h-30px py-0'
          onChange={onChange}
          activeKey={activeKey}
          type='editable-card'
          onEdit={onEdit}
          items={tabs}
          renderTabBar={renderTabBar}
        />
      ) : (
        <span />
      )}

      <div className='flex'>
        {tabOptions?.map((item, index) => (
          <div
            key={index}
            className={`
                ${styles.leftDivide}
                change
                divide-solid
                w-36px
                h-36px
                hover:opacity-70
                flex
                place-content-center
                items-center
              `}
          >
            {item.element}
          </div>
        ))}
      </div>
    </div>
  )
}

export default LayoutTabs
