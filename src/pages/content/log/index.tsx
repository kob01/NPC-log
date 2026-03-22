import { FileExcelOutlined } from '@ant-design/icons'
import { message, Tooltip, Button } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import { UpdateBtn, DeleteBtn } from '@/components/Buttons'
import BasicContent from '@/components/Content/BasicContent'
import BasicPagination from '@/components/Pagination/BasicPagination'
import BasicSearch from '@/components/Search/BasicSearch'
import BasicTable from '@/components/Table/BasicTable'
import { useCommonStore } from '@/hooks/useCommonStore'
import { getNPCEventPage, getAllNPCEvents, deleteNPCEvent } from '@/servers/content/event'
import { setRefreshPage } from '@/stores/public'
import { INIT_PAGINATION } from '@/utils/config'
import { exportToExcel } from '@/utils/excel'
import { checkPermission } from '@/utils/permissions'

import { searchList, tableColumns } from './model'

import type { FormData } from '#/form'
import type { PagePermission, TableOptions } from '#/public'
import type { AppDispatch, RootState } from '@/stores'

// 当前行数据
interface RowData {
  id: string
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
  const isRefreshPage = useSelector((state: RootState) => state.public.isRefreshPage)

  // 权限前缀
  const permissionPrefix = '/content/log'

  // 权限
  const pagePermission: PagePermission = {
    page: checkPermission(`${permissionPrefix}/index`, permissions),
    create: checkPermission(`${permissionPrefix}/create`, permissions),
    update: checkPermission(`${permissionPrefix}/update`, permissions),
    delete: checkPermission(`${permissionPrefix}/delete`, permissions),
  }

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
      ]

      // 格式化数据
      const exportData = data.map((item: FormData) => {
        const formatted: Record<string, string> = {}
        exportColumns.forEach((col) => {
          formatted[col.title] = (item[col.key] as string) ?? ''
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
  const optionRender: TableOptions<object> = (_, record) => (
    <>
      {pagePermission.update === true && (
        <UpdateBtn
          className='mr-5px'
          isLoading={isLoading}
          onClick={() => onUpdate((record as RowData).id)}
        />
      )}
      {pagePermission.delete === true && (
        <DeleteBtn
          className='mr-5px'
          isLoading={isLoading}
          handleDelete={() => onDelete((record as RowData).id)}
        />
      )}
    </>
  )

  const TooltipRender = (text: string) => (
    <Tooltip title={text}>
      <span className='multi-line-ellipsis'>{text}</span>
    </Tooltip>
  )

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
        columns={tableColumns(t, optionRender, TooltipRender)}
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
