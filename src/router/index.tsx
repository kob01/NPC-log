import { App, ConfigProvider, theme } from 'antd'
import enUS from 'antd/es/locale/en_US'
import zhCN from 'antd/es/locale/zh_CN'
import nprogress from 'nprogress'
import { useEffect } from 'react'
import { AliveScope } from 'react-activation'
import { useTranslation } from 'react-i18next'
import { BrowserRouter as Router } from 'react-router-dom'

import { useCommonStore } from '@/hooks/useCommonStore'
import { VERSION } from '@/utils/config'
import StaticAntd from '@/utils/staticAntd'

import AppPage from './App'

// antd主题
const { defaultAlgorithm, darkAlgorithm } = theme

const Page = () => {
  const { i18n } = useTranslation()
  const { theme: themeMode } = useCommonStore()
  // 获取当前语言
  const currentLanguage = i18n.language

  // 顶部进度条
  useEffect(() => {
    nprogress.done()

    // 首次进入清除版本缓存
    handleClearVersion()

    // 关闭loading
    const firstElement = document.getElementById('first')
    if (firstElement && firstElement.style?.display !== 'none') {
      firstElement.style.display = 'none'
    }

    return () => {
      nprogress.start()
    }
  }, [])

  /** 清空版本 */
  const handleClearVersion = () => {
    localStorage.removeItem(VERSION)
  }

  return (
    <Router>
      <ConfigProvider
        locale={currentLanguage === 'en' ? enUS : zhCN}
        theme={{
          algorithm: [themeMode === 'dark' ? darkAlgorithm : defaultAlgorithm],
        }}
      >
        <App>
          <StaticAntd />
          <AliveScope>
            <AppPage />
          </AliveScope>
        </App>
      </ConfigProvider>
    </Router>
  )
}

export default Page
