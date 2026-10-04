import { Input, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { useClipboard } from '@/hooks/useClipboard'

import type { InputProps } from 'antd'

const { Search } = Input

const CopyInput = (props: InputProps) => {
  const { t } = useTranslation()
  const [, copyToClipboard] = useClipboard()

  /**
   * 处理复制
   * @param value - 复制内容
   */
  const handleCopy = (value: string) => {
    if (!value) {
      return message.warning({ content: t('public.inputPleaseEnter'), key: 'copy' })
    }
    try {
      copyToClipboard(value)
      message.success({ content: t('public.copySuccessfully'), key: 'copy' })
    } catch (e) {
      message.warning({ content: t('public.copyFailed'), key: 'copy' })
    }
  }

  return <Search {...props} placeholder={t('public.inputPleaseEnter')} enterButton={t('public.copy')} onSearch={handleCopy} />
}

export default CopyInput
