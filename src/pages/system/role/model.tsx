import { FORM_REQUIRED } from '@/utils/config'
import { OPEN_CLOSE } from '@/utils/constants'

import type { FormList } from '#/form'
import type { TableColumn, TableOptions } from '#/public'
import type { TFunction } from 'i18next'

// 搜索数据
export const searchList = (t: TFunction): FormList[] => [
  {
    label: t('public.name'),
    name: 'name',
    component: 'Input',
    componentProps: {
      placeholder: t('system.searchByName'),
    },
  },
  {
    label: t('system.roleCode'),
    name: 'code',
    component: 'Input',
    componentProps: {
      placeholder: t('system.searchByCode'),
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
    title: t('public.name'),
    dataIndex: 'name',
    width: 150,
    fixed: 'left',
  },
  {
    title: t('system.roleCode'),
    dataIndex: 'code',
    width: 150,
  },
  {
    title: t('system.description'),
    dataIndex: 'description',
    width: 200,
    ellipsis: true,
  },
  {
    title: t('system.state'),
    dataIndex: 'status',
    width: 100,
    render: (value: number) => (
      <span style={{ color: value === 1 ? '#52c41a' : '#ff4d4f' }}>
        {value === 1 ? t('public.open') : t('public.close')}
      </span>
    ),
  },
  {
    title: t('system.sortOrder'),
    dataIndex: 'sort_order',
    width: 100,
  },
  {
    title: t('public.createTime'),
    dataIndex: 'created_at',
    width: 180,
  },
  {
    title: t('public.operate'),
    dataIndex: 'operate',
    width: 250,
    fixed: 'right',
    render: (value: unknown, record: object) => optionRender(value, record),
  },
]

// 新增/编辑表单数据
export const createList = (t: TFunction, isEdit: boolean): FormList[] => [
  {
    label: t('public.name'),
    name: 'name',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      placeholder: t('system.pleaseEnterRoleName'),
    },
  },
  {
    label: t('system.roleCode'),
    name: 'code',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      disabled: isEdit, // 编辑时角色编码不可修改
      placeholder: t('system.pleaseEnterRoleCode'),
    },
  },
  {
    label: t('system.description'),
    name: 'description',
    component: 'TextArea',
    componentProps: {
      placeholder: t('system.pleaseEnterDescription'),
      autoSize: { minRows: 2, maxRows: 4 },
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
  {
    label: t('system.sortOrder'),
    name: 'sort_order',
    component: 'InputNumber',
    componentProps: {
      placeholder: t('system.pleaseEnterSortOrder'),
      min: 0,
    },
  },
]
