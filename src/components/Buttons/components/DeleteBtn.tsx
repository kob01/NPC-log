import { ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, App, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ButtonProps } from 'antd'

interface Props extends Omit<ButtonProps, 'loading'> {
  isLoading: boolean
  handleDelete: () => void
}

const DeleteBtn = (props: Props) => {
  const { isLoading, handleDelete } = props
  const { t } = useTranslation()
  const { modal } = App.useApp()

  // 清除自定义属性
  const params: Partial<Props> = { ...props }
  delete params.isLoading
  delete params.handleDelete

  const showConfirm = () => {
    modal.confirm({
      title: t('public.kindTips'),
      icon: <ExclamationCircleOutlined />,
      content: t('public.confirmMessage', { name: t('public.delete') }),
      okText: t('public.confirm'),
      okType: 'danger',
      cancelText: t('public.cancel'),
      onOk() {
        handleDelete()
      },
    })
  }

  return (
    <Tooltip title={t('public.delete')}>
      <Button
        danger
        type='primary'
        icon={<DeleteOutlined />}
        {...params}
        loading={!!isLoading}
        onClick={showConfirm}
      />
    </Tooltip>
  )
}

export default DeleteBtn
