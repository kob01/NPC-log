// 生成路由排除内容，不带后缀名转换成“/文件名/”格式
export const ROUTER_EXCLUDE = [
  'login',
  'register',
  'components',
  'utils',
  'lib',
  'hooks',
  'model.tsx',
  '404.tsx',
  // 移动端页面走 App.tsx 显式路由（不包桌面 Layout），匹配 /m/ 目录段
  '/m/',
]
