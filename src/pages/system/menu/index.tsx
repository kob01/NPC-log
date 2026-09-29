import { type FormInstance, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

import { searchList, createList, tableColumns } from './model'

import type { FormData } from '#/form'
import type { PagePermission } from '#/public'

import { UpdateBtn, DeleteBtn } from '@/components/Buttons'
import BasicContent from '@/components/Content/BasicContent'
import BasicForm from '@/components/Form/BasicForm'
import BasicModal from '@/components/Modal/BasicModal'
import BasicPagination from '@/components/Pagination/BasicPagination'
import BasicSearch from '@/components/Search/BasicSearch'
import BasicTable from '@/components/Table/BasicTable'
import FilterButton from '@/components/TableFilter'
import { useFiler } from '@/components/TableFilter/hooks/useFiler'
import { useCommonStore } from '@/hooks/useCommonStore'
import {
  getMenuPage,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
  getAllMenus,
  getMenuList,
} from '@/servers/system/menu'
import { setMenuList } from '@/stores/menu'
import { ADD_TITLE, EDIT_TITLE, INIT_PAGINATION } from '@/utils/config'
import { checkPermission } from '@/utils/permissions'

// 当前行数据
interface RowData {
  id: string
}

// 初始化新增数据
const initCreate = {
  status: 1,
}

const Page = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const createFormRef = useRef<FormInstance>(null)
  const columns = tableColumns(t, optionRender)
  const [isFetch, setFetch] = useState(false)
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [isCreateLoading, setCreateLoading] = useState(false)
  const [createTitle, setCreateTitle] = useState(ADD_TITLE(t))
  const [createId, setCreateId] = useState('')
  const [createData, setCreateData] = useState<FormData>(initCreate)
  const [searchData, setSearchData] = useState<FormData>({})
  const [page, setPage] = useState(INIT_PAGINATION.page)
  const [pageSize, setPageSize] = useState(INIT_PAGINATION.pageSize)
  const [total, setTotal] = useState(0)
  const [tableData, setTableData] = useState<FormData[]>([])
  const [tableFilters, setTableFilters] = useState<string[]>([])
  const [parentOptions, setParentOptions] = useState<{ label: string; value: number }[]>([])

  const [handleFilterTable] = useFiler()
  const { permissions } = useCommonStore()

  // 权限前缀
  const permissionPrefix = '/authority/menu'

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

  /**
   * 获取勾选表格数据
   * @param checks - 勾选
   */
  const getTableChecks = (checks: string[]) => {
    setTableFilters(checks)
  }

  /**
   * 点击搜索
   * @param values - 表单返回数据
   */
  const onSearch = (values: FormData) => {
    setPage(1)
    setSearchData(values)
    setFetch(true)
  }

  // 首次进入自动加载接口数据
  useEffect(() => {
    if (pagePermission.page) {
      getPage()
      loadParentOptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePermission.page])

  /** 加载父级菜单选项 */
  const loadParentOptions = async () => {
    try {
      const { code, data } = await getAllMenus()
      if (Number(code) === 200) {
        setParentOptions(
          (data || []).map((m: FormData) => ({
            label: m.label as string,
            value: m.id as number,
          }))
        )
      }
    } catch (error) {
      console.error('加载菜单选项失败:', error)
    }
  }

  /**
   * 菜单增删改后同步刷新两侧数据：
   * 左侧导航数据源存于 store（仅 layout 挂载时拉一次），父级下拉也只在首次进入拉取，
   * 不主动刷新就会出现“新建菜单要重登才看得到”、“新建的菜单当不了父级”。
   */
  const refreshMenuCache = useCallback(async () => {
    try {
      const { code, data } = await getMenuList()
      if (Number(code) === 200) {
        dispatch(setMenuList(data || []))
      }
    } catch (error) {
      console.error('刷新导航菜单失败:', error)
    }
    loadParentOptions()
  }, [dispatch])

  /** 点击新增 */
  const onCreate = () => {
    setCreateOpen(true)
    setCreateTitle(ADD_TITLE(t))
    setCreateId('')
    // 必须传入新对象：initCreate 是模块级常量，重复使用同一引用时 BasicForm 的
    // useEffect 不会触发 resetFields，导致第二次「新增」沿用上次的路由地址/排序
    setCreateData({ ...initCreate })
  }

  /**
   * 点击编辑
   * @param id - 唯一值
   */
  const onUpdate = async (id: string) => {
    try {
      setCreateOpen(true)
      setCreateTitle(EDIT_TITLE(t, id))
      setCreateId(id)
      setCreateLoading(true)
      const { code, data } = await getMenuById(id as string)
      if (Number(code) !== 200) {
        return
      }
      setCreateData(data)
    } finally {
      setCreateLoading(false)
    }
  }

  /** 表单提交 */
  const createSubmit = () => {
    createFormRef?.current?.submit()
  }

  /** 关闭新增/修改弹窗 */
  const closeCreate = () => {
    setCreateOpen(false)
  }

  /** 获取表格数据 */
  const getPage = async () => {
    const params = { ...searchData, page, pageSize }

    try {
      setLoading(true)
      const res = await getMenuPage(params)
      const { code, data } = res
      if (Number(code) !== 200) {
        return
      }
      const { items, total } = data
      setTotal(total)
      setTableData(items)
    } finally {
      setFetch(false)
      setLoading(false)
    }
  }

  /**
   * 新增/编辑提交
   * @param values - 表单返回数据
   */
  const handleCreate = async (values: FormData) => {
    try {
      setCreateLoading(true)
      const functions = () => (createId ? updateMenu(createId, values) : createMenu(values))
      const { code, message: msg } = await functions()
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('public.successfulOperation'))
      setCreateOpen(false)
      getPage()
      refreshMenuCache()
    } finally {
      setCreateLoading(false)
    }
  }

  /**
   * 点击删除
   * @param id - 唯一值
   */
  const onDelete = async (id: string) => {
    try {
      setLoading(true)
      const { code, message: msg } = await deleteMenu(id as string)
      if (Number(code) === 200) {
        message.success(msg || t('public.successfullyDeleted'))
        getPage()
        refreshMenuCache()
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
  const onChangePagination = useCallback((page: number, pageSize: number) => {
    setPage(page)
    setPageSize(pageSize)
    setFetch(true)
  }, [])

  /**
   * 渲染操作
   * @param _ - 当前值
   * @param record - 当前行参数
   */
  function optionRender(_: unknown, record: object) {
    return (
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
        <FilterButton columns={columns} className='!mb-5px' getTableChecks={getTableChecks} />
      </BasicSearch>

      <BasicTable
        loading={isLoading}
        columns={handleFilterTable(columns, tableFilters)}
        dataSource={tableData}
      />

      <BasicPagination
        disabled={isLoading}
        current={page}
        pageSize={pageSize}
        total={total}
        onChange={onChangePagination}
      />

      <BasicModal
        width={600}
        title={createTitle}
        open={isCreateOpen}
        confirmLoading={isCreateLoading}
        onOk={createSubmit}
        onCancel={closeCreate}
      >
        <BasicForm
          ref={createFormRef}
          list={createList(t, createId, parentOptions)}
          data={createData}
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 19 }}
          handleFinish={handleCreate}
        />
      </BasicModal>
    </BasicContent>
  )
}

export default Page
