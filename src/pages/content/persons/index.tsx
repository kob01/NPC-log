/**
 * 人物图谱页（/content/persons）
 * - 左栏：按 event_persons 聚合的人物卡片（出现次数/首末次/共现标签）
 * - 右栏：所选人物的相关日志时间线（按年过滤，条目点击进详情）
 * - 支持 ?name=xxx 深链（年度回顾人物标签跳转过来）
 * - 可以屏蔽某个人：只从自己的图谱列表里隐藏，日志正文与 AI 问答都不受影响（与小程序端同一口径）
 */
import { EyeInvisibleOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Col, Empty, Input, List, Popconfirm, Row, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import type { PersonBlockItem, PersonItem, PersonTimelineResult } from '@/servers/content/memory'

import BasicContent from '@/components/Content/BasicContent'
import NavLinks from '@/components/NavLinks'
import { useCommonStore } from '@/hooks/useCommonStore'
import { blockPerson, getMemoryPersons, getPersonBlocks, getPersonTimeline, unblockPerson } from '@/servers/content/memory'
import { checkPermission } from '@/utils/permissions'

const Page = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { search } = useLocation()
  const { permissions } = useCommonStore()

  const [persons, setPersons] = useState<PersonItem[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [filtered, setFiltered] = useState<PersonItem[]>([])
  const [selected, setSelected] = useState<string>('')
  const [year, setYear] = useState<string | undefined>(undefined)
  const [timeline, setTimeline] = useState<PersonTimelineResult | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  // 屏蔽名单：条数由列表接口带出（决定入口要不要露），名单本体按需拉
  const [blockedCount, setBlockedCount] = useState(0)
  const [blocks, setBlocks] = useState<PersonBlockItem[]>([])
  const [showBlocks, setShowBlocks] = useState(false)

  // ?name= 深链
  const urlName = useMemo(() => new URLSearchParams(search).get('name') || '', [search])

  /**
   * 左栏列表高度封顶到「视口还剩多少」：人多时卡片不再把页面顶长，超出部分在列表内部自己滚
   * 只按文档坐标算（rect.top + window.scrollY），这样右侧时间线再长、页面滚到哪都不影响列表高度
   * 不用 sticky：祖先 #layoutContent 与 BasicContent 都带 overflow-auto，sticky 会被这层滚动容器吃掉而失效
   */
  const listRef = useRef<HTMLDivElement>(null)
  const [listMaxHeight, setListMaxHeight] = useState<number>()

  useEffect(() => {
    const el = listRef.current
    if (!el) {
      return
    }
    const FOOT = 96 // 卡片底部说明行 + 卡片内边距 + 视口下沿余量
    const sync = () => {
      const docTop = el.getBoundingClientRect().top + window.scrollY
      setListMaxHeight(Math.max(200, window.innerHeight - docTop - FOOT))
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
    // 屏蔽名单展开/收起、关键词过滤都会顶下或挪动列表起点，重算一次
  }, [showBlocks, filtered.length])

  /** 加载人物列表 */
  const loadPersons = useCallback(
    async (keepSelected = false) => {
      try {
        setListLoading(true)
        const { code, data } = await getMemoryPersons()
        if (Number(code) === 200) {
          const list = data?.persons || []
          setPersons(list)
          setFiltered(list)
          setBlockedCount(Number(data?.blockedCount || 0))
          if (keepSelected) {
            // 恢复/屏蔽后重拉不该把选中项跳到第一个：人还在就维持原选择，不在了再回退
            setSelected((cur) => (cur && list.some((p) => p.person === cur) ? cur : list[0]?.person || ''))
            return
          }
          // 深链人物优先，否则选最高频
          const target = list.find((p) => p.person === urlName)?.person || list[0]?.person || ''
          setSelected(target)
        }
      } catch (error) {
        console.error('获取人物列表失败:', error)
      } finally {
        setListLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [urlName],
  )

  useEffect(() => {
    loadPersons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 加载所选人物时间线 */
  const loadTimeline = useCallback(async (person: string, y?: string) => {
    if (!person) {
      return
    }
    try {
      setTimelineLoading(true)
      const { code, data } = await getPersonTimeline(person, y)
      setTimeline(Number(code) === 200 && data ? data : null)
    } catch (error) {
      console.error('获取人物时间线失败:', error)
      setTimeline(null)
    } finally {
      setTimelineLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTimeline(selected, year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, year])

  /** 关键词过滤人物 */
  const onFilter = (value: string) => {
    const v = value.trim()
    setFiltered(v ? persons.filter((p) => p.person.includes(v)) : persons)
  }

  /** 拉被屏蔽名单（展开入口时拉一次：屏蔽了谁必须能找回来，否则与「人没了」无法区分） */
  const loadBlocks = useCallback(async () => {
    const { code, data } = await getPersonBlocks()
    if (Number(code) === 200) {
      setBlocks(data?.blocks || [])
      setBlockedCount((data?.blocks || []).length)
    }
  }, [])

  /**
   * 屏蔽一个人
   * 本地直接剔那一格，不重拉整张图：重拉会转一圈 loading，而屏蔽不该打断用户在看的时间线
   */
  const doBlock = async (name: string) => {
    const { code, message: msg } = await blockPerson(name)
    if (Number(code) !== 200) {
      message.error(msg || t('content.personsBlockFailed'))
      return
    }
    setPersons((cur) => cur.filter((p) => p.person !== name))
    setFiltered((cur) => cur.filter((p) => p.person !== name))
    setBlockedCount((cur) => cur + 1)
    if (selected === name) {
      setSelected('')
      setTimeline(null)
    }
    if (showBlocks) {
      loadBlocks()
    }
    message.success(t('content.personsBlocked'))
  }

  /** 恢复一个人：图谱那边是服务端算好的，必须重拉一次这个人才会回来 */
  const doUnblock = async (name: string) => {
    const { code, message: msg } = await unblockPerson(name)
    if (Number(code) !== 200) {
      message.error(msg || t('content.personsUnblockFailed'))
      return
    }
    setBlocks((cur) => cur.filter((b) => b.person !== name))
    setBlockedCount((cur) => Math.max(0, cur - 1))
    message.success(t('content.personsUnblocked'))
    loadPersons(true)
  }

  return (
    <BasicContent isPermission={checkPermission('/content/persons/index', permissions)}>
      <Typography.Title level={4} className='mt-0'>
        <UserOutlined /> {t('content.personsTitle')}
      </Typography.Title>

      <Row gutter={12}>
        {/* 左栏：人物列表 */}
        <Col span={8}>
          <Card
            title={t('content.personsList')}
            size='small'
            extra={
              blockedCount > 0 && (
                <Button size='small' type='link' onClick={() => setShowBlocks((v) => !v)}>
                  {t('content.personsBlockedToggle', { count: blockedCount })}
                </Button>
              )
            }
          >
            {/* 被屏蔽名单：展开才拉，不展开不多一趟往返（屏蔽了谁必须能找回来） */}
            {showBlocks && (
              <div className='mb-3 rounded-6px bg-gray-50 px-3 py-2'>
                {blocks.length ? (
                  blocks.map((b) => (
                    <div key={b.person} className='flex items-center justify-between py-1'>
                      <Typography.Text type='secondary' ellipsis className='flex-1'>
                        {b.person}
                      </Typography.Text>
                      <Button size='small' type='link' onClick={() => doUnblock(b.person)}>
                        {t('content.personsUnblock')}
                      </Button>
                    </div>
                  ))
                ) : (
                  <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                    {t('content.personsBlockEmpty')}
                  </Typography.Text>
                )}
              </div>
            )}
            <Input.Search
              allowClear
              placeholder={t('content.personsSearch')}
              className='mb-3'
              onSearch={onFilter}
              onChange={(e) => !e.target.value && onFilter('')}
            />
            <div ref={listRef} style={{ maxHeight: listMaxHeight, overflowY: 'auto' }}>
              <Spin spinning={listLoading}>
                {filtered.length ? (
                  <List
                    size='small'
                    dataSource={filtered}
                    renderItem={(p) => (
                      <List.Item
                        onClick={() => setSelected(p.person)}
                        className={`
                        cursor-pointer rounded-6px px-2
                        ${selected === p.person ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      `}
                      >
                        <div className='w-full'>
                          <div className='flex items-center justify-between'>
                            <Typography.Text strong>
                              <UserOutlined className='mr-1 text-purple-500' />
                              {p.person}
                            </Typography.Text>
                            <Space size={4}>
                              <Tag color='purple' style={{ marginRight: 0 }}>
                                {p.count}
                              </Tag>
                              {/* 屏蔽只隐这一格（日志与 AI 问答都不动），所以必须当面说清后果：Popconfirm 就是那句说明 */}
                              <Popconfirm
                                title={t('content.personsBlockConfirm', { name: p.person })}
                                description={t('content.personsBlockHint')}
                                okText={t('content.personsBlockOk')}
                                onConfirm={() => doBlock(p.person)}
                              >
                                <span onClick={(e) => e.stopPropagation()}>
                                  <Tooltip title={t('content.personsBlockTip')}>
                                    <Button size='small' type='text' icon={<EyeInvisibleOutlined />} />
                                  </Tooltip>
                                </span>
                              </Popconfirm>
                            </Space>
                          </div>
                          <div className='mt-1 text-12px text-gray-400'>
                            {p.firstTime} ~ {p.lastTime}
                          </div>
                          {p.topTags.length > 0 && (
                            <Space size={[4, 4]} wrap className='mt-1'>
                              {p.topTags.map((tag) => (
                                <Tag key={tag.tag} style={{ marginRight: 0, fontSize: 11 }}>
                                  {tag.tag}
                                </Tag>
                              ))}
                            </Space>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.personsEmpty')} />
                )}
              </Spin>
            </div>
            {persons.length > 0 && <div className='mt-2 text-12px text-gray-400'>{t('content.personsBlockGuide')}</div>}
          </Card>
        </Col>

        {/* 右栏：人物时间线 */}
        <Col span={16}>
          <Card
            title={
              <Space>
                {t('content.personsTimeline')}
                {selected && (
                  <Typography.Text strong style={{ color: '#722ed1' }}>
                    {selected}
                  </Typography.Text>
                )}
                {timeline && (
                  <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                    {timeline.total} {t('content.reportTotalEvents')}
                  </Typography.Text>
                )}
              </Space>
            }
            extra={
              <Select
                allowClear
                style={{ width: 110 }}
                placeholder={t('content.personsAllYears')}
                value={year}
                onChange={(v) => setYear(v)}
                options={(timeline?.years || []).map((y) => ({
                  label: `${y.year} (${y.count})`,
                  value: y.year,
                }))}
              />
            }
            size='small'
          >
            <Spin spinning={timelineLoading}>
              {timeline?.list?.length ? (
                <div>
                  {timeline.list.map((item) => (
                    <Card
                      key={item.id}
                      size='small'
                      hoverable
                      className='mb-2'
                      onClick={() => navigate(`/content/log/option?id=${item.id}`)}
                      styles={{ body: { padding: '8px 12px' } }}
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <Typography.Text strong ellipsis className='flex-1'>
                          {item.event}
                        </Typography.Text>
                        <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                          {item.time}
                        </Typography.Text>
                      </div>
                      {item.summary && (
                        <Typography.Paragraph type='secondary' ellipsis={{ rows: 2 }} style={{ fontSize: 12, margin: '2px 0' }}>
                          {item.summary}
                        </Typography.Paragraph>
                      )}
                      <div className='flex items-center justify-between'>
                        <Space size={[4, 4]} wrap>
                          {item.tags.slice(0, 4).map((tag) => (
                            <Tag key={tag} color='blue' style={{ marginRight: 0, fontSize: 11 }}>
                              {tag}
                            </Tag>
                          ))}
                        </Space>
                        <span onClick={(e) => e.stopPropagation()}>
                          <NavLinks lng={item.lng} lat={item.lat} position={item.position} address={item.address} compact />
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('content.personsTimelineEmpty')} />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </BasicContent>
  )
}

export default Page
