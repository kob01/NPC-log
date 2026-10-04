/**
 * 公开分享访客页（/s/:token）
 * - 无需登录：走白名单接口 /api/share/view，仅凭签名 token 读取脱敏内容
 * - 只读展示：标题 / 时间 / 图片 / AI 摘要 / 正文 / 标签 / 地点
 * - 脱离桌面 Layout 与 /m 守卫（在 App.tsx 注册为顶层路由，并在 ROUTER_EXCLUDE 排除自动扫描）
 */
import { EnvironmentOutlined } from '@ant-design/icons'
import { Image, Spin, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import type { SharedViewData } from '@/servers/content/event'

import { getSharedView } from '@/servers/content/event'
import { EMPTY_VALUE, resolveFileUrl } from '@/utils/config'

const SharedView = () => {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedViewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('分享链接无效')
        setLoading(false)
        return
      }
      try {
        const { code, data: resp, message } = await getSharedView(token)
        if (Number(code) === 200 && resp) {
          setData(resp)
        } else {
          setError(message || '分享链接无效或已过期')
        }
      } catch (err) {
        console.error('加载分享内容失败:', err)
        setError('分享链接无效或已过期')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className='flex justify-center items-center h-100vh'>
        <Spin tip='加载中…' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='text-center mt-100px text-gray-500'>
        <p className='text-16px'>{error || '内容不存在'}</p>
      </div>
    )
  }

  const images = (data.images || []).map((img) => resolveFileUrl(img.url || img.thumbUrl)).filter(Boolean)
  const place = data.position || data.address || ''

  return (
    <div className='min-h-100vh bg-gray-100'>
      <div className='max-w-768px mx-auto px-4 py-5 bg-white min-h-100vh'>
        {/* 品牌头部 */}
        <div className='text-center mb-4'>
          <div className='text-18px font-bold text-gray-800'>NPC存档 · 分享</div>
          {data.author && <div className='text-12px text-gray-400 mt-1'>@{data.author}</div>}
        </div>

        <h1 className='text-22px font-bold text-gray-800 mt-2 mb-1'>{data.event || EMPTY_VALUE}</h1>
        <div className='flex flex-wrap items-center gap-2 text-12px text-gray-400 mb-4'>
          {data.type && (
            <Tag color='blue' style={{ marginRight: 0 }}>
              {data.type}
            </Tag>
          )}
          <span>{data.time || EMPTY_VALUE}</span>
        </div>

        {images.length > 0 && (
          <div className='mb-4 rounded-10px overflow-hidden'>
            <Image.PreviewGroup>
              {images.length === 1 ? (
                <Image src={images[0]} alt='' className='w-full object-cover' style={{ maxHeight: '60vh' }} />
              ) : (
                <div className='grid grid-cols-3 gap-2'>
                  {images.map((src, idx) => (
                    <Image key={`${src}-${idx}`} src={src} alt='' className='w-full aspect-square object-cover' style={{ borderRadius: 8 }} />
                  ))}
                </div>
              )}
            </Image.PreviewGroup>
          </div>
        )}

        {data.summary && (
          <div className='p-3 mb-4 rounded-10px bg-blue-50 text-13px text-gray-700'>
            <span className='font-bold text-blue-500 mr-1'>AI 摘要</span>
            {data.summary}
          </div>
        )}

        {data.content && <div className='text-15px text-gray-700 whitespace-pre-wrap leading-relaxed mb-4'>{data.content}</div>}

        {(data.tags || []).length > 0 && (
          <div className='flex flex-wrap gap-1 mb-4'>
            {(data.tags || []).map((tag) => (
              <Tag key={tag} color='geekblue' style={{ marginRight: 0 }}>
                {tag}
              </Tag>
            ))}
          </div>
        )}

        {place && (
          <div className='text-13px text-gray-500 mb-6'>
            <EnvironmentOutlined className='mr-1 text-red-400' />
            {place}
          </div>
        )}

        <div className='text-center text-12px text-gray-400 mt-8 pt-4 border-t border-gray-200'>来自「NPC存档」</div>
      </div>
    </div>
  )
}

export default SharedView
