import { Icon } from '@iconify/react'
import { Tooltip } from 'antd'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import SearchModal from './components/SearchModal'

import type { SearchModalProps } from './components/SearchModal'

/**
 * @description: 全局搜索菜单组件
 */
const GlobalSearch = () => {
  const { t } = useTranslation()
  const modalRef = useRef<SearchModalProps>(null)

  /** 切换显示 */
  const toggle = () => {
    modalRef.current?.toggle()
  }

  return (
    <>
      <Tooltip title={t('public.search')}>
        {/* 外层用原生 div 承载 ref 与点击：Icon 首帧是异步加载的占位 span、拿不到 ref，
            antd Tooltip 会退化成 findDOMNode，React 开发模式下报 deprecation 警告 */}
        <div className='flex items-center justify-center text-lg mr-3 cursor-pointer' onClick={toggle}>
          <Icon icon='uil-search' />
        </div>
      </Tooltip>

      <SearchModal modalRef={modalRef} />
    </>
  )
}

export default GlobalSearch
