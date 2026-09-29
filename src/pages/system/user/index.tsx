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
import FilterButton from '@/components/TableFilter'
import { useFiler } from '@/components/TableFilter/hooks/useFiler'
import { useCommonStore } from '@/hooks/useCommonStore'
import { getAllOrgs, getUserOrgs, setUserOrgs } from '@/servers/system/organization'
import { createUser, deleteUser, getUserById, getUserPage, updateUser } from '@/servers/system/user'
import { ADD_TITLE, EDIT_TITLE, INIT_PAGINATION } from '@/utils/config'
import { encryptMd5 } from '@/utils/crypto'
import { checkPermission } from '@/utils/permissions'

// 当前行数据
interface RowData {
  id: string
}

// 初始化新增数据
const initCreate = {
  status: 1,
  account_type: 0,
  org_ids: [],
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
  const [orgOptions, setOrgOptions] = useState<{ label: string; value: number }[]>([])

  const [handleFilterTable] = useFiler()

  const { permissions } = useCommonStore()

  // 权限前缀
  const permissionPrefix = '/authority/user'

  // 权限
  const pagePermission: PagePermission = {
    page: checkPermission(`${permissionPrefix}/index`, permissions),
    create: checkPermission(`${permissionPrefix}/create`, permissions),
    update: checkPermission(`${permissionPrefix}/update`, permissions),
    delete: checkPermission(`${permissionPrefix}/delete`, permissions),
  }

  // 获取表格数据
  const getPage = useCallback(async () => {
    const params = { ...searchData, page, pageSize }

    try {
      setLoading(true)
      const { code, data } = await getUserPage(params)
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

  // 加载组织选项
  const loadOrgOptions = useCallback(async () => {
    try {
      const { code, data } = await getAllOrgs()
      if (Number(code) === 200) {
        setOrgOptions(
          (data || []).map((org: FormData) => ({
            label: org.org_name as string,
            value: org.id as number,
          }))
        )
      }
    } catch (error) {
      console.error('加载组织选项失败:', error)
    }
  }, [])

  // 首次进入自动加载接口数据
  useEffect(() => {
    if (pagePermission.page) {
      getPage()
      loadOrgOptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePermission.page])

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

  /** 点击新增 */
  const onCreate = () => {
    setCreateOpen(true)
    setCreateTitle(ADD_TITLE(t))
    setCreateId('')
    // 传入新对象：同一引用不会触发 BasicForm 的 resetFields，第二次「新增」会沿用上个用户的姓名/手机/邮箱
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
      const { code, data } = await getUserById(id as string)
      if (Number(code) !== 200) {
        return
      }
      // 编辑时不回填密码
      const { password, ...restData } = data
      // 加载该用户所属组织
      const { code: orgCode, data: orgIds } = await getUserOrgs(id)
      const finalData: FormData = { ...restData }
      if (Number(orgCode) === 200) {
        finalData.org_ids = orgIds || []
      }
      setCreateData(finalData)
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
      const payload: FormData = { ...values }
      // 密码与登录链路保持一致：提交前做 MD5；编辑留空表示不修改
      if (payload.password) {
        payload.password = encryptMd5(payload.password as string)
      } else {
        delete payload.password
      }

      const orgIds = ((payload.org_ids as number[]) || []).map((x) => Number(x))
      delete payload.org_ids

      if (createId) {
        const { code, message: msg } = await updateUser(createId, payload)
        if (Number(code) !== 200) {
          return
        }
        await setUserOrgs(createId, orgIds)
        message.success(msg || t('public.successfulOperation'))
      } else {
        const { code, data } = await createUser(payload)
        if (Number(code) !== 200) {
          return
        }
        const newId = (data as { id?: number })?.id
        if (newId) {
          await setUserOrgs(String(newId), orgIds)
        }
        message.success(t('public.successfulOperation'))
      }
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
      const { code, message: msg } = await deleteUser(id as string)
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
   * @param newPage - 当前页数
   * @param newPageSize - 每页条数
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
          list={createList(t, !!createId, orgOptions)}
          data={createData}
          labelCol={{ span: 6 }}
          handleFinish={handleCreate}
        />
      </BasicModal>
    </BasicContent>
  )
}

export default Page
