import { Icon } from '@iconify/react'
import { Button, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { useClipboard } from '@/hooks/useClipboard'

import type { ButtonProps } from 'antd'

interface Props extends ButtonProps {
  text: string
  value: string
}

const CopyBtn = (props: Props) => {
  const { text, value } = props
  const { t } = useTranslation()
  const [, copyToClipboard] = useClipboard()

  /** 点击编辑 */
  const onClick = () => {
    try {
      copyToClipboard(value)
      message.success({ content: t('public.copySuccessfully'), key: 'copy' })
    } catch (e) {
      message.warning({ content: t('public.copyFailed'), key: 'copy' })
    }
  }

  return (
    <Button {...props} icon={<Icon icon='ant-design:copy-outlined' />} onClick={onClick}>
      {text}
    </Button>
  )
}

export default CopyBtn
