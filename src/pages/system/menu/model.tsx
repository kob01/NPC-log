import dayjs from 'dayjs'

import type { FormList } from '#/form'
import type { TableColumn, TableOptions } from '#/public'
import type { TFunction } from 'i18next'

import { FORM_REQUIRED } from '@/utils/config'
import { MENU_STATUS } from '@/utils/constants'
import { valueToLabel } from '@/utils/helper'

// 搜索数据
export const searchList = (t: TFunction): FormList[] => [
  {
    label: t('public.name'),
    name: 'keyword',
    component: 'Input',
    componentProps: {
      placeholder: t('system.searchByMenuName'),
    },
  },
  {
    label: t('system.state'),
    name: 'status',
    component: 'Select',
    componentProps: {
      options: [{ label: t('public.all'), value: '' }, ...MENU_STATUS(t)],
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
  },
  {
    title: t('public.name'),
    dataIndex: 'label',
    width: 160,
  },
  {
    title: t('system.menuKey'),
    dataIndex: 'menuKey',
    width: 200,
  },
  {
    title: t('system.permissionRule'),
    dataIndex: 'rule',
    width: 200,
  },
  {
    title: t('system.sort'),
    dataIndex: 'sort',
    width: 80,
  },
  {
    title: t('system.state'),
    dataIndex: 'status',
    width: 100,
    render: (value: number) => <span>{valueToLabel(value, MENU_STATUS(t))}</span>,
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
export const createList = (t: TFunction, id: string, parentOptions: { label: string; value: number }[] = []): FormList[] => [
  {
    label: t('system.parentMenu'),
    name: 'parent_id',
    // 顶级菜单应可直接留空（后端默认 parent_id=0）；此前强制必填，必须显式选一次「顶级菜单」才能提交
    component: 'Select',
    componentProps: {
      options: [{ label: t('system.topLevel'), value: 0 }, ...parentOptions],
      placeholder: t('system.pleaseSelectParentMenu'),
    },
  },
  {
    label: t('public.name'),
    name: 'label',
    rules: FORM_REQUIRED,
    component: 'Input',
    componentProps: {
      placeholder: t('system.pleaseEnterMenuName'),
    },
  },
  {
    label: t('system.menuNameEn'),
    name: 'labelEn',
    component: 'Input',
  },
  {
    label: t('system.icon'),
    name: 'icon',
    component: 'Input',
    componentProps: {
      placeholder: 'ion:settings-outline',
    },
  },
  {
    label: t('system.menuKey'),
    name: 'menuKey',
    component: 'Input',
    componentProps: {
      placeholder: '/system/user',
    },
  },
  {
    label: t('system.permissionRule'),
    name: 'rule',
    component: 'Input',
    componentProps: {
      // 留空即所有登录用户可见（与后端菜单剪枝语义一致）
      placeholder: '/authority/user/index（留空则所有登录用户可见）',
    },
  },
  {
    label: t('system.sort'),
    name: 'sort',
    component: 'InputNumber',
    componentProps: {
      min: 0,
    },
  },
  {
    label: t('system.state'),
    name: 'status',
    rules: FORM_REQUIRED,
    component: 'Select',
    componentProps: {
      options: MENU_STATUS(t),
    },
  },
]
