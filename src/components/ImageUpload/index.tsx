import { PlusOutlined } from '@ant-design/icons'
import { Image, message, Upload } from 'antd'
import imageCompression from 'browser-image-compression'
import { wgs84togcj02 } from 'coordtransform'
import exifr from 'exifr'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { UploadFile, RcFile } from 'antd/es/upload/interface'

import { uploadEventImage } from '@/servers/content/event'
import { resolveFileUrl } from '@/utils/config'

/** 受控值：随日志提交的图片项 */
export interface ImageUploadValue {
  url: string
  thumbUrl?: string
  sort?: number
}

export interface ImageUploadProps {
  /** 受控值 */
  value?: ImageUploadValue[]
  /** 值变更回调（仅包含上传成功的图片，按当前顺序生成 sort） */
  onChange?: (value: ImageUploadValue[]) => void
  /** 成功从照片 EXIF 提取到 GPS（GCJ-02）时回调，多张图仅取第一张有效值 */
  onGpsExtracted?: (gps: { lng: number; lat: number }) => void
  /** 最多上传数量，默认 9 */
  maxCount?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 接受的文件类型 */
  accept?: string
}

// 允许的图片类型
const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic'
// 压缩后输出类型（不支持 webp 时回退 jpeg）
let cachedWebpSupport: boolean | null = null

/** 检测当前浏览器 canvas 是否支持输出 webp */
function supportsWebp(): boolean {
  if (cachedWebpSupport !== null) {
    return cachedWebpSupport
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    cachedWebpSupport = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  } catch {
    cachedWebpSupport = false
  }
  return cachedWebpSupport
}

/**
 * 图片上传组件（压缩 + EXIF 取 GPS）
 * - 顺序：先用 exifr 读原图 GPS，再压缩（压缩会丢 EXIF）
 * - 受控 value/onChange，可接入 BasicForm 或 antd Form.Item
 */
