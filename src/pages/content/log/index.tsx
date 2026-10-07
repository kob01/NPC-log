import { EyeOutlined, FileExcelOutlined, LinkOutlined, SoundOutlined } from '@ant-design/icons'
import { message, Tooltip, Button, Image, Tag, Segmented, Popover } from 'antd'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import { searchList, tableColumns } from './model'

import type { FormData } from '#/form'
import type { PagePermission, TableOptions } from '#/public'
import type { EventListItem } from '@/servers/content/event'
import type { AppDispatch, RootState } from '@/stores'
import type { ScopeValue } from '@/utils/onlyMine'

import { UpdateBtn, DeleteBtn } from '@/components/Buttons'
import BasicContent from '@/components/Content/BasicContent'
import NavLinks from '@/components/NavLinks'
import BasicPagination from '@/components/Pagination/BasicPagination'
import BasicSearch from '@/components/Search/BasicSearch'
import BasicTable from '@/components/Table/BasicTable'
import { useCommonStore } from '@/hooks/useCommonStore'
import { useMobileRedirect } from '@/hooks/useMobileRedirect'
import { getNPCEventPage, getAllNPCEvents, deleteNPCEvent, getNPCEventImages } from '@/servers/content/event'
import { setRefreshPage } from '@/stores/public'
import { setMenuClick } from '@/stores/tabs'
import { EMPTY_VALUE, INIT_PAGINATION, resolveFileUrl } from '@/utils/config'
import { exportToExcel } from '@/utils/excel'
import { getFilterScope, setFilterScope } from '@/utils/onlyMine'
import { checkPermission } from '@/utils/permissions'

// 当前行数据
interface RowData {
  id: string
  is_mine?: boolean
}

// 日志列表查看范围三态：全部 / 只看自己 / 只看组织内他人
const SCOPE_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '只看自己', value: 'mine' },
  { label: '只看他人', value: 'others' },
]

// 日志列表查看范围的提示文案（仅作用于列表/导出，不再是全局开关）
const SCOPE_TIP =
  '仅作用于日志列表与导出：可切换「全部 / 只看自己 / 只看组织内他人」。' +
  'AI 回忆、年度回顾、人物图谱、地图足迹等分析页始终只统计本人数据，不受此筛选影响'

/**
 * 录音时长展示：1 分钟内只报秒，超过则分:秒
 * @param seconds - 后端回传的 audioDuration（秒，可能为 null）
 */
