/**
 * 定时提醒管理页（/content/reminder）
 *
 * 定位是「看住这条链路 + 把提醒在电脑上管完」：
 * 订阅授权只能由小程序里的用户点击触发（wx.requestSubscribeMessage），网页做不到，
 * 但新建/编辑本身不需要授权，所以本页随时能建一条不关联日志的单独提醒
 * （邮件不依赖授权也不消耗额度，可以建完就用；选微信时表单顶部会提示该去小程序授权）。
 *
 * 管理员看到的是跨用户视图，因为提醒最难查的一段几乎都出在用户身上：
 * 没绑 openid（推送没有收件人）、订阅次数为 0（发不出去）、没填邮箱、连败被自动停用。
 * 普通用户走自扫接口，后端天然按 user_id 收窄，这里不做前端过滤。
 * 跨用户视图仍是只读的：别人的提醒不能代改（提醒是「给自己定的」），
 * 但「新建」不拿视图拦——它建的永远是当前登录人自己那一条。
 */
import { BellOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  type FormInstance,
} from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CHANNEL_META, STATUS_META, createReminderForm, repeatTextOf, statusKeyOf } from './model'

import type { FormData } from '#/form'
import type { TableColumn } from '#/public'
import type {
  ReminderAdminResult,
  ReminderChannel,
  ReminderConfig,
  ReminderFormData,
  ReminderIntervalUnit,
  ReminderItem,
  ReminderRepeat,
} from '@/servers/content/reminder'

import BasicContent from '@/components/Content/BasicContent'
import BasicForm from '@/components/Form/BasicForm'
import { useCommonStore } from '@/hooks/useCommonStore'
import {
  adminDeleteReminder,
  createReminder,
  deleteReminder,
  getMyReminders,
  getReminderAdminPage,
  getReminderConfig,
  REMINDER_STATUS,
  setReminderStatus,
  testReminder,
  updateReminder,
} from '@/servers/content/reminder'
import { checkPermission } from '@/utils/permissions'
import { message } from '@/utils/staticAntd'

/**
 * 新建时表单的初始值（时间由用户自己选：提醒本来就是面向未来的东西）
 * 间隔默认「每 1 天」：选到「自定义间隔」时不必先填两个空字段
 */
const EMPTY_FORM: FormData = {
  title: '',
  time: '',
  repeat: 'none',
  intervalValue: 1,
  intervalUnit: 'day',
  channel: 'email',
  email: '',
  remark: '',
}

/**
 * 'YYYY-MM-DD HH:mm:ss' → 'MM-DD HH:mm'
 * 只做字符串切片：不 new Date() 解析，浏览器与服务器时区不一致时不会整体挪几个小时
 */
function shortTime(value?: string) {
  if (!value) {
    return '-'
  }
  return value.length >= 16 ? value.slice(5, 16) : value
}

