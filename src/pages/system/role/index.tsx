import { SafetyOutlined } from '@ant-design/icons'
import { type FormInstance, Button, message, Tooltip } from 'antd'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

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
import { getRolePage, getRoleById, createRole, updateRole, deleteRole, getRoleMenus, saveRoleMenus } from '@/servers/system/role'
import { getMenuList } from '@/servers/system/menu'
import { ADD_TITLE, EDIT_TITLE, INIT_PAGINATION } from '@/utils/config'
import { checkPermission } from '@/utils/permissions'

import PermissionDrawer from './components/PermissionDrawer'
import { createList, searchList, tableColumns } from './model'

import type { FormData } from '#/form'
import type { PagePermission } from '#/public'
import type { Key } from 'antd/es/table/interface'
import type { DataNode } from 'antd/es/tree'

// 当前行数据
interface RowData {
  id: string
}

// 初始化新增数据
const initCreate = {
  status: 1,
  sort_order: 0,
}

const Page = () => {
  const { t } = useTranslation()
  const createFormRef = useRef<FormInstance>(null)

  const [isFetch, setFetch] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [isCreateLoading, setCreateLoading] = useState(false)
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState(ADD_TITLE(t))
  const [createId, setCreateId] = useState('')
  const [createData, setCreateData] = useState<FormData>(initCreate)
  const [searchData, setSearchData] = useState<FormData>({})
  const [page, setPage] = useState(INIT_PAGINATION.page)
  const [pageSize, setPageSize] = useState(INIT_PAGINATION.pageSize)
  const [total, setTotal] = useState(0)
  const [tableData, setTableData] = useState<FormData[]>([])
  const [tableFilters, setTableFilters] = useState<string[]>([])

  const [promiseId, setPromiseId] = useState('')
  const [isPromiseVisible, setPromiseVisible] = useState(false)
  const [promiseCheckedKeys, setPromiseCheckedKeys] = useState<Key[]>([])
  const [promiseTreeData, setPromiseTreeData] = useState<DataNode[]>([])
  const [handleFilterTable] = useFiler()

  const { permissions } = useCommonStore()

  // 权限前缀
  const permissionPrefix = '/authority/role'

  // 权限
  const pagePermission: PagePermission = {
    page: checkPermission(`${permissionPrefix}/index`, permissions),
    create: checkPermission(`${permissionPrefix}/create`, permissions),
    update: checkPermission(`${permissionPrefix}/update`, permissions),
    delete: checkPermission(`${permissionPrefix}/delete`, permissions),
    permission: checkPermission(`${permissionPrefix}/authority`, permissions),
  }

  // 获取表格数据
  const getPage = useCallback(async () => {
    const params = { ...searchData, page, pageSize }

    try {
      setLoading(true)
      const { code, data } = await getRolePage(params)
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
  }, [searchData, page, pageSize])

  useEffect(() => {
    if (isFetch) {
      getPage()
    }
  }, [isFetch, getPage])

  // 首次进入自动加载接口数据
  useEffect(() => {
    if (pagePermission.page) {
      getPage()
    }
  }, [pagePermission.page, getPage])

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

  /** 开启权限设置 */
  const openPermission = async (id: string) => {
    try {
      setLoading(true)
      // 获取菜单树
      const { code: menuCode, data: menuData } = await getMenuList()
      if (Number(menuCode) !== 200) {
        message.error('获取菜单列表失败')
        return
      }

      // 获取角色已有权限
      const { code: roleCode, data: roleMenus } = await getRoleMenus(id)
      if (Number(roleCode) !== 200) {
        message.error('获取角色权限失败')
        return
      }

      // 转换菜单数据为树形结构
      const treeData = convertMenuToTree(menuData)
      
      setPromiseId(id)
      setPromiseTreeData(treeData)
      setPromiseCheckedKeys(roleMenus || [])
      setPromiseVisible(true)
    } finally {
      setLoading(false)
    }
  }

  /** 将菜单数据转换为树形结构 */
  const convertMenuToTree = (menus: any[]): DataNode[] => {
    return menus.map(menu => ({
      title: menu.label,
      key: menu.id?.toString() || menu.key,
      children: menu.children ? convertMenuToTree(menu.children) : undefined
    }))
  }

  /** 关闭权限设置 */
  const closePermission = () => {
    setPromiseVisible(false)
  }

  /**
   * 权限提交
   */
  const permissionSubmit = async (checked: Key[]) => {
    try {
      setLoading(true)
      const params = {
        roleId: promiseId,
        menuIds: checked.map(key => key.toString()),
      }
      const { code, message: msg } = await saveRoleMenus(params)
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('system.authorizationSuccessful'))
      setPromiseVisible(false)
    } finally {
      setLoading(false)
    }
  }

  /** 点击新增 */
  const onCreate = () => {
    setCreateOpen(true)
    setCreateTitle(ADD_TITLE(t))
    setCreateId('')
    setCreateData(initCreate)
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
      const { code, data } = await getRoleById(id as string)
      if (Number(code) !== 200) {
        return
      }
      setCreateData(data)
    } finally {
      setCreateLoading(false)
    }
  }

  /** 表格提交 */
  const createSubmit = () => {
    createFormRef.current?.submit()
  }

  /** 关闭新增/修改弹窗 */
  const closeCreate = () => {
    setCreateOpen(false)
  }

  /**
   * 新增/编辑提交
   * @param values - 表单返回数据
   */
  const handleCreate = async (values: FormData) => {
    try {
      setCreateLoading(true)
      const functions = () => (createId ? updateRole(createId, values) : createRole(values))
      const { code, message } = await functions()
      if (Number(code) !== 200) {
        return
      }
      message.success(message || t('public.successfulOperation'))
      setCreateOpen(false)
      getPage()
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
      const { code, message } = await deleteRole(id as string)
      if (Number(code) === 200) {
        message.success(message || t('public.successfullyDeleted'))
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
  const onChangePagination = (newPage: number, newPageSize: number) => {
    setPage(newPage)
    setPageSize(newPageSize)
    setFetch(true)
  }

  /**
   * 渲染操作
   * @param _ - 当前值
   * @param record - 当前行参数
   */
  function optionRender(_: unknown, record: object) {
    return (
      <>
        {pagePermission.permission === true && (
          <Tooltip title={t('system.permissions')}>
            <Button
              className='mr-5px'
              type='primary'
              icon={<SafetyOutlined />}
              loading={isLoading}
              onClick={() => openPermission((record as RowData).id)}
            />
          </Tooltip>
        )}
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

  // 表格列
  const columns = tableColumns(t, optionRender)

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
        title={createTitle}
        open={isCreateOpen}
        confirmLoading={isCreateLoading}
        onOk={createSubmit}
        onCancel={closeCreate}
        width={600}
      >
        <BasicForm
          ref={createFormRef}
          list={createList(t, !!createId)}
          data={createData}
          labelCol={{ span: 6 }}
          handleFinish={handleCreate}
        />
      </BasicModal>

      <PermissionDrawer
        isVisible={isPromiseVisible}
        treeData={promiseTreeData}
        checkedKeys={promiseCheckedKeys}
        onClose={closePermission}
        onSubmit={permissionSubmit}
      />
    </BasicContent>
  )
}

export default Page
