import { EditOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ButtonProps } from 'antd'

interface Props extends Omit<ButtonProps, 'loading'> {
  isLoading: boolean
}

const UpdateBtn = (props: Props) => {
  const { isLoading } = props
  const { t } = useTranslation()

  // 清除自定义属性
  const params: Partial<Props> = { ...props }
  delete params.isLoading

  return (
    <Tooltip title={t('public.edit')}>
      <Button type='primary' icon={<EditOutlined />} {...params} loading={!!isLoading} />
    </Tooltip>
  )
}

export default UpdateBtn
