/**
 * 地点选择组件（受控）
 * - 搜索输入（AMap.AutoComplete）
 * - 地图选点 Modal（AMap.Marker + 逆地理编码 + PlaceSearch 联网搜索）
 * - EXIF GPS 联动（initialCoordinate）
 * - 未配置 Key 时优雅降级为纯 Input
 */
import { EnvironmentOutlined } from '@ant-design/icons'
import { AutoComplete, Button, Input, Modal, Space, Spin, Tooltip, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isAmapConfigured, loadAmap } from '@/utils/amap'

/** 地点复合值 */
export interface LocationValue {
  position?: string | null
  address?: string | null
  lng?: number | null
  lat?: number | null
}

export interface LocationPickerProps {
  /** 受控值 */
  value?: LocationValue
  /** 值变更回调 */
  onChange?: (v: LocationValue) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 占位符 */
  placeholder?: string
  /** EXIF GPS 传入的初始坐标（GCJ-02），用于自动逆地理编码 */
  initialCoordinate?: { lng: number; lat: number } | null
}

/** 默认地图中心（北京） */
const DEFAULT_CENTER: [number, number] = [116.397, 39.909]
const DEFAULT_ZOOM = 11

/**
 * 地点选择组件
 */
const LocationPicker = (props: LocationPickerProps) => {
  const { value, onChange, disabled = false, placeholder, initialCoordinate } = props
  const { t } = useTranslation()

  // 是否可用高德
  const amapReady = isAmapConfigured()
  // 加载状态
  const [loading, setLoading] = useState(false)
  // 地图 Modal
  const [mapVisible, setMapVisible] = useState(false)
  // 搜索选项
  const [options, setOptions] = useState<{ value: string; label: string; data?: unknown }[]>([])
  // 搜索关键词
  const [searchText, setSearchText] = useState(value?.position || '')
  // 地图 Modal 内的临时坐标
  const [tempCoord, setTempCoord] = useState<{ lng: number; lat: number } | null>(null)
  // 地图 Modal 内的临时地址
  const [tempAddress, setTempAddress] = useState('')
  // 地图 Modal 内的临时 POI 名
  const [tempPosition, setTempPosition] = useState('')
  // 地图加载失败
  const [mapError, setMapError] = useState(false)
  // 逆地理编码中
  const [geocoding, setGeocoding] = useState(false)
  // 地图 Modal 内搜索结果
  const [mapSearchOptions, setMapSearchOptions] = useState<
    {
      value: string
      label: string
      data?: unknown
    }[]
  >([])

  // 地图实例引用
  const mapRef = useRef<unknown>(null)
  const markerRef = useRef<unknown>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const autoCompleteRef = useRef<unknown>(null)
  const geocoderRef = useRef<unknown>(null)
  const placeSearchRef = useRef<unknown>(null)
  // 地图 Modal 内搜索防抖
  const mapSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 用户是否手动修改过 position
  const userModifiedPosition = useRef(false)
  // 已处理过的 initialCoordinate
  const processedCoord = useRef<string>('')

  // 同步外部 value 到 searchText
  useEffect(() => {
    if (value?.position !== undefined) {
      setSearchText(value.position || '')
    }
  }, [value?.position])

  /**
   * 触发 onChange
   */
  const emitChange = useCallback(
    (next: LocationValue) => {
      onChange?.(next)
    },
    [onChange],
  )

  /**
   * 逆地理编码：坐标 → 地址 + POI
   */
  const reverseGeocode = useCallback(async (lng: number, lat: number): Promise<{ address: string; position: string }> => {
    try {
      const AMap = await loadAmap()
      if (!geocoderRef.current) {
        geocoderRef.current = new (AMap as unknown as { Geocoder: new (opts?: { extensions?: string; radius?: number }) => unknown }).Geocoder({
          extensions: 'all',
          radius: 200,
        })
      }
      const geocoder = geocoderRef.current as {
        getAddress: (lnglat: [number, number], cb: (status: string, result: unknown) => void) => void
      }
      return new Promise((resolve) => {
        geocoder.getAddress([lng, lat], (status, result) => {
          if (status === 'complete' && result) {
            const r = result as {
              regeocode?: {
                formattedAddress?: string
                pois?: Array<{ name?: string; distance?: string | number }>
                aois?: Array<{ name?: string }>
                addressComponent?: {
                  township?: string
                  street?: string
                  streetNumber?: string
                  neighborhood?: { name?: string }
                  building?: { name?: string }
                }
              }
            }
            const address = r.regeocode?.formattedAddress || ''
            const comp = r.regeocode?.addressComponent
            // 优先取最近的 POI / AOI 名称，避免只显示街道这类过于笼统的名称
            const nearestPoi = r.regeocode?.pois?.find((p) => p.name)?.name || r.regeocode?.aois?.find((a) => a.name)?.name
            const position = nearestPoi || comp?.building?.name || comp?.neighborhood?.name || comp?.township || ''
            resolve({ address, position })
          } else {
            resolve({ address: '', position: '' })
          }
        })
      })
    } catch {
      return { address: '', position: '' }
    }
  }, [])

  /**
   * EXIF GPS 联动：当 initialCoordinate 变化且当前无坐标时自动逆地理编码
   */
  useEffect(() => {
    if (!initialCoordinate || !amapReady) {
      return
    }
    const coordKey = `${initialCoordinate.lng},${initialCoordinate.lat}`
    if (processedCoord.current === coordKey) {
      return
    }
    processedCoord.current = coordKey

    // 如果已有坐标，不覆盖
    if (value?.lng != null && value?.lat != null) {
      return
    }

    setLoading(true)
    reverseGeocode(initialCoordinate.lng, initialCoordinate.lat)
      .then(({ address, position }) => {
        const next: LocationValue = {
          ...value,
          lng: initialCoordinate.lng,
          lat: initialCoordinate.lat,
          address: address || value?.address || null,
        }
        // 尊重用户已手动填写的 position
        if (!userModifiedPosition.current && position) {
          next.position = position
        }
        emitChange(next)
      })
      .finally(() => setLoading(false))
  }, [initialCoordinate, amapReady, value, reverseGeocode, emitChange])

  /**
   * 搜索输入变化
   */
  const handleSearch = async (text: string) => {
    setSearchText(text)
    userModifiedPosition.current = true

    if (!amapReady || !text.trim()) {
      setOptions([])
      // 直接更新 position（纯文本模式）
      emitChange({ ...value, position: text || null })
      return
    }

    try {
      const AMap = await loadAmap()
      if (!autoCompleteRef.current) {
        autoCompleteRef.current = new (
          AMap as unknown as {
            AutoComplete: new (opts: { city?: string }) => unknown
          }
        ).AutoComplete({ city: '' })
      }
      const ac = autoCompleteRef.current as {
        search: (keyword: string, cb: (status: string, result: unknown) => void) => void
      }
      ac.search(text, (status, result) => {
        if (status === 'complete' && result) {
          const r = result as {
            tips?: Array<{
              id?: string
              name?: string
              district?: string
              address?: string
              location?: { lng: number; lat: number }
            }>
          }
          const tips = (r.tips || []).filter((tip) => tip.name && tip.location)
          setOptions(
            tips.map((tip) => ({
              value: tip.name || '',
              label: `${tip.name}${tip.district ? ` (${tip.district})` : ''}`,
              data: tip,
            })),
          )
        } else {
          setOptions([])
        }
      })
    } catch {
      setOptions([])
    }
  }

  /**
   * 选中搜索建议
   */
  const handleSelect = (selectedValue: string) => {
    const opt = options.find((o) => o.value === selectedValue)
    if (!opt?.data) {
      emitChange({ ...value, position: selectedValue })
      return
    }
    const tip = opt.data as {
      name?: string
      district?: string
      address?: string
      location?: { lng: number; lat: number }
    }
    const lng = tip.location?.lng ?? null
    const lat = tip.location?.lat ?? null
    const address = tip.address ? `${tip.district || ''}${tip.address}` : tip.district || null
    emitChange({
      position: tip.name || selectedValue,
      address,
      lng,
      lat,
    })
    setSearchText(tip.name || selectedValue)
    setOptions([])
  }

  /**
   * 地图 Modal 内联网搜索（AMap.PlaceSearch）
   */
  const handleMapSearch = (text: string) => {
    if (mapSearchTimer.current) {
      clearTimeout(mapSearchTimer.current)
    }
    if (!text.trim()) {
      setMapSearchOptions([])
      return
    }
    // 防抖，减少请求频次
    mapSearchTimer.current = setTimeout(async () => {
      try {
        const AMap = await loadAmap()
        if (!placeSearchRef.current) {
          placeSearchRef.current = new (
            AMap as unknown as {
              PlaceSearch: new (opts: { city?: string; citylimit?: boolean }) => unknown
            }
          ).PlaceSearch({ city: '全国', citylimit: false })
        }
        const ps = placeSearchRef.current as {
          search: (keyword: string, cb: (status: string, result: unknown) => void) => void
        }
        ps.search(text, (status, result) => {
          if (status === 'complete' && result) {
            const r = result as {
              poiList?: {
                pois?: Array<{
                  name?: string
                  address?: string
                  city?: string
                  district?: string
                  location?: { lng: number; lat: number }
                }>
              }
            }
            const pois = (r.poiList?.pois || []).filter((p) => p.name && p.location && Number.isFinite(p.location.lng))
            setMapSearchOptions(
              pois.map((p) => ({
                value: p.name || '',
                label: `${p.name}${p.district ? ` (${p.district})` : ''}`,
                data: p,
              })),
            )
          } else {
            setMapSearchOptions([])
          }
        })
      } catch {
        setMapSearchOptions([])
      }
    }, 300)
  }

  /**
   * 地图 Modal 内选中搜索结果：移动地图并落点
   */
  const handleMapSearchSelect = (selectedValue: string) => {
    const opt = mapSearchOptions.find((o) => o.value === selectedValue)
    const poi = opt?.data as {
      name?: string
      address?: string
      city?: string
      district?: string
      location?: { lng: number; lat: number }
    }
    const map = mapRef.current as {
      setCenter: (c: [number, number]) => void
      setZoom: (z: number) => void
    } | null
    if (poi?.location && map) {
      const { lng, lat } = poi.location
      map.setCenter([lng, lat])
      map.setZoom(16)
      if (markerRef.current) {
        ;(markerRef.current as { setPosition: (p: [number, number]) => void }).setPosition([lng, lat])
      }
      setTempCoord({ lng, lat })
      setTempPosition(poi.name || selectedValue)
      setTempAddress([poi.city, poi.district, poi.address].filter(Boolean).join(''))
    }
    setMapSearchOptions([])
  }

  /**
   * 打开地图选点 Modal
   */
  const openMapModal = () => {
    if (!amapReady || disabled) {
      return
    }
    setMapSearchOptions([])
    setTempCoord(value?.lng != null && value?.lat != null ? { lng: value.lng, lat: value.lat } : null)
    setTempAddress(value?.address || '')
    setTempPosition(value?.position || '')
    setMapError(false)
    setMapVisible(true)
  }

  /**
   * 初始化地图
   */
  const initMap = useCallback(async () => {
    if (!mapContainerRef.current) {
      return
    }
    try {
      const AMap = await loadAmap()
      const AMapNS = AMap as unknown as Record<string, unknown>

      // 销毁旧实例
      if (mapRef.current) {
        ;(mapRef.current as { destroy: () => void }).destroy()
        mapRef.current = null
        markerRef.current = null
      }

      const center = tempCoord ? [tempCoord.lng, tempCoord.lat] : DEFAULT_CENTER

      const MapConstructor = AMapNS.Map as new (el: HTMLElement, opts: Record<string, unknown>) => unknown
      const map = new MapConstructor(mapContainerRef.current, {
        zoom: tempCoord ? 15 : DEFAULT_ZOOM,
        center,
        resizeEnable: true,
      })
      mapRef.current = map

      // 添加 Marker
      const MarkerConstructor = AMapNS.Marker as new (opts: Record<string, unknown>) => unknown
      const marker = new MarkerConstructor({
        position: center,
        draggable: true,
        cursor: 'move',
      })
      ;(map as { add: (m: unknown) => void }).add(marker)
      markerRef.current = marker

      // Marker 拖拽结束
      ;(marker as { on: (evt: string, cb: (e: unknown) => void) => void }).on('dragend', (e: unknown) => {
        const evt = e as { target?: { getPosition?: () => { lng: number; lat: number } } }
        const pos = evt.target?.getPosition?.()
        if (pos) {
          setTempCoord({ lng: pos.lng, lat: pos.lat })
          doReverseGeocode(pos.lng, pos.lat)
        }
      })

      // 地图点击
      ;(map as { on: (evt: string, cb: (e: unknown) => void) => void }).on('click', (e: unknown) => {
        const evt = e as { lnglat?: { lng: number; lat: number } }
        if (evt.lnglat) {
          const { lng, lat } = evt.lnglat
          setTempCoord({ lng, lat })
          ;(marker as { setPosition: (p: [number, number]) => void }).setPosition([lng, lat])
          doReverseGeocode(lng, lat)
        }
      })

      // 添加工具条
      const ToolBarConstructor = AMapNS.ToolBar as new () => unknown
      const toolbar = new ToolBarConstructor()
      ;(map as { addControl: (c: unknown) => void }).addControl(toolbar)

      // 如果没有初始坐标，尝试浏览器定位
      if (!tempCoord) {
        tryGeolocation(AMapNS, map)
      }

      // 如果有初始坐标，做逆地理编码
      if (tempCoord) {
        doReverseGeocode(tempCoord.lng, tempCoord.lat)
      }
    } catch {
      setMapError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempCoord])

  /**
   * 尝试浏览器定位
   */
  const tryGeolocation = (AMapNS: Record<string, unknown>, map: unknown) => {
    try {
      const GeolocationConstructor = AMapNS.Geolocation as new (opts: Record<string, unknown>) => unknown
      const geolocation = new GeolocationConstructor({
        enableHighAccuracy: true,
        timeout: 5000,
      }) as {
        getCurrentPosition: (cb: (status: string, result: unknown) => void) => void
      }
      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete' && result) {
          const r = result as { position?: { lng: number; lat: number } }
          if (r.position) {
            const { lng, lat } = r.position
            setTempCoord({ lng, lat })
            ;(map as { setCenter: (c: [number, number]) => void }).setCenter([lng, lat])
            ;(map as { setZoom: (z: number) => void }).setZoom(15)
            if (markerRef.current) {
              ;(markerRef.current as { setPosition: (p: [number, number]) => void }).setPosition([lng, lat])
            }
            doReverseGeocode(lng, lat)
          }
        }
      })
    } catch {
      // 定位失败，保持默认中心
    }
  }

  /**
   * 地图 Modal 内逆地理编码
   */
  const doReverseGeocode = async (lng: number, lat: number) => {
    setGeocoding(true)
    const { address, position } = await reverseGeocode(lng, lat)
    if (address) {
      setTempAddress(address)
    }
    if (position) {
      setTempPosition(position)
    }
    setGeocoding(false)
  }

  /**
   * 地图 Modal 确认
   */
  const handleMapConfirm = () => {
    emitChange({
      position: tempPosition || value?.position || null,
      address: tempAddress || null,
      lng: tempCoord?.lng ?? null,
      lat: tempCoord?.lat ?? null,
    })
    setSearchText(tempPosition || value?.position || '')
    destroyMap()
    setMapVisible(false)
  }

  /**
   * 清除坐标（仅保留文本）
   */
  const handleClearCoord = () => {
    emitChange({
      position: value?.position || null,
      address: null,
      lng: null,
      lat: null,
    })
    destroyMap()
    setMapVisible(false)
  }

  /**
   * 销毁地图实例
   */
  const destroyMap = () => {
    if (mapRef.current) {
      try {
        ;(mapRef.current as { destroy: () => void }).destroy()
      } catch {
        // ignore
      }
      mapRef.current = null
      markerRef.current = null
    }
  }

  // Modal 关闭时销毁
  const handleMapCancel = () => {
    destroyMap()
    setMapVisible(false)
  }

  // 组件卸载时清理
  useEffect(
    () => () => {
      destroyMap()
    },
    [],
  )

  // Modal 打开后初始化地图
  useEffect(() => {
    if (mapVisible && !mapError) {
      // 延迟一帧等 DOM 就绪
      const timer = setTimeout(() => initMap(), 100)
      return () => clearTimeout(timer)
    }
  }, [mapVisible, initMap, mapError])

  // ============ 降级模式：未配置 Key ============
  if (!amapReady) {
    return (
      <Space direction='vertical' style={{ width: '100%' }} size={2}>
        <Input
          value={searchText}
          disabled={disabled}
          placeholder={placeholder || t('content.locationPlaceholder')}
          onChange={(e) => {
            setSearchText(e.target.value)
            userModifiedPosition.current = true
            emitChange({ ...value, position: e.target.value || null })
          }}
        />
        <Tooltip title={t('content.amapNotConfigured')}>
          <Typography.Text type='secondary' style={{ fontSize: 11 }}>
            {t('content.amapNotConfigured')}
          </Typography.Text>
        </Tooltip>
      </Space>
    )
  }

  // ============ 正常模式 ============
  return (
    <Space direction='vertical' style={{ width: '100%' }} size={2}>
      <Spin spinning={loading} size='small'>
        <AutoComplete
          value={searchText}
          options={options}
          disabled={disabled}
          placeholder={placeholder || t('content.locationPlaceholder')}
          onSearch={handleSearch}
          onSelect={handleSelect}
          onChange={(val) => {
            // 允许自由输入（不选建议时同步 position）
            if (!options.find((o) => o.value === val)) {
              setSearchText(val)
              userModifiedPosition.current = true
              emitChange({ ...value, position: val || null })
            }
          }}
          style={{ width: '100%' }}
        >
          <Input
            suffix={
              <Tooltip title={t('content.mapPicker')}>
                <EnvironmentOutlined style={{ cursor: disabled ? 'not-allowed' : 'pointer', color: '#1677ff' }} onClick={openMapModal} />
              </Tooltip>
            }
          />
        </AutoComplete>
      </Spin>

      {/* 已选坐标提示 */}
      {value?.lng != null && value?.lat != null && (
        <Typography.Text type='secondary' style={{ fontSize: 11 }}>
          <EnvironmentOutlined style={{ marginRight: 3 }} />
          {t('content.locationConfirmed')}
          {value.address ? ` · ${value.address}` : ''}
          <Button
            type='link'
            size='small'
            style={{ fontSize: 11, padding: '0 4px' }}
            onClick={() => {
              userModifiedPosition.current = false
              handleClearCoord()
            }}
          >
            {t('content.clearCoord')}
          </Button>
        </Typography.Text>
      )}

      {/* 地图选点 Modal */}
      <Modal
        title={t('content.mapPicker')}
        open={mapVisible}
        onCancel={handleMapCancel}
        width={720}
        destroyOnClose
        footer={[
          <Button key='clear' onClick={handleClearCoord}>
            {t('content.clearCoord')}
          </Button>,
          <Button key='cancel' onClick={handleMapCancel}>
            {t('public.cancel')}
          </Button>,
          <Button key='confirm' type='primary' onClick={handleMapConfirm}>
            {t('public.confirm')}
          </Button>,
        ]}
      >
        {mapError ? (
          <Typography.Text type='danger'>{t('content.mapLoadFailed')}</Typography.Text>
        ) : (
          <div>
            {/* 联网搜索地点（选中结果名称即为地址名称字段） */}
            <AutoComplete
              value={tempPosition}
              options={mapSearchOptions}
              placeholder={t('content.searchLocationPlaceholder')}
              onSearch={handleMapSearch}
              onSelect={handleMapSearchSelect}
              onChange={(val) => setTempPosition(val)}
              style={{ width: '100%', marginBottom: 8 }}
              allowClear
            />
            <Spin spinning={geocoding} size='small'>
              <Typography.Text type='secondary' style={{ fontSize: 11, display: 'block', wordBreak: 'break-all', marginBottom: 8 }}>
                {tempAddress || t('content.clickMapToSelect')}
                {tempCoord ? ` · ${tempCoord.lng.toFixed(6)}, ${tempCoord.lat.toFixed(6)}` : ''}
              </Typography.Text>
            </Spin>
            <div ref={mapContainerRef} style={{ width: '100%', height: 400, borderRadius: 6 }} />
          </div>
        )}
      </Modal>
    </Space>
  )
}

export default LocationPicker
