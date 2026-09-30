import loadable from '@loadable/component'
import { useRoutes } from 'react-router-dom'

import { handleRoutes } from './utils/helper'

import type { DefaultComponent } from '@loadable/component'
import type { RouteObject } from 'react-router-dom'

import Layout from '@/layouts'
import NotFound from '@/pages/404'
import Login from '@/pages/login'
import Register from '@/pages/register'
import SharedView from '@/pages/s'

type PageFiles = Record<string, () => Promise<DefaultComponent<unknown>>>
const pages = import.meta.glob('../pages/**/*.tsx') as PageFiles
const layouts = handleRoutes(pages)

// 添加显式路由配置，确保瀑布图演示页面可以正确访问
const demoRoutes: RouteObject[] = []

// 移动端轻量页：独立裸布局（不含桌面菜单/标签页），不参与 Layout
const MobileLayout = loadable(() => import('@/pages/m/layout'))
const MobileHome = loadable(() => import('@/pages/m/index'))
const MobileDetail = loadable(() => import('@/pages/m/detail'))
const MobileMemory = loadable(() => import('@/pages/m/memory'))
const MobileFootprint = loadable(() => import('@/pages/m/footprint'))
const MobileEdit = loadable(() => import('@/pages/m/edit'))
const mobileRoutes: RouteObject[] = [
  {
    path: '/m',
    element: <MobileLayout />,
    children: [
      {
        path: '',
        element: <MobileHome />,
      },
      {
        path: 'detail',
        element: <MobileDetail />,
      },
      {
        path: 'memory',
        element: <MobileMemory />,
      },
      {
        path: 'footprint',
        element: <MobileFootprint />,
      },
      {
        path: 'edit',
        element: <MobileEdit />,
      },
    ],
  },
]

const newRoutes: RouteObject[] = [
  {
    path: 'login',
    element: <Login />,
  },
  {
    path: 'register',
    element: <Register />,
  },
  {
    // 公开分享访客页（无需登录，脱离 Layout 守卫）
    path: 's/:token',
    element: <SharedView />,
  },
  {
    path: '',
    element: <Layout />,
    children: [...layouts, ...demoRoutes],
  },
  ...mobileRoutes,
  {
    path: '*',
    element: <NotFound />,
  },
]

const App = () => <>{useRoutes(newRoutes)}</>

export default App