const ImageUpload = (props: ImageUploadProps) => {
  const {
    value,
    onChange,
    onGpsExtracted,
    maxCount = 9,
    disabled = false,
    accept = DEFAULT_ACCEPT,
  } = props
  const { t } = useTranslation()

  // 上传中的占位项（独立于已提交值，避免并发上传相互覆盖）
  const [pendingList, setPendingList] = useState<UploadFile[]>([])
  // 预览（使用 antd Image 内置灯箱预览）
  const [previewSrc, setPreviewSrc] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  // 始终指向最新已提交值，保证并发上传成功时链式追加正确
  const valueRef = useRef<ImageUploadValue[]>(value || [])
  // 是否已抛出过 GPS（每次挂载仅取第一张有效 GPS）
  const gpsEmittedRef = useRef(false)

  // 外部 value 变化（编辑回填/重置）时同步 ref
  useEffect(() => {
    valueRef.current = value || []
  }, [value])

  /** 提交新值 */
  const emit = (next: ImageUploadValue[]) => {
    // 按当前数组顺序重排 sort
    const normalized = next.map((item, index) => ({ ...item, sort: index }))
    valueRef.current = normalized
    onChange?.(normalized)
  }

  // 已提交的图片转为 antd 展示项
  const doneList: UploadFile[] = (value || []).map((item, index) => ({
    uid: `done-${index}-${item.url}`,
    name: item.url.split('/').pop() || `image-${index}`,
    status: 'done',
    url: resolveFileUrl(item.url),
    thumbUrl: resolveFileUrl(item.thumbUrl || item.url),
  }))

  const fileList = [...doneList, ...pendingList]

  /**
   * 尝试从原图读取 EXIF GPS 并转换为 GCJ-02
   * @param file - 原始文件（压缩前）
   */
  const tryExtractGps = async (file: File) => {
    if (gpsEmittedRef.current || !onGpsExtracted) {
      return
    }
    try {
      const gps = await exifr.gps(file)
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        // WGS-84 -> GCJ-02
        const [lng, lat] = wgs84togcj02(gps.longitude, gps.latitude)
        gpsEmittedRef.current = true
        onGpsExtracted({ lng, lat })
      }
    } catch {
      // 无 EXIF 或解析失败，忽略
    }
  }

  /**
   * 压缩图片
   * @param file - 原始文件
   */
  const compress = async (file: File): Promise<{ blob: Blob; ext: string }> => {
    const useWebp = supportsWebp()
    const fileType = useWebp ? 'image/webp' : 'image/jpeg'
    const ext = useWebp ? 'webp' : 'jpg'
    try {
      const blob = await imageCompression(file, {
        // 0.2MB 会把大图压成肉眼可见的糊（浏览器侧先压一道，服务端 webp 再压一道），
        // 放宽到 0.8MB 并与后端长边上限（2560）对齐，清晰度明显改善而体积仍可控
        maxSizeMB: 0.8,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
        fileType,
      })
      return { blob, ext }
    } catch {
      // 压缩失败回退原图
      return { blob: file, ext: file.type === 'image/png' ? 'png' : 'jpg' }
    }
  }

  /**
   * 选择文件后：EXIF -> 压缩 -> 上传 -> 写入 value
   * @param file - antd 原始文件
   */
  const beforeUpload = async (file: RcFile) => {
    // 数量校验
    if ((value || []).length + pendingList.length >= maxCount) {
      message.warning(t('content.imageMaxCount', { num: maxCount }))
      return Upload.LIST_IGNORE
    }
    // 类型校验
    const isValidType = accept.split(',').some((type) => file.type === type.trim())
    if (!isValidType) {
      message.error(t('content.imageTypeInvalid'))
      return Upload.LIST_IGNORE
    }

    const uid = file.uid
    const previewUrl = URL.createObjectURL(file)
    setPendingList((prev) => [
      ...prev,
      { uid, name: file.name, status: 'uploading', thumbUrl: previewUrl },
    ])

    try {
      // 1. 先读 EXIF GPS（压缩会丢失 EXIF）
      await tryExtractGps(file)
      // 2. 压缩
      const { blob, ext } = await compress(file)
      // 3. 上传
      const baseName = (file.name.replace(/\.[^.]+$/, '') || 'image').slice(0, 40)
      const { url, thumbUrl } = await uploadEventImage(blob, `${baseName}.${ext}`)
      // 4. 写入受控值
      emit([...valueRef.current, { url, thumbUrl }])
    } catch {
      message.error(t('content.imageUploadFailed'))
    } finally {
      URL.revokeObjectURL(previewUrl)
      setPendingList((prev) => prev.filter((item) => item.uid !== uid))
    }

    // 阻止 antd 默认上传行为（已自行处理）
    return false
  }

  /**
   * 删除图片
   * @param file - 待删除的展示项
   */
  const onRemove = (file: UploadFile) => {
    const next = (value || []).filter((item) => resolveFileUrl(item.url) !== file.url)
    emit(next)
  }

  return (
    <>
      <Upload
        listType='picture-card'
        fileList={fileList}
        accept={accept}
        multiple
        maxCount={maxCount}
        disabled={disabled}
        beforeUpload={beforeUpload}
        onRemove={onRemove}
        onPreview={(file) => {
          const src = file.url || file.thumbUrl
          if (src) {
            setPreviewSrc(src)
            setPreviewOpen(true)
          }
        }}
      >
        {(value || []).length + pendingList.length >= maxCount ? null : (
          <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>{t('content.imageUpload')}</div>
          </div>
        )}
      </Upload>
      {/* 隐藏的图片预览器，仅用于灯箱预览 */}
      <Image
        style={{ display: 'none' }}
        preview={{
          visible: previewOpen,
          src: previewSrc,
          onVisibleChange: (visible) => setPreviewOpen(visible),
        }}
      />
    </>
  )
}

export default ImageUpload
