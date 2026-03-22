import { useRoutes } from 'react-router-dom'

import Layout from '@/layouts'
import NotFound from '@/pages/404'
import Login from '@/pages/login'

import { handleRoutes } from './utils/helper'

import type { DefaultComponent } from '@loadable/component'
import type { RouteObject } from 'react-router-dom'

type PageFiles = Record<string, () => Promise<DefaultComponent<unknown>>>
const pages = import.meta.glob('../pages/**/*.tsx') as PageFiles
const layouts = handleRoutes(pages)

// 添加显式路由配置，确保瀑布图演示页面可以正确访问
const demoRoutes: RouteObject[] = []

const newRoutes: RouteObject[] = [
  {
    path: 'login',
    element: <Login />,
  },
  {
    path: '',
    element: <Layout />,
    children: [...layouts, ...demoRoutes],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]

const App = () => <>{useRoutes(newRoutes)}</>

export default App
