/**
 * 小程序访问记录页（/content/visit，仅管理员）
 *
 * 这张表回答的是「谁来过、几点、从哪个入口、停留多久、用什么设备」，
 * 数据由小程序 App.onShow / App.onHide 上报（表为 note_app_visit）。
 * 一次「进前台」一行：切后台再回来会多出一行，所以「点开次数」直接按行数算。
 *
 * 三件页面级设计决定：
 * 1. **详情按行懒取**：列表接口不返回 raw_payload / ua / 屏幕参数这些大字段，
 *    展开某一行才按 id 单取一次。50 行一页全带上就是白传几百 KB，
 *    而 99% 的行根本不会被展开看。
 * 2. **概览卡与趋势取的是全表/全窗口口径，不跟随筛选**：这几块的职责是
 *    「这张表到底有没有在攒数据」，跟着筛选走会变成「筛完什么都没了」的误读。
 * 3. **匿名行照实展示**：`is_login=0` 的行没有账号身份，只能看设备与 IP，
 *    这些恰好是「点进来又退回登录页」的流失现场，不能因为对不上人就藏起来。
 *
 * ⚠ 本页只读（除了删单行清脏数据），且接口挂 adminOnly 回查库：
 *   前端隐藏菜单不算防护，普通用户拿旧 token 直接调也是 403。
 */
import { DeleteOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ENV_META, STATUS_META, batteryText, clockDiffText, deviceText, durationText, orDash, pageLabelOf, shortTime, userTextOf } from './model'

import type { TableColumn } from '#/public'
import type { VisitAdminResult, VisitDetail, VisitEnvVersion, VisitItem } from '@/servers/content/visit'
import type { Dayjs } from 'dayjs'

import BasicContent from '@/components/Content/BasicContent'
import { useCommonStore } from '@/hooks/useCommonStore'
import { deleteVisit, getVisitAdminPage, getVisitDetail, VISIT_STATUS } from '@/servers/content/visit'
import { checkPermission } from '@/utils/permissions'
import { message } from '@/utils/staticAntd'

const { RangePicker } = DatePicker

/** 回看天数可选项（概览卡与趋势条的窗口） */
const DAYS_OPTIONS = [7, 14, 30, 90]

