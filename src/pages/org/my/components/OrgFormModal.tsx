import { Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { FormData } from '#/form'

import { FORM_REQUIRED } from '@/utils/config'
import { OPEN_CLOSE } from '@/utils/constants'

// 与后端 organizationService 的列宽校验保持一致（ORG_NAME_MAX / ORG_DESC_MAX）：
// 用 maxLength 卡在输入端，避免提交后才拿到「长度不能超过」的报错
const NAME_MAX = 100
const DESC_MAX = 255

// 用 type 而不是 interface：后者没有隐式索引签名，无法直接当作 FormData（Record<string, unknown>）传递
export type OrgFormValues = {
  org_name: string
  description?: string
  status?: number
}

interface Props {
  open: boolean
  title: string
  /** 编辑时回填的组织数据（新建传 undefined） */
  data?: FormData
  /** 启用/停用是平台治理权，只在管理员的「全部组织」页签暴露该字段 */
  showStatus?: boolean
  confirmLoading?: boolean
  onCancel: () => void
  onOk: (values: OrgFormValues) => void
}

/**
 * 组织新建 / 编辑弹窗
 * 「我的组织」页签（所有人建、改自己管理的组织）与管理员的「全部组织」页签共用一份表单，
 * 差别只在后者多一个启停用状态，因此用 showStatus 控制，而不是复制两个弹窗
 */
const OrgFormModal = ({ open, title, data, showStatus = false, confirmLoading = false, onCancel, onOk }: Props) => {
  const { t } = useTranslation()
  const [form] = Form.useForm<OrgFormValues>()

  // 每次打开都重灌一遍：沿用上一次实例会让「新建」带着刚编辑过的名称与描述
  useEffect(() => {
    if (!open) {
      return
    }
    form.resetFields()
    if (data) {
      form.setFieldsValue({
        org_name: String(data.org_name ?? ''),
        description: String(data.description ?? ''),
        status: Number(data.status ?? 1),
      })
    }
  }, [open, data, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    onOk(values)
  }

  return (
    <Modal
      title={title}
      open={open}
      confirmLoading={confirmLoading}
      onOk={handleOk}
      onCancel={onCancel}
      okText={t('public.confirm')}
      cancelText={t('public.cancel')}
      destroyOnClose
      width={520}
    >
      <Form form={form} labelCol={{ span: 5 }} initialValues={{ status: 1 }} preserve={false}>
        <Form.Item label={t('system.orgName')} name='org_name' rules={FORM_REQUIRED}>
          <Input placeholder={t('system.pleaseEnterOrgName')} maxLength={NAME_MAX} />
        </Form.Item>
        <Form.Item label={t('system.orgDescription')} name='description'>
          <Input.TextArea placeholder={t('public.pleaseEnter', { name: t('system.orgDescription') })} rows={3} maxLength={DESC_MAX} showCount />
        </Form.Item>
        {showStatus && (
          <Form.Item label={t('system.state')} name='status' rules={FORM_REQUIRED}>
            <Select options={OPEN_CLOSE(t)} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default OrgFormModal
