import { type FormInstance, message, Spin } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'

import { createList } from './model'

import type { FormData } from '#/form'
import type { PagePermission } from '#/public'
import type { AppDispatch } from '@/stores'

import SubmitBottom from '@/components/Bottom/SubmitBottom'
import BasicContent from '@/components/Content/BasicContent'
import BasicForm from '@/components/Form/BasicForm'
import { useCommonStore } from '@/hooks/useCommonStore'
import { useSingleTab } from '@/hooks/useSingleTab'
import { getNPCEventById, createNPCEvent, updateNPCEvent } from '@/servers/content/event'
import { getMyOrgs } from '@/servers/system/organization'
import { setRefreshPage } from '@/stores/public'
import { closeTabGoNext } from '@/stores/tabs'
import { getUrlParam } from '@/utils/helper'
import { checkPermission } from '@/utils/permissions'

// 初始化新增数据
const initCreate = {
  time: dayjs().format('YYYY-MM-DD HH:mm'),
  event: '',
  type: '',
  content: '',
  rating: '',
  feeling: '',
  experience: '',
  position: '',
  witness: '',
  visibility: 0,
  visibleOrgIds: [],
}

// 父路径
const fatherPath = '/content/log'

const Page = () => {
  const { t } = useTranslation()
  const { pathname, search } = useLocation()
  const uri = pathname + search
  const id = getUrlParam(search, 'id')
  const createFormRef = useRef<FormInstance>(null)
  const dispatch: AppDispatch = useDispatch()
  const [isLoading, setLoading] = useState(false)
  const [createId, setCreateId] = useState('')
  const [createData, setCreateData] = useState<FormData>(initCreate)
  const [orgOptions, setOrgOptions] = useState<{ label: string; value: number }[]>([])
  const { permissions } = useCommonStore()
  useSingleTab(fatherPath)

  // 加载“我加入的组织”（仅已通过）作为可见组织选项
  useEffect(() => {
    const loadOrgs = async () => {
      const { code, data } = await getMyOrgs()
      if (Number(code) === 200) {
        setOrgOptions(
          (data || [])
            .filter((o: FormData) => Number(o.my_status) === 1)
            .map((o: FormData) => ({ label: o.org_name as string, value: o.id as number }))
        )
      }
    }
    loadOrgs()
  }, [])

  // 权限前缀
  const permissionPrefix = '/content/log'

  // 权限
  const pagePermission: PagePermission = {
    create: checkPermission(`${permissionPrefix}/create`, permissions),
    update: checkPermission(`${permissionPrefix}/update`, permissions),
  }

  useEffect(() => {
    id ? handleUpdate(id) : handleCreate()
    const values = localStorage.getItem('values')
    if (values && Object.keys(values).length > 0) {
      setCreateData(JSON.parse(values) as FormData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 处理新增 */
  const handleCreate = () => {
    setCreateId('')
    setCreateData(initCreate)
  }

  /**
   * 处理编辑
   * @param id - 唯一值
   */
  const handleUpdate = async (id: string) => {
    try {
      setCreateId(id)
      setLoading(true)
      const { code, data } = await getNPCEventById(id as string)
      if (Number(code) !== 200) {
        return
      }
      setCreateData(data)
    } finally {
      setLoading(false)
    }
  }

  /** 表格提交 */
  const handleSubmit = () => {
    createFormRef.current?.submit()
  }

  /**
   * 返回主页
   * @param isRefresh - 返回页面是否重新加载接口
   */
  const goBack = (isRefresh?: boolean) => {
    // debugger
    createFormRef.current?.resetFields()
    if (isRefresh) {
      dispatch(setRefreshPage(true))
    }
    const st = closeTabGoNext({
      key: uri,
      nextPath: fatherPath,
    })
    dispatch(st)
  }

  /**
   * 新增/编辑提交
   * @param values - 表单返回数据
   */
  const handleFinish = async (values: FormData) => {
    try {
      setLoading(true)
      const functions = () =>
        createId ? updateNPCEvent({ ...values, id: createId }) : createNPCEvent(values)
      const { code, message: msg } = await functions()
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('public.successfulOperation'), 3)
      createFormRef.current?.resetFields()
      goBack(true)
      // navigate(-1);
      localStorage.setItem('values', 'null')
    } catch {
      localStorage.setItem('values', JSON.stringify(values))
    } finally {
      setLoading(false)
    }
  }

  return (
    <BasicContent isPermission={id ? pagePermission.update : pagePermission.create}>
      <div className='mb-50px'>
        <Spin spinning={isLoading}>
          <BasicForm
            ref={createFormRef}
            list={createList(t, orgOptions)}
            data={createData}
            labelCol={{ span: 5 }}
            handleFinish={handleFinish}
          />
        </Spin>
      </div>

      <SubmitBottom isLoading={isLoading} goBack={goBack} handleSubmit={handleSubmit} />
    </BasicContent>
  )
}

export default Page
