import type { FormList } from '#/form'
import type { TableColumn, TableOptions } from '#/public'
import type { TFunction } from 'i18next'

import { EMPTY_VALUE, FORM_REQUIRED } from '@/utils/config'

export const typeOptions = [
  {
    label: '工作',
    value: '工作',
  },
  {
    label: '爱好',
    value: '爱好',
  },
  {
    label: '大事件',
    value: '大事件',
  },
  {
    label: '学习',
    value: '学习',
  },
  {
    label: '运动',
    value: '运动',
  },
  {
    label: '旅游',
    value: '旅游',
  },
  {
    label: '吃喝',
    value: '吃喝',
  },
  {
    label: '社交',
    value: '社交',
  },
  {
    label: '家庭',
    value: '家庭',
  },
  {
    label: '生活',
    value: '生活',
  },
  {
    label: '其他',
    value: '其他',
  },
  {
    label: 'Her',
    value: 'Her',
  },
  {
    label: '衣',
    value: '衣',
  },
  {
    label: '待办',
    value: '待办',
  },
]
export const ratingOptions = [
  {
    label: '非常好',
    value: '非常好',
  },
  {
    label: '好',
    value: '好',
  },
  {
    label: '一般',
    value: '一般',
  },
  {
    label: '差',
    value: '差',
  },
  {
    label: '非常差',
    value: '非常差',
  },
]
// 可见范围选项
export const visibilityOptions = [
  { label: '仅自己可见', value: 0 },
  { label: '组织可见', value: 1 },
]
// 搜索数据
export const searchList = (t: TFunction): FormList[] => [
  {
    label: t('public.date'),
    name: 'time',
    component: 'RangePicker',
    componentProps: {
      format: 'YYYY-MM-DD',
    },
  },
  {
    label: '事件',
    name: 'event',
    component: 'Input',
  },
  {
    label: '分类',
    name: 'type',
    component: 'Select',
    componentProps: {
      options: typeOptions,
      listHeight: 800,
    },
  },
  {
    label: '内容',
    name: 'content',
    component: 'Input',
  },
  {
    label: '评价',
    name: 'rating',
    component: 'Select',
    componentProps: {
      options: ratingOptions,
    },
  },
  {
    label: '经验教训',
    name: 'experience',
    component: 'Input',
  },
  {
    label: '地点',
    name: 'position',
    component: 'Input',
  },
  {
    label: t('content.logTagFilter'),
    name: 'tag',
    component: 'Input',
  },
  {
    label: '见证者',
    name: 'witness',
    component: 'Input',
  },
]

/**
 * 表格数据
 * @param optionRender - 渲染操作函数
 * @param TooltipRender - 文本溢出提示渲染
 * @param imageRender - 图片列渲染（JSX 由页面注入，model.ts 为纯 ts）
 * @param linkRender - 作品列渲染
 * @param positionRender - 地点列渲染（导航链接）
 * @param tagRender - AI 标签列渲染
 * @param audioRender - 录音列渲染（播放浮层由页面注入）
 */
