/**
 * 移动端超级记忆（/m/memory）
 * - 单列堆叠：记忆检索 → AI 问答 → 热门标签 → 月度摘要
 * - 与桌面双栏版共用同一批 /api/memory 接口，结果点击进 /m/detail 浏览
 */
import { ReloadOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Spin, Tag } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { MemoryAskResult, MemorySearchItem, MemorySummaryResult, TagCountItem } from '@/servers/content/memory'
import type { ReactNode } from 'react'

import { askMemory, getMemorySummary, getMemoryTags, isAiNotConfigured, searchMemory } from '@/servers/content/memory'
import { EMPTY_VALUE, resolveFileUrl } from '@/utils/config'

const MobileMemory = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 记忆检索
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchList, setSearchList] = useState<MemorySearchItem[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [limit, setLimit] = useState(8)

  // AI 问答
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askResult, setAskResult] = useState<MemoryAskResult | null>(null)
  const [askNotConfigured, setAskNotConfigured] = useState(false)
  const [askError, setAskError] = useState('')

  // 标签 + 月度摘要
  const [tags, setTags] = useState<TagCountItem[]>([])
  const [summary, setSummary] = useState<MemorySummaryResult | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryNotConfigured, setSummaryNotConfigured] = useState(false)

  /**
   * 记忆检索
   * @param value - 关键词
   * @param size - 返回条数
   */
  const handleSearch = useCallback(async (value: string, size = 8) => {
    const q = (value || '').trim()
    if (!q) {
      return
    }
    try {
      setSearching(true)
      setSearched(true)
      setKeyword(q)
      // AI 回忆页固定只看自己（scope 'mine'）
      const { code, data } = await searchMemory(q, size, 'mine')
      if (Number(code) === 200 && data) {
        setSearchList(data.list || [])
        setSearchTotal(data.total || 0)
        setLimit(size)
      } else {
        setSearchList([])
        setSearchTotal(0)
      }
    } catch (error) {
      console.error('记忆搜索失败:', error)
      setSearchList([])
    } finally {
      setSearching(false)
    }
  }, [])

  /** 加载更多（放大 top-k 重新检索） */
  const handleLoadMore = () => {
    handleSearch(keyword, Math.min(limit + 8, 20))
  }

  /** AI 问答 */
  const handleAsk = async () => {
    const q = question.trim()
    if (!q) {
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
  }

  /** 生成/获取月度摘要 */
  const handleSummary = async () => {
    try {
      setSummaryLoading(true)
      setSummaryNotConfigured(false)
      const { code, message: msg, data } = await getMemorySummary()
      if (Number(code) === 200 && data) {
        setSummary(data)
      } else if (isAiNotConfigured(msg)) {
        setSummaryNotConfigured(true)
      }
    } catch (error) {
      console.error('获取月度摘要失败:', error)
    } finally {
      setSummaryLoading(false)
    }
  }

  // 热门标签：不依赖 AI 密钥，进页面即拉
  useEffect(() => {
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
   * 点击标签/关键词：直接触发检索
   * @param value - 关键词
   */
  const onTagClick = (value: string) => {
    handleSearch(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className='max-w-768px mx-auto px-3 py-3'>
      {/* 记忆检索 */}
      <div className='relative mb-3'>
        <SearchOutlined className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-1' />
        <input
          className='
            w-full box-border
            pl-9 pr-4 py-2
            rounded-full border-none
            bg-white text-14px
            outline-none
          '
          placeholder={t('content.memorySearchPlaceholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch((e.target as HTMLInputElement).value)}
        />
      </div>

      <Block title={t('content.memorySearchTitle')}>
        <Spin spinning={searching}>
          {searchList.length ? (
            <>
              <div className='text-12px text-gray-400 mb-2'>
                {t('content.memorySearchTitle')} · {searchTotal}
              </div>
              {searchList.map((item) => (
                <SearchCard key={item.id} item={item} onClick={() => navigate(`/m/detail?id=${item.id}`)} />
              ))}
              {searchList.length < searchTotal && searchList.length < 20 && (
                <div className='text-center'>
                  <Button type='link' size='small' onClick={handleLoadMore}>
                    {t('content.memoryLoadMore')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            !searching && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={searched ? t('content.memorySearchEmpty') : t('content.memorySearchHint')} />
            )
          )}
        </Spin>
      </Block>

      {/* AI 问答 */}
      <Block title={t('content.memoryAskBtn')}>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 5 }}
          value={question}
          maxLength={500}
          placeholder={t('content.memoryAskPlaceholder')}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button className='mt-2' block type='primary' icon={<ThunderboltOutlined />} loading={asking} onClick={handleAsk}>
          {t('content.memoryAskBtn')}
        </Button>

        {asking && (
          <div className='mt-3 text-center'>
            <Spin tip={t('content.memoryAskLoading')} size='small' />
          </div>
        )}
        {askNotConfigured && <Alert className='mt-3' type='info' showIcon message={t('content.memoryAskNotConfigured')} />}
        {askError && <Alert className='mt-3' type='error' showIcon message={askError} />}
        {askResult && (
          <div className='mt-3'>
            <Alert type='success' showIcon message={askResult.answer} style={{ whiteSpace: 'pre-wrap', alignItems: 'flex-start' }} />
            {askResult.references?.length > 0 && (
              <div className='mt-2 flex flex-col gap-1'>
                <span className='text-12px text-gray-400'>{t('content.memoryReferences')}</span>
                {askResult.references.map((ref) => (
                  <span
                    key={ref.id}
                    role='button'
                    tabIndex={0}
                    className='text-12px text-blue-500'
                    onClick={() => navigate(`/m/detail?id=${ref.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/m/detail?id=${ref.id}`)}
                  >
                    {ref.time || EMPTY_VALUE} 《{ref.event || EMPTY_VALUE}》
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Block>

      {/* 热门标签 */}
      <Block title={t('content.memoryTagsTitle')}>
        {tags.length ? (
          <div className='flex gap-2 overflow-x-auto whitespace-nowrap'>
            {tags.map((item) => (
              <Tag key={item.tag} color='geekblue' className='shrink-0 !mr-0 cursor-pointer' onClick={() => onTagClick(item.tag)}>
                {item.tag} · {item.count}
              </Tag>
            ))}
          </div>
        ) : (
          <span className='text-12px text-gray-400'>{t('content.memoryTagsEmpty')}</span>
        )}
      </Block>

      {/* 月度摘要 */}
      <Block
        title={t('content.memorySummaryTitle')}
        extra={
          <Button type='link' size='small' icon={<ReloadOutlined />} loading={summaryLoading} onClick={handleSummary}>
            {summary ? t('public.reload') : t('content.memorySummaryGenBtn')}
          </Button>
        }
      >
        {summaryNotConfigured && <Alert type='info' showIcon message={t('content.memorySummaryNotConfigured')} />}
        {summary?.summary ? (
          <div>
            <div className='text-13px text-gray-700 whitespace-pre-wrap'>{summary.summary}</div>
            {summary.keywords?.length > 0 && (
              <div className='mt-2 flex flex-wrap gap-1'>
                {summary.keywords.map((k) => (
                  <Tag key={k} color='cyan' className='!mr-0 cursor-pointer' onClick={() => onTagClick(k)}>
                    {k}
                  </Tag>
                ))}
              </div>
            )}
            <div className='mt-2 text-12px text-gray-400'>
              {summary.period}
              {summary.generatedAt ? ` · ${t('content.memorySummaryGenerated')} ${summary.generatedAt}` : ''}
              {summary.cached ? ` · ${t('content.memorySummaryCached')}` : ''}
            </div>
          </div>
        ) : (
          !summaryNotConfigured && <span className='text-12px text-gray-400'>{t('content.memorySummaryEmpty')}</span>
        )}
      </Block>
    </div>
  )
}

/**
 * 白底区块容器（与移动端时间线卡片同风格）
 */
const Block = ({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) => (
  <div className='mb-3 p-3 rounded-10px bg-white shadow-0_1px_4px_rgba(0,0,0,0.06)'>
    <div className='flex items-center justify-between mb-2'>
      <span className='text-13px font-bold text-gray-700'>{title}</span>
      {extra}
    </div>
    {children}
  </div>
)

/**
 * 检索结果卡片
 */
const SearchCard = ({ item, onClick }: { item: MemorySearchItem; onClick: () => void }) => {
  const { t } = useTranslation()
  const thumb = resolveFileUrl(item.firstThumb)
  return (
    <div
      role='button'
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className='
        mb-2 p-2 rounded-8px bg-gray-50 active:bg-gray-100
        flex gap-2 cursor-pointer
      '
    >
      {thumb ? <img src={thumb} alt='' className='w-52px h-52px object-cover rounded-6px shrink-0' /> : null}
      <div className='flex-1 min-w-0'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-14px font-bold text-gray-800 truncate flex-1'>{item.event || EMPTY_VALUE}</span>
          <span className='text-11px text-gray-400 shrink-0'>{item.time || EMPTY_VALUE}</span>
        </div>
        {item.summary ? (
          <div className='mt-1 text-12px text-gray-500 multi-line-ellipsis-2'>{item.summary}</div>
        ) : (
          <div className='mt-1 text-12px text-gray-400'>{t('content.memoryAiNotProcessed')}</div>
        )}
        <div className='mt-1 flex items-center gap-1 overflow-hidden'>
          {item.tags.slice(0, 3).map((tag) => (
            <Tag key={tag} color='blue' className='!mr-0' style={{ fontSize: 11 }}>
              {tag}
            </Tag>
          ))}
          <span className='ml-auto text-11px text-gray-400 shrink-0'>
            {t('content.memoryRelevance')} {Math.round(item.score * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default MobileMemory
