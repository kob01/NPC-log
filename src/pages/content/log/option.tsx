/**
 * 日志新增/编辑页（桌面端）
 * 数据装配与提交规则统一在 hooks/useEventForm，移动端 /m/edit 复用同一套逻辑
 */
import { BulbOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons'
import { Card, Space, Spin, Tag, Typography } from 'antd'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'

import { createList } from './model'

import type { FormData } from '#/form'
import type { PagePermission } from '#/public'
import type { AppDispatch } from '@/stores'
import type { FormInstance } from 'antd'

import SubmitBottom from '@/components/Bottom/SubmitBottom'
import BasicContent from '@/components/Content/BasicContent'
import BasicForm from '@/components/Form/BasicForm'
import { useCommonStore } from '@/hooks/useCommonStore'
import { useEventForm } from '@/hooks/useEventForm'
import { useMobileRedirect } from '@/hooks/useMobileRedirect'
import { useSingleTab } from '@/hooks/useSingleTab'
import { setRefreshPage } from '@/stores/public'
import { closeTabGoNext } from '@/stores/tabs'
import { getUrlParam } from '@/utils/helper'
import { checkPermission } from '@/utils/permissions'

// 父路径
const fatherPath = '/content/log'

const Page = () => {
  const { t } = useTranslation()
  const { pathname, search } = useLocation()
  const uri = pathname + search
  const id = getUrlParam(search, 'id')
  const createFormRef = useRef<FormInstance>(null)
  const dispatch: AppDispatch = useDispatch()
  const { permissions } = useCommonStore()
  useSingleTab(fatherPath)

  // 移动版已支持编辑：手机访问时带着同一个 id 跳到 /m/edit
  const toMobile = useMobileRedirect(`/m/edit${search}`)

  const { isLoading, data, aiInfo, orgOptions, submit } = useEventForm(id)

  // 权限前缀
  const permissionPrefix = '/content/log'

  // 权限
  const pagePermission: PagePermission = {
    create: checkPermission(`${permissionPrefix}/create`, permissions),
    update: checkPermission(`${permissionPrefix}/update`, permissions),
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
    const isSuccess = await submit(values)
    if (!isSuccess) {
      return
    }
    createFormRef.current?.resetFields()
    goBack(true)
  }

  // 已判定走移动版，等重定向生效，不再渲染桌面表单
  if (toMobile) {
    return null
  }

  return (
    <BasicContent isPermission={id ? pagePermission.update : pagePermission.create}>
      <div className='mb-50px'>
        {id && aiInfo && (
          <Card
            size='small'
            className='mb-4'
            title={
              <Space>
                <BulbOutlined /> {t('content.memoryAiSummary')}
                {aiInfo.aiStatus === 0 && (
                  <Tag icon={<SyncOutlined />} color='processing'>
                    {t('content.memoryAiNotProcessed')}
                  </Tag>
                )}
                {aiInfo.aiStatus === 2 && (
                  <Tag icon={<CloseCircleOutlined />} color='error'>
                    {t('content.memoryAiFailed')}
                  </Tag>
                )}
              </Space>
            }
          >
            {aiInfo.summary && <Typography.Paragraph style={{ marginBottom: 8 }}>{aiInfo.summary}</Typography.Paragraph>}
            <Space size={[4, 6]} wrap>
              {(aiInfo.tags || []).map((tag) => (
                <Tag key={tag} color='blue' style={{ marginRight: 0 }}>
                  {tag}
                </Tag>
              ))}
              {(aiInfo.persons || []).map((p) => (
                <Tag key={p} color='purple' style={{ marginRight: 0 }}>
                  {p}
                </Tag>
              ))}
            </Space>
            {!aiInfo.summary && !aiInfo.tags?.length && !aiInfo.persons?.length && (
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('content.memoryAiNotProcessed')}
              </Typography.Text>
            )}
          </Card>
        )}
        <Spin spinning={isLoading}>
          <BasicForm ref={createFormRef} list={createList(t, orgOptions)} data={data} labelCol={{ span: 5 }} handleFinish={handleFinish} />
        </Spin>
      </div>

      <SubmitBottom isLoading={isLoading} goBack={goBack} handleSubmit={handleSubmit} />
    </BasicContent>
  )
}

export default Page
