import { StyleProvider, legacyLogicalPropertiesTransformer } from '@ant-design/cssinjs'
import dayjs from 'dayjs'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'

import Router from './router'
import { store } from './stores'
import '@/assets/css/public.less'
import '@/assets/fonts/font.less'
import 'uno.css'
import 'nprogress/nprogress.css'
import '@/assets/css/scrollbar.less'
import '@/assets/css/theme-color.less'
import './locales/config'
import '@/assets/css/antd.less'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <StyleProvider hashPriority='high' transformers={[legacyLogicalPropertiesTransformer]}>
    <Provider store={store}>
      <Router />
    </Provider>
  </StyleProvider>
)

// 关闭loading
const firstElement = document.getElementById('first')
if (firstElement && firstElement.style?.display !== 'none') {
  firstElement.style.display = 'none'
}
