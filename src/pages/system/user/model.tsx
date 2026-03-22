import { FORM_REQUIRED } from '@/utils/config'
import { OPEN_CLOSE } from '@/utils/constants'

import type { FormList } from '#/form'
import type { TableColumn, TableOptions } from '#/public'
import type { TFunction } from 'i18next'

// 搜索数据
export const searchList = (t: TFunction): FormList[] => [
  {
    label: t('public.name'),
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
    width: 150,
    fixed: 'left',
  },
  {
    title: t('public.name'),
    dataIndex: 'real_name',
    width: 120,
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
    title: t('public.createTime'),
    dataIndex: 'create_time',
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
    label: t('login.username'),
    name: 'username',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      disabled: isEdit, // 编辑时用户名不可修改
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
    label: t('public.name'),
    name: 'real_name',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      placeholder: t('system.pleaseEnterRealName'),
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
