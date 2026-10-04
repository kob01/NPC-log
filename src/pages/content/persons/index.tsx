/**
 * 人物图谱页（/content/persons）
 * - 左栏：按 event_persons 聚合的人物卡片（出现次数/首末次/共现标签）
 * - 右栏：所选人物的相关日志时间线（按年过滤，条目点击进详情）
 * - 支持 ?name=xxx 深链（年度回顾人物标签跳转过来）
 */
import { UserOutlined } from '@ant-design/icons'
import { Card, Col, Empty, Input, List, Row, Select, Space, Spin, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import type { PersonItem, PersonTimelineResult } from '@/servers/content/memory'

import BasicContent from '@/components/Content/BasicContent'
import NavLinks from '@/components/NavLinks'
import { useCommonStore } from '@/hooks/useCommonStore'
import { getMemoryPersons, getPersonTimeline } from '@/servers/content/memory'
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

  // ?name= 深链
  const urlName = useMemo(() => new URLSearchParams(search).get('name') || '', [search])

  /** 加载人物列表 */
  useEffect(() => {
    const load = async () => {
      try {
        setListLoading(true)
        const { code, data } = await getMemoryPersons()
        if (Number(code) === 200) {
          const list = data?.persons || []
          setPersons(list)
          setFiltered(list)
          // 深链人物优先，否则选最高频
          const target = list.find((p) => p.person === urlName)?.person || list[0]?.person || ''
          setSelected(target)
        }
      } catch (error) {
        console.error('获取人物列表失败:', error)
      } finally {
        setListLoading(false)
      }
    }
    load()
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

  return (
    <BasicContent isPermission={checkPermission('/content/persons/index', permissions)}>
      <Typography.Title level={4} className='mt-0'>
        <UserOutlined /> {t('content.personsTitle')}
      </Typography.Title>

      <Row gutter={12}>
        {/* 左栏：人物列表 */}
        <Col span={8}>
          <Card title={t('content.personsList')} size='small'>
            <Input.Search
              allowClear
              placeholder={t('content.personsSearch')}
              className='mb-3'
              onSearch={onFilter}
              onChange={(e) => !e.target.value && onFilter('')}
            />
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
                          <Tag color='purple' style={{ marginRight: 0 }}>
                            {p.count}
                          </Tag>
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
