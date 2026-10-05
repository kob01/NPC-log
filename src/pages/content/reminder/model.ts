/**
 * 定时提醒页的表单与枚举配置
 *
 * 单独一个 model.ts 与 /content/log 同一形态：表单字段用项目内的声明式
 * FormList 描述（DatePicker/Select/RadioGroup 由 BasicForm 统一渲染），
 * 页面里就不该再手写一遍 antd Form.Item。
 *
 * ⚠ 时间字段的 format 必须写成 'YYYY-MM-DD HH:mm'：BasicForm 提交前会用
 * 这一项的 format 把 dayjs 转成字符串（见 components/Dates/utils/helper.ts 的
 * filterDayjs），而后端的墙钟校验只认 'YYYY-MM-DD HH:mm[:ss]'。
 * 留默认值会带出秒位以外的格式差异，编辑时也会让「时间到底改没改」判错。
 */
import type { FormList } from '#/form'
import type { ReminderChannel, ReminderRepeat } from '@/servers/content/reminder'
import type { TFunction } from 'i18next'

import { FORM_REQUIRED } from '@/utils/config'

/** 渠道 → 文案键与标签色（与后端 CHANNELS 一一对应） */
export const CHANNEL_META: Record<ReminderChannel, { key: string; color: string }> = {
  wx: { key: 'content.reminderChannelWx', color: 'blue' },
  email: { key: 'content.reminderChannelEmail', color: 'purple' },
  both: { key: 'content.reminderChannelBoth', color: 'cyan' },
}

/** 状态码 → 文案键与颜色（与后端 remind_status 一一对应，不要再加字符串映射层） */
export const STATUS_META: Record<number, { key: string; color: string }> = {
  0: { key: 'content.reminderStatusOff', color: 'default' },
  1: { key: 'content.reminderStatusWaiting', color: 'blue' },
  2: { key: 'content.reminderStatusNeedAuth', color: 'red' },
  3: { key: 'content.reminderStatusFiring', color: 'gold' },
}

/**
 * 状态 2 在两个通道下的含义不同：微信是「订阅次数用完」，邮件是「解析不出收件人」。
 * 直接按渠道换文案，而不是让前端去猜 last_error 的内容。
 */
export function statusKeyOf(status: number, channel: ReminderChannel): string {
  if (status === 2 && channel === 'email') {
    return 'content.reminderStatusNeedEmail'
  }
  return (STATUS_META[status] || STATUS_META[0]).key
}

/** 重复规则 → 文案键 */
export const REPEAT_KEYS: Record<ReminderRepeat, string> = {
  none: 'content.reminderRepeatNone',
  daily: 'content.reminderRepeatDaily',
  weekly: 'content.reminderRepeatWeekly',
  monthly: 'content.reminderRepeatMonthly',
}

interface ReminderFormCtx {
  /** 账号上的邮箱：作为收件邮箱的占位与回落值 */
  accountEmail: string
  /** 当前选中的渠道（决定要不要收收件邮箱） */
  channel: ReminderChannel
}

/**
 * 新建/编辑提醒的表单字段
 * @param t - 翻译函数
 * @param ctx - 渠道与账号邮箱等上下文（随表单选择变化而重建列表）
 */
export function createReminderForm(t: TFunction, ctx: ReminderFormCtx): FormList[] {
  const needEmail = ctx.channel === 'email' || ctx.channel === 'both'
  return [
    {
      label: t('content.reminderFormTitle'),
      name: 'title',
      component: 'Input',
      rules: FORM_REQUIRED,
      placeholder: t('content.reminderFormTitlePlaceholder'),
      componentProps: { maxLength: 200 },
    },
    {
      label: t('content.reminderFormTime'),
      name: 'time',
      component: 'DatePicker',
      rules: FORM_REQUIRED,
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm',
        style: { width: '100%' },
      },
    },
    {
      label: t('content.reminderRepeat'),
      name: 'repeat',
      component: 'Select',
      componentProps: {
        options: (Object.keys(REPEAT_KEYS) as ReminderRepeat[]).map((v) => ({
          label: t(REPEAT_KEYS[v]),
          value: v,
        })),
      },
    },
    {
      label: t('content.reminderChannel'),
      name: 'channel',
      // 用 Select 而不是 RadioGroup：项目里的 ComponentProps 只给 RadioProps
      // （不含 options/optionType），要拿声明式表单渲就先得能过类型
      component: 'Select',
      componentProps: {
        options: (Object.keys(CHANNEL_META) as ReminderChannel[]).map((v) => ({
          label: t(CHANNEL_META[v].key),
          value: v,
        })),
      },
    },
    {
      label: t('content.reminderEmail'),
      name: 'email',
      hidden: !needEmail,
      placeholder: ctx.accountEmail ? t('content.reminderEmailFollow', { email: ctx.accountEmail }) : t('content.reminderEmailPlaceholder'),
      rules: needEmail ? [{ type: 'email', message: t('public.validateEmail', { label: t('content.reminderEmail') }) }] : [],
      component: 'Input',
      componentProps: { maxLength: 100 },
    },
    {
      label: t('content.reminderFormRemark'),
      name: 'remark',
      component: 'TextArea',
      componentProps: {
        autoSize: { minRows: 2, maxRows: 4 },
        maxLength: 500,
        placeholder: t('content.reminderFormRemarkPlaceholder'),
      },
    },
  ]
}
