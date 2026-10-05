import dayjs from 'dayjs'

import type { FormList } from '#/form'
import type { TableColumn, TableOptions } from '#/public'
import type { TFunction } from 'i18next'

import { FORM_REQUIRED } from '@/utils/config'
import { OPEN_CLOSE, GlobalStatus } from '@/utils/constants'

// 账号类型选项
const ACCOUNT_TYPE = (t: TFunction) => [
  { label: t('system.normalUser'), value: 0 },
  { label: t('system.adminUser'), value: 1 },
]

// 搜索数据
export const searchList = (t: TFunction): FormList[] => [
  {
    label: t('system.username'),
    name: 'keyword',
    component: 'Input',
    componentProps: {
      placeholder: t('system.searchByName'),
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
    title: t('login.username'),
    dataIndex: 'username',
    width: 190,
    fixed: 'left',
    // 微信一键注册的账号只带 openid、还没设过密码；标出来免得管理员当成坏数据
    render: (value: string, record: object) => {
      const noPass = Number((record as { has_password?: number }).has_password) === 0
      return (
        <span>
          {value}
          {noPass ? <span style={{ marginLeft: 6, fontSize: 12, color: '#fa8c16' }}>{t('system.noPassword')}</span> : null}
        </span>
      )
    },
  },
  {
    title: t('system.username'),
    dataIndex: 'real_name',
    width: 120,
  },
  {
    title: t('system.accountType'),
    dataIndex: 'account_type',
    width: 110,
    render: (value: number) => <span>{Number(value) === 1 ? t('system.adminUser') : t('system.normalUser')}</span>,
  },
  {
    title: t('system.phone'),
    dataIndex: 'phone',
    width: 130,
  },
  {
    title: t('system.email'),
    dataIndex: 'email',
    width: 180,
    ellipsis: true,
  },
  {
    title: t('system.state'),
    dataIndex: 'status',
    width: 100,
    render: (value: number) => {
      const enabled = value === GlobalStatus.Enable
      return <span style={{ color: enabled ? '#52c41a' : '#ff4d4f' }}>{enabled ? t('public.open') : t('public.close')}</span>
    },
  },
  {
    title: t('public.createTime'),
    dataIndex: 'created_at',
    width: 180,
    // 接口返回的是 ISO 串（2026-09-29T16:58:31.000Z），与其它列表的时间格式保持一致
    render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
  },
  {
    title: t('public.operate'),
    dataIndex: 'operate',
    width: 180,
    fixed: 'right',
    render: (value: unknown, record: object) => optionRender(value, record),
  },
]

// 新增/编辑表单数据
export const createList = (t: TFunction, isEdit: boolean, orgOptions: { label: string; value: number }[] = []): FormList[] => [
  {
    label: t('login.username'),
    name: 'username',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      disabled: isEdit, // 编辑时账号不可修改
      placeholder: t('login.pleaseEnterUsername'),
    },
  },
  {
    label: t('login.password'),
    name: 'password',
    rules: isEdit ? undefined : FORM_REQUIRED,
    component: 'InputPassword',
    componentProps: {
      placeholder: isEdit ? t('system.leaveBlankForNoChange') : t('login.pleaseEnterPassword'),
    },
  },
  {
    label: t('system.username'),
    name: 'real_name',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      placeholder: t('system.pleaseEnterRealName'),
    },
  },
  {
    label: t('system.phone'),
    name: 'phone',
    component: 'Input',
    componentProps: {
      placeholder: t('system.pleaseEnterPhone'),
    },
  },
  {
    label: t('system.email'),
    name: 'email',
    component: 'Input',
    componentProps: {
      placeholder: t('system.pleaseEnterEmail'),
    },
  },
  {
    label: t('system.accountType'),
    name: 'account_type',
    rules: FORM_REQUIRED,
    component: 'Select',
    componentProps: {
      options: ACCOUNT_TYPE(t),
      placeholder: t('system.pleaseSelectAccountType'),
    },
  },
  {
    label: t('system.organization'),
    name: 'org_ids',
    component: 'Select',
    componentProps: {
      mode: 'multiple',
      options: orgOptions,
      placeholder: t('system.pleaseSelectOrganization'),
      allowClear: true,
    },
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
