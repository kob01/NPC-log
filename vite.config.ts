import { defineConfig, loadEnv } from 'vite'
import { createVitePlugins } from './build/plugins'
import { buildOptions } from './build/vite/build'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root)

  return {
    plugins: createVitePlugins(),
    resolve: {
      alias: {
        '@': '/src',
        '#': '/types',
      },
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          charset: false,
        },
      },
    },
    server: {
      open: true,
      port: +env.VITE_SERVER_PORT,
      // 跨域处理
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
        },
        // 后端静态图片资源代理（dev 环境下 /uploads 相对路径可访问）
        '/uploads': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
        },
      },
    },
    build: buildOptions(),
  }
})
