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
  // 移动端页面走 App.tsx 显式路由（不包桌面 Layout）。
  // 此处必须写裸目录名：helper 会给不带“.”的项自动包成 /项/，
  // 若写成 '/m/' 会被二次包成 '//m//' 从而永不匹配，排除失效。
  'm',
  // 公开分享页（/s/:token）走 App.tsx 显式顶层路由，不被自动扫描纳入 Layout 守卫
  's',
]
