import { Button, Form, Input, Popconfirm, Select, Space, Table, message } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import OrgFormModal from './OrgFormModal'

import type { FormData } from '#/form'
import type { OrgFormValues } from './OrgFormModal'
import type { ColumnsType } from 'antd/es/table'

import { useCommonStore } from '@/hooks/useCommonStore'
import { createOrg, deleteOrg, getOrgPage, updateOrg } from '@/servers/system/organization'
import { INIT_PAGINATION } from '@/utils/config'
import { GlobalStatus, OPEN_CLOSE } from '@/utils/constants'
import { checkPermission } from '@/utils/permissions'

interface Props {
  /** 父级「我的组织」页签自身发生变更时递增，用于驱动本表重新拉取 */
  refreshKey: number
  /** 本表内发生变更后通知父级刷新「我的组织」「待审批」等视图 */
  onChanged: () => void
}

/**
 * 全部组织（原「组织管理」页，仅系统管理员可见）
 * 合并到「我的组织」后仍保留平台治理职责：跨组织搜索、启停用、删除任意组织；
 * 普通用户看不到本页签，他们只能在自己的组织上增删改（后端同样按「管理员 or 该组织管理者」拦）
 */
const AllOrgs = ({ refreshKey, onChanged }: Props) => {
  const { t } = useTranslation()
  const [searchForm] = Form.useForm()

  const [loading, setLoading] = useState(false)
  const [isFormOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formTitle, setFormTitle] = useState(t('public.createTitle', { title: t('system.orgName') }))
  const [formData, setFormData] = useState<FormData | undefined>(undefined)
  const [editId, setEditId] = useState('')
  const [searchData, setSearchData] = useState<FormData>({})
  const [page, setPage] = useState(INIT_PAGINATION.page)
  const [pageSize, setPageSize] = useState(INIT_PAGINATION.pageSize)
  const [total, setTotal] = useState(0)
  const [list, setList] = useState<FormData[]>([])

  const { permissions } = useCommonStore()
  const canUpdate = checkPermission('/org/manager/update', permissions)
  const canDelete = checkPermission('/org/manager/delete', permissions)

  const getPage = useCallback(async () => {
    try {
      setLoading(true)
      const { code, data } = await getOrgPage({ ...searchData, page, pageSize })
      if (Number(code) !== 200) {
        return
      }
      setTotal(Number(data.total) || 0)
      setList(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [searchData, page, pageSize])

  useEffect(() => {
    getPage()
  }, [getPage, refreshKey])

  /** 点击查询 */
  const onSearch = (values: FormData) => {
    setPage(1)
    setSearchData({ keyword: values.keyword || undefined, status: values.status === '' || values.status === undefined ? undefined : values.status })
  }

  /** 重置搜索条件 */
  const onReset = () => {
    searchForm.resetFields()
    onSearch({})
  }

  /** 打开新增 / 编辑弹窗 */
  const openForm = (record?: FormData) => {
    setFormOpen(true)
    setEditId(record ? String(record.id) : '')
    setFormTitle(record ? t('public.editTitle', { title: t('system.orgName') }) : t('public.createTitle', { title: t('system.orgName') }))
    // 新建时必须传 undefined：沿用上一行的引用会让表单带着上个组织的名称与描述
    setFormData(record)
  }

  /** 新增 / 编辑提交 */
  const handleSubmit = async (values: OrgFormValues) => {
    try {
      setFormLoading(true)
      const { code, message: msg } = editId ? await updateOrg(editId, values) : await createOrg(values)
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('public.successfulOperation'))
      setFormOpen(false)
      getPage()
      // 改名/停用也会影响父级的「我的组织」列表（自己也是成员）
      onChanged()
    } finally {
      setFormLoading(false)
    }
  }

  /** 删除组织（级联清成员关系与日志可见组织关联） */
  const handleDelete = async (id: string) => {
    try {
      setLoading(true)
      const { code, message: msg } = await deleteOrg(id)
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('public.successfullyDeleted'))
      getPage()
      onChanged()
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnsType<FormData> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: t('system.orgName'), dataIndex: 'org_name', width: 160 },
    { title: t('system.orgDescription'), dataIndex: 'description', ellipsis: true },
    {
      title: t('system.creator'),
      dataIndex: 'creator_name',
      width: 120,
      render: (value: string, record) => value || (record as { creator_user?: string }).creator_user || '-',
    },
    { title: t('system.memberCount'), dataIndex: 'member_count', width: 80 },
    { title: t('system.managerCount'), dataIndex: 'manager_count', width: 80 },
    {
      title: t('system.pendingCount'),
      dataIndex: 'pending_count',
      width: 80,
      render: (value: number) => (Number(value) > 0 ? <span style={{ color: '#ff4d4f' }}>{value}</span> : value),
    },
    {
      title: t('system.state'),
      dataIndex: 'status',
      width: 80,
      render: (value: number) => {
        const enabled = Number(value) === GlobalStatus.Enable
        return <span style={{ color: enabled ? '#52c41a' : '#ff4d4f' }}>{enabled ? t('public.open') : t('public.close')}</span>
      },
    },
    {
      title: t('public.creationTime'),
      dataIndex: 'created_at',
      width: 150,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: t('public.operate'),
      key: 'operate',
      width: 150,
      render: (_: unknown, record) => (
        <Space>
          {canUpdate && (
            <Button size='small' type='primary' onClick={() => openForm(record)}>
              {t('public.edit')}
            </Button>
          )}
          {canDelete && (
            <Popconfirm title={t('system.confirmDeleteOrg')} onConfirm={() => handleDelete(String(record.id))}>
              <Button size='small' danger>
                {t('public.delete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Form form={searchForm} layout='inline' onFinish={onSearch} className='mb-16px'>
        <Form.Item name='keyword'>
          <Input allowClear placeholder={t('system.searchByOrgName')} style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name='status'>
          <Select
            allowClear
            placeholder={t('system.state')}
            options={[{ label: t('public.all'), value: '' }, ...OPEN_CLOSE(t)]}
            style={{ width: 120 }}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type='primary' htmlType='submit'>
              {t('public.search')}
            </Button>
            <Button onClick={onReset}>{t('public.clear')}</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table
        rowKey='id'
        loading={loading}
        columns={columns}
        dataSource={list as never[]}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (num) => t('public.totalNum', { num }),
          onChange: (newPage, newPageSize) => {
            setPage(newPage)
            setPageSize(newPageSize)
          },
        }}
      />

      <OrgFormModal
        open={isFormOpen}
        title={formTitle}
        data={formData}
        showStatus
        confirmLoading={formLoading}
        onCancel={() => setFormOpen(false)}
        onOk={handleSubmit}
      />
    </>
  )
}

export default AllOrgs
