import {
  BulbOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShareAltOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Empty, Image, Input, Space, Spin, Tag, Typography, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { CardData } from '@/components/ShareCard/templates'
import type { ShareCopyResult, SocialPlatform } from '@/servers/content/event'
import type { MemoryAskResult, MemorySearchItem, MemorySummaryResult, TagCountItem } from '@/servers/content/memory'

import BasicContent from '@/components/Content/BasicContent'
import NavLinks from '@/components/NavLinks'
import ShareCardModal from '@/components/ShareCard'
import { useCommonStore } from '@/hooks/useCommonStore'
import { useMobileRedirect } from '@/hooks/useMobileRedirect'
import { askMemory, generateMemoryShareCopy, getMemorySummary, getMemoryTags, isAiNotConfigured, searchMemory } from '@/servers/content/memory'
import { EMPTY_VALUE, resolveFileUrl } from '@/utils/config'
import { checkPermission } from '@/utils/permissions'

const Page = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { permissions } = useCommonStore()

  // 手机访问记忆页时切到移动版（单列布局）
  const toMobile = useMobileRedirect('/m/memory')

  // ==================== 问答 ====================
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askResult, setAskResult] = useState<MemoryAskResult | null>(null)
  const [askNotConfigured, setAskNotConfigured] = useState(false)
  const [askError, setAskError] = useState('')

  // ==================== 记忆搜索 ====================
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchList, setSearchList] = useState<MemorySearchItem[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [limit, setLimit] = useState(8)

  // ==================== 热门标签 ====================
  const [tags, setTags] = useState<TagCountItem[]>([])

  // ==================== 月度摘要 ====================
  const [summary, setSummary] = useState<MemorySummaryResult | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryNotConfigured, setSummaryNotConfigured] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  /** 月度回顾分享卡：把当前摘要交给 AI 改写 */
  const summaryCardData: CardData = {
    time: summary?.period,
    event: `${summary?.period || ''} 月度回顾`,
    summary: summary?.summary,
    tags: summary?.keywords,
  }

  const getSummaryCopy = useCallback(
    async (platform: SocialPlatform): Promise<ShareCopyResult | null> => {
      const { code, data } = await generateMemoryShareCopy({
        month: summary?.period,
        platform,
      })
      return Number(code) === 200 && data ? data : null
    },
    [summary?.period],
  )

  // 热门标签：进入页面即拉取（不依赖 AI 密钥）
  useEffect(() => {
    if (toMobile) {
      return
    }
    const loadTags = async () => {
      try {
        const { code, data } = await getMemoryTags()
        if (Number(code) === 200) {
          setTags(data?.tags || [])
        }
      } catch (error) {
        console.error('获取热门标签失败:', error)
      }
    }
    loadTags()
  }, [])

  /**
   * 点击标签：填入搜索框并触发搜索
   * @param tag - 标签名
   */
  const onTagClick = (tag: string) => {
    setKeyword(tag)
    handleSearch(tag)
  }

  /**
   * AI 问答
   */
  const handleAsk = useCallback(async () => {
    const q = question.trim()
    if (!q) {
      message.warning(t('content.memoryAskPlaceholder'))
      return
    }
    try {
      setAsking(true)
      setAskError('')
      setAskNotConfigured(false)
      setAskResult(null)
      const { code, message: msg, data } = await askMemory(q)
      if (Number(code) === 200 && data) {
        setAskResult(data)
      } else if (isAiNotConfigured(msg)) {
        setAskNotConfigured(true)
      } else {
        setAskError(msg || t('content.memoryAiFailed'))
      }
    } catch (error) {
      console.error('AI 问答失败:', error)
      setAskError(error instanceof Error ? error.message : String(error))
    } finally {
      setAsking(false)
    }
  }, [question, t])

  /**
   * 记忆搜索
   * @param value - 搜索关键词（默认取输入框）
   * @param size - 返回条数
   */
  const handleSearch = useCallback(
    async (value?: string, size = limit) => {
      const q = (value ?? keyword).trim()
      if (!q) {
        message.warning(t('content.memorySearchPlaceholder'))
        return
      }
      try {
        setSearching(true)
        setSearched(true)
        const { code, data, message: msg } = await searchMemory(q, size)
        if (Number(code) === 200 && data) {
          setSearchList(data.list || [])
          setSearchTotal(data.total || 0)
          setLimit(size)
        } else {
          message.error(msg || t('content.memorySearchEmpty'))
        }
      } catch (error) {
        console.error('记忆搜索失败:', error)
        message.error(t('content.memorySearchEmpty'))
      } finally {
        setSearching(false)
      }
    },
    [keyword, limit, t],
  )

  /**
   * 加载更多（放大 top-k 重新检索）
   */
  const handleLoadMore = () => {
    handleSearch(keyword, Math.min(limit + 8, 20))
  }

  /**
   * 生成/获取月度摘要
   */
  const handleSummary = useCallback(async () => {
    try {
      setSummaryLoading(true)
      setSummaryNotConfigured(false)
      const { code, message: msg, data } = await getMemorySummary()
      if (Number(code) === 200 && data) {
        setSummary(data)
      } else if (isAiNotConfigured(msg)) {
        setSummaryNotConfigured(true)
      } else {
        message.warning(msg || t('content.memorySummaryEmpty'))
      }
    } catch (error) {
      console.error('获取月度摘要失败:', error)
    } finally {
      setSummaryLoading(false)
    }
  }, [t])

  /**
   * 跳转到日志编辑页（查看完整条目）
   * @param id - 日志 id
   */
  const goDetail = (id: number) => {
    navigate(`/content/log/option?id=${id}`)
  }

  /**
   * 渲染单条记忆结果卡片
   * @param item - 搜索结果
   */
  const renderCard = (item: MemorySearchItem) => {
    const thumb = resolveFileUrl(item.firstThumb)
    return (
      <Card key={item.id} size='small' hoverable className='mb-3' onClick={() => goDetail(item.id)} styles={{ body: { padding: 12 } }}>
        <div className='flex gap-3'>
          {thumb ? <Image src={thumb} width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} preview={false} /> : null}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center justify-between gap-2'>
              <Typography.Text strong ellipsis className='flex-1'>
                {item.event || EMPTY_VALUE}
              </Typography.Text>
              <Typography.Text type='secondary' style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {item.time || EMPTY_VALUE}
              </Typography.Text>
            </div>

            {item.summary ? (
              <ParagraphEllipsis text={item.summary} />
            ) : (
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('content.memoryAiNotProcessed')}
              </Typography.Text>
            )}

            <Space size={[4, 4]} wrap className='mt-1'>
              {item.tags.map((tag) => (
                <Tag key={tag} color='blue' style={{ marginRight: 0 }}>
                  {tag}
                </Tag>
              ))}
              {item.persons.map((p) => (
                <Tag key={p} icon={<UserOutlined />} color='purple' style={{ marginRight: 0 }}>
                  {p}
                </Tag>
              ))}
            </Space>

            <div className='mt-1 flex items-center justify-between'>
              <NavLinks lng={item.lng} lat={item.lat} position={item.position} address={item.address} compact />
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('content.memoryRelevance')} {Math.round(item.score * 100)}%
              </Typography.Text>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  // 已判定走移动版，等重定向生效，不再渲染桌面双栏
  if (toMobile) {
    return null
  }

  return (
    <BasicContent isPermission={checkPermission('/content/memory/index', permissions)}>
      <Typography.Title level={4} className='mt-0'>
        <BulbOutlined /> {t('content.memoryTitle')}
      </Typography.Title>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 items-start'>
        {/* ==================== 左列：问答 + 月度摘要 ==================== */}
        <Space direction='vertical' size={16} className='w-full'>
          <Card
            title={
              <Space>
                <ThunderboltOutlined /> {t('content.memoryAskBtn')}
              </Space>
            }
          >
            <Input.TextArea
              rows={3}
              value={question}
              maxLength={500}
              showCount
              placeholder={t('content.memoryAskPlaceholder')}
              onChange={(e) => setQuestion(e.target.value)}
              onPressEnter={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  handleAsk()
                }
              }}
            />
            <div className='mt-3'>
              <Button type='primary' icon={<ThunderboltOutlined />} loading={asking} onClick={handleAsk}>
                {t('content.memoryAskBtn')}
              </Button>
            </div>

            {asking && (
              <div className='mt-3 text-center'>
                <Spin tip={t('content.memoryAskLoading')} />
              </div>
            )}

            {askNotConfigured && <Alert className='mt-3' type='info' showIcon message={t('content.memoryAskNotConfigured')} />}

            {askError && <Alert className='mt-3' type='error' showIcon message={askError} />}

            {askResult && (
              <div className='mt-3'>
                <Alert type='success' showIcon message={askResult.answer} style={{ whiteSpace: 'pre-wrap', alignItems: 'flex-start' }} />
                {askResult.references?.length > 0 && (
                  <div className='mt-2'>
                    <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                      <HistoryOutlined /> {t('content.memoryReferences')}
                    </Typography.Text>
                    <div className='mt-1 flex flex-col gap-1'>
                      {askResult.references.map((ref) => (
                        <Typography.Link key={ref.id} onClick={() => goDetail(ref.id)} ellipsis style={{ fontSize: 12 }}>
                          {ref.time || EMPTY_VALUE} 《{ref.event || EMPTY_VALUE}》{ref.summary ? ` — ${ref.summary}` : ''}
                        </Typography.Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!askResult && !asking && !askNotConfigured && !askError && (
              <Typography.Paragraph type='secondary' className='mt-3 mb-0'>
                {t('content.memoryAskEmpty')}
              </Typography.Paragraph>
            )}
          </Card>

          {/* 热门标签 */}
          <Card
            title={
              <Space>
                <TagsOutlined /> {t('content.memoryTagsTitle')}
              </Space>
            }
            size='small'
          >
            {tags.length ? (
              <Space size={[6, 8]} wrap>
                {tags.map((item) => (
                  <Tag key={item.tag} color='geekblue' style={{ cursor: 'pointer', marginRight: 0 }} onClick={() => onTagClick(item.tag)}>
                    {item.tag} · {item.count}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('content.memoryTagsEmpty')}
              </Typography.Text>
            )}
          </Card>

          {/* 月度摘要 */}
          <Card
            title={
              <Space>
                <HistoryOutlined /> {t('content.memorySummaryTitle')}
              </Space>
            }
            size='small'
            extra={
              <Space size={4}>
                {summary?.summary ? (
                  <Button type='link' size='small' icon={<ShareAltOutlined />} onClick={() => setShareOpen(true)}>
                    {t('content.shareBtn')}
                  </Button>
                ) : null}
                <Button type='link' size='small' icon={<ReloadOutlined />} loading={summaryLoading} onClick={handleSummary}>
                  {summary ? t('public.reload') : t('content.memorySummaryGenBtn')}
                </Button>
              </Space>
            }
          >
            {summaryNotConfigured && <Alert type='info' showIcon message={t('content.memorySummaryNotConfigured')} />}

            {summary && summary.summary ? (
              <div>
                <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{summary.summary}</Typography.Text>
                {summary.keywords?.length > 0 && (
                  <div className='mt-2'>
                    <Space size={[4, 4]} wrap>
                      {summary.keywords.map((k) => (
                        <Tag key={k} color='cyan' style={{ cursor: 'pointer', marginRight: 0 }} onClick={() => onTagClick(k)}>
                          {k}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
                <div className='mt-2'>
                  <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                    {summary.period}
                    {summary.generatedAt ? ` · ${t('content.memorySummaryGenerated')} ${summary.generatedAt}` : ''}
                    {summary.cached ? ` · ${t('content.memorySummaryCached')}` : ''}
                  </Typography.Text>
                </div>
              </div>
            ) : (
              !summaryNotConfigured && (
                <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                  {t('content.memorySummaryEmpty')}
                </Typography.Text>
              )
            )}
          </Card>
        </Space>

        {/* ==================== 右列：记忆搜索 ==================== */}
        <Card
          title={
            <Space>
              <SearchOutlined /> {t('content.memorySearchTitle')}
            </Space>
          }
        >
          <Search inputKeyword={keyword} searching={searching} onChangeKeyword={setKeyword} onSearch={handleSearch} />

          <Spin spinning={searching}>
            <div className='mt-4'>
              {searchList.length ? (
                <>
                  <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                    {t('content.memorySearchTitle')} · {searchTotal}
                  </Typography.Text>
                  <div className='mt-2'>{searchList.map(renderCard)}</div>
                  {searchList.length < searchTotal && searchList.length < 20 && (
                    <div className='text-center'>
                      <Button type='link' onClick={handleLoadMore}>
                        {t('content.memoryLoadMore')}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={searched ? t('content.memorySearchEmpty') : t('content.memorySearchHint')} />
              )}
            </div>
          </Spin>
        </Card>
      </div>

      {/* 月度回顾分享卡 */}
      <ShareCardModal open={shareOpen} onClose={() => setShareOpen(false)} type='summary' data={summaryCardData} getCopy={getSummaryCopy} />
    </BasicContent>
  )
}

/**
 * 摘要省略展示（超过两行折叠）
 * @param text - 摘要文本
 */
const ParagraphEllipsis = ({ text }: { text: string }) => (
  <Typography.Paragraph ellipsis={{ rows: 2 }} type='secondary' style={{ fontSize: 12, marginBottom: 4, marginTop: 2 }}>
    {text}
  </Typography.Paragraph>
)

/**
 * 搜索输入区
 */
const Search = (props: { inputKeyword: string; searching: boolean; onChangeKeyword: (v: string) => void; onSearch: (v?: string) => void }) => {
  const { inputKeyword, searching, onChangeKeyword, onSearch } = props
  const { t } = useTranslation()
  return (
    <Input.Search
      allowClear
      enterButton={
        <Button type='primary' icon={<SearchOutlined />} loading={searching}>
          {t('content.memorySearchTitle')}
        </Button>
      }
      size='large'
      value={inputKeyword}
      placeholder={t('content.memorySearchPlaceholder')}
      onChange={(e) => onChangeKeyword(e.target.value)}
      onSearch={(v) => onSearch(v)}
    />
  )
}

export default Page
