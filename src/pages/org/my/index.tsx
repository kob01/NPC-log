import { Badge, Button, Card, Modal, Popconfirm, Space, Table, Tabs, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AllOrgs from './components/AllOrgs'
import OrgFormModal from './components/OrgFormModal'
import ReasonModal from './components/ReasonModal'
import RecordDetailModal from './components/RecordDetailModal'

import type { FormData } from '#/form'
import type { OrgFormValues } from './components/OrgFormModal'
import type { ColumnsType } from 'antd/es/table'

import BasicContent from '@/components/Content/BasicContent'
import { useCommonStore } from '@/hooks/useCommonStore'
import {
  applyJoin,
  auditRequest,
  createOrg,
  deleteOrg,
  getMyApplications,
  getMyOrgs,
  getMyRecords,
  getOrgMembers,
  getPendingRequests,
  getPublicOrgs,
  kickMember,
  leaveOrg,
  setOrgManager,
  updateOrg,
} from '@/servers/system/organization'
import { checkPermission } from '@/utils/permissions'

/** 接口返回的是 ISO 串，统一折成与其它列表一致的展示格式 */
const timeText = (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-')

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
  // 我提交的申请记录 / 已结束的审批记录：「我的组织」只剩已通过的成员关系，
  // 进行中的申请看 applications，已出结果的（我申请的 + 我管的组织里别人的）看 records
  const [applications, setApplications] = useState<FormData[]>([])
  const [records, setRecords] = useState<FormData[]>([])
  const [detailRecord, setDetailRecord] = useState<FormData | null>(null)
  // 申请与拒绝都收一个可选理由，所以走弹窗而不是 Popconfirm
  const [applyTarget, setApplyTarget] = useState<{ orgId: number; orgName: string } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<{ orgId: number; userId: number; name: string; inManage: boolean } | null>(null)
  const [reasonLoading, setReasonLoading] = useState(false)

  // 新建 / 编辑组织弹窗（原「组织管理」页的能力已并入本页）
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formId, setFormId] = useState('')
  const [formData, setFormData] = useState<FormData | undefined>(undefined)
  // 本页签发生变更时递增，驱动「全部组织」表重新拉取
  const [refreshKey, setRefreshKey] = useState(0)

  const { permissions, userId: myUserId } = useCommonStore()
  const canCreate = checkPermission('/org/my/create', permissions)
  const canUpdate = checkPermission('/org/my/update', permissions)
  const canDelete = checkPermission('/org/my/delete', permissions)
  // 「全部组织」是管理员专属页签（原「组织管理」页的权限标识）
  const canSeeAll = checkPermission('/org/manager/index', permissions)

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

  /** 展示名：昵称为空时回落登录账号（只取一个字段会整行空白） */
  const displayNameOf = (row: FormData) => String(row.real_name || row.username || '')

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

  const loadApplications = useCallback(async () => {
    const { code, data } = await getMyApplications()
    if (Number(code) === 200) {
      setApplications(data || [])
    }
  }, [])

  const loadRecords = useCallback(async () => {
    const { code, data } = await getMyRecords()
    if (Number(code) === 200) {
      setRecords(data || [])
    }
  }, [])

  useEffect(() => {
    loadMyOrgs()
    loadSquare()
    loadPendingAll()
    loadApplications()
    loadRecords()
  }, [loadMyOrgs, loadSquare, loadPendingAll, loadApplications, loadRecords])

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
    if (key === 'applications') {
      loadApplications()
    }
    if (key === 'finished') {
      loadRecords()
    }
  }

  /** 申请加入：先弹窗收可选理由（被审的人看得到） */
  const openApply = (orgId: number, orgName: string) => {
    setApplyTarget({ orgId, orgName })
  }

  const submitApply = async (reason: string) => {
    if (!applyTarget) {
      return
    }
    try {
      setReasonLoading(true)
      const { code, message: msg } = await applyJoin(applyTarget.orgId, reason)
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('system.applySubmitted'))
      setApplyTarget(null)
      // 被拒后重新申请也算一次变更，广场的 relation 与我的申请记录都要重拉
      loadSquare()
      loadApplications()
    } finally {
      setReasonLoading(false)
    }
  }

  /** 退出组织 */
  const handleLeave = async (id: number) => {
    const { code, message: msg } = await leaveOrg(id)
    if (Number(code) === 200) {
      message.success(msg || t('system.leftOrg'))
      loadMyOrgs()
      loadSquare()
      // 退出会连成员行一起删，申请记录里的那行也要跟着消
      loadApplications()
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

  /** 提交审批结论，返回是否成功让调用方决定后续刷新 */
  const doAudit = async (orgId: number, userId: number, approved: boolean, reason?: string) => {
    const { code, message: msg } = await auditRequest({ orgId, userId, approved, reason })
    if (Number(code) !== 200) {
      return false
    }
    message.success(msg || t('public.successfulOperation'))
    return true
  }

  /** 审批（管理弹窗内）：通过直接执行，拒绝先收理由 */
  const handleAudit = (userId: number, approved: boolean, name = '') => {
    const orgId = Number(curOrg?.id)
    if (!approved) {
      setRejectTarget({ orgId, userId, name, inManage: true })
      return
    }
    doAudit(orgId, userId, true).then(async (ok) => {
      if (!ok) {
        return
      }
      await refreshManage(orgId)
      loadMyOrgs()
      loadPendingAll()
      loadRecords()
    })
  }

  /** 审批（全局待审批入口，跨组织） */
  const handleAuditGlobal = (orgId: number, userId: number, approved: boolean, name = '') => {
    if (!approved) {
      setRejectTarget({ orgId, userId, name, inManage: false })
      return
    }
    doAudit(orgId, userId, true).then((ok) => {
      if (!ok) {
        return
      }
      loadPendingAll()
      loadMyOrgs()
      loadApplications()
      loadRecords()
      if (Number(curOrg?.id) === orgId) {
        refreshManage(orgId)
      }
    })
  }

  /** 拒绝（理由可选） */
  const submitReject = async (reason: string) => {
    if (!rejectTarget) {
      return
    }
    const { orgId, userId, inManage } = rejectTarget
    try {
      setReasonLoading(true)
      if (!(await doAudit(orgId, userId, false, reason))) {
        return
      }
      setRejectTarget(null)
      if (inManage) {
        await refreshManage(orgId)
      }
      loadMyOrgs()
      loadPendingAll()
      loadApplications()
      loadRecords()
    } finally {
      setReasonLoading(false)
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

  // ==================== 新建 / 编辑 / 删除组织 ====================

  /** 打开新建弹窗（登录用户都能建自己管理的组织，一人最多 5 个，超出后端报错） */
  const openCreate = () => {
    setFormId('')
    // 传 undefined：沿用上一行的引用会让表单带着上个组织的名称与描述
    setFormData(undefined)
    setFormOpen(true)
  }

  /** 打开编辑弹窗（仅组织管理者，后端同样会按「管理员 or 管理者」拦） */
  const openEdit = (record: FormData) => {
    setFormId(String(record.id))
    setFormData(record)
    setFormOpen(true)
  }

  /** 新建/编辑提交 */
  const handleOrgSubmit = async (values: OrgFormValues) => {
    try {
      setFormLoading(true)
      const { code, message: msg } = formId ? await updateOrg(formId, values) : await createOrg(values)
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('public.successfulOperation'))
      setFormOpen(false)
      loadMyOrgs()
      loadSquare()
      setRefreshKey((k) => k + 1)
    } finally {
      setFormLoading(false)
    }
  }

  /** 删除自己管理的组织（后端级联清成员关系与日志可见组织关联） */
  const handleDeleteOrg = async (id: number) => {
    const { code, message: msg } = await deleteOrg(String(id))
    if (Number(code) !== 200) {
      return
    }
    message.success(msg || t('public.successfullyDeleted'))
    if (Number(curOrg?.id) === id) {
      setManageOpen(false)
    }
    loadMyOrgs()
    loadSquare()
    loadPendingAll()
    setRefreshKey((k) => k + 1)
  }

  /** 移出成员：只删成员关系，日志的组织可见范围按成员实时算，移出去就看不到本组织日志了 */
  const handleKick = async (targetUserId: number) => {
    const orgId = Number(curOrg?.id)
    const { code, message: msg } = await kickMember(orgId, targetUserId)
    if (Number(code) !== 200) {
      return
    }
    message.success(msg || t('public.successfulOperation'))
    await refreshManage(orgId)
    loadMyOrgs()
  }

  // ==================== 我的组织列 ====================
  const myOrgColumns: ColumnsType<FormData> = [
    { title: t('system.orgName'), dataIndex: 'org_name', width: 160 },
    { title: t('system.description'), dataIndex: 'description', ellipsis: true },
    { title: t('system.myRole'), dataIndex: 'my_role', width: 100, render: (value: number) => <Tag>{roleText(value)}</Tag> },
    { title: t('system.memberCount'), dataIndex: 'member_count', width: 90 },
    {
      title: t('system.joinTime'),
      dataIndex: 'apply_time',
      width: 150,
      render: (value: string) => timeText(value),
    },
    {
      title: t('system.pendingCount'),
      dataIndex: 'pending_count',
      width: 90,
      render: (value: number) => (Number(value) > 0 ? <Tag color='red'>{value}</Tag> : value),
    },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 260,
      render: (_: unknown, record) => (
        <Space>
          {Number(record.my_status) === 1 && Number(record.is_manager) === 1 && (
            <Button type='primary' size='small' onClick={() => openManage(record)}>
              {t('system.manage')}
            </Button>
          )}
          {Number(record.my_status) === 1 && Number(record.is_manager) === 1 && canUpdate && (
            <Button size='small' onClick={() => openEdit(record)}>
              {t('public.edit')}
            </Button>
          )}
          {Number(record.my_status) === 1 && Number(record.is_manager) === 1 && canDelete && (
            <Popconfirm title={t('system.confirmDeleteOrg')} onConfirm={() => handleDeleteOrg(Number(record.id))}>
              <Button danger size='small'>
                {t('system.dismiss')}
              </Button>
            </Popconfirm>
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
          <Button type='primary' size='small' onClick={() => openApply(Number(record.id), String(record.org_name || ''))}>
            {t('system.applyJoin')}
          </Button>
        )
      },
    },
  ]

  // ==================== 待审批列 ====================
  const requestColumns: ColumnsType<FormData> = [
    { title: t('login.username'), dataIndex: 'username', width: 140 },
    { title: t('system.username'), dataIndex: 'real_name', width: 140 },
    {
      title: t('system.applyReason'),
      dataIndex: 'apply_reason',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 200,
      // 审批直接影响他人能否加入组织，属于不可逆操作：通过给二次确认，拒绝多收一个可选理由回显给申请人
      render: (_: unknown, record) => (
        <Space>
          <Popconfirm title={t('system.confirmApprove')} onConfirm={() => handleAudit(Number(record.userId), true)}>
            <Button type='primary' size='small'>
              {t('system.approve')}
            </Button>
          </Popconfirm>
          <Button danger size='small' onClick={() => handleAudit(Number(record.userId), false, displayNameOf(record))}>
            {t('system.reject')}
          </Button>
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
      width: 240,
      // 升降级与移出都是对别人的成员关系动手，统一二次确认；避免一行只能三个管理者时误点
      render: (_: unknown, record) => {
        const role = Number(record.role)
        if (role === 2) {
          return '-' // 创建者既不可变更也不可被移出
        }
        return (
          <Space>
            {role === 1 ? (
              <Popconfirm title={t('system.confirmDemote')} onConfirm={() => handleSetManager(Number(record.id), 0)}>
                <Button size='small'>{t('system.demote')}</Button>
              </Popconfirm>
            ) : (
              <Popconfirm title={t('system.confirmPromote')} onConfirm={() => handleSetManager(Number(record.id), 1)}>
                <Button size='small' type='primary'>
                  {t('system.promote')}
                </Button>
              </Popconfirm>
            )}
            {/* 移出自己没有意义（该用退出组织），后端也会拦，这里干脆不给按钮 */}
            {Number(record.id) !== Number(myUserId) && (
              <Popconfirm title={t('system.confirmKick')} onConfirm={() => handleKick(Number(record.id))}>
                <Button size='small' danger>
                  {t('system.kick')}
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  const canManage = myOrgs.some((o) => Number(o.is_manager) === 1)

  // 「我的申请」只装进行中的：已通过的在「我的组织」，已出结果的在「审批结束」
  const pendingMine = applications.filter((a) => Number(a.status) === 0)

  /** 仅刷新本页数据（给「全部组织」页签回调用，不能再递增 refreshKey，否则两个视图会相互触发重拉） */
  const reloadMine = () => {
    loadMyOrgs()
    loadSquare()
    loadPendingAll()
    // 管理员停用/解散组织会直接影响申请记录里的可重新申请判定
    loadApplications()
  }

  // 全局待审批列（跨组织）
  const pendingAllColumns: ColumnsType<FormData> = [
    { title: t('system.orgName'), dataIndex: 'org_name', width: 160 },
    { title: t('login.username'), dataIndex: 'username', width: 140 },
    { title: t('system.username'), dataIndex: 'real_name', width: 140 },
    {
      title: t('system.applyReason'),
      dataIndex: 'apply_reason',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: t('system.applyTime'),
      dataIndex: 'apply_time',
      width: 160,
      render: (value: string) => timeText(value),
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
          <Button danger size='small' onClick={() => handleAuditGlobal(Number(record.orgId), Number(record.userId), false, displayNameOf(record))}>
            {t('system.reject')}
          </Button>
        </Space>
      ),
    },
  ]

  // ==================== 我的申请列（只装进行中的）====================
  const applicationColumns: ColumnsType<FormData> = [
    { title: t('system.orgName'), dataIndex: 'org_name', width: 200 },
    {
      title: t('system.applyReason'),
      dataIndex: 'apply_reason',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    { title: t('system.applyTime'), dataIndex: 'apply_time', width: 180, render: (value: string) => timeText(value) },
  ]

  // ==================== 审批结束列（我申请的 + 我管的组织里别人的）====================
  const recordColumns: ColumnsType<FormData> = [
    {
      title: t('system.direction'),
      dataIndex: 'direction',
      width: 100,
      render: (value: string) => <Tag>{value === 'mine' ? t('system.dirMine') : t('system.dirOrg')}</Tag>,
    },
    { title: t('system.orgName'), dataIndex: 'org_name', width: 160 },
    { title: t('system.applicant'), dataIndex: 'username', width: 140, render: (_: string, record) => displayNameOf(record) },
    {
      title: t('system.auditResult'),
      dataIndex: 'status',
      width: 100,
      render: (value: number) =>
        Number(value) === 1 ? <Tag color='green'>{t('system.approved')}</Tag> : <Tag color='red'>{t('system.rejected')}</Tag>,
    },
    { title: t('system.auditTime'), dataIndex: 'audit_time', width: 160, render: (value: string) => timeText(value) },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 200,
      render: (_: unknown, record) => (
        // 整行可点开详情，所以这里要挡住冒泡：否则点「重新申请」会连带弹出详情，两层弹窗叠在一起
        <Space onClick={(e) => e.stopPropagation()}>
          <Button size='small' onClick={() => setDetailRecord(record)}>
            {t('system.viewReason')}
          </Button>
          {/* 自己申请且被拒、组织还在启用 → 允许再试一次 */}
          {record.direction === 'mine' && Number(record.status) === 2 && Number(record.org_status) === 1 && (
            <Button size='small' type='primary' onClick={() => openApply(Number(record.orgId), String(record.org_name || ''))}>
              {t('system.applyAgain')}
            </Button>
          )}
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
          tabBarExtraContent={
            canCreate && {
              right: (
                <Button type='primary' onClick={openCreate}>
                  {t('system.createOrg')}
                </Button>
              ),
            }
          }
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
            {
              key: 'applications',
              label: (
                <Badge count={pendingMine.length} size='small' offset={[8, -2]}>
                  <span>{t('system.myApplications')}</span>
                </Badge>
              ),
              children: (
                <Table
                  rowKey={(r: FormData) => String(r.orgId)}
                  loading={loading}
                  columns={applicationColumns}
                  dataSource={pendingMine as never[]}
                  locale={{ emptyText: t('system.noPendingApps') }}
                  pagination={false}
                />
              ),
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
            {
              // 两个方向已出结果的记录合在一处看，不用在「我的申请」与「我已处理」之间来回跳
              key: 'finished',
              label: t('system.finishedRecords'),
              children: (
                <Table
                  rowKey={(r: FormData) => `${r.direction}-${r.orgId}-${r.userId}`}
                  loading={loading}
                  columns={recordColumns}
                  dataSource={records as never[]}
                  onRow={(record) => ({ onClick: () => setDetailRecord(record as FormData), style: { cursor: 'pointer' } })}
                  pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (num) => t('public.totalNum', { num }) }}
                />
              ),
            },
            ...(canSeeAll
              ? [
                  {
                    key: 'all',
                    label: t('system.allOrg'),
                    children: <AllOrgs refreshKey={refreshKey} onChanged={reloadMine} />,
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

      <OrgFormModal
        open={formOpen}
        title={formId ? t('public.editTitle', { title: t('system.orgName') }) : t('public.createTitle', { title: t('system.orgName') })}
        data={formData}
        confirmLoading={formLoading}
        onCancel={() => setFormOpen(false)}
        onOk={handleOrgSubmit}
      />

      <ReasonModal
        open={!!applyTarget}
        title={t('system.applyJoin')}
        tip={t('system.applyTip', { name: applyTarget?.orgName || '' })}
        placeholder={t('system.applyReasonPlaceholder')}
        confirmLoading={reasonLoading}
        onCancel={() => setApplyTarget(null)}
        onOk={submitApply}
      />

      <ReasonModal
        open={!!rejectTarget}
        title={t('system.rejectTitle', { name: rejectTarget?.name || '' })}
        tip={t('system.rejectTip')}
        placeholder={t('system.rejectReasonPlaceholder')}
        confirmLoading={reasonLoading}
        onCancel={() => setRejectTarget(null)}
        onOk={submitReject}
      />

      <RecordDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
    </BasicContent>
  )
}

export default Page
