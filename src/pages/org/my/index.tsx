import { Badge, Button, Card, Modal, Popconfirm, Space, Table, Tabs, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { FormData } from '#/form'
import type { ColumnsType } from 'antd/es/table'

import BasicContent from '@/components/Content/BasicContent'
import {
  applyJoin,
  auditRequest,
  getMyOrgs,
  getOrgMembers,
  getPendingRequests,
  getPublicOrgs,
  leaveOrg,
  setOrgManager,
} from '@/servers/system/organization'

const Page = () => {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [myOrgs, setMyOrgs] = useState<FormData[]>([])
  const [square, setSquare] = useState<FormData[]>([])

  // 管理弹窗
  const [manageOpen, setManageOpen] = useState(false)
  const [curOrg, setCurOrg] = useState<FormData | null>(null)
  const [requests, setRequests] = useState<FormData[]>([])
  const [members, setMembers] = useState<FormData[]>([])
  // 全局待审批（我管理的所有组织的申请）
  const [pendingAll, setPendingAll] = useState<FormData[]>([])

  /** 角色文案 */
  const roleText = (role: number) => {
    if (Number(role) === 2) {
      return t('system.creator')
    }
    if (Number(role) === 1) {
      return t('system.manager')
    }
    return t('system.member')
  }

  const loadMyOrgs = useCallback(async () => {
    try {
      setLoading(true)
      const { code, data } = await getMyOrgs()
      if (Number(code) === 200) {
        setMyOrgs(data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSquare = useCallback(async () => {
    const { code, data } = await getPublicOrgs()
    if (Number(code) === 200) {
      setSquare(data || [])
    }
  }, [])

  const loadPendingAll = useCallback(async () => {
    const { code, data } = await getPendingRequests()
    if (Number(code) === 200) {
      setPendingAll(data || [])
    }
  }, [])

  useEffect(() => {
    loadMyOrgs()
    loadSquare()
    loadPendingAll()
  }, [loadMyOrgs, loadSquare, loadPendingAll])

  /**
   * 切换页签时拉对应数据
   * 此前三个页签只在挂载时各拉一次，审批通过后切到「组织广场」看到的还是旧成员数
   * @param key - 页签 key
   */
  const onTabChange = (key: string) => {
    if (key === 'mine') {
      loadMyOrgs()
    }
    if (key === 'square') {
      loadSquare()
    }
    if (key === 'pending') {
      loadPendingAll()
    }
  }

  /** 申请加入 */
  const handleApply = async (id: number) => {
    const { code, message: msg } = await applyJoin(id)
    if (Number(code) === 200) {
      message.success(msg || t('system.applySubmitted'))
      loadSquare()
    }
  }

  /** 退出组织 */
  const handleLeave = async (id: number) => {
    const { code, message: msg } = await leaveOrg(id)
    if (Number(code) === 200) {
      message.success(msg || t('system.leftOrg'))
      loadMyOrgs()
      loadSquare()
      if (Number(curOrg?.id) === id) {
        setManageOpen(false)
      }
    }
  }

  /** 刷新当前管理组织数据 */
  const refreshManage = useCallback(async (orgId: number) => {
    const [req, mem] = await Promise.all([getPendingRequests(orgId), getOrgMembers(String(orgId))])
    if (Number(req.code) === 200) {
      setRequests(req.data || [])
    }
    if (Number(mem.code) === 200) {
      setMembers(mem.data || [])
    }
  }, [])

  /** 打开管理弹窗 */
  const openManage = async (org: FormData) => {
    setCurOrg(org)
    setManageOpen(true)
    await refreshManage(Number(org.id))
  }

  /** 审批 */
  const handleAudit = async (userId: number, approved: boolean) => {
    const { code, message: msg } = await auditRequest({
      orgId: Number(curOrg?.id),
      userId,
      approved,
    })
    if (Number(code) === 200) {
      message.success(msg || t('public.successfulOperation'))
      await refreshManage(Number(curOrg?.id))
      loadMyOrgs()
      loadPendingAll()
    }
  }

  /** 审批（全局待审批入口，跨组织） */
  const handleAuditGlobal = async (orgId: number, userId: number, approved: boolean) => {
    const { code, message: msg } = await auditRequest({ orgId, userId, approved })
    if (Number(code) === 200) {
      message.success(msg || t('public.successfulOperation'))
      loadPendingAll()
      loadMyOrgs()
      if (Number(curOrg?.id) === orgId) {
        refreshManage(orgId)
      }
    }
  }

  /** 提升/降级管理者 */
  const handleSetManager = async (userId: number, role: number) => {
    const { code, message: msg } = await setOrgManager({
      orgId: Number(curOrg?.id),
      userId,
      role,
    })
    if (Number(code) === 200) {
      message.success(msg || t('public.successfulOperation'))
      await refreshManage(Number(curOrg?.id))
      loadMyOrgs()
    }
  }

  // ==================== 我的组织列 ====================
  const myOrgColumns: ColumnsType<FormData> = [
    { title: t('system.orgName'), dataIndex: 'org_name', width: 160 },
    { title: t('system.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('system.myRole'),
      dataIndex: 'my_role',
      width: 100,
      render: (value: number) => <Tag>{roleText(value)}</Tag>,
    },
    {
      title: t('system.state'),
      dataIndex: 'my_status',
      width: 110,
      render: (value: number) =>
        Number(value) === 1 ? <Tag color='green'>{t('system.approved')}</Tag> : <Tag color='orange'>{t('system.pending')}</Tag>,
    },
    { title: t('system.memberCount'), dataIndex: 'member_count', width: 90 },
    {
      title: t('system.pendingCount'),
      dataIndex: 'pending_count',
      width: 90,
      render: (value: number) => (Number(value) > 0 ? <Tag color='red'>{value}</Tag> : value),
    },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 180,
      render: (_: unknown, record) => (
        <Space>
          {Number(record.my_status) === 1 && Number(record.is_manager) === 1 && (
            <Button type='primary' size='small' onClick={() => openManage(record)}>
              {t('system.manage')}
            </Button>
          )}
          {Number(record.my_status) === 1 && (
            <Popconfirm title={t('system.confirmLeave')} onConfirm={() => handleLeave(Number(record.id))}>
              <Button danger size='small'>
                {t('system.leave')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ==================== 组织广场列 ====================
  const squareColumns: ColumnsType<FormData> = [
    { title: t('system.orgName'), dataIndex: 'org_name', width: 160 },
    { title: t('system.description'), dataIndex: 'description', ellipsis: true },
    { title: t('system.memberCount'), dataIndex: 'member_count', width: 90 },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 160,
      render: (_: unknown, record) => {
        const relation = record.relation as string
        if (relation === 'joined') {
          return (
            <Popconfirm title={t('system.confirmLeave')} onConfirm={() => handleLeave(Number(record.id))}>
              <Button danger size='small'>
                {t('system.leave')}
              </Button>
            </Popconfirm>
          )
        }
        if (relation === 'pending') {
          return <Tag color='orange'>{t('system.pending')}</Tag>
        }
        return (
          <Popconfirm title={t('system.confirmApply')} onConfirm={() => handleApply(Number(record.id))}>
            <Button type='primary' size='small'>
              {t('system.applyJoin')}
            </Button>
          </Popconfirm>
        )
      },
    },
  ]

  // ==================== 待审批列 ====================
  const requestColumns: ColumnsType<FormData> = [
    { title: t('login.username'), dataIndex: 'username', width: 140 },
    { title: t('system.username'), dataIndex: 'real_name', width: 140 },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 200,
      // 审批直接影响他人能否加入组织，属于不可逆操作，与同页「退出/申请」保持一致加二次确认
      render: (_: unknown, record) => (
        <Space>
          <Popconfirm title={t('system.confirmApprove')} onConfirm={() => handleAudit(Number(record.userId), true)}>
            <Button type='primary' size='small'>
              {t('system.approve')}
            </Button>
          </Popconfirm>
          <Popconfirm title={t('system.confirmReject')} onConfirm={() => handleAudit(Number(record.userId), false)}>
            <Button danger size='small'>
              {t('system.reject')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ==================== 成员列 ====================
  const memberColumns: ColumnsType<FormData> = [
    { title: t('login.username'), dataIndex: 'username', width: 140 },
    { title: t('system.username'), dataIndex: 'real_name', width: 140 },
    {
      title: t('system.role'),
      dataIndex: 'role',
      width: 100,
      render: (value: number) => <Tag>{roleText(value)}</Tag>,
    },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 160,
      // 变更管理者同样加二次确认，避免一行只能三个成员名额时误点
      render: (_: unknown, record) => {
        const role = Number(record.role)
        if (role === 2) {
          return '-'
        } // 创建者不可变更
        return role === 1 ? (
          <Popconfirm title={t('system.confirmDemote')} onConfirm={() => handleSetManager(Number(record.id), 0)}>
            <Button size='small'>{t('system.demote')}</Button>
          </Popconfirm>
        ) : (
          <Popconfirm title={t('system.confirmPromote')} onConfirm={() => handleSetManager(Number(record.id), 1)}>
            <Button size='small' type='primary'>
              {t('system.promote')}
            </Button>
          </Popconfirm>
        )
      },
    },
  ]

  const canManage = myOrgs.some((o) => Number(o.is_manager) === 1)

  // 全局待审批列（跨组织）
  const pendingAllColumns: ColumnsType<FormData> = [
    { title: t('system.orgName'), dataIndex: 'org_name', width: 160 },
    { title: t('login.username'), dataIndex: 'username', width: 140 },
    { title: t('system.username'), dataIndex: 'real_name', width: 140 },
    {
      title: t('system.applyTime'),
      dataIndex: 'apply_time',
      width: 180,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 160,
      render: (_: unknown, record) => (
        <Space>
          <Popconfirm title={t('system.confirmApprove')} onConfirm={() => handleAuditGlobal(Number(record.orgId), Number(record.userId), true)}>
            <Button type='primary' size='small'>
              {t('system.approve')}
            </Button>
          </Popconfirm>
          <Popconfirm title={t('system.confirmReject')} onConfirm={() => handleAuditGlobal(Number(record.orgId), Number(record.userId), false)}>
            <Button danger size='small'>
              {t('system.reject')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <BasicContent>
      <Card>
        <Tabs
          defaultActiveKey='mine'
          onChange={onTabChange}
          items={[
            {
              key: 'mine',
              label: t('system.myOrg'),
              children: <Table rowKey='id' loading={loading} columns={myOrgColumns} dataSource={myOrgs as never[]} pagination={false} />,
            },
            {
              key: 'square',
              label: t('system.orgSquare'),
              children: <Table rowKey='id' loading={loading} columns={squareColumns} dataSource={square as never[]} pagination={false} />,
            },
            ...(canManage || pendingAll.length > 0
              ? [
                  {
                    key: 'pending',
                    label: (
                      <Badge count={pendingAll.length} size='small' offset={[8, -2]}>
                        <span>{t('system.pendingRequests')}</span>
                      </Badge>
                    ),
                    children: (
                      <Table
                        rowKey={(r: FormData) => `${r.orgId}-${r.userId}`}
                        loading={loading}
                        columns={pendingAllColumns}
                        dataSource={pendingAll as never[]}
                        pagination={false}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Modal
        title={`${t('system.manageOrg')}${curOrg ? ` - ${curOrg.org_name}` : ''}`}
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        footer={null}
        width={720}
      >
        <Tabs
          items={[
            {
              key: 'requests',
              label: `${t('system.pendingRequests')}${requests.length ? `(${requests.length})` : ''}`,
              children: <Table rowKey='userId' columns={requestColumns} dataSource={requests as never[]} pagination={false} />,
            },
            {
              key: 'members',
              label: t('system.orgMembers'),
              children: <Table rowKey='id' columns={memberColumns} dataSource={members as never[]} pagination={false} />,
            },
          ]}
        />
      </Modal>
    </BasicContent>
  )
}

export default Page