export const tableColumns = (
  t: TFunction,
  optionRender: TableOptions<object>,
  TooltipRender: (text: string) => JSX.Element,
  imageRender: (record: object) => JSX.Element,
  linkRender: (record: object) => JSX.Element,
  positionRender?: (record: object) => JSX.Element,
  tagRender?: (record: object) => JSX.Element,
  audioRender?: (record: object) => JSX.Element,
): TableColumn => [
  {
    title: '时间',
    dataIndex: 'time',
    width: 110,
    fixed: 'left',
  },
  {
    title: '事件',
    dataIndex: 'event',
    width: 120,
    ellipsis: true,
    render: (value) => TooltipRender(value),
  },
  {
    title: '分类',
    dataIndex: 'type',
    width: 80,
  },
  {
    title: '内容',
    dataIndex: 'content',
    width: 220,
    ellipsis: true,
    render: (value) => TooltipRender(value),
  },
  {
    title: '评价',
    dataIndex: 'rating',
    width: 80,
  },
  {
    title: '经验教训',
    dataIndex: 'experience',
    width: 140,
    ellipsis: true,
    render: (value) => TooltipRender(value),
  },
  {
    title: '地点',
    dataIndex: 'position',
    width: 100,
    render: (_value: unknown, record: object) => (positionRender ? positionRender(record) : (_value as string) || '-'),
  },
  {
    title: '见证者',
    dataIndex: 'witness',
    width: 100,
  },
  {
    title: '图片',
    dataIndex: 'firstThumb',
    width: 150,
    render: (_value: unknown, record: object) => imageRender(record),
  },
  {
    title: '录音',
    dataIndex: 'audioUrl',
    width: 96,
    render: (_value: unknown, record: object) => (audioRender ? audioRender(record) : null),
  },
  {
    title: '作品',
    dataIndex: 'linkCount',
    width: 72,
    render: (_value: unknown, record: object) => linkRender(record),
  },
  {
    title: t('content.logTagColumn'),
    dataIndex: 'tags',
    width: 140,
    render: (_value: unknown, record: object) => (tagRender ? tagRender(record) : '—'),
  },
  {
    title: '作者',
    dataIndex: 'author',
    width: 100,
  },
  {
    title: '可见范围',
    dataIndex: 'visibility',
    width: 130,
    render: (value: number, record: object) => {
      if (Number(value) !== 1) {
        return '仅自己可见'
      }
      const orgNames = (record as { visibleOrgNames?: string }).visibleOrgNames
      return orgNames ? `组织可见·${orgNames}` : '组织可见'
    },
  },
  {
    // 后端 event_update_time：每次编辑（含只换图片/链接/可见组织）都会推齐
    title: '更新于',
    dataIndex: 'updatedAt',
    width: 140,
    render: (value: string) => value || EMPTY_VALUE,
  },
  {
    title: t('public.operate'),
    dataIndex: 'operate',
    width: 100,
    fixed: 'right',
    render: (value: unknown, record: object) => optionRender(value, record),
  },
]

// 新增数据
export const createList = (t: TFunction, orgOptions: { label: string; value: number }[] = []): FormList[] => [
  {
    label: t('public.date'),
    name: 'time',
    component: 'DatePicker',
    rules: FORM_REQUIRED,
    componentProps: {
      showTime: true,
      format: 'YYYY-MM-DD HH:mm',
    },
  },
  {
    label: '事件',
    name: 'event',
    component: 'TextArea',
    rules: FORM_REQUIRED,
    componentProps: {
      autoSize: { minRows: 2, maxRows: 6 },
    },
  },
  {
    label: '分类',
    name: 'type',
    component: 'Select',
    componentProps: {
      options: typeOptions,
      listHeight: 800,
    },
  },
  {
    label: '内容',
    name: 'content',
    component: 'TextArea',
    componentProps: {
      autoSize: { minRows: 4, maxRows: 12 },
      maxLength: 4000,
      showCount: true,
      placeholder: '详细经过与当时的感受，两段写在同一个框里',
    },
  },
  {
    label: '评价',
    name: 'rating',
    component: 'Select',
    componentProps: {
      options: ratingOptions,
    },
  },
  {
    label: '经验教训',
    name: 'experience',
    component: 'TextArea',
    componentProps: {
      autoSize: { minRows: 2, maxRows: 4 },
    },
  },
  {
    label: '地点',
    name: 'location',
    component: 'LocationPicker',
  },
  {
    label: '见证者',
    name: 'witness',
    component: 'Input',
  },
  {
    label: '可见范围',
    name: 'visibility',
    component: 'Select',
    rules: FORM_REQUIRED,
    componentProps: {
      options: visibilityOptions,
    },
  },
  {
    label: '可见组织',
    name: 'visibleOrgIds',
    component: 'Select',
    componentProps: {
      mode: 'multiple',
      options: orgOptions,
      allowClear: true,
      placeholder: '默认所有已加入组织可见（可多选指定组织）',
    },
  },
  {
    label: t('content.imageField'),
    name: 'images',
    component: 'ImageUpload',
    componentProps: {
      maxCount: 9,
    },
  },
  {
    label: t('content.linkField'),
    name: 'links',
    component: 'LinkList',
  },
]
