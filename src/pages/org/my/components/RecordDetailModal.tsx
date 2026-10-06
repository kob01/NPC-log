import { Modal, Tag } from 'antd'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import type { FormData } from '#/form'
import type { CSSProperties, ReactNode } from 'react'

interface Props {
  /** 为 null 表示关闭；列表里只留这一份详情弹窗，避免每行挂一个实例 */
  record: FormData | null
  onClose: () => void
}

/** 接口给的是 ISO 串（UTC），统一折成本地可读格式 */
const timeText = (value: unknown) => (value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '-')

/** 理由块的底色：用内联样式而不是原子类，跟随主题的黑底白字交给 antd 变量太绕 */
const reasonBox = (color?: string): { style: CSSProperties } => ({
  style: {
    borderRadius: 6,
    padding: '6px 10px',
    background: 'rgba(140, 140, 140, 0.12)',
    wordBreak: 'break-word',
    color,
  },
})

/** 一行「标签 + 内容」 */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', marginBottom: 12 }}>
    <div style={{ width: 88, flexShrink: 0, color: 'rgba(0, 0, 0, 0.45)', fontSize: 13 }}>{label}</div>
    <div style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', fontSize: 13 }}>{children}</div>
  </div>
)

/**
 * 审批记录详情
 * 列表里只放结论（组织 / 结果 / 时间），申请理由与拒绝理由收在这里，
 * 否则一张表要挤两列长文本，行高被拉得没法看
 */
const RecordDetailModal = ({ record, onClose }: Props) => {
  const { t } = useTranslation()
  const approved = Number(record?.status) === 1
  const isMine = record?.direction === 'mine'

  return (
    <Modal title={t('system.recordDetail')} open={!!record} onCancel={onClose} footer={null} width={520} destroyOnClose>
      {record && (
        <div style={{ paddingTop: 16 }}>
          <Row label={t('system.orgName')}>{String(record.org_name || '-')}</Row>
          <Row label={t('system.direction')}>{isMine ? t('system.dirMine') : t('system.dirOrg')}</Row>
          <Row label={t('system.applicant')}>{String(record.real_name || record.username || '-')}</Row>
          <Row label={t('system.auditResult')}>
            {approved ? <Tag color='green'>{t('system.approved')}</Tag> : <Tag color='red'>{t('system.rejected')}</Tag>}
          </Row>
          <Row label={t('system.applyTime')}>{timeText(record.apply_time)}</Row>
          <Row label={t('system.applyReason')}>{record.apply_reason ? <div {...reasonBox()}>{String(record.apply_reason)}</div> : '-'}</Row>
          <Row label={t('system.auditTime')}>{timeText(record.audit_time)}</Row>
          <Row label={t('system.auditor')}>{String(record.auditor_name || '-')}</Row>
          <Row label={t('system.auditReason')}>{record.audit_reason ? <div {...reasonBox('#d4380d')}>{String(record.audit_reason)}</div> : '-'}</Row>
        </div>
      )}
    </Modal>
  )
}

export default RecordDetailModal
