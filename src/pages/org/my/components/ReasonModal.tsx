import { Input, Modal } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// 对齐 note_org_members.apply_reason / audit_reason 的列宽
const REASON_MAX = 255

interface Props {
  open: boolean
  title: string
  /** 弹窗顶部的一行说明，告诉用户这条理由会落到谁手里 */
  tip?: string
  placeholder?: string
  confirmLoading?: boolean
  onCancel: () => void
  onOk: (reason: string) => void
}

/**
 * 可选理由输入框（申请理由与拒绝理由共用）
 * 只有一个字段，用受控 state 而不是再套一层 Form；每次打开清空，避免带出上一条的理由
 */
const ReasonModal = ({ open, title, tip, placeholder, confirmLoading = false, onCancel, onOk }: Props) => {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
    }
  }, [open])

  return (
    <Modal
      title={title}
      open={open}
      confirmLoading={confirmLoading}
      onOk={() => onOk(reason.trim())}
      onCancel={onCancel}
      okText={t('public.confirm')}
      cancelText={t('public.cancel')}
      destroyOnClose
      width={480}
    >
      {tip && <div className='mb-8px text-13px text-gray-500'>{tip}</div>}
      <Input.TextArea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder || t('public.pleaseEnter', { name: t('system.reason') })}
        rows={3}
        maxLength={REASON_MAX}
        showCount
      />
      <div className='mt-8px text-12px text-gray-400'>{t('system.reasonOptional')}</div>
    </Modal>
  )
}

export default ReasonModal
