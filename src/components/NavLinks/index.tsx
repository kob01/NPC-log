/**
 * 导航链接组件
 * - 有坐标：手机端直接唤起高德导航，PC端 Dropdown 多选项
 * - 无坐标：退化为高德搜索或纯文本
 */
import { EnvironmentOutlined } from '@ant-design/icons'
import { Dropdown, Typography } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { MenuProps } from 'antd'

import {
  buildAmapMarkerUrl,
  buildAmapNavigationUrl,
  buildAmapSearchUrl,
  buildFallbackNavUrls,
  isMobileDevice,
} from '@/utils/nav'

export interface NavLinksProps {
  /** GCJ-02 经度 */
  lng?: number | null
  /** GCJ-02 纬度 */
  lat?: number | null
  /** 地点名（POI） */
  position?: string | null
  /** 结构化地址 */
  address?: string | null
  /** 是否紧凑模式（表格内使用） */
  compact?: boolean
}

/**
 * 导航链接组件
 * 渲染为可点击入口，根据设备类型和坐标情况自适应
 */
const NavLinks = (props: NavLinksProps) => {
  const { lng, lat, position, address, compact = false } = props
  const { t } = useTranslation()

  const hasCoord = lng != null && lat != null
  const hasText = !!(position || address)
  const isMobile = useMemo(() => isMobileDevice(), [])

  // 无任何地点信息
  if (!hasCoord && !hasText) {
    return <span>-</span>
  }

  // 构建链接
  const amapNavUrl = hasCoord ? buildAmapNavigationUrl({ lng, lat, name: position }) : ''
  const amapMarkerUrl = hasCoord ? buildAmapMarkerUrl({ lng, lat, name: position }) : ''
  const amapSearchUrl = !hasCoord && position ? buildAmapSearchUrl(position) : ''
  const fallbackUrls = hasCoord
    ? buildFallbackNavUrls({ lng, lat, name: position })
    : { google: '', apple: '' }

  // 主链接（点击行为）
  const primaryUrl = amapNavUrl || amapMarkerUrl || amapSearchUrl || ''

  const displayName = position || address || t('content.viewOnMap')

  // 手机端：直接链接打开（callnative=1 会唤起 App）
  if (isMobile && primaryUrl) {
    return (
      <a
        href={primaryUrl}
        target='_blank'
        rel='noopener noreferrer'
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <EnvironmentOutlined />
        {compact ? (
          <Typography.Text ellipsis style={{ maxWidth: 80 }}>
            {displayName}
          </Typography.Text>
        ) : (
          displayName
        )}
      </a>
    )
  }

  // PC端：有坐标时用 Dropdown 提供多地图选项；无坐标时用简单链接
  if (hasCoord) {
    const menuItems: MenuProps['items'] = [
      {
        key: 'amap-nav',
        label: (
          <a href={amapNavUrl} target='_blank' rel='noopener noreferrer'>
            {t('content.navAmap')}
          </a>
        ),
      },
      {
        key: 'amap-marker',
        label: (
          <a href={amapMarkerUrl} target='_blank' rel='noopener noreferrer'>
            {t('content.navAmapMarker')}
          </a>
        ),
      },
      ...(fallbackUrls.apple
        ? [
            {
              key: 'apple',
              label: (
                <a href={fallbackUrls.apple} target='_blank' rel='noopener noreferrer'>
                  Apple Maps
                </a>
              ),
            },
          ]
        : []),
      ...(fallbackUrls.google
        ? [
            {
              key: 'google',
              label: (
                <a href={fallbackUrls.google} target='_blank' rel='noopener noreferrer'>
                  Google Maps
                </a>
              ),
            },
          ]
        : []),
    ]

    return (
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <span
          role='button'
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            color: '#1677ff',
          }}
        >
          <EnvironmentOutlined />
          {compact ? (
            <Typography.Text ellipsis style={{ maxWidth: 80 }}>
              {displayName}
            </Typography.Text>
          ) : (
            displayName
          )}
        </span>
      </Dropdown>
    )
  }

  // 无坐标，仅有关键词搜索
  if (amapSearchUrl) {
    return (
      <a
        href={amapSearchUrl}
        target='_blank'
        rel='noopener noreferrer'
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <EnvironmentOutlined />
        {compact ? (
          <Typography.Text ellipsis style={{ maxWidth: 80 }}>
            {displayName}
          </Typography.Text>
        ) : (
          displayName
        )}
      </a>
    )
  }

  // 纯文本
  return compact ? (
    <Typography.Text ellipsis style={{ maxWidth: 80 }}>
      {displayName}
    </Typography.Text>
  ) : (
    <span>{displayName}</span>
  )
}

export default NavLinks
