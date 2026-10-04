import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { message, Form, Button, Input } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import Logo from '@/assets/images/logo.svg'
import I18n from '@/components/I18n'
import { useCommonStore } from '@/hooks/useCommonStore'
import { useToken } from '@/hooks/useToken'
import { login } from '@/servers/login'
import { getPermissions } from '@/servers/permissions'
import { getMenuList } from '@/servers/system/menu'
import { setMenuList } from '@/stores/menu'
import { setThemeValue } from '@/stores/public'
import { setPermissions, setUserInfo } from '@/stores/user'
import { PASSWORD_RULE, THEME_KEY, HOME_PATH } from '@/utils/config'
import { encryptMd5 } from '@/utils/crypto'

import type { SideMenu } from '#/public'
import type { LoginData } from './model'
import type { AppDispatch } from '@/stores'
import type { ThemeType } from '@/stores/public'
import type { FormProps } from 'antd'

const Login = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch: AppDispatch = useDispatch()
  const [getToken, setToken] = useToken()
  const [isLoading, setLoading] = useState(false)

  const { permissions, menuList } = useCommonStore()
  const themeCache = (localStorage.getItem(THEME_KEY) || 'light') as ThemeType

  useEffect(() => {
    if (!themeCache) {
      localStorage.setItem(THEME_KEY, 'light')
    }
    if (themeCache === 'dark') {
      document.body.className = 'theme-dark'
    }
    dispatch(setThemeValue(themeCache === 'dark' ? 'dark' : 'light'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeCache])

  useEffect(() => {
    // 如果存在token，则直接进入页面
    const localToken = localStorage.getItem('NPC_token')
    if (localToken) {
      navigate(HOME_PATH)
    }

    if (getToken()) {
      // 如果不存在缓存则获取权限
      if (!permissions.length) {
        getUserPermissions()
      } else {
        // 有权限则直接跳转
        handleGoMenu()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 获取用户权限 */
  const getUserPermissions = async () => {
    try {
      setLoading(true)
      const { code, data } = await getPermissions({ refresh_cache: false })
      if (Number(code) !== 200) {
        return
      }
      const { user, permissions } = data
      dispatch(setUserInfo(user))
      dispatch(setPermissions(permissions))
      handleGoMenu()
    } finally {
      setLoading(false)
    }
  }

  /** 获取菜单数据 */
  const getMenuData = async () => {
    if (menuList?.length) {
      return menuList
    }
    let result: SideMenu[] = []

    try {
      setLoading(true)
      const { code, data } = await getMenuList()
      // const { code, data } = { "code": 200, "data": [{ "label": "仪表盘", "labelEn": "Dashboard", "icon": "la:tachometer-alt", "key": "/dashboard", "rule": "/dashboard" }, { "label": "组件", "labelEn": "Components", "icon": "fluent:box-20-regular", "key": "/demo", "children": [{ "label": "剪切板", "labelEn": "Copy", "key": "/demo/copy", "rule": "/demo/copy" }, { "label": "水印", "labelEn": "Watermark", "key": "/demo/watermark", "rule": "/demo/watermark" }, { "label": "虚拟滚动", "labelEn": "Virtual Scroll", "key": "/demo/virtualScroll", "rule": "/demo/virtualScroll" }, { "label": "富文本", "labelEn": "Editor", "key": "/demo/editor", "rule": "/demo/editor" }, { "label": "动态路由参数", "labelEn": "Dynamic", "key": "/demo/123/dynamic", "rule": "/demo/dynamic" }, { "label": "层级1", "labelEn": "Level1", "key": "/demo/level1", "children": [{ "label": "层级2", "labelEn": "Level2", "key": "/demo/level1/level2", "children": [{ "label": "层级3", "labelEn": "Level3", "key": "/demo/level1/level2/level3", "rule": "/demo/watermark" }] }] }] }, { "label": "系统管理", "labelEn": "System Management", "icon": "ion:settings-outline", "key": "/system", "children": [{ "label": "用户管理", "labelEn": "User Management", "key": "/system/user", "rule": "/authority/user" }, { "label": "菜单管理", "labelEn": "Menu Management", "key": "/system/menu", "rule": "/authority/menu" }] }, { "label": "内容管理", "labelEn": "Content Management", "icon": "majesticons:article-search-line", "key": "/content", "children": [{ "label": "文章管理", "labelEn": "Article Management", "key": "/content/article", "rule": "/content/article" }] }] };
      if (Number(code) !== 200) {
        return
      }
      dispatch(setMenuList(data || []))
      result = data
    } finally {
      setLoading(false)
    }

    return result
  }

  /** 菜单跳转（确保菜单数据已缓存后跳首页） */
  const handleGoMenu = async () => {
    if (!menuList?.length) {
      await getMenuData()
    }
    navigate(HOME_PATH)
  }

  /**
   * 处理登录
   * @param values - 表单数据
   */
  const handleFinish: FormProps['onFinish'] = async (values: LoginData) => {
    try {
      setLoading(true)
      const { code, data } = await login({
        username: values.username,
        password: encryptMd5(values.password),
      })
      if (Number(code) !== 200) {
        return
      }
      const { token, user, permissions } = data

      if (!permissions?.length || !token) {
        return message.error({ content: t('login.notPermissions'), key: 'permissions' })
      }
      localStorage.setItem('NPC_token', token)
      localStorage.setItem('NPC_user', JSON.stringify(user))
      setToken(token)
      dispatch(setUserInfo(user))
      dispatch(setPermissions(permissions))
      handleGoMenu()
    } finally {
      setLoading(false)
    }
  }

  /**
   * 处理失败
   * @param errors - 错误信息
   */
  const handleFinishFailed: FormProps['onFinishFailed'] = (errors) => {
    console.error('错误信息:', errors)
  }

  return (
    <>
      <div
        className={`
        ${themeCache === 'dark' ? 'bg-black text-white' : 'bg-light-400'}
        w-screen
        h-screen
        relative
      `}
      >
        <div className='absolute top-5 right-5'>
          <I18n />
        </div>
        <div
          className={`
          w-300px
          h-290px
          p-30px
          rounded-5px
          ${themeCache === 'dark' ? 'bg-black bg-dark-200' : 'bg-white'}
          box-border
          absolute
          left-1/2
          top-1/2
          -translate-x-1/2
          -translate-y-1/2
        `}
        >
          <div className='pb-30px pt-10px flex items-center justify-center'>
            <img className='mr-2 object-contain' width='30' height='30' src={Logo} alt='LOGO' />
            <span className='text-xl font-bold tracking-2px'>{t('login.systemLogin')}</span>
          </div>
          <Form
            name='horizontal_login'
            autoComplete='on'
            onFinish={handleFinish}
            onFinishFailed={handleFinishFailed}
            initialValues={{
              username: 'pink',
              password: '',
            }}
          >
            <Form.Item name='username' rules={[{ required: true, message: t('public.pleaseEnter', { name: t('login.username') }) }]}>
              <Input
                allow-clear='true'
                placeholder={t('login.username')}
                data-test='username'
                autoComplete='username'
                addonBefore={<UserOutlined className='change' />}
              />
            </Form.Item>

            <Form.Item
              name='password'
              rules={[{ required: true, message: t('public.pleaseEnter', { name: t('login.password') }) }, PASSWORD_RULE(t)]}
            >
              <Input.Password placeholder={t('login.password')} autoComplete='current-password' addonBefore={<LockOutlined className='change' />} />
            </Form.Item>

            <Form.Item>
              <Button type='primary' htmlType='submit' className='w-full mt-5px rounded-5px tracking-2px' loading={isLoading}>
                {t('login.login')}
              </Button>
            </Form.Item>

            <div className='flex justify-center'>
              <Button type='link' size='small' onClick={() => navigate('/register')}>
                {t('login.toRegister')}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </>
  )
}

export default Login
