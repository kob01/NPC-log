import { type FormInstance } from 'antd'
import { message } from 'antd'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { createList, searchList, tableColumns } from './model'

import type { FormData } from '#/form'
import type { PagePermission } from '#/public'

import { UpdateBtn, DeleteBtn } from '@/components/Buttons'
import BasicContent from '@/components/Content/BasicContent'
import BasicForm from '@/components/Form/BasicForm'
import BasicModal from '@/components/Modal/BasicModal'
import BasicPagination from '@/components/Pagination/BasicPagination'
import BasicSearch from '@/components/Search/BasicSearch'
import BasicTable from '@/components/Table/BasicTable'
import { useCommonStore } from '@/hooks/useCommonStore'
import {
  createOrg,
  deleteOrg,
  getOrgById,
  getOrgPage,
  updateOrg,
} from '@/servers/system/organization'
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

  const { permissions } = useCommonStore()

  // 权限前缀（组织管理）
  const permissionPrefix = '/org/manager'

  const pagePermission: PagePermission = {
    page: checkPermission(`${permissionPrefix}/index`, permissions),
    create: checkPermission(`${permissionPrefix}/create`, permissions),
    update: checkPermission(`${permissionPrefix}/update`, permissions),
    delete: checkPermission(`${permissionPrefix}/delete`, permissions),
  }

  const getPage = useCallback(async () => {
    const params = { ...searchData, page, pageSize }
    try {
      setLoading(true)
      const { code, data } = await getOrgPage(params)
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

  useEffect(() => {
    if (pagePermission.page) {
      getPage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePermission.page])

  /** 点击搜索 */
  const onSearch = (values: FormData) => {
    setPage(1)
    setSearchData(values)
    setFetch(true)
  }

  /** 点击新增 */
  const onCreate = () => {
    setCreateOpen(true)
    setCreateTitle(ADD_TITLE(t))
    setCreateId('')
    // 传入新对象：同一引用不会触发 BasicForm 的 resetFields，第二次「新增」会沿用上个组织的名称/描述
    setCreateData({ ...initCreate })
  }

  /** 点击编辑 */
  const onUpdate = async (id: string) => {
    try {
      setCreateOpen(true)
      setCreateTitle(EDIT_TITLE(t, id))
      setCreateId(id)
      setCreateLoading(true)
      const { code, data } = await getOrgById(id)
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
    createFormRef.current?.submit()
  }

  /** 关闭弹窗 */
  const closeCreate = () => {
    setCreateOpen(false)
  }

  /** 新增/编辑提交 */
  const handleCreate = async (values: FormData) => {
    try {
      setCreateLoading(true)
      const functions = () => (createId ? updateOrg(createId, values) : createOrg(values))
      const { code, message: msg } = await functions()
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('public.successfulOperation'))
      setCreateOpen(false)
      getPage()
    } finally {
      setCreateLoading(false)
    }
  }

  /** 点击删除 */
  const onDelete = async (id: string) => {
    try {
      setLoading(true)
      const { code, message: msg } = await deleteOrg(id)
      if (Number(code) === 200) {
        message.success(msg || t('public.successfullyDeleted'))
        getPage()
      }
    } finally {
      setLoading(false)
    }
  }

  /** 处理分页 */
  const onChangePagination = (newPage: number, newPageSize: number) => {
    setPage(newPage)
    setPageSize(newPageSize)
    setFetch(true)
  }

  /** 渲染操作 */
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
      />

      <BasicTable loading={isLoading} columns={columns} dataSource={tableData} />

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
          list={createList(t)}
          data={createData}
          labelCol={{ span: 6 }}
          handleFinish={handleCreate}
        />
      </BasicModal>
    </BasicContent>
  )
}

export default Page