const formatAudioDuration = (seconds?: number | null): string => {
  const s = Number(seconds || 0)
  if (!Number.isFinite(s) || s <= 0) {
    return ''
  }
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const Page = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch: AppDispatch = useDispatch()
  const { permissions } = useCommonStore()
  const [isFetch, setFetch] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [searchData, setSearchData] = useState<FormData>({})
  const [page, setPage] = useState(INIT_PAGINATION.page)
  const [pageSize, setPageSize] = useState(INIT_PAGINATION.pageSize)
  const [total, setTotal] = useState(0)
  const [tableData, setTableData] = useState<FormData[]>([])
  // 多图日志的完整图片集（按日志 id 存）：列表接口只回首图+数量，这里异步回填全部缩略图供行内浏览
  const [imagesMap, setImagesMap] = useState<Record<string, { thumb: string; full: string }[]>>({})
  // 日志列表查看范围：真值存本地缓存（供列表/导出与 H5 列表读取），这里只做展示与切换
  const [filterScope, setFilterScopeState] = useState<ScopeValue>(getFilterScope())
  const isRefreshPage = useSelector((state: RootState) => state.public.isRefreshPage)
  const isMenuClick = useSelector((state: RootState) => state.tabs.isMenuClick)
  const hasFetched = useRef(false) // 标记是否已经请求过数据

  // 权限前缀
  const permissionPrefix = '/content/log'

  // 权限
  const pagePermission: PagePermission = {
    page: checkPermission(`${permissionPrefix}/index`, permissions),
    create: checkPermission(`${permissionPrefix}/create`, permissions),
    update: checkPermission(`${permissionPrefix}/update`, permissions),
    delete: checkPermission(`${permissionPrefix}/delete`, permissions),
  }

  // 管理员（可操作他人日志）
  const isAdmin = checkPermission('/authority/user/index', permissions)

  // 手机访问桌面列表：重定向到移动浏览页，并跳过硬渲染表格/拉取列表
  const toMobile = useMobileRedirect()

  // 页面首次加载或从菜单点击进入时请求数据
  useEffect(() => {
    // 已判定走移动版，等重定向生效，不再发起本页的数据请求
    if (toMobile) {
      return
    }
    // 首次进入页面（未请求过数据）
    if (!hasFetched.current) {
      setFetch(true)
      hasFetched.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isFetch) {
      getPage()
    }
  }, [isFetch])

  // 监听是否刷新页面
  useEffect(() => {
    if (isRefreshPage) {
      getPage()
      dispatch(setRefreshPage(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshPage])

  // 监听是否从菜单点击进入，如果是则刷新数据
  useEffect(() => {
    if (isMenuClick) {
      setFetch(true)
      // 重置标记
      dispatch(setMenuClick(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuClick])

  /**
   * 获取分页数据
   */
  const getPage = async () => {
    try {
      setLoading(true)
      const { code, data } = await getNPCEventPage(
        {
          ...searchData,
          page,
          pageSize,
        },
        filterScope,
      )

      if (Number(code) === 200) {
        const { items, total } = data
        setTotal(total)
        setTableData(items)
        hydrateImages(items)
      }
    } finally {
      setFetch(false)
      setLoading(false)
    }
  }

  /**
   * 回填多图日志的完整图片集（复用详情接口并发拉取，内部已限并发 6）
   * @param rows - 当前页行数据
   */
  const hydrateImages = async (rows: EventListItem[]) => {
    const need = rows.filter((r) => Number(r.imageCount || 0) > 1).map((r) => r.id)
    if (!need.length) {
      return
    }
    try {
      const map = await getNPCEventImages(need)
      setImagesMap((prev) => {
        const next = { ...prev }
        Object.entries(map).forEach(([id, imgs]) => {
          next[id] = (imgs || [])
            .map((img) => ({
              thumb: resolveFileUrl(img.thumbUrl || img.url),
              full: resolveFileUrl(img.url),
            }))
            .filter((item) => item.thumb)
        })
        return next
      })
    } catch (error) {
      console.error('回填日志图片失败（已忽略）:', error)
    }
  }

  /**
   * 切换日志列表查看范围（仅影响本页列表/导出，分析页不受影响）
   * @param scope - 'all' | 'mine' | 'others'
   */
  const onScopeChange = (scope: ScopeValue) => {
    setFilterScope(scope)
    setFilterScopeState(scope)
    // 筛选是后端查询条件，切换后回到第一页重新拉取
    setPage(INIT_PAGINATION.page)
    setPageSize(INIT_PAGINATION.pageSize)
    setFetch(true)
  }

  /**
   * 点击新增
   */
  const onCreate = () => {
    navigate('/content/log/option')
  }

  /**
   * 点击编辑
   * @param id - 唯一值
   */
  const onUpdate = (id: string) => {
    navigate(`/content/log/option?id=${id}`)
  }

  /**
   * 点击搜索
   * @param values - 表单返回数据
   */
  const onSearch = (values: FormData) => {
    setSearchData(values)
    setFetch(true)
  }

  /**
   * 点击删除
   * @param id - 唯一值
   */
  const onDelete = async (id: string) => {
    try {
      setLoading(true)
      const { code, message: msg } = await deleteNPCEvent(id as string)

      if (Number(code) === 200) {
        message.success(msg || t('public.successfullyDeleted'))
        getPage()
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * 处理分页
   * @param page - 当前页数
   * @param pageSize - 每页条数
   */
  const onChangePagination = (page: number, pageSize: number) => {
    setPage(page)
    setPageSize(pageSize)
    setFetch(true)
  }

  /**
   * 导出Excel
   */
  const handleExportExcel = async () => {
    if (tableData.length === 0) {
      message.warning('暂无数据可导出')
      return
    }

    try {
      setLoading(true)
      // 获取所有数据（不分页）
      const { code, data } = await getAllNPCEvents(searchData, filterScope)
      if (Number(code) !== 200) {
        message.error('获取数据失败')
        return
      }

      // 定义导出列
      const exportColumns = [
        { key: 'time', title: '时间' },
        { key: 'event', title: '事件' },
        { key: 'type', title: '分类' },
        { key: 'content', title: '内容' },
        { key: 'rating', title: '评价' },
        { key: 'experience', title: '经验教训' },
        { key: 'position', title: '地点' },
        { key: 'witness', title: '见证者' },
        { key: 'author', title: '作者' },
        { key: 'visibility', title: '可见范围' },
        { key: 'updatedAt', title: '更新于' },
      ]

      // 格式化数据
      const exportData = data.map((item: FormData) => {
        const formatted: Record<string, string> = {}
        exportColumns.forEach((col) => {
          if (col.key === 'visibility') {
            const orgNames = (item.visibleOrgNames as string) || ''
            formatted[col.title] = Number(item[col.key]) === 1 ? (orgNames ? `组织可见·${orgNames}` : '组织可见') : '仅自己可见'
          } else {
            formatted[col.title] = (item[col.key] as string) ?? ''
          }
        })
        return formatted
      })

      // 导出
      const success = exportToExcel(exportData, `事件记录_${new Date().toLocaleDateString()}`, '事件记录')
      if (success) {
        message.success('导出成功', 3)
      } else {
        message.error('导出失败', 3)
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * 渲染操作
   * @param _ - 当前值
   * @param record - 当前行参数
   */
  const optionRender: TableOptions<object> = (_, record) => {
    const row = record as RowData
    // 仅作者本人或管理员可编辑/删除
    const canOperate = row.is_mine || isAdmin
    return (
      <>
        {pagePermission.update === true && canOperate && <UpdateBtn className='mr-5px' isLoading={isLoading} onClick={() => onUpdate(row.id)} />}
        {pagePermission.delete === true && canOperate && <DeleteBtn className='mr-5px' isLoading={isLoading} handleDelete={() => onDelete(row.id)} />}
      </>
    )
  }

  const TooltipRender = (text: string) => (
    <Tooltip title={text}>
      <span className='multi-line-ellipsis'>{text}</span>
    </Tooltip>
  )

  // 列表行内最多平铺的缩略图数，超出折叠为 +N（点开仍可翻页看全部）
  const MAX_THUMB = 3

  /**
   * 图片列渲染：多图平铺缩略图条（点击组内预览可翻全部），单图/未回填时首图 + 数量角标
   * @param record - 当前行数据
   */
  const imageRender = (record: object) => {
    const row = record as EventListItem
    const count = Number(row.imageCount || 0)
    if (count <= 0) {
      return <span>{EMPTY_VALUE}</span>
    }
    const thumbs = imagesMap[row.id]
    if (thumbs && thumbs.length > 1) {
      const shown = thumbs.slice(0, MAX_THUMB)
      const rest = thumbs.slice(MAX_THUMB)
      return (
        <div style={{ position: 'relative', display: 'inline-flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Image.PreviewGroup>
            {shown.map((img, idx) => (
              <Image
                key={idx}
                src={img.thumb}
                width={44}
                height={44}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                // 缩略图太窄，默认遮罩里的“预览”二字会被截成省略号，只留眼睛图标
                preview={{ src: img.full, mask: <EyeOutlined /> }}
              />
            ))}
            {/* 隐藏图同样注册进预览组，打开大图后可翻页浏览全部 */}
            {rest.map((img, idx) => (
              <div key={`rest-${idx}`} style={{ width: 0, height: 0, overflow: 'hidden' }}>
                <Image src={img.full} />
              </div>
            ))}
          </Image.PreviewGroup>
          {rest.length > 0 && (
            <span
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                padding: '0 4px',
                fontSize: 10,
                lineHeight: '14px',
                color: '#fff',
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '4px 0 4px 0',
                pointerEvents: 'none',
              }}
            >
              +{rest.length}
            </span>
          )}
        </div>
      )
    }
    // 单图或详情图片未回填：行内仍用首图缩略图，但点开必须是原图（与编辑页一致）。
    // 列表接口的 firstUrl 只是一个字符串、不传图字节，因此不增加列表流量
    const thumb = resolveFileUrl(row.firstThumb)
    if (!thumb) {
      return <span>{EMPTY_VALUE}</span>
    }
    const full = imagesMap[row.id]?.[0]?.full || resolveFileUrl(row.firstUrl)
    return (
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <Image
          src={thumb}
          width={48}
          height={48}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          preview={{ src: full || undefined, mask: <EyeOutlined /> }}
        />
        {count > 1 && (
          <span
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              padding: '0 4px',
              fontSize: 10,
              lineHeight: '14px',
              color: '#fff',
              background: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '4px 0 4px 0',
            }}
          >
            {count}
          </span>
        )}
      </div>
    )
  }

  /**
   * 作品列渲染：平台标签 + 数量，点击打开首条链接
   * @param record - 当前行数据
   */
  const linkRender = (record: object) => {
    const row = record as EventListItem
    const count = Number(row.linkCount || 0)
    const first = row.firstLink
    if (count <= 0 || !first?.url) {
      return <span>{EMPTY_VALUE}</span>
    }
    const colorMap: Record<string, string> = {
      douyin: '#161823',
      xiaohongshu: '#ff2442',
      other: '#8c8c8c',
    }
    const color = colorMap[first.platform] || '#8c8c8c'
    return (
      <a href={first.url} target='_blank' rel='noopener noreferrer' onClick={(e) => e.stopPropagation()}>
        <Tag color={color} style={{ marginRight: 0 }}>
          <LinkOutlined /> {count}
        </Tag>
      </a>
    )
  }

  /**
   * AI 标签列渲染：最多展示 3 个，剩余折叠为 +N（悬停看全部）
   * @param record - 当前行数据
   */
  const tagRender = (record: object) => {
    const row = record as EventListItem
    const tags = row.tags || []
    if (!tags.length) {
      return <span>{EMPTY_VALUE}</span>
    }
    const shown = tags.slice(0, 3)
    const rest = tags.slice(3)
    return (
      <Tooltip title={tags.join('、')}>
        <span onClick={(e) => e.stopPropagation()}>
          {shown.map((tag) => (
            <Tag key={tag} color='blue' style={{ marginRight: 4 }}>
              {tag}
            </Tag>
          ))}
          {rest.length > 0 && <Tag style={{ marginRight: 0 }}>+{rest.length}</Tag>}
        </span>
      </Tooltip>
    )
  }

  /**
   * 地点列渲染：有坐标时显示导航链接，无坐标时显示纯文本
   * @param record - 当前行数据
   */
  const positionRender = (record: object) => {
    const row = record as EventListItem
    return <NavLinks lng={row.lng} lat={row.lat} position={row.position as string} address={row.address} compact />
  }

  /**
   * 录音列渲染：小程序语音日志随条留存的录音，行内只放一个轻入口，
   * 点开才在浮层里挂原生 audio 控件（不预加载，避免一页行同时拉音频）
   * 注：录音是用户自己念的口语，没有字幕可提，故关掉 media-has-caption
   * @param record - 当前行数据
   */
  const audioRender = (record: object) => {
    const row = record as EventListItem
    const src = resolveFileUrl(row.audioUrl)
    if (!src) {
      return <span>{EMPTY_VALUE}</span>
    }
    const duration = formatAudioDuration(row.audioDuration)
    return (
      <Popover
        trigger='click'
        placement='left'
        title='录音回放'
        destroyTooltipOnHide
        content={
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={src} controls autoPlay preload='none' style={{ width: 280, height: 36, display: 'block' }} />
        }
      >
        <Button size='small' icon={<SoundOutlined />} onClick={(e) => e.stopPropagation()}>
          {duration || '播放'}
        </Button>
      </Popover>
    )
  }

  return (
    <BasicContent isPermission={pagePermission.page}>
      <BasicSearch
        list={searchList(t)}
        data={searchData}
        isLoading={isLoading}
        isCreate={pagePermission.create}
        onCreate={onCreate}
        handleFinish={onSearch}
      >
        <Tooltip title={SCOPE_TIP}>
          <Segmented
            size='small'
            className='ml-2 !mb-5px'
            value={filterScope}
            options={SCOPE_OPTIONS}
            onChange={(val) => onScopeChange(val as ScopeValue)}
          />
        </Tooltip>
        <Button type='primary' icon={<FileExcelOutlined />} loading={isLoading} onClick={handleExportExcel} className='ml-2'>
          导出Excel
        </Button>
      </BasicSearch>

      <BasicTable
        loading={isLoading}
        columns={tableColumns(t, optionRender, TooltipRender, imageRender, linkRender, positionRender, tagRender, audioRender)}
        dataSource={tableData}
      />

      <BasicPagination disabled={isLoading} current={page} pageSize={pageSize} total={total} onChange={onChangePagination} />
    </BasicContent>
  )
}

export default Page
