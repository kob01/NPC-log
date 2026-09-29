import dayjs from 'dayjs'

import type { FormList } from '#/form'
import type { TableColumn, TableOptions } from '#/public'
import type { TFunction } from 'i18next'

import { FORM_REQUIRED } from '@/utils/config'
import { OPEN_CLOSE, GlobalStatus } from '@/utils/constants'

// 搜索数据
export const searchList = (t: TFunction): FormList[] => [
  {
    label: t('system.orgName'),
    name: 'keyword',
    component: 'Input',
    componentProps: {
      placeholder: t('system.searchByOrgName'),
    },
  },
  {
    label: t('system.state'),
    name: 'status',
    component: 'Select',
    componentProps: {
      options: [{ label: t('public.all'), value: '' }, ...OPEN_CLOSE(t)],
      allowClear: true,
    },
  },
]

/**
 * 表格数据
 * @param optionRender - 渲染操作函数
 */
export const tableColumns = (t: TFunction, optionRender: TableOptions<object>): TableColumn => [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 80,
    fixed: 'left',
  },
  {
    title: t('system.orgName'),
    dataIndex: 'org_name',
    width: 160,
    fixed: 'left',
  },
  {
    title: t('system.orgDescription'),
    dataIndex: 'description',
    width: 220,
    ellipsis: true,
  },
  {
    title: t('system.creator'),
    dataIndex: 'creator_name',
    width: 120,
    render: (value: string, record: object) =>
      value || (record as { creator_user?: string }).creator_user || '-',
  },
  {
    title: t('system.memberCount'),
    dataIndex: 'member_count',
    width: 90,
  },
  {
    title: t('system.managerCount'),
    dataIndex: 'manager_count',
    width: 90,
  },
  {
    title: t('system.pendingCount'),
    dataIndex: 'pending_count',
    width: 90,
  },
  {
    title: t('system.state'),
    dataIndex: 'status',
    width: 90,
    render: (value: number) => {
      const enabled = value === GlobalStatus.Enable
      return (
        <span style={{ color: enabled ? '#52c41a' : '#ff4d4f' }}>
          {enabled ? t('public.open') : t('public.close')}
        </span>
      )
    },
  },
  {
    title: t('public.createTime'),
    dataIndex: 'created_at',
    width: 180,
    // 接口返回的是 ISO 串，与其它列表的时间格式保持一致
    render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
  },
  {
    title: t('public.operate'),
    dataIndex: 'operate',
    width: 160,
    fixed: 'right',
    render: (value: unknown, record: object) => optionRender(value, record),
  },
]

// 新增/编辑表单数据
export const createList = (t: TFunction): FormList[] => [
  {
    label: t('system.orgName'),
    name: 'org_name',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      placeholder: t('system.pleaseEnterOrgName'),
    },
  },
  {
    label: t('system.orgDescription'),
    name: 'description',
    component: 'TextArea',
  },
  {
    label: t('system.state'),
    name: 'status',
    rules: FORM_REQUIRED,
    component: 'Select',
    componentProps: {
      options: OPEN_CLOSE(t),
    },
  },
]
