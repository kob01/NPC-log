import { FileExcelOutlined, LinkOutlined } from '@ant-design/icons'
import { message, Tooltip, Button, Image, Tag, Switch, Space } from 'antd'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import { searchList, tableColumns } from './model'

import type { FormData } from '#/form'
import type { PagePermission, TableOptions } from '#/public'
import type { EventListItem } from '@/servers/content/event'
import type { AppDispatch, RootState } from '@/stores'

import { UpdateBtn, DeleteBtn } from '@/components/Buttons'
import BasicContent from '@/components/Content/BasicContent'
import NavLinks from '@/components/NavLinks'
import BasicPagination from '@/components/Pagination/BasicPagination'
import BasicSearch from '@/components/Search/BasicSearch'
import BasicTable from '@/components/Table/BasicTable'
import { useCommonStore } from '@/hooks/useCommonStore'
import { getNPCEventPage, getAllNPCEvents, deleteNPCEvent } from '@/servers/content/event'
import { setRefreshPage } from '@/stores/public'
import { setMenuClick } from '@/stores/tabs'
import { EMPTY_VALUE, INIT_PAGINATION, resolveFileUrl } from '@/utils/config'
import { exportToExcel } from '@/utils/excel'
import { getOnlyMine, setOnlyMine } from '@/utils/onlyMine'
import { checkPermission } from '@/utils/permissions'

// 当前行数据
interface RowData {
  id: string
  is_mine?: boolean
}

// “只看自己日志”开关的提示文案
const ONLY_MINE_TIP =
  '开启后全局只看自己的日志：列表/导出、AI 记忆检索与问答、月度/年度摘要、' +
  '热门标签、人物图谱、地图足迹都只统计本人数据，避开他人日志干扰分析'

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
  // “只看自己日志”全局开关：状态真值存在本地缓存（请求拦截器要读），这里只做展示与切换
  const [onlyMine, setOnlyMineState] = useState(getOnlyMine())
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

  // 页面首次加载或从菜单点击进入时请求数据
  useEffect(() => {
    // 窄视口（手机）访问桌面列表时自动重定向到移动浏览页
    if (window.innerWidth <= 768) {
      navigate('/m', { replace: true })
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
      const { code, data } = await getNPCEventPage({
        ...searchData,
        page,
        pageSize,
      })

      if (Number(code) === 200) {
        const { items, total } = data
        setTotal(total)
        setTableData(items)
      }
    } finally {
      setFetch(false)
      setLoading(false)
    }
  }

  /**
   * 切换“只看自己日志”
   * @param checked - 是否只看自己的日志
   */
  const onToggleOnlyMine = (checked: boolean) => {
    setOnlyMine(checked)
    setOnlyMineState(checked)
    // 开关是后端查询条件，切换后回到第一页重新拉取
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
      const { code, data } = await getAllNPCEvents(searchData)
      if (Number(code) !== 200) {
        message.error('获取数据失败')
        return
      }

      // 定义导出列
      const exportColumns = [
        { key: 'time', title: '时间' },
        { key: 'event', title: '事件' },
        { key: 'type', title: '分类' },
        { key: 'content', title: '进度/记录' },
        { key: 'rating', title: '评价' },
        { key: 'feeling', title: '感受' },
        { key: 'experience', title: '经验教训' },
        { key: 'position', title: '地点' },
        { key: 'witness', title: '见证者' },
        { key: 'author', title: '作者' },
        { key: 'visibility', title: '可见范围' },
      ]

      // 格式化数据
      const exportData = data.map((item: FormData) => {
        const formatted: Record<string, string> = {}
        exportColumns.forEach((col) => {
          if (col.key === 'visibility') {
            const orgNames = (item.visibleOrgNames as string) || ''
            formatted[col.title] =
              Number(item[col.key]) === 1
                ? orgNames
                  ? `组织可见·${orgNames}`
                  : '组织可见'
                : '仅自己可见'
          } else {
            formatted[col.title] = (item[col.key] as string) ?? ''
          }
        })
        return formatted
      })

      // 导出
      const success = exportToExcel(
        exportData,
        `事件记录_${new Date().toLocaleDateString()}`,
        '事件记录'
      )
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
        {pagePermission.update === true && canOperate && (
          <UpdateBtn className='mr-5px' isLoading={isLoading} onClick={() => onUpdate(row.id)} />
        )}
        {pagePermission.delete === true && canOperate && (
          <DeleteBtn
            className='mr-5px'
            isLoading={isLoading}
            handleDelete={() => onDelete(row.id)}
          />
        )}
      </>
    )
  }

  const TooltipRender = (text: string) => (
    <Tooltip title={text}>
      <span className='multi-line-ellipsis'>{text}</span>
    </Tooltip>
  )

  /**
   * 图片列渲染：首图缩略图 + 数量角标
   * @param record - 当前行数据
   */
  const imageRender = (record: object) => {
    const row = record as EventListItem
    const count = Number(row.imageCount || 0)
    const thumb = resolveFileUrl(row.firstThumb)
    if (!thumb || count <= 0) {
      return <span>{EMPTY_VALUE}</span>
    }
    return (
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <Image src={thumb} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 4 }} />
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
      <a
        href={first.url}
        target='_blank'
        rel='noopener noreferrer'
        onClick={(e) => e.stopPropagation()}
      >
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
    return (
      <NavLinks
        lng={row.lng}
        lat={row.lat}
        position={row.position as string}
        address={row.address}
        compact
      />
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
        <Space className='ml-2 !mb-5px' size={6}>
          <Tooltip title={ONLY_MINE_TIP}>
            <Switch size='small' checked={onlyMine} onChange={onToggleOnlyMine} />
          </Tooltip>
          <span>只看自己</span>
        </Space>
        <Button
          type='primary'
          icon={<FileExcelOutlined />}
          loading={isLoading}
          onClick={handleExportExcel}
          className='ml-2'
        >
          导出Excel
        </Button>
      </BasicSearch>

      <BasicTable
        loading={isLoading}
        columns={tableColumns(
          t,
          optionRender,
          TooltipRender,
          imageRender,
          linkRender,
          positionRender,
          tagRender
        )}
        dataSource={tableData}
      />

      <BasicPagination
        disabled={isLoading}
        current={page}
        pageSize={pageSize}
        total={total}
        onChange={onChangePagination}
      />
    </BasicContent>
  )
}

export default Page
