/**
 * 地点选择组件（受控）
 * - 搜索输入（AMap.AutoComplete）
 * - 地图选点 Modal（AMap.Marker + 逆地理编码 + PlaceSearch 联网搜索）
 * - 无已有坐标时自动定位到当前位置（浏览器定位失败退回 IP 城市定位）
 * - 未配置 Key 时优雅降级为纯 Input
 */
import { AimOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { AutoComplete, Button, Input, Modal, Space, Spin, Tooltip, Typography, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isAmapConfigured, loadAmap } from '@/utils/amap'
import { isNarrowViewport } from '@/utils/device'

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
}

/** 默认地图中心（北京） */
const DEFAULT_CENTER: [number, number] = [116.397, 39.909]
const DEFAULT_ZOOM = 11
/** 精确定位缩放级别 */
const LOCATE_ZOOM = 16
/** IP 城市定位缩放级别（精度低，只到市中心） */
const CITY_ZOOM = 12
/** 定位整体超时（毫秒），防止插件回调丢失导致 loading 卡死 */
const LOCATE_TIMEOUT = 12000

/** AMap.Geolocation 实例结构 */
interface GeolocationPlugin {
  getCurrentPosition: (cb: (status: string, result: unknown) => void) => void
  getCity: (cb: (status: string, result: unknown) => void) => void
}

/**
 * 给 Promise 加超时兜底，避免高德回调不触发时一直 pending
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])
}

/**
 * 地点选择组件
 */
