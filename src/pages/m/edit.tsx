/**
 * 移动端日志编辑（/m/edit[?id=]）
 * - 字段定义复用桌面 pages/content/log/model.ts 的 createList，校验规则单一来源
 * - 数据装配与提交复用 hooks/useEventForm
 * - 表单用 vertical 布局单列全宽；吸底保存栏替代底部导航（导航在本页隐藏）
 */
import { Card, Space, Tag, Typography } from 'antd'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import type { FormData } from '#/form'
import type { FormInstance } from 'antd'

import BasicForm from '@/components/Form/BasicForm'
import { useEventForm } from '@/hooks/useEventForm'
import { createList } from '@/pages/content/log/model'

const MobileEdit = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { search } = useLocation()
  const id = new URLSearchParams(search).get('id')
  const formRef = useRef<FormInstance>(null)

  const { isLoading, data, aiInfo, orgOptions, submit } = useEventForm(id)

  /**
   * 提交表单
   * @param values - 表单值
   */
  const handleFinish = async (values: FormData) => {
    const isSuccess = await submit(values)
    if (!isSuccess) {
      return
    }
    formRef.current?.resetFields()
    // 编辑回到详情浏览（详情自行重新拉取，拿得到最新内容），新增回到时间线
    navigate(id ? `/m/detail?id=${id}` : '/m', { replace: true })
  }

  /** 返回上一页（无历史时回时间线） */
  const handleCancel = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/m', { replace: true })
  }

  return (
    <div className='max-w-768px mx-auto px-3 py-3 pb-72px'>
      <div className='text-15px font-bold text-gray-800 mb-2'>{id ? t('content.mobileEditUpdate') : t('content.mobileEditNew')}</div>

      {/* AI 解析结果：只读展示，不参与提交 */}
      {id && aiInfo && (
        <Card size='small' className='mb-3'>
          <div className='text-12px font-bold text-gray-400 mb-1'>{t('content.memoryAiSummary')}</div>
          {aiInfo.summary && <Typography.Paragraph style={{ marginBottom: 8, fontSize: 13 }}>{aiInfo.summary}</Typography.Paragraph>}
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

      <div className='rounded-10px bg-white p-3 shadow-0_1px_4px_rgba(0,0,0,0.06)'>
        <BasicForm ref={formRef} layout='vertical' list={createList(t, orgOptions)} data={data} handleFinish={handleFinish} />
      </div>

      {/* 吸底操作栏：本页已隐藏底部导航，故贴着安全区底部放置 */}
      <div
        className='
          fixed bottom-0 left-0 right-0 z-10
          flex gap-3 px-4 py-3
          bg-white border-t border-gray-200
        '
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <button
          type='button'
          className='
            flex-1 py-2 rounded-8px text-14px
            bg-gray-100 text-gray-700 border-none cursor-pointer
          '
          onClick={handleCancel}
        >
          {t('public.cancel')}
        </button>
        <button
          type='button'
          disabled={isLoading}
          className='
            flex-1 py-2 rounded-8px text-14px
            bg-blue-500 text-white border-none cursor-pointer
            disabled:opacity-60
          '
          onClick={() => formRef.current?.submit()}
        >
          {t('public.submit')}
        </button>
      </div>
    </div>
  )
}

export default MobileEdit
