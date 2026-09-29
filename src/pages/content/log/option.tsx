import { BulbOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons'
import { Card, Space, Spin, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'

import { createList } from './model'

import type { FormData } from '#/form'
import type { PagePermission } from '#/public'
import type { ImageUploadValue } from '@/components/ImageUpload'
import type { LinkListValue } from '@/components/LinkList'
import type { LocationValue } from '@/components/LocationPicker'
import type { EventPayload } from '@/servers/content/event'
import type { AppDispatch } from '@/stores'
import type { FormInstance } from 'antd'

import SubmitBottom from '@/components/Bottom/SubmitBottom'
import BasicContent from '@/components/Content/BasicContent'
import BasicForm from '@/components/Form/BasicForm'
import { isValidLinkUrl } from '@/components/LinkList'
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
  location: { position: null, address: null, lng: null, lat: null },
  witness: '',
  visibility: 0,
  visibleOrgIds: [],
  images: [],
  links: [],
}

// 父路径
const fatherPath = '/content/log'

const Page = () => {
  const { t } = useTranslation()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const uri = pathname + search
  const id = getUrlParam(search, 'id')
  const createFormRef = useRef<FormInstance>(null)
  const dispatch: AppDispatch = useDispatch()
  const [isLoading, setLoading] = useState(false)
  const [createId, setCreateId] = useState('')
  const [createData, setCreateData] = useState<FormData>(initCreate)
  // 编辑时的 AI 解析结果（只读展示，不参与表单提交）
  const [aiInfo, setAiInfo] = useState<{
    summary?: string
    tags?: string[]
    persons?: string[]
    aiStatus?: number
  } | null>(null)
  const [orgOptions, setOrgOptions] = useState<{ label: string; value: number }[]>([])
  // 是否已从照片 EXIF 自动识别到位置
  const [gpsTip, setGpsTip] = useState(false)
  // EXIF GPS 坐标（GCJ-02），传给 LocationPicker 的 initialCoordinate
  const [exifCoord, setExifCoord] = useState<{ lng: number; lat: number } | null>(null)
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
    // 窄视口下编辑页不可用（移动端纯浏览），重定向回时间线
    if (window.innerWidth <= 768) {
      navigate('/m', { replace: true })
      return
    }
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
    setAiInfo(null)
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
      // 将后端返回的 position/lng/lat/address 组装为 location 复合对象
      const formData: FormData = { ...data }
      formData.location = {
        position: data.position || null,
        address: data.address || null,
        lng: data.lng != null ? Number(data.lng) : null,
        lat: data.lat != null ? Number(data.lat) : null,
      } as LocationValue
      // 移除旧的分散字段，避免干扰
      delete formData.position
      delete formData.lng
      delete formData.lat
      delete formData.address
      setCreateData(formData)
      // 抽出 AI 字段做只读展示（不回填表单，避免提交时误覆盖）
      setAiInfo({
        summary: (data.summary as string) || '',
        tags: (data.tags as string[]) || [],
        persons: (data.persons as string[]) || [],
        aiStatus: Number(data.aiStatus ?? 0),
      })
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
   * 照片 EXIF 识别到 GPS 时传给 LocationPicker
   * @param gps - GCJ-02 坐标
   */
  const handleGpsExtracted = (gps: { lng: number; lat: number }) => {
    setExifCoord(gps)
    setGpsTip(true)
  }

  /**
   * 构造提交 payload：将 location 复合对象拆解为 position/lng/lat/address
   * @param values - 表单原始值
   */
  const buildPayload = (values: FormData): FormData & Partial<EventPayload> => {
    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') {
        return null
      }
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }
    const rawImages = (values.images as ImageUploadValue[] | undefined) || []
    const rawLinks = (values.links as LinkListValue[] | undefined) || []
    const images = rawImages
      .filter((item) => item && item.url)
      .map((item, index) => ({
        url: item.url,
        thumbUrl: item.thumbUrl || item.url,
        sort: item.sort ?? index,
      }))
    const links = rawLinks
      .filter((item) => item && item.url && item.url.trim())
      .map((item) => ({
        platform: item.platform,
        url: item.url.trim(),
        title: (item.title || '').trim(),
      }))

    // 拆解 location 复合对象
    const loc = (values.location as LocationValue | undefined) || {}

    // 移除 location 字段，替换为后端契约的四个字段
    const { location: _loc, ...rest } = values
    void _loc

    return {
      ...rest,
      position: loc.position || '',
      lng: toNum(loc.lng),
      lat: toNum(loc.lat),
      address: loc.address || null,
      images,
      links,
    }
  }

  /**
   * 新增/编辑提交
   * @param values - 表单返回数据
   */
  const handleFinish = async (values: FormData) => {
    // 链接格式校验：存在非法 URL 则提示且不提交
    const rawLinks = (values.links as LinkListValue[] | undefined) || []
    const hasInvalidLink = rawLinks.some(
      (item) => item?.url && item.url.trim() && !isValidLinkUrl(item.url.trim())
    )
    if (hasInvalidLink) {
      message.error(t('content.linkUrlInvalid'))
      return
    }
    try {
      setLoading(true)
      const payload = buildPayload(values)
      const functions = () =>
        createId ? updateNPCEvent({ ...payload, id: createId }) : createNPCEvent(payload)
      const { code, message: msg } = await functions()
      if (Number(code) !== 200) {
        return
      }
      message.success(msg || t('public.successfulOperation'), 3)
      createFormRef.current?.resetFields()
      setGpsTip(false)
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
            {aiInfo.summary && (
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                {aiInfo.summary}
              </Typography.Paragraph>
            )}
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
          <BasicForm
            ref={createFormRef}
            list={createList(t, orgOptions, handleGpsExtracted, exifCoord)}
            data={createData}
            labelCol={{ span: 5 }}
            handleFinish={handleFinish}
          />
        </Spin>
        {gpsTip && (
          <Typography.Text
            type='secondary'
            style={{ display: 'block', marginTop: 8, fontSize: 12 }}
          >
            {t('content.gpsExtracted')}
          </Typography.Text>
        )}
      </div>

      <SubmitBottom isLoading={isLoading} goBack={goBack} handleSubmit={handleSubmit} />
    </BasicContent>
  )
}

export default Page