const Page = () => {
  const { t } = useTranslation()
  const { permissions } = useCommonStore()
  const canDelete = checkPermission('/content/visit/delete', permissions)

  const [rows, setRows] = useState<VisitItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<VisitAdminResult | null>(null)

  // 筛选条件：日期只取 YYYY-MM-DD 字符串交给后端（后端只认这个形状，其余当没填）
  const [range, setRange] = useState<[string, string] | null>(null)
  const [login, setLogin] = useState<'0' | '1' | ''>('')
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [envVersion, setEnvVersion] = useState<VisitEnvVersion | ''>('')
  // 场景值筛选存成字符串：它来自「入口分布」的点击，也可能是管理员手输的数字
  const [scene, setScene] = useState('')
  const [keyword, setKeyword] = useState('')
  const [days, setDays] = useState(14)

  // 展开行才取详情：key = visit_id，值可以是 'loading'
  const [details, setDetails] = useState<Record<number, VisitDetail | 'loading'>>({})

  const loadRows = useCallback(async () => {
    try {
      setLoading(true)
      const { code, data } = await getVisitAdminPage({
        page,
        pageSize,
        days,
        login,
        status,
        scene,
        envVersion,
        keyword,
        from: range?.[0] || '',
        to: range?.[1] || '',
      })
      if (Number(code) === 200 && data) {
        setRows(data.items || [])
        setTotal(Number(data.total || 0))
        setOverview(data)
        // 筛选一变就把详情缓存丢掉：老 id 的行可能已经不在结果里，
        // 而展开态是 antd 自己记着的，不清会看到上一条的旧数据
        setDetails({})
      }
    } catch (error) {
      console.error('获取访问记录失败:', error)
      message.error(t('content.visitLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [days, envVersion, keyword, login, page, pageSize, range, scene, status, t])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  /** 展开某一行：详情按需取一次，之后复用缓存（同一行反复展开不重复打接口） */
  const onExpand = useCallback(
    async (expanded: boolean, row: VisitItem) => {
      if (!expanded || details[row.id]) {
        return
      }
      setDetails((prev) => ({ ...prev, [row.id]: 'loading' }))
      try {
        const { code, data } = await getVisitDetail(row.id)
        if (Number(code) === 200 && data) {
          setDetails((prev) => ({ ...prev, [row.id]: data }))
        } else {
          setDetails((prev) => {
            const next = { ...prev }
            delete next[row.id]
            return next
          })
        }
      } catch (error) {
        console.error('获取访问记录详情失败:', error)
        setDetails((prev) => {
          const next = { ...prev }
          delete next[row.id]
          return next
        })
      }
    },
    [details],
  )

  const onDelete = async (id: number) => {
    try {
      const { code } = await deleteVisit(id)
      if (Number(code) === 200) {
        message.success(t('content.visitDeleted'))
        loadRows()
        return
      }
      message.error(t('content.visitDeleteFailed'))
    } catch (error) {
      console.error('删除访问记录失败:', error)
    }
  }

  /** 重置分页：任何筛选变了都该回第一页，否则会停在「筛完只剩 3 条的第 8 页」这种空结果 */
  const patchFilter = (fn: () => void) => {
    fn()
    setPage(1)
  }

  const columns = useMemo<TableColumn<VisitItem>>(
    () => [
      {
        title: t('content.visitUser'),
        dataIndex: 'username',
        width: 180,
        render: (_v, r) => (
          <Space size={4} wrap>
            <Typography.Text strong={r.isLogin}>{userTextOf(t, r)}</Typography.Text>
            {!r.isLogin && (
              <Tag color='default' style={{ marginRight: 0 }}>
                {t('content.visitAnonymous')}
              </Tag>
            )}
            {r.accountType === 1 && (
              <Tag color='red' style={{ marginRight: 0 }}>
                {t('content.visitAdminTag')}
              </Tag>
            )}
            <div>
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {orDash(r.ip)}
              </Typography.Text>
            </div>
          </Space>
        ),
      },
      {
        title: t('content.visitTime'),
        dataIndex: 'openTime',
        width: 190,
        render: (_v, r) => (
          <div>
            <Typography.Text>{shortTime(r.openTime)}</Typography.Text>
            <div>
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {r.closeTime ? `${t('content.visitCloseAt')} ${shortTime(r.closeTime)}` : t('content.visitNotClosed')}
              </Typography.Text>
            </div>
            <Space size={4} wrap>
              <Tag color={r.coldStart ? 'blue' : 'default'} style={{ marginRight: 0 }}>
                {r.coldStart ? t('content.visitColdStart') : t('content.visitHotStart')}
              </Tag>
              {r.foregroundIndex && r.foregroundIndex > 1 ? (
                <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                  {t('content.visitForegroundIndex', { n: r.foregroundIndex })}
                </Typography.Text>
              ) : null}
            </Space>
          </div>
        ),
      },
      {
        title: t('content.visitDuration'),
        dataIndex: 'durationSec',
        width: 110,
        render: (_v, r) => {
          const diff = clockDiffText(t, r.clockDiffMs)
          return (
            <div>
              <Typography.Text>{durationText(t, r.durationSec)}</Typography.Text>
              {diff && (
                <div>
                  <Typography.Text type='warning' style={{ fontSize: 12 }}>
                    {diff}
                  </Typography.Text>
                </div>
              )}
            </div>
          )
        },
      },
      {
        /**
         * 入口：文案只是辅助，数字 scene 才是判据（scene_label 来自端上映射表，
         * 未收录的值写的是「场景N」，拿文案反推规则迟早会看错）
         */
        title: t('content.visitEntry'),
        dataIndex: 'scene',
        width: 190,
        render: (_v, r) => (
          <div>
            <Typography.Text>{r.sceneLabel || orDash(r.scene)}</Typography.Text>
            <div>
              <Space size={4} wrap>
                {r.hasShareTicket && (
                  <Tag color='purple' style={{ marginRight: 0 }}>
                    {t('content.visitShareCard')}
                  </Tag>
                )}
                <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                  {t('content.visitSceneCode', { scene: orDash(r.scene) })}
                </Typography.Text>
              </Space>
            </div>
          </div>
        ),
      },
      {
        title: t('content.visitPage'),
        dataIndex: 'lastRoute',
        width: 150,
        render: (_v, r) => (
          <div>
            <Typography.Text>{pageLabelOf(t, r.lastRoute || r.launchPath)}</Typography.Text>
            <div>
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('content.visitEnterPage')}：{pageLabelOf(t, r.launchPath) || '-'}
              </Typography.Text>
            </div>
          </div>
        ),
      },
      {
        title: t('content.visitDevice'),
        dataIndex: 'model',
        width: 230,
        render: (_v, r) => {
          const battery = batteryText(r)
          const env = ENV_META[r.envVersion as VisitEnvVersion]
          return (
            <div>
              <Typography.Text>{deviceText(r) || '-'}</Typography.Text>
              <div>
                <Space size={4} wrap>
                  {env && (
                    <Tag color={env.color} style={{ marginRight: 0 }}>
                      {t(env.key)}
                    </Tag>
                  )}
                  <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                    {[r.netType, battery, r.wxVersion].filter(Boolean).join(' · ') || '-'}
                  </Typography.Text>
                </Space>
              </div>
              <div>
                <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                  {t('content.visitSdk', { sdk: orDash(r.sdkVersion), ver: orDash(r.mpVersion) })}
                </Typography.Text>
              </div>
            </div>
          )
        },
      },
      {
        title: t('content.visitStatus'),
        dataIndex: 'status',
        width: 100,
        render: (v: number) => {
          const meta = STATUS_META[v] || STATUS_META[VISIT_STATUS.INTERRUPTED]
          return (
            <Tag color={meta.color} style={{ marginRight: 0 }}>
              {t(meta.key)}
            </Tag>
          )
        },
      },
      {
        title: t('public.operate'),
        dataIndex: 'operation',
        width: 70,
        render: (_v, r) =>
          canDelete ? (
            <Popconfirm
              title={t('content.visitDeleteConfirm')}
              okText={t('public.confirm')}
              cancelText={t('public.cancel')}
              onConfirm={() => onDelete(r.id)}
            >
              <Button size='small' type='text' danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ) : null,
      },
    ],
    // onDelete 每次渲染都是新函数，列入依赖会让 columns 每帧重建（Table 会反复重排）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canDelete, t],
  )

  /** 展开区：详情按组排版，最后附上端上原始报文 */
  const expandedRowRender = (row: VisitItem) => {
    const detail = details[row.id]
    if (!detail || detail === 'loading') {
      return (
        <div className='py-16px text-center'>
          <Spin size='small' />
        </div>
      )
    }
    const d = detail
    const items = [
      { key: 'open', label: t('content.visitOpenTime'), children: shortTime(d.openTime, true) },
      { key: 'close', label: t('content.visitCloseTime'), children: d.closeTime ? shortTime(d.closeTime, true) : t('content.visitNotClosed') },
      { key: 'duration', label: t('content.visitDuration'), children: durationText(t, d.durationSec) },
      { key: 'client', label: t('content.visitClientTime'), children: d.clientOpenMs ? new Date(d.clientOpenMs).toLocaleString() : '-' },
      { key: 'status', label: t('content.visitStatus'), children: t((STATUS_META[d.status] || STATUS_META[3]).key) },
      {
        key: 'user',
        label: t('content.visitUser'),
        children: d.username ? `${d.nickName || d.username}（${d.username}）` : t('content.visitAnonymous'),
      },
      { key: 'scene', label: t('content.visitScene'), children: `${orDash(d.scene)} ${d.sceneLabel || ''}`.trim() },
      { key: 'launch', label: t('content.visitLaunchPath'), children: orDash(d.launchPath) },
      { key: 'query', label: t('content.visitLaunchQuery'), children: orDash(d.launchQuery) },
      { key: 'last', label: t('content.visitLastRoute'), children: orDash(d.lastRoute) },
      { key: 'ref', label: t('content.visitReferrer'), children: orDash(d.refAppid) },
      { key: 'ch', label: t('content.visitChInfo'), children: orDash(d.chInfo) },
      { key: 'device', label: t('content.visitDevice'), children: deviceText(d) || '-' },
      { key: 'memory', label: t('content.visitMemory'), children: d.deviceMemoryMb ? `${d.deviceMemoryMb} MB` : '-' },
      {
        key: 'screen',
        label: t('content.visitScreen'),
        children: d.screenWidth ? `${d.screenWidth}×${d.screenHeight}${d.pixelRatio ? ` @${d.pixelRatio}x` : ''}` : '-',
      },
      { key: 'window', label: t('content.visitWindow'), children: d.windowWidth ? `${d.windowWidth}×${d.windowHeight}` : '-' },
      { key: 'bar', label: t('content.visitStatusBar'), children: d.statusBarHeight ? `${d.statusBarHeight} / ${d.safeBottom ?? '-'} px` : '-' },
      { key: 'battery', label: t('content.visitBattery'), children: batteryText(d) || '-' },
      { key: 'brightness', label: t('content.visitBrightness'), children: orDash(d.brightness) },
      { key: 'net', label: t('content.visitNetType'), children: orDash(d.netType) },
      {
        key: 'wifi',
        label: t('content.visitWifiOn'),
        children: d.wifiEnabled === null ? '-' : d.wifiEnabled ? t('content.visitSwitchOn') : t('content.visitSwitchOff'),
      },
      {
        key: 'location',
        label: t('content.visitLocationOn'),
        children: d.locationEnabled === null ? '-' : d.locationEnabled ? t('content.visitSwitchOn') : t('content.visitSwitchOff'),
      },
      { key: 'orientation', label: t('content.visitOrientation'), children: orDash(d.deviceOrientation) },
      { key: 'lang', label: t('content.visitLanguage'), children: orDash(d.language) },
      { key: 'theme', label: t('content.visitTheme'), children: orDash(d.theme) },
      { key: 'wx', label: t('content.visitWxVersion'), children: orDash(d.wxVersion) },
      { key: 'sdk', label: t('content.visitSdkVersion'), children: orDash(d.sdkVersion) },
      { key: 'mp', label: t('content.visitMpVersion'), children: orDash(d.mpVersion) },
      {
        key: 'env',
        label: t('content.visitEnvVersion'),
        children: ENV_META[d.envVersion as VisitEnvVersion] ? t(ENV_META[d.envVersion as VisitEnvVersion].key) : orDash(d.envVersion),
      },
      { key: 'appid', label: 'AppID', children: orDash(d.appId) },
      { key: 'ip', label: t('content.visitIp'), children: orDash(d.ip) },
      { key: 'ua', label: 'User-Agent', children: orDash(d.ua) },
      { key: 'req', label: t('content.visitRequestId'), children: orDash(d.requestId) },
      { key: 'key', label: t('content.visitKey'), children: orDash(d.visitKey) },
      { key: 'create', label: t('content.visitCreateTime'), children: shortTime(d.createTime, true) },
    ]

    return (
      <div className='py-2'>
        <Descriptions size='small' column={{ xs: 1, sm: 2, md: 3, lg: 4 }} items={items} />
        {/* 原始报文：没落成列的字段全在这里，想加新维度先来看这里有没有 */}
        <Card size='small' title={t('content.visitRawPayload')} className='mt-3'>
          <Typography.Paragraph copyable={{ text: JSON.stringify(d.rawPayload ?? '', null, 2) }} className='mb-2'>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              {t('content.visitRawHint')}
            </Typography.Text>
          </Typography.Paragraph>
          <pre style={{ maxHeight: 260, overflow: 'auto', margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {typeof d.rawPayload === 'string' ? d.rawPayload : JSON.stringify(d.rawPayload ?? {}, null, 2)}
          </pre>
        </Card>
      </div>
    )
  }

  const today = overview?.today
  const trend = overview?.trend || []
  const maxOpens = trend.reduce((m, r) => Math.max(m, r.opens), 0)
  const scenes = overview?.scenes || []
  const maxScene = scenes.reduce((m, r) => Math.max(m, r.cnt), 0)
  const summary = overview?.summary

  return (
    <BasicContent isPermission={checkPermission('/content/visit/index', permissions)}>
      <>
        <Typography.Title level={4} className='mt-0'>
          <HistoryOutlined /> {t('content.visitTitle')}
        </Typography.Title>

        {/* 记录功能整体关着时必须说在第一位：否则页面看起来像「没人用」，其实是没在记 */}
        {overview && !overview.capability.trackEnabled && (
          <Alert type='warning' showIcon className='mb-3' message={t('content.visitTrackDisabled')} />
        )}
        {summary && summary.total === 0 && <Alert type='info' showIcon className='mb-3' message={t('content.visitEmptyHint')} />}

        {summary && (
          <Row gutter={12} className='mb-3'>
            <Col span={5}>
              <Card size='small'>
                <Statistic title={t('content.visitTodayOpens')} value={today?.opens ?? 0} suffix={t('content.visitTimes')} />
              </Card>
            </Col>
            <Col span={5}>
              <Card size='small'>
                <Statistic title={t('content.visitTodayPeople')} value={today?.people ?? 0} />
              </Card>
            </Col>
            <Col span={5}>
              <Card size='small'>
                {/* 进行中不是「在线人数」：它只统计没等到关闭上报的那几行，
                    小程序被杀掉而没发出 close 时这里会留一行 */}
                <Statistic
                  title={t('content.visitRunning')}
                  value={summary.running}
                  valueStyle={{ color: summary.running ? '#faad14' : undefined }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size='small'>
                <Statistic title={t('content.visitAvgDuration')} value={summary.avgSec} suffix={t('content.visitSeconds')} />
              </Card>
            </Col>
            <Col span={5}>
              <Card size='small'>
                <Statistic
                  title={t('content.visitTotalRows')}
                  value={summary.total}
                  suffix={t('content.visitAnonRatio', {
                    anon: summary.anon,
                    total: summary.total,
                  })}
                />
              </Card>
            </Col>
          </Row>
        )}

        <Row gutter={12} className='mb-3'>
          <Col span={14}>
            <Card size='small' title={t('content.visitTrendTitle', { days: overview?.days ?? days })}>
              {trend.length ? (
                trend.map((r) => (
                  <div key={r.day} className='mb-2'>
                    <div className='flex justify-between text-12px'>
                      <span>{r.day}</span>
                      <span>{t('content.visitTrendValue', { opens: r.opens, people: r.people, anon: r.anon })}</span>
                    </div>
                    <Progress percent={maxOpens ? Math.round((r.opens / maxOpens) * 100) : 0} showInfo={false} size='small' />
                  </div>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.visitNoTrend')} />
              )}
            </Card>
          </Col>
          <Col span={10}>
            <Card size='small' title={t('content.visitSceneTitle', { days: overview?.days ?? days })}>
              {scenes.length ? (
                scenes.map((s) => (
                  <div key={`scene-${s.scene ?? 'null'}`} className='mb-2'>
                    <div className='flex justify-between text-12px'>
                      {/* 点这一行就把列表筛到该场景：文案（可能是「场景N」）不如数字可靠，所以主展示是数字 */}
                      <Typography.Link onClick={() => patchFilter(() => setScene(s.scene === null ? '' : String(s.scene)))}>
                        {s.sceneLabel || orDash(s.scene)}
                      </Typography.Link>
                      <span>{s.cnt}</span>
                    </div>
                    <Progress percent={maxScene ? Math.round((s.cnt / maxScene) * 100) : 0} showInfo={false} size='small' />
                  </div>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.visitNoTrend')} />
              )}
            </Card>
          </Col>
        </Row>

        <Card size='small' className='mb-3'>
          <Space wrap>
            <RangePicker
              size='small'
              onChange={(v: [Dayjs | null, Dayjs | null] | null) =>
                patchFilter(() => setRange(v && v[0] && v[1] ? [v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')] : null))
              }
            />
            <Select
              allowClear
              size='small'
              style={{ width: 130 }}
              placeholder={t('content.visitAllLogin')}
              value={login || undefined}
              onChange={(v) => patchFilter(() => setLogin(v || ''))}
              options={[
                { label: t('content.visitOnlyLogin'), value: '1' },
                { label: t('content.visitOnlyAnon'), value: '0' },
              ]}
            />
            <Select
              allowClear
              size='small'
              style={{ width: 150 }}
              placeholder={t('content.visitAllStatus')}
              value={status}
              onChange={(v) => patchFilter(() => setStatus(v))}
              options={[VISIT_STATUS.RUNNING, VISIT_STATUS.CLOSED, VISIT_STATUS.INTERRUPTED].map((v) => ({
                label: t(STATUS_META[v].key),
                value: v,
              }))}
            />
            <Select
              allowClear
              size='small'
              style={{ width: 130 }}
              placeholder={t('content.visitAllEnv')}
              value={envVersion || undefined}
              onChange={(v) => patchFilter(() => setEnvVersion((v || '') as VisitEnvVersion | ''))}
              options={(Object.keys(ENV_META) as VisitEnvVersion[]).map((v) => ({
                label: t(ENV_META[v].key),
                value: v,
              }))}
            />
            <Select
              allowClear
              size='small'
              style={{ width: 190 }}
              placeholder={t('content.visitAllScenes')}
              value={scene || undefined}
              onChange={(v) => patchFilter(() => setScene(v || ''))}
              options={scenes.map((s) => ({
                label: `${s.scene ?? '-'} ${s.sceneLabel || ''}`.trim(),
                value: String(s.scene ?? ''),
              }))}
            />
            <Select
              size='small'
              style={{ width: 120 }}
              value={days}
              onChange={(v) => patchFilter(() => setDays(v))}
              options={DAYS_OPTIONS.map((v) => ({
                label: t('content.visitDaysOption', { days: v }),
                value: v,
              }))}
            />
            <Input.Search
              allowClear
              size='small'
              style={{ width: 230 }}
              placeholder={t('content.visitSearchPlaceholder')}
              onSearch={(v) => patchFilter(() => setKeyword(v.trim()))}
              onChange={(e) => !e.target.value && patchFilter(() => setKeyword(''))}
            />
            <ReloadOutlined className='cursor-pointer' onClick={() => loadRows()} />
          </Space>
        </Card>

        <Table<VisitItem>
          rowKey='id'
          size='small'
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1180 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.visitEmpty')} /> }}
          expandable={{ expandedRowRender, onExpand, rowExpandable: () => true }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (num) => t('public.totalNum', { num }),
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </>
    </BasicContent>
  )
}

export default Page
