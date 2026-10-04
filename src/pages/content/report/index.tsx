/**
 * 年度回顾页（/content/report）— Spotify Wrapped 式「这一年」报告
 * - 统计聚合零 AI 成本：条数/活跃月/分类分布/热门标签/高频人物/足迹数
 * - AI 年度总结：仅输入当月各条已存摘要与月度缓存（不重读原文），一年一次 LLM 调用，懒生成+缓存
 * - AI 未配置时：统计部分完整可用，总结区提示配置密钥
 */
import { CalendarOutlined, EnvironmentOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Progress, Row, Select, Space, Spin, Statistic, Tag, Timeline, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { YearReportResult } from '@/servers/content/memory'

import BasicContent from '@/components/Content/BasicContent'
import { useCommonStore } from '@/hooks/useCommonStore'
import { getYearReport } from '@/servers/content/memory'
import { checkPermission } from '@/utils/permissions'

const Page = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { permissions } = useCommonStore()
  const [year, setYear] = useState<number | undefined>(undefined)
  const [report, setReport] = useState<YearReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (y?: number) => {
      try {
        setLoading(true)
        setError('')
        const { code, data, message: msg } = await getYearReport(y)
        if (Number(code) === 200 && data) {
          setReport(data)
          setYear(data.year)
        } else {
          setError(msg || t('content.reportLoadFailed'))
        }
      } catch (err) {
        console.error('获取年度回顾失败:', err)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    load()
  }, [load])

  const maxTypeCount = report?.typeDist?.[0]?.count || 1

  return (
    <BasicContent isPermission={checkPermission('/content/report/index', permissions)}>
      <Space className='w-full flex items-center justify-between mb-4'>
        <Typography.Title level={4} className='mt-0 mb-0'>
          <CalendarOutlined /> {t('content.reportTitle')}
        </Typography.Title>
        <Space>
          <Select
            style={{ width: 120 }}
            value={year}
            placeholder={t('public.date')}
            onChange={(v) => load(v)}
            options={(report?.years || []).map((y) => ({
              label: `${y}`,
              value: y,
            }))}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(year)}>
            {t('public.reload')}
          </Button>
        </Space>
      </Space>

      {error ? <Alert type='error' showIcon message={error} className='mb-4' /> : <span />}

      <Spin spinning={loading}>
        <div>
          {report && report.eventCount === 0 && !loading ? (
            <Empty description={t('content.reportEmpty')} className='mt-60px' />
          ) : (
            report && (
              <>
                {/* 核心数字 */}
                <Row gutter={12} className='mb-4'>
                  <Col span={6}>
                    <Card size='small'>
                      <Statistic title={t('content.reportTotalEvents')} value={report.eventCount} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size='small'>
                      <Statistic title={t('content.reportActiveMonths')} value={report.monthCount} suffix='/ 12' />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size='small'>
                      <Statistic title={t('content.reportLocated')} value={report.locatedCount} prefix={<EnvironmentOutlined />} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size='small'>
                      <Statistic title={t('content.reportPersons')} value={report.topPersons?.length || 0} prefix={<UserOutlined />} />
                    </Card>
                  </Col>
                </Row>

                {/* AI 年度总结 */}
                <Card title={t('content.reportAiSummary')} className='mb-4' size='small'>
                  {report.summary ? (
                    <>
                      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{report.summary}</Typography.Paragraph>
                      <Space size={[4, 6]} wrap>
                        {report.keywords.map((k) => (
                          <Tag key={k} color='gold' style={{ marginRight: 0 }}>
                            {k}
                          </Tag>
                        ))}
                      </Space>
                      {report.cached && (
                        <Typography.Text type='secondary' style={{ fontSize: 12 }} className='ml-2'>
                          {t('content.memorySummaryCached')}
                        </Typography.Text>
                      )}
                    </>
                  ) : report.aiConfigured ? (
                    <Typography.Text type='secondary'>{report.eventCount ? t('content.memoryAiFailed') : t('content.reportEmpty')}</Typography.Text>
                  ) : (
                    <Alert type='info' showIcon message={t('content.reportNoAi')} />
                  )}
                </Card>

                <Row gutter={12}>
                  {/* 分类分布 */}
                  <Col span={8}>
                    <Card title={t('content.reportTypeDist')} size='small' className='mb-4'>
                      {report.typeDist.length ? (
                        report.typeDist.map((item) => (
                          <div key={item.type} className='mb-2'>
                            <div className='flex justify-between text-12px'>
                              <span>{item.type}</span>
                              <span>{item.count}</span>
                            </div>
                            <Progress percent={Math.round((item.count / maxTypeCount) * 100)} showInfo={false} size='small' />
                          </div>
                        ))
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                  </Col>

                  {/* 高频人物 */}
                  <Col span={8}>
                    <Card title={t('content.reportTopPersons')} size='small' className='mb-4'>
                      {report.topPersons.length ? (
                        <Space size={[6, 8]} wrap>
                          {report.topPersons.map((p) => (
                            <Tag
                              key={p.person}
                              icon={<UserOutlined />}
                              color='purple'
                              style={{ cursor: 'pointer', marginRight: 0 }}
                              onClick={() => navigate(`/content/persons?name=${encodeURIComponent(p.person)}`)}
                            >
                              {p.person} · {p.count}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                  </Col>

                  {/* 热门标签 */}
                  <Col span={8}>
                    <Card title={t('content.memoryTagsTitle')} size='small' className='mb-4'>
                      {report.topTags.length ? (
                        <Space size={[6, 8]} wrap>
                          {report.topTags.map((tag) => (
                            <Tag key={tag.tag} color='geekblue' style={{ marginRight: 0 }}>
                              {tag.tag} · {tag.count}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                  </Col>
                </Row>

                {/* 月度时间线（复用月度摘要缓存） */}
                <Card title={t('content.reportMonthline')} size='small'>
                  <Timeline
                    mode='left'
                    items={report.months.map((m) => ({
                      color: m.summary ? 'blue' : 'gray',
                      children: (
                        <div>
                          <Typography.Text strong>{m.month}</Typography.Text>
                          <Typography.Text type='secondary' className='ml-2 text-12px'>
                            {m.count} {t('content.reportTotalEvents')}
                          </Typography.Text>
                          {m.summary && (
                            <Typography.Paragraph
                              type='secondary'
                              ellipsis={{ rows: 2, expandable: true }}
                              className='mt-1 mb-0'
                              style={{ fontSize: 13 }}
                            >
                              {m.summary}
                            </Typography.Paragraph>
                          )}
                        </div>
                      ),
                    }))}
                  />
                </Card>
              </>
            )
          )}
        </div>
      </Spin>
    </BasicContent>
  )
}

export default Page
