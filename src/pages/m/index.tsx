/**
 * 移动端时间线（/m）
 * - 卡片流按日期分组，游标（beforeId）下拉无限加载
 * - 简易搜索走 /api/memory/search（LIKE + FULLTEXT + 语义混合检索）
 * - 缩略图横条：批量懒拉取详情图片（getNPCEventImages），点击进详情
 */
import { DownOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons'
import { Empty, Spin, Tag } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { EventListItem } from '@/servers/content/event'
import type { MemorySearchItem } from '@/servers/content/memory'

import NavLinks from '@/components/NavLinks'
import { getNPCEventImages, getNPCEventPage } from '@/servers/content/event'
import { searchMemory } from '@/servers/content/memory'
import { resolveFileUrl } from '@/utils/config'

// 每页条数（移动端流量敏感，取小值）
const PAGE_SIZE = 10

// 时间线统一展示模型（列表模式 + 搜索模式共用）
interface TimelineEntry {
  id: string | number
  time: string | null
  event: string
  type: string
  summary: string
  content: string
  tags: string[]
  persons: string[]
  position: string
  address: string | null
  lng: number | null
  lat: number | null
  thumbs: string[]
}

/** 列表项 → 时间线条目 */
const fromListItem = (item: EventListItem): TimelineEntry => ({
  id: item.id,
  time: (item.time as string) || null,
  event: (item.event as string) || '',
  type: (item.type as string) || '',
  summary: item.summary || '',
  content: (item.content as string) || '',
  tags: item.tags || [],
  persons: (item.persons as string[]) || [],
  position: (item.position as string) || '',
  address: item.address ?? null,
  lng: item.lng ?? null,
  lat: item.lat ?? null,
  thumbs: item.firstThumb ? [resolveFileUrl(item.firstThumb)] : [],
})

/** 搜索结果 → 时间线条目 */
const fromMemoryItem = (item: MemorySearchItem): TimelineEntry => ({
  id: item.id,
  time: item.time,
  event: item.event,
  type: item.type,
  summary: item.summary,
  content: '',
  tags: item.tags,
  persons: item.persons,
  position: item.position,
  address: item.address,
  lng: item.lng,
  lat: item.lat,
  thumbs: item.firstThumb ? [resolveFileUrl(item.firstThumb)] : [],
})

/** 取 YYYY-MM-DD 作为日期分组键 */
const dayKey = (time: string | null) => (time ? String(time).slice(0, 10) : 'unknown')

const MobileHome = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const cursorRef = useRef<number | null>(null) // 游标：当前已加载最小 event_id
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef<number | null>(null)
  const listVersion = useRef(0) // 用于缩略图异步回填时丢弃过期结果

  /**
   * 回填一批条目的缩略图（仅缺图条目，并发受控）
   * @param batch - 本次新加载的条目
   */
  const hydrateThumbs = useCallback(async (batch: TimelineEntry[]) => {
    const need = batch.filter((e) => !e.thumbs.length).map((e) => e.id)
    if (!need.length) {
      return
    }
    const version = listVersion.current
    try {
      const map = await getNPCEventImages(need)
      if (version !== listVersion.current) {
        return
      } // 列表已重置，丢弃
      setEntries((prev) =>
        prev.map((e) => {
          if (e.thumbs.length) {
            return e
          }
          const images = map[String(e.id)]
          if (!images?.length) {
            return e
          }
          return {
            ...e,
            thumbs: images.slice(0, 9).map((img) => resolveFileUrl(img.thumbUrl || img.url)),
          }
        }),
      )
    } catch (error) {
      console.error('回填缩略图失败（已忽略）:', error)
    }
  }, [])

  /** 加载下一页（游标模式） */
  const loadMore = useCallback(async () => {
    if (searchMode) {
      return
    }
    try {
      setLoading(true)
      const params: Record<string, unknown> = { page: 1, pageSize: PAGE_SIZE }
      if (cursorRef.current != null) {
        // 游标分页固定取第 1 页，靠 beforeId 向前推进
        params.beforeId = cursorRef.current
      }
      const { code, data } = await getNPCEventPage(params)
      if (Number(code) === 200 && data) {
        const items = (data.items || []).map(fromListItem)
        const total = Number(data.total || 0)
        setEntries((prev) => {
          const ids = new Set(prev.map((e) => String(e.id)))
          return [...prev, ...items.filter((e) => !ids.has(String(e.id)))]
        })
        if (items.length) {
          const minId = Math.min(...items.map((e) => Number(e.id)))
          if (Number.isFinite(minId)) {
            cursorRef.current = minId
          }
        }
        setHasMore(items.length >= PAGE_SIZE || (items.length > 0 && total === 0))
        hydrateThumbs(items)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('加载时间线失败:', error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [searchMode, hydrateThumbs])

  /** 重置并重新加载（下拉刷新 / 退出搜索） */
  const reset = useCallback(async () => {
    listVersion.current += 1
    cursorRef.current = null
    setEntries([])
    setHasMore(true)
    await loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 首屏加载
  useEffect(() => {
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 滚动到底部自动加载下一页
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || searchMode) {
      return
    }
    const observer = new IntersectionObserver(
      (entriesVisible) => {
        if (entriesVisible[0]?.isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore, hasMore, loading, searchMode])

  /**
   * 搜索（记忆混合检索）
   * @param value - 关键词
   */
  const onSearch = async (value: string) => {
    const q = value.trim()
    if (!q) {
      // 清空关键词 → 回到时间线模式
      listVersion.current += 1
      setSearchMode(false)
      setEntries([])
      cursorRef.current = null
      loadMore()
      return
    }
    listVersion.current += 1
    setSearchMode(true)
    setLoading(true)
    try {
      const { code, data } = await searchMemory(q, 20)
      setEntries(Number(code) === 200 && data ? (data.list || []).map(fromMemoryItem) : [])
    } catch (error) {
      console.error('记忆搜索失败:', error)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  /** 原生下拉刷新（页面在顶部时向下拖拽） */
  const onTouchStart = (e: React.TouchEvent) => {
    pullStartY.current = window.scrollY <= 0 ? (e.touches[0]?.clientY ?? null) : null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const startY = pullStartY.current
    pullStartY.current = null
    const endY = e.changedTouches[0]?.clientY ?? 0
    if (startY != null && endY - startY > 80 && !loading && !searchMode) {
      reset()
    }
  }

  // 按日期分组（保持时间线顺序）
  const groups: { day: string; items: TimelineEntry[] }[] = []
  entries.forEach((entry) => {
    const day = dayKey(entry.time)
    const last = groups[groups.length - 1]
    if (last && last.day === day) {
      last.items.push(entry)
    } else {
      groups.push({ day, items: [entry] })
    }
  })

  return (
    <div className='max-w-768px mx-auto px-3 py-3' onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* 搜索框 */}
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
          placeholder={t('content.mobileSearchPlaceholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch((e.target as HTMLInputElement).value)}
          onBlur={(e) => e.target.value.trim() && onSearch(e.target.value)}
        />
      </div>

      {groups.length === 0 && !loading && (
        <Empty
          className='mt-80px'
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchMode ? t('content.memorySearchEmpty') : t('content.mobileEmpty')}
        />
      )}

      {groups.map((group) => (
        <div key={`${group.day}-${group.items[0]?.id}`}>
          {/* 日期分组头（吸顶） */}
          <div className='sticky top-52px z-2 py-2 text-center'>
            <span className='px-3 py-4px rounded-full bg-gray-200 text-gray-600 text-12px'>
              {group.day === 'unknown' ? t('public.date') : group.day}
            </span>
          </div>

          {group.items.map((entry) => (
            <Card key={entry.id} entry={entry} onClick={() => navigate(`/m/detail?id=${entry.id}`)} />
          ))}
        </div>
      ))}

      {/* 触底哨兵 + 加载态 */}
      <div ref={sentinelRef} className='py-3 text-center'>
        {loading && <Spin tip={t('content.mobileLoading')} size='small' />}
        {!loading && !hasMore && entries.length > 0 && (
          <span className='text-gray-400 text-12px'>
            <DownOutlined /> {t('content.mobileNoMore')}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * 时间线卡片
 */
const Card = ({ entry, onClick }: { entry: TimelineEntry; onClick: () => void }) => (
  <div
    role='button'
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => e.key === 'Enter' && onClick()}
    className='
      mb-3 p-3 rounded-10px bg-white
      shadow-0_1px_4px_rgba(0,0,0,0.06)
      active:bg-gray-50
    '
  >
    <div className='flex items-center gap-2 mb-1'>
      {entry.type && (
        <Tag color='blue' style={{ marginRight: 0 }}>
          {entry.type}
        </Tag>
      )}
      <span className='text-gray-400 text-12px'>{entry.time || ''}</span>
    </div>

    <div className='font-bold text-15px text-gray-800 truncate'>{entry.event}</div>

    {(entry.summary || entry.content) && <div className='mt-1 text-13px text-gray-500 multi-line-ellipsis-2'>{entry.summary || entry.content}</div>}

    {/* 缩略图横条 */}
    {entry.thumbs.length > 0 && (
      <div className='mt-2 flex gap-2 overflow-x-auto'>
        {entry.thumbs.map((src, idx) => (
          <img key={`${src}-${idx}`} src={src} alt='' loading='lazy' className='w-56px h-56px object-cover rounded-6px shrink-0 bg-gray-100' />
        ))}
      </div>
    )}

    {/* 标签 + 人物 */}
    {(entry.tags.length > 0 || entry.persons.length > 0) && (
      <div className='mt-2 flex flex-wrap gap-1'>
        {entry.tags.slice(0, 4).map((tag) => (
          <Tag key={tag} color='geekblue' style={{ marginRight: 0, fontSize: 11 }}>
            {tag}
          </Tag>
        ))}
        {entry.persons.slice(0, 3).map((p) => (
          <Tag key={p} color='purple' style={{ marginRight: 0, fontSize: 11 }}>
            {p}
          </Tag>
        ))}
      </div>
    )}

    {/* 地点 */}
    {(entry.lng != null || entry.position || entry.address) && (
      <div className='mt-2 flex items-center text-12px text-gray-500'>
        <EnvironmentOutlined className='mr-1 text-gray-400' />
        <NavLinks lng={entry.lng} lat={entry.lat} position={entry.position} address={entry.address} compact />
      </div>
    )}
  </div>
)

export default MobileHome
