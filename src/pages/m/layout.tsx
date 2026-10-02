/**
 * 移动端裸布局（/m 前缀）
 * - 不含桌面侧边菜单/标签页，useOutlet 渲染子路由
 * - 复用桌面登录态：无 token 跳 /login
 * - 顶部标题栏（右侧“桌面版”入口）+ 底部导航（时间线 / 记忆 / 足迹 / 记一笔 / 退出）
 * - 编辑页隐藏底部导航，让表单拿到全部纵向空间（页内自带吸底保存栏）
 */
import { EditOutlined, EnvironmentFilled, LogoutOutlined, ThunderboltFilled, UnorderedListOutlined } from '@ant-design/icons'
import { Modal } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useOutlet } from 'react-router-dom'

import { useToken } from '@/hooks/useToken'
import { logout } from '@/servers/login'
import { TOKEN, HOME_PATH } from '@/utils/config'
import { setDesktopModeForced } from '@/utils/device'
import { removeLocalInfo } from '@/utils/local'

const MobileLayout = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [getToken, , removeToken] = useToken()
  const outlet = useOutlet()

  // 鉴权：复用桌面 JWT 登录态，未登录跳登录页
  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 退出登录：清 token 后整页跳登录（location.href 可重置全部内存态） */
  const onLogout = () => {
    Modal.confirm({
      title: t('content.mLogoutConfirm'),
      okText: t('public.confirm'),
      cancelText: t('public.cancel'),
      onOk: async () => {
        try {
          await logout()
        } catch (error) {
          console.error('退出登录接口失败（已忽略）:', error)
        }
        removeToken()
        removeLocalInfo(TOKEN)
        window.location.href = '/login'
      },
    })
  }

  const isTimeline = location.pathname === '/m' || location.pathname === '/m/'
  // 编辑态不需要底部导航
  const isEdit = location.pathname === '/m/edit'

  // 标题随路由切换（detail 等子页沿用站点标题）
  const titleMap: Record<string, string> = {
    '/m/memory': t('content.memoryTitle'),
    '/m/footprint': t('content.footprintTitle'),
  }
  const title = titleMap[location.pathname] || t('content.mobileTitle')

  /** 切换到桌面版：标记本次会话强留桌面，避免进桌面页又被自动跳回移动版 */
  const onSwitchDesktop = () => {
    setDesktopModeForced(true)
    navigate(HOME_PATH, { replace: true })
  }

  return (
    <div className='min-h-100vh bg-gray-100'>
      {/* 顶部标题栏：左占位保持标题居中，右侧为桌面版入口 */}
      <div
        className='
          sticky top-0 z-10
          grid grid-cols-[56px_1fr_56px] items-center
          px-4 py-3
          bg-white border-b border-gray-200
        '
      >
        <span />
        <span className='text-16px font-bold text-gray-800 text-center'>{title}</span>
        <button
          type='button'
          onClick={onSwitchDesktop}
          className='
            justify-self-end p-0 border-none bg-transparent cursor-pointer
            text-12px text-blue-500
          '
        >
          {t('content.mobileToDesktop')}
        </button>
      </div>

      {/* 内容区：底部留出自适应导航栏高度 */}
      <div className={isEdit ? '' : 'pb-64px'}>{outlet}</div>

      {/* 底部导航 */}
      {!isEdit && (
        <div
          className='
            fixed bottom-0 left-0 right-0 z-10
            flex bg-white border-t border-gray-200
          '
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <TabItem active={isTimeline} icon={<UnorderedListOutlined />} label={t('content.mobileTimeline')} onClick={() => navigate('/m')} />
          <TabItem
            active={location.pathname === '/m/memory'}
            icon={<ThunderboltFilled />}
            label={t('content.memoryTitle')}
            onClick={() => navigate('/m/memory')}
          />
          <TabItem
            active={location.pathname === '/m/footprint'}
            icon={<EnvironmentFilled />}
            label={t('content.footprintTitle')}
            onClick={() => navigate('/m/footprint')}
          />
          <TabItem icon={<EditOutlined />} label={t('content.mobileEditNew')} onClick={() => navigate('/m/edit')} />
          <TabItem icon={<LogoutOutlined />} label={t('content.mobileLogout')} onClick={onLogout} />
        </div>
      )}
    </div>
  )
}

/**
 * 底部导航单项
 */
const TabItem = (props: { active?: boolean; icon: JSX.Element; label: string; onClick: () => void }) => {
  const { active, icon, label, onClick } = props
  return (
    <div
      role='button'
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`
        flex-1 flex flex-col items-center justify-center gap-2px
        py-2 cursor-pointer select-none
        ${active ? 'text-blue-500 font-bold' : 'text-gray-500'}
      `}
    >
      {icon}
      <span className='text-11px'>{label}</span>
    </div>
  )
}

export default MobileLayout