const LocationPicker = (props: LocationPickerProps) => {
  const { value, onChange, disabled = false, placeholder } = props
  const { t } = useTranslation()

  // 是否可用高德
  const amapReady = isAmapConfigured()
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
  // 定位中
  const [locating, setLocating] = useState(false)
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
  const geolocationRef = useRef<unknown>(null)
  // 地图 Modal 内搜索防抖
  const mapSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 用户是否手动修改过 position
  const userModifiedPosition = useRef(false)
  // 地图 Modal 初始化时的坐标（用 ref 避免 initMap 依赖 tempCoord 导致重建）
  const initCoordRef = useRef<{ lng: number; lat: number } | null>(null)
  // 定位进行中标记（initMap 闭包只持有首次渲染的 state，重入判断须用 ref）
  const locatingRef = useRef(false)

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
        geocoderRef.current = new (
          AMap as unknown as {
            Geocoder: new (opts?: { extensions?: string; radius?: number }) => unknown
          }
        ).Geocoder({
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
      map.setZoom(LOCATE_ZOOM)
      if (markerRef.current) {
        const marker = markerRef.current as { setPosition: (p: [number, number]) => void; show: () => void }
        marker.setPosition([lng, lat])
        marker.show()
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
    const initialCoord = value?.lng != null && value?.lat != null ? { lng: value.lng, lat: value.lat } : null
    initCoordRef.current = initialCoord
    setTempCoord(initialCoord)
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

      const center = initCoordRef.current ? [initCoordRef.current.lng, initCoordRef.current.lat] : DEFAULT_CENTER

      const MapConstructor = AMapNS.Map as new (el: HTMLElement, opts: Record<string, unknown>) => unknown
      const map = new MapConstructor(mapContainerRef.current, {
        zoom: initCoordRef.current ? LOCATE_ZOOM : DEFAULT_ZOOM,
        center,
        resizeEnable: true,
      })
      mapRef.current = map

      // 添加 Marker（无已有坐标时先隐藏，避免默认中心的图钉被误认为已选位置）
      const MarkerConstructor = AMapNS.Marker as new (opts: Record<string, unknown>) => unknown
      const marker = new MarkerConstructor({
        position: center,
        draggable: true,
        cursor: 'move',
        visible: !!initCoordRef.current,
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
          const m = marker as { setPosition: (p: [number, number]) => void; show: () => void }
          m.setPosition([lng, lat])
          m.show()
          doReverseGeocode(lng, lat)
        }
      })

      // 添加工具条
      const ToolBarConstructor = AMapNS.ToolBar as new () => unknown
      const toolbar = new ToolBarConstructor()
      ;(map as { addControl: (c: unknown) => void }).addControl(toolbar)

      // 没有已有坐标时，默认拉一次当前位置（不覆盖用户已填的地点名）
      if (!initCoordRef.current) {
        locateCurrentPosition({ keepName: true })
      }

      // 如果有初始坐标，做逆地理编码（同样不覆盖已存的地点名）
      if (initCoordRef.current) {
        doReverseGeocode(initCoordRef.current.lng, initCoordRef.current.lat, true)
      }
    } catch {
      setMapError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 把定位结果落到地图上：居中 + 显示图钉 + 逆地理编码
   * @param keepName 已有地点名时不被逆地理编码结果覆盖（自动定位场景）
   */
  const applyLocatedPoint = (lng: number, lat: number, zoom: number, keepName = false) => {
    const map = mapRef.current as { setCenter: (c: [number, number]) => void; setZoom: (z: number) => void } | null
    if (!map) {
      return
    }
    setTempCoord({ lng, lat })
    map.setCenter([lng, lat])
    map.setZoom(zoom)
    if (markerRef.current) {
      const marker = markerRef.current as { setPosition: (p: [number, number]) => void; show: () => void }
      marker.setPosition([lng, lat])
      marker.show()
    }
    doReverseGeocode(lng, lat, keepName)
  }

  /**
   * 获取 AMap.Geolocation 实例（插件未随 loader 注入时显式补加载一次）
   */
  const getGeolocationPlugin = async (): Promise<GeolocationPlugin | null> => {
    const AMapNS = (await loadAmap()) as unknown as Record<string, unknown>
    if (typeof AMapNS.Geolocation !== 'function') {
      const plugin = AMapNS.plugin as ((name: string, cb: () => void) => void) | undefined
      if (typeof plugin === 'function') {
        await withTimeout(new Promise<void>((resolve) => plugin('AMap.Geolocation', () => resolve())), 3000, undefined)
      }
    }
    if (typeof AMapNS.Geolocation !== 'function') {
      return null
    }
    if (!geolocationRef.current) {
      const GeolocationConstructor = AMapNS.Geolocation as new (opts: Record<string, unknown>) => unknown
      geolocationRef.current = new GeolocationConstructor({
        // 优先浏览器高精度定位，拿不到（拒授权 / 非 HTTPS）时自动退回 IP 定位
        enableHighAccuracy: true,
        timeout: 8000,
        noIpLocate: 0,
        noGeoLocation: 0,
        convert: true,
      })
    }
    return geolocationRef.current as GeolocationPlugin
  }

  /**
   * 定位到当前位置：浏览器精确定位 → IP 城市定位 → 提示失败
   */
  const locateCurrentPosition = async (opts?: { keepName?: boolean }) => {
    if (!mapRef.current || locatingRef.current) {
      return
    }
    const keepName = !!opts?.keepName
    locatingRef.current = true
    setLocating(true)
    try {
      const geo = await getGeolocationPlugin()
      if (!geo) {
        message.warning(t('content.locateFailed'))
        return
      }
      const point = await withTimeout(
        new Promise<{ lng: number; lat: number; zoom: number } | null>((resolve) => {
          geo.getCurrentPosition((status, result) => {
            const r = result as { position?: { lng: number; lat: number } }
            if (status === 'complete' && r?.position && Number.isFinite(r.position.lng) && Number.isFinite(r.position.lat)) {
              resolve({ lng: r.position.lng, lat: r.position.lat, zoom: LOCATE_ZOOM })
              return
            }
            // 浏览器定位不可用（拒授权 / 非 HTTPS），退回 IP 城市定位
            geo.getCity((_status, cityResult) => {
              const c = cityResult as { center?: string }
              const [lngStr, latStr] = String(c?.center || '').split(',')
              const lng = Number(lngStr)
              const lat = Number(latStr)
              // center 形如 "116.397428,39.90923"，可解析即视为成功
              resolve(Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat, zoom: CITY_ZOOM } : null)
            })
          })
        }),
        LOCATE_TIMEOUT,
        null,
      )
      if (point) {
        applyLocatedPoint(point.lng, point.lat, point.zoom, keepName)
      } else {
        message.warning(t('content.locateFailed'))
      }
    } catch {
      message.warning(t('content.locateFailed'))
    } finally {
      locatingRef.current = false
      setLocating(false)
    }
  }

  /**
   * 地图 Modal 内逆地理编码
   * @param keepName 保留用户已填的地点名，仅在为空时回填 POI
   */
  const doReverseGeocode = async (lng: number, lat: number, keepName = false) => {
    setGeocoding(true)
    const { address, position } = await reverseGeocode(lng, lat)
    if (address) {
      setTempAddress(address)
    }
    if (position) {
      setTempPosition((prev) => (keepName && prev ? prev : position))
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
        width={mapVisible && isNarrowViewport() ? '94%' : 720}
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              {/* Spin 嵌套模式下 style 不生效，宽度约束交给外层 div */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Spin spinning={geocoding || locating} size='small'>
                  <Typography.Text type='secondary' style={{ fontSize: 11, display: 'block', wordBreak: 'break-all' }}>
                    {tempAddress || (locating ? t('content.locating') : t('content.clickMapToSelect'))}
                    {tempCoord ? ` · ${tempCoord.lng.toFixed(6)}, ${tempCoord.lat.toFixed(6)}` : ''}
                  </Typography.Text>
                </Spin>
              </div>
              <Tooltip title={t('content.locateNow')}>
                <Button size='small' icon={<AimOutlined />} loading={locating} onClick={() => locateCurrentPosition()} />
              </Tooltip>
            </div>
            <div
              ref={mapContainerRef}
              style={{
                width: '100%',
                height: mapVisible && isNarrowViewport() ? '45vh' : 400,
                borderRadius: 6,
              }}
            />
          </div>
        )}
      </Modal>
    </Space>
  )
}

export default LocationPicker
