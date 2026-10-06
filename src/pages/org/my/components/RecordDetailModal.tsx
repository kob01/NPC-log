import { Modal, Spin, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getAuditHistory } from '@/servers/system/organization'

import type { FormData } from '#/form'
import type { CSSProperties, ReactNode } from 'react'

interface Props {
  /** 为 null 表示关闭；列表里只留这一份详情弹窗，避免每行挂一个实例 */
  record: FormData | null
  onClose: () => void
  /** record=已结束的审批记录（带方向/结果）；pending=待审批当场看历史（无方向/结果） */
  mode?: 'record' | 'pending'
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

/** 时间线里一小段带标题的理由块 */
const ReasonLine = ({ label, text, danger }: { label: string; text: string; danger?: boolean }) => (
  <div style={{ marginTop: 6 }}>
    <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 2 }}>{label}</div>
    <div {...reasonBox(danger ? '#d4380d' : undefined)}>{text}</div>
  </div>
)

/** 一条处理记录：结论 + 处理时间 + 处理人，下面依次是那一轮的申请理由与拒绝理由 */
const HistoryEntry = ({ item }: { item: FormData }) => {
  const { t } = useTranslation()
  const isApproved = Number(item.status) === 1
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        {isApproved ? <Tag color='green'>{t('system.approved')}</Tag> : <Tag color='red'>{t('system.rejected')}</Tag>}
        <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>{timeText(item.audit_time)}</span>
        {item.auditor_name ? <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>· {String(item.auditor_name)}</span> : null}
      </div>
      {item.apply_reason ? <ReasonLine label={t('system.applyReason')} text={String(item.apply_reason)} /> : null}
      {item.reason ? <ReasonLine label={t('system.auditReason')} text={String(item.reason)} danger={!isApproved} /> : null}
    </div>
  )
}

/**
 * 审批记录详情
 * 列表里只放结论（组织 / 结果 / 时间），申请理由与拒绝理由收在这里，
 * 否则一张表要挤两列长文本，行高被拉得没法看
 */
const RecordDetailModal = ({ record, onClose, mode = 'record' }: Props) => {
  const { t } = useTranslation()
  const approved = Number(record?.status) === 1
  const isMine = record?.direction === 'mine'
  const isPending = mode === 'pending'
  const [history, setHistory] = useState<FormData[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // 打开某条记录时拉它的完整审批往来：成员行只留最近一轮（被拒后重新申请还会清空），
  // 多次拒绝必须从历史表取，才能在「处理记录」里全部列出
  useEffect(() => {
    if (!record) {
      setHistory([])
      return
    }
    let alive = true
    setHistoryLoading(true)
    getAuditHistory(String(record.orgId), String(record.userId))
      .then(({ code, data }) => {
        if (alive && Number(code) === 200) {
          setHistory(data || [])
        }
      })
      .finally(() => {
        if (alive) {
          setHistoryLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [record])

  return (
    <Modal title={t('system.recordDetail')} open={!!record} onCancel={onClose} footer={null} width={520} destroyOnClose>
      {record && (
        <div style={{ paddingTop: 16 }}>
          <Row label={t('system.orgName')}>{String(record.org_name || '-')}</Row>
          {!isPending && <Row label={t('system.direction')}>{isMine ? t('system.dirMine') : t('system.dirOrg')}</Row>}
          {record.real_name || record.username ? <Row label={t('system.applicant')}>{String(record.real_name || record.username)}</Row> : null}
          {!isPending && (
            <Row label={t('system.auditResult')}>
              {approved ? <Tag color='green'>{t('system.approved')}</Tag> : <Tag color='red'>{t('system.rejected')}</Tag>}
            </Row>
          )}
          <Row label={t('system.applyTime')}>{timeText(record.apply_time)}</Row>
          <Row label={t('system.applyReason')}>{record.apply_reason ? <div {...reasonBox()}>{String(record.apply_reason)}</div> : '-'}</Row>
          <Row label={t('system.auditHistory')}>
            <Spin spinning={historyLoading}>
              {history.length ? (
                <div>
                  {history.map((item, index) => (
                    <HistoryEntry key={index} item={item} />
                  ))}
                </div>
              ) : (
                <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>{t('system.noHistory')}</span>
              )}
            </Spin>
          </Row>
        </div>
      )}
    </Modal>
  )
}

export default RecordDetailModal
