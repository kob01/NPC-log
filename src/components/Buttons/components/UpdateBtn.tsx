import { EditOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ButtonProps } from 'antd'

import { useHoverOverlay } from '@/hooks/useHoverOverlay'

interface Props extends Omit<ButtonProps, 'loading'> {
  isLoading: boolean
}

const UpdateBtn = (props: Props) => {
  const { isLoading, onClick } = props
  const { t } = useTranslation()
  // 浮层受控：页面被 KeepAlive 缓存时不会留下一枚没人关闭的「编辑」气泡
  const tip = useHoverOverlay()

  // 清除自定义属性
  const params: Partial<Props> = { ...props }
  delete params.isLoading

  return (
    <Tooltip title={t('public.edit')} open={tip.open} onOpenChange={tip.onOpenChange}>
      <Button type='primary' icon={<EditOutlined />} {...params} loading={!!isLoading} onClick={tip.withHide(onClick)} />
    </Tooltip>
  )
}

export default UpdateBtn