const Page = () => {
  const { t } = useTranslation()
  const { permissions } = useCommonStore()
  const isAdmin = checkPermission('/content/reminder/admin', permissions)

  const [rows, setRows] = useState<ReminderItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<ReminderAdminResult['summary'] | null>(null)
  const [capability, setCapability] = useState<ReminderAdminResult['capability'] | null>(null)
  const [cfg, setCfg] = useState<ReminderConfig | null>(null)
  // 管理员默认看全部用户，可切回只看自己
  const [scope, setScope] = useState<'all' | 'mine'>(isAdmin ? 'all' : 'mine')
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [channel, setChannel] = useState<ReminderChannel | undefined>(undefined)
  const [keyword, setKeyword] = useState('')

  // 新建/编辑弹窗：editingId=0 表示新建
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(0)
  const [formChannel, setFormChannel] = useState<ReminderChannel>('email')
  const [formRepeat, setFormRepeat] = useState<ReminderRepeat>('none')
  const [formRow, setFormRow] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<FormInstance>(null)
  /**
   * 打开表单时的时间原值：只改标题/备注时不把它一起提交，
   * 否则后端会按「用户改了时间」拦一道「必须晚于现在」，已过期的提醒就再也改不了
   */
  const origTimeRef = useRef('')

  /** 拉当前登录人的额度/绑定态（两种视图都需要，管理员也要知道自己能不能收到） */
  const loadConfig = useCallback(async () => {
    try {
      const { code, data } = await getReminderConfig()
      if (Number(code) === 200) {
        setCfg(data)
      }
    } catch (error) {
      console.error('获取提醒配置失败:', error)
    }
  }, [])

  const loadRows = useCallback(async () => {
    try {
      setLoading(true)
      if (scope === 'all' && isAdmin) {
        const { code, data } = await getReminderAdminPage({ page, pageSize, status, channel, keyword })
        if (Number(code) === 200 && data) {
          setRows(data.items || [])
          setTotal(Number(data.total || 0))
          setSummary(data.summary)
          setCapability(data.capability)
        }
        return
      }
      // 「只看我的」：自扫接口不分页（条数上限已在后端按人拦住）
      const { code, data } = await getMyReminders(true)
      if (Number(code) === 200) {
        const list = Array.isArray(data) ? data : []
        const kw = keyword.trim()
        setRows(
          list.filter(
            (r) =>
              (status === undefined || r.status === status) &&
              (channel === undefined || r.channel === channel) &&
              (!kw || r.title.includes(kw) || (r.remark || '').includes(kw)),
          ),
        )
        setTotal(Array.isArray(data) ? data.length : 0)
        setSummary(null)
      }
    } catch (error) {
      console.error('获取提醒列表失败:', error)
      message.error(t('content.reminderLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [channel, isAdmin, keyword, page, pageSize, scope, status, t])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  /** 删除：管理员视图走跨用户口，其余走本人接口 */
  const onDelete = async (id: number) => {
    try {
      const { code } = scope === 'all' && isAdmin ? await adminDeleteReminder(id) : await deleteReminder(id)
      if (Number(code) === 200) {
        message.success(t('content.reminderDeleted'))
        loadRows()
        loadConfig()
      }
    } catch (error) {
      console.error('删除提醒失败:', error)
    }
  }

  /** 启停：只对自己的提醒开放（管理员视图里不拿它代用户改状态） */
  const onToggle = async (row: ReminderItem, enabled: boolean) => {
    try {
      const { code, message: msg } = await setReminderStatus(row.id, enabled)
      if (Number(code) === 200) {
        message.success(enabled ? t('content.reminderEnabled') : t('content.reminderDisabled'))
        loadRows()
        return
      }
      // 过期的一次性提醒开不了（后端会说「请编辑后重新设时间」），这句必须直接现在屏幕上
      message.error(msg || t('content.reminderSaveFailed'))
    } catch (error) {
      console.error('提醒启停失败:', error)
    }
  }

  /** 新建：默认渠道给邮件（PC 能自己发的就那一个） */
  const openCreate = () => {
    origTimeRef.current = ''
    setEditingId(0)
    setFormChannel('email')
    setFormRepeat('none')
    setFormRow({ ...EMPTY_FORM, email: cfg?.accountEmail || '' })
    setFormOpen(true)
  }

  /** 编辑：把列表行灌回表单（time 给字符串，BasicForm 里的 DatePicker 会自己转 dayjs） */
  const openEdit = (row: ReminderItem) => {
    origTimeRef.current = row.time || ''
    setEditingId(row.id)
    setFormChannel(row.channel || 'wx')
    setFormRepeat(row.repeat || 'none')
    setFormRow({
      title: row.title,
      time: row.time ? row.time.slice(0, 16) : '',
      repeat: row.repeat || 'none',
      intervalValue: row.intervalValue ?? 1,
      intervalUnit: (row.intervalUnit as ReminderIntervalUnit) || 'day',
      channel: row.channel || 'wx',
      email: row.email || '',
      remark: row.remark || '',
    })
    setFormOpen(true)
  }

  /** 渠道与重复规则一变就要重算表单项（要不要收收件邮箱 / 要不要收间隔） */
  const onValuesChange = (changed: FormData) => {
    if (changed && changed.channel) {
      setFormChannel(changed.channel as ReminderChannel)
    }
    if (changed && changed.repeat) {
      setFormRepeat(changed.repeat as ReminderRepeat)
    }
  }

  /**
   * 提交新建/编辑
   *
   * 时间没改就不带 time：后端的「必须晚于现在」只针对真改了时间的场景，
   * 否则一条已过期的提醒连改个备注都提交不上
   */
  const handleFinish = async (values: FormData) => {
    const v = values as unknown as ReminderFormData
    const payload: ReminderFormData = {
      title: String(v.title || '').trim(),
      repeat: (v.repeat || 'none') as ReminderFormData['repeat'],
      remark: String(v.remark || '').trim(),
      channel: v.channel,
      email: String(v.email || '').trim(),
    }
    // 间隔只在自定义规则下提交：其它规则带了也没人读，不如不传（后端也会自己清空两列）
    if (payload.repeat === 'custom') {
      payload.intervalValue = Number(v.intervalValue) || 1
      payload.intervalUnit = (v.intervalUnit || 'day') as ReminderIntervalUnit
    }
    if (v.time && v.time !== origTimeRef.current) {
      payload.time = v.time
    }
    try {
      setSaving(true)
      const { code, message: msg } = editingId ? await updateReminder({ ...payload, id: editingId }) : await createReminder(payload)
      if (Number(code) === 200) {
        message.success(editingId ? t('content.reminderUpdated') : t('content.reminderCreated'))
        setFormOpen(false)
        loadRows()
        loadConfig()
        return
      }
      message.error(msg || t('content.reminderSaveFailed'))
    } catch (error) {
      console.error('保存提醒失败:', error)
      message.error(t('content.reminderSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  /** 发一封测试邮件：把「SMTP 主机/端口/凭证/发信人」四类配置错一次点穿 */
  const onTestMail = async () => {
    try {
      const { code, message: msg, data } = await testReminder('email')
      if (Number(code) === 200) {
        message.success(`${t('content.reminderTestMailSent')}${data?.to ? `（${data.to}）` : ''}`)
        return
      }
      const tips: Record<string, string> = {
        auth: t('content.reminderTestMailAuth'),
        rejected: t('content.reminderTestMailRejected'),
        network: t('content.reminderTestMailNetwork'),
        rateLimit: t('content.reminderTestMailQuota'),
        noRecipient: t('content.reminderTestMailNoTo'),
      }
      message.error(`${msg || t('content.reminderTestFailed')}${data?.kind && tips[data.kind] ? `｜${tips[data.kind]}` : ''}`)
    } catch (error) {
      console.error('测试邮件失败:', error)
    }
  }

  /** 表单项：随渠道、重复规则与账号邮箱变化重建（BasicForm 只在 data 变化时才重置字段） */
  const formList = useMemo(
    () =>
      createReminderForm(t, {
        accountEmail: cfg?.accountEmail || '',
        channel: formChannel,
        repeat: formRepeat,
      }),
    [cfg, formChannel, formRepeat, t],
  )

  const columns = useMemo<TableColumn<ReminderItem>>(() => {
    const cols: TableColumn<ReminderItem> = []
    if (scope === 'all' && isAdmin) {
      cols.push({
        title: t('content.reminderUser'),
        dataIndex: 'username',
        width: 150,
        render: (_v, r) => (
          <Space size={4} wrap>
            <Typography.Text>{r.nickName || r.username}</Typography.Text>
            <Tag color={r.wxBound ? 'green' : 'red'} style={{ marginRight: 0 }}>
              {r.wxBound ? t('content.reminderWxBound') : t('content.reminderWxUnbound')}
            </Tag>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              {t('content.reminderMyQuota', { count: r.quota ?? 0 })}
            </Typography.Text>
          </Space>
        ),
      })
    }
    cols.push(
      {
        title: t('public.title'),
        dataIndex: 'title',
        ellipsis: true,
        render: (_v, r) => (
          <div>
            <Typography.Text strong>{r.title}</Typography.Text>
            {r.remark && (
              <div>
                <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                  {r.remark}
                </Typography.Text>
              </div>
            )}
            {r.eventName && (
              <div>
                <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                  {t('content.reminderLinkedLog')}：{r.eventName}
                </Typography.Text>
              </div>
            )}
          </div>
        ),
      },
      {
        title: t('content.reminderNextTime'),
        dataIndex: 'time',
        width: 130,
        render: (v: string) => shortTime(v),
      },
      {
        title: t('content.reminderRepeat'),
        dataIndex: 'repeat',
        width: 100,
        render: (_v, r) => repeatTextOf(t, r),
      },
      {
        /**
         * 渠道列：收件邮箱就接在标签下面。不单开一列是因为一行只有三四个列宽能容纳，
         * 而「选了邮件却没地址」恰好是必须一起看到的信息
         */
        title: t('content.reminderChannel'),
        dataIndex: 'channel',
        width: 140,
        render: (v: ReminderItem['channel'], r) => {
          const meta = CHANNEL_META[v] || CHANNEL_META.wx
          return (
            <Space size={4} direction='vertical' style={{ display: 'flex' }}>
              <Tag color={meta.color} style={{ marginRight: 0 }}>
                {t(meta.key)}
              </Tag>
              {v !== 'wx' && (
                <Typography.Text type={r.email ? 'secondary' : 'danger'} style={{ fontSize: 12 }}>
                  {/* 本人视图里 email 空串是「跟随账号」；管理端视图后端已用账号邮箱解析过，
                      所以这里只在确实拿不到地址时才用 danger 色 */}
                  {r.email || t('content.reminderEmailFollowShort')}
                </Typography.Text>
              )}
            </Space>
          )
        },
      },
      {
        title: t('content.reminderStatus'),
        dataIndex: 'status',
        width: 130,
        render: (v: number, r) => {
          const meta = STATUS_META[v] || STATUS_META[0]
          // 状态 2 在邮件渠道下是「没收件人」而不是「没额度」，文案必须跟着渠道走
          return <Tag color={meta.color}>{t(statusKeyOf(v, r.channel || 'wx'))}</Tag>
        },
      },
      {
        title: t('content.reminderPushCount'),
        dataIndex: 'pushCount',
        width: 90,
        align: 'center',
      },
      {
        title: t('content.reminderFailCount'),
        dataIndex: 'failCount',
        width: 90,
        align: 'center',
        render: (v: number) => (v > 0 ? <Typography.Text type='danger'>{v}</Typography.Text> : 0),
      },
      {
        title: t('content.reminderLastError'),
        dataIndex: 'lastError',
        ellipsis: true,
        width: 150,
        render: (v: string, r) => v || shortTime(r.lastPushTime),
      },
      {
        title: t('public.operate'),
        key: 'action',
        width: 170,
        render: (_v, r) => (
          <Space size={6} wrap>
            {/* 新建/编辑/启停只对自己的提醒开放：管理员视图是跨用户只读体检视图，
                在那里改别人的提醒没有意义（提醒是「给自己定的」） */}
            {!(scope === 'all' && isAdmin) && (
              <>
                <Typography.Link onClick={() => openEdit(r)}>{t('public.edit')}</Typography.Link>
                <Switch
                  size='small'
                  checked={r.status === REMINDER_STATUS.WAITING || r.status === REMINDER_STATUS.FIRING}
                  onChange={(checked) => onToggle(r, checked)}
                />
              </>
            )}
            <Popconfirm
              title={t('public.confirmMessage', { name: t('public.delete') })}
              okText={t('public.confirm')}
              cancelText={t('public.cancel')}
              onConfirm={() => onDelete(r.id)}
            >
              <Typography.Link type='danger'>{t('public.delete')}</Typography.Link>
            </Popconfirm>
          </Space>
        ),
      },
    )
    return cols
    // onDelete/openEdit/onToggle 每次渲染都是新函数，列入依赖会让 columns 每帧重建（Table 会反复重排）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, scope, t])

  /** 顶部提醒文案：先把「哪个通道根本发不出去」说在第一位，再轮到用户自己的状态 */
  const alertText = useMemo(() => {
    const wxReady = !!cfg?.enabled
    const mailReady = capability ? capability.mailReady : !!cfg?.mailEnabled
    if (capability && !capability.schedulerEnabled) {
      return t('content.reminderSchedulerStopped')
    }
    if (cfg && !wxReady && !mailReady) {
      return t('content.reminderSchedulerOff')
    }
    if (cfg?.hint) {
      return cfg.hint
    }
    if (!mailReady) {
      return t('content.reminderMailChannelOff')
    }
    return t('content.reminderCreateHint')
  }, [capability, cfg, t])

  return (
    <BasicContent isPermission={checkPermission('/content/reminder/index', permissions)}>
      {/* BasicContent 的 children 类型是 JSX.Element | JSX.Element[]（不收 false/null），
          而本页有若干条件渲染块，所以统一包一个 Fragment */}
      <>
        <Typography.Title level={4} className='mt-0'>
          <BellOutlined /> {t('content.reminderTitle')}
        </Typography.Title>

        <Alert
          type={capability && !capability.schedulerEnabled ? 'error' : cfg && !cfg.enabled && !cfg.mailEnabled ? 'warning' : 'info'}
          showIcon
          className='mb-3'
          message={alertText}
          description={
            cfg
              ? t('content.reminderMyQuota', { count: cfg.quota }) +
                ' · ' +
                (cfg.wxBound ? t('content.reminderMyWxBound') : t('content.reminderMyWxUnbound')) +
                ' · ' +
                (cfg.accountEmail ? `${t('content.reminderMyEmail')}: ${cfg.accountEmail}` : t('content.reminderMyNoEmail')) +
                (cfg.needAuth ? ` · ${cfg.needAuth} ${t('content.reminderStatusNeedAuth')}` : '')
              : undefined
          }
        />

        {isAdmin && summary && (
          <Row gutter={12} className='mb-3'>
            <Col span={6}>
              <Card size='small'>
                <Statistic title={t('public.total')} value={summary.total} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size='small'>
                <Statistic title={t('content.reminderStatusWaiting')} value={summary.waiting} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size='small'>
                <Statistic title={t('content.reminderStatusNeedAuth')} value={summary.needAuth} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size='small'>
                <Statistic title={t('content.reminderStatusOff')} value={summary.off} />
              </Card>
            </Col>
          </Row>
        )}

        <Card size='small' className='mb-3'>
          <Space wrap>
            {/* 新建永远可用：建的是「当前登录人自己的一条单独提醒」（不关联日志），
                与当前看的是哪个视图无关；而编辑/启停只对自己的行开放（见下面操作列） */}
            <Button size='small' type='primary' icon={<PlusOutlined />} onClick={openCreate}>
              {t('content.reminderCreate')}
            </Button>
            {isAdmin && (
              <Radio.Group
                size='small'
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value)
                  setPage(1)
                }}
                options={[
                  { label: t('content.reminderAdminView'), value: 'all' },
                  { label: t('content.reminderMineOnly'), value: 'mine' },
                ]}
              />
            )}
            <Select
              allowClear
              size='small'
              style={{ width: 140 }}
              placeholder={t('content.reminderAllStatus')}
              value={status}
              onChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
              options={[1, 2, 3, 0].map((v) => ({ label: t(STATUS_META[v].key), value: v }))}
            />
            <Select
              allowClear
              size='small'
              style={{ width: 150 }}
              placeholder={t('content.reminderAllChannel')}
              value={channel}
              onChange={(v) => {
                setChannel(v)
                setPage(1)
              }}
              options={(Object.keys(CHANNEL_META) as ReminderChannel[]).map((v) => ({
                label: t(CHANNEL_META[v].key),
                value: v,
              }))}
            />
            <Input.Search
              allowClear
              size='small'
              style={{ width: 220 }}
              placeholder={t('content.reminderSearchPlaceholder')}
              onSearch={(v) => {
                setKeyword(v)
                setPage(1)
              }}
              onChange={(e) => !e.target.value && setKeyword('')}
            />
            <ReloadOutlined
              className='cursor-pointer'
              onClick={() => {
                loadRows()
                loadConfig()
              }}
            />
            {/* 测试邮件：SMTP 配错的表现全是「等不到信」，有这个口就不用等下一分钟
                （它测的是当前登录人自己的收件人，与当前视图无关，所以不拿 scope 拦） */}
            {cfg?.mailEnabled && (
              <Button size='small' onClick={onTestMail}>
                {t('content.reminderTestMail')}
              </Button>
            )}
            {/* 渠道分布只给管理员看：它是「邮件通道到底有没有人用」的唯一快照 */}
            {isAdmin && summary?.channels && (
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('content.reminderChannelStat', {
                  wx: summary.channels.wx,
                  email: summary.channels.email,
                  both: summary.channels.both,
                })}
              </Typography.Text>
            )}
          </Space>
        </Card>

        <Table<ReminderItem>
          rowKey='id'
          size='small'
          loading={loading}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.reminderEmpty')} /> }}
          pagination={
            scope === 'all' && isAdmin
              ? {
                  current: page,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  showTotal: (num) => t('public.totalNum', { num }),
                  onChange: (p, ps) => {
                    setPage(p)
                    setPageSize(ps)
                  },
                }
              : { pageSize, showTotal: (num) => t('public.totalNum', { num }) }
          }
        />

        {/* 新建/编辑弹窗：表单字段声明在 ./model.ts，提交与时间回落规则都在本页 */}
        <Modal
          title={t(editingId ? 'content.reminderEdit' : 'content.reminderCreate')}
          open={formOpen}
          onCancel={() => setFormOpen(false)}
          onOk={() => formRef.current?.submit()}
          okText={t('public.confirm')}
          cancelText={t('public.cancel')}
          confirmLoading={saving}
          destroyOnClose
          width={560}
        >
          {/* 新建的是不关联日志的单独提醒：不说这一句，用户会找不到「怎么挂到某条日志上」 */}
          {!editingId && <Alert type='info' showIcon className='mb-3' message={t('content.reminderStandaloneHint')} />}
          <BasicForm ref={formRef} list={formList} data={formRow} labelCol={{ span: 6 }} onValuesChange={onValuesChange} handleFinish={handleFinish}>
            {/* 选微信渠道时必须把「还得去小程序授权」说出来，否则建完只会看到一条永远发不出的提醒 */}
            {formChannel !== 'email' && (
              <Alert
                type={cfg?.enabled ? 'info' : 'warning'}
                showIcon
                className='mb-0'
                message={t(cfg?.enabled ? 'content.reminderWxNeedAuth' : 'content.reminderWxChannelOff')}
              />
            )}
          </BasicForm>
        </Modal>
      </>
    </BasicContent>
  )
}

export default Page
