/**
 * 地图足迹撒点（高德 JS API）
 * 桌面端 /content/footprint 与移动端 /m/footprint 共用
 * - 未配置 Key 或加载失败：通过 onDegrade 通知调用方降级为列表，不白屏
 * - 点击标记弹气泡，详情链接由 detailHref 决定跳桌面还是移动端；
 *   气泡不用 AMap.InfoWindow（官方明确：一个地图实例每次只能打开一个信息窗体），
 *   而是用 lngLatToContainer 算像素坐标自己渲染的 React 卡片，想开几个开几个
 * - 右上角一键全屏：优先用元素原生 Fullscreen API（能隐掉浏览器地址栏），
 *   iOS Safari 等不支持元素全屏的内核退化为 fixed 铺满视口
 */
import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { FootprintPoint } from '@/servers/content/memory'
import type { CSSProperties } from 'react'

import { isAmapConfigured, loadAmap } from '@/utils/amap'
import { resolveFileUrl } from '@/utils/config'

/** 全屏形态：none 常规内嵌 / native 浏览器原生全屏 / css 伪全屏（不支持元素全屏的内核） */
type FsMode = 'none' | 'native' | 'css'

/**
 * 气泡样式：宽度取旧版 InfoWindow（300px）的一半，面积约为原来的 1/4，
 * 四个城市并排挂在一起也不至于互相压住；地址行在 150px 宽下读不出信息，直接不带
 */
const BUBBLE_STYLE: CSSProperties = {
  position: 'relative',
  width: 150,
  background: '#fff',
  borderRadius: 6,
  boxShadow: '0 2px 10px rgba(0,0,0,.22)',
  padding: '5px 6px 6px',
}
/** 指向点位的小三角 */
const TAIL_STYLE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: -5,
  marginLeft: -5,
  width: 0,
  height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: '5px solid #fff',
}
/** 气泡右上角的关闭按钮（行高写在 style 里，不依赖原子类的 leading 规则） */
const CLOSE_BTN_STYLE: CSSProperties = {
  position: 'absolute',
  top: 2,
  right: 3,
  width: 14,
  height: 14,
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: '14px',
  color: '#9ca3af',
}

/** 气泡锥尖与标记圆点之间留的间隙（px） */
const BUBBLE_GAP = 8

// 高德 SDK 对象的最小结构描述（项目未安装 @amap/maps 全局类型，避免 any）
interface AmapObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
interface AmapMarker extends AmapObject {
  on(event: string, handler: () => void): void
}
interface AmapMap extends AmapObject {
  add(obj: AmapObject | AmapObject[]): void
  remove(obj: AmapObject | AmapObject[]): void
  addControl(control: AmapObject): void
  setCenter(center: [number, number]): void
  setZoom(zoom: number): void
  setFitView(targets: AmapObject[], immediately?: boolean, avoid?: number[]): void
  /** 容器尺寸变化后重算画布，否则出现灰边与比例错乱 */
  resize(): void
  /** 经纬度 → 容器内像素坐标 */
  lngLatToContainer(lnglat: [number, number]): AmapObject
  on(event: string, handler: () => void): void
  destroy(): void
}

interface Props {
  /** 带坐标的日志点 */
  points: FootprintPoint[]
  /** 地图高度 */
  height?: number
  /** 详情链接构造（桌面指向编辑页，移动指向 /m/detail） */
  detailHref: (id: number) => string
  /** 地图不可用（Key 未配置/初始化失败）时的降级通知 */
  onDegrade?: (message: string) => void
}

const FootprintMap = (props: Props) => {
  const { points, height = 460, detailHref, onDegrade } = props
  const { t } = useTranslation()

  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<AmapMap | null>(null)
  const markersRef = useRef<AmapMarker[]>([])
  const [fsMode, setFsMode] = useState<FsMode>('none')
  // 已展开气泡的点位（按点击顺序，后面的 z-index 更高）：
  // InfoWindow 多开不了，所以气泡由我们渲染，坐标靠下面的 rAF 跟随地图
  const [opened, setOpened] = useState<FootprintPoint[]>([])
  // 气泡外层容器的 DOM：left/top 由 rAF 直接写，不经 React 重渲染
  const bubbleEls = useRef<Map<number, HTMLDivElement>>(new Map())
  // 用 ref 保存回调与文案，避免把它们放进 effect 依赖导致地图反复重建
  const degradeRef = useRef(onDegrade)
  degradeRef.current = onDegrade
  const copyRef = useRef({ notConfigured: '', loadFailed: '' })
  copyRef.current = {
    notConfigured: t('content.amapNotConfigured'),
    loadFailed: t('content.mapLoadFailed'),
  }

  /** 撒点（数据变化或首次加载后） */
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!points?.length) {
        return
      }
      if (!isAmapConfigured()) {
        degradeRef.current?.(copyRef.current.notConfigured)
        return
      }
      try {
        const AMap = await loadAmap()
        if (cancelled || !mapRef.current) {
          return
        }

        if (!mapInstance.current) {
          mapInstance.current = new (AMap as AmapObject).Map(mapRef.current, { zoom: 5 }) as AmapMap
          mapInstance.current.addControl(new (AMap as AmapObject).ToolBar() as AmapObject)
        }
        const map = mapInstance.current

        // 换过滤条件后旧点位可能已不在图上，收掉上一轮留的气泡
        setOpened([])
        // 清空旧标记
        markersRef.current.forEach((m) => map.remove(m))
        markersRef.current = []

        points.forEach((p) => {
          const marker = new (AMap as AmapObject).Marker({
            position: [p.lng, p.lat],
            title: p.event,
            content: `<div style="width:14px;height:14px;border-radius:50%;background:#1677ff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            offset: new (AMap as AmapObject).Pixel(-7, -7),
            extData: p,
          }) as AmapMarker
          marker.on('click', () => toggleInfo(p))
          map.add(marker)
          markersRef.current.push(marker)
        })
        // 自适应视野
        if (points.length > 1) {
          map.setFitView(markersRef.current, false, [40, 40, 40, 40])
        } else {
          map.setCenter([points[0].lng, points[0].lat])
          map.setZoom(12)
        }
      } catch (error) {
        console.error('地图初始化失败:', error)
        if (!cancelled) {
          degradeRef.current?.(copyRef.current.loadFailed)
        }
      }
    }
    render()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  /** 卸载时销毁地图实例 */
  useEffect(
    () => () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
        mapInstance.current = null
      }
    },
    [],
  )

  /**
   * 切换某个点的气泡：没开则开（已开的其它点不动），已开则收
   * 用函数式更新，marker 的点击闭包里不会拿到过期的 opened
   * @param p - 足迹点
   */
  const toggleInfo = (p: FootprintPoint) => {
    setOpened((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]))
  }

  /** 收起全部气泡 */
  const closeAll = () => setOpened([])

  /**
   * 点位经纬度 → 容器内像素坐标
   * @param p - 足迹点
   */
  const toPixel = (p: FootprintPoint) => {
    const map = mapInstance.current
    if (!map) {
      return null
    }
    try {
      const px = map.lngLatToContainer([p.lng, p.lat])
      const x = typeof px?.getX === 'function' ? Number(px.getX()) : Number(px?.x)
      const y = typeof px?.getY === 'function' ? Number(px.getY()) : Number(px?.y)
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    } catch (error) {
      console.error('足迹气泡坐标换算失败:', error)
      return null
    }
  }

  /**
   * 把单个气泡按当前地图视野钉到它的点位上
   * 不走 React 重渲染：拖图时每帧 setState 会把整棵子树重推一遍，直接写 DOM 才跟得上
   * @param p - 足迹点
   * @param el - 气泡外层容器
   */
  const placeOne = (p: FootprintPoint, el: HTMLDivElement) => {
    const pos = toPixel(p)
    if (!pos) {
      return
    }
    const left = `${pos.x}px`
    const top = `${pos.y - BUBBLE_GAP}px`
    // 地图没动就不写 style，否则每帧都会制造一次无效的样式失效与重排
    if (el.style.left !== left || el.style.top !== top) {
      el.style.left = left
      el.style.top = top
    }
  }

  /** 重算全部已开气泡的位置 */
  const placeBubbles = () => {
    opened.forEach((p) => {
      const el = bubbleEls.current.get(p.id)
      if (el) {
        placeOne(p, el)
      }
    })
  }

  /**
   * 把气泡容器登记进来，并在插入的同一刻定好位
   * @param id - 日志ID
   * @param el - 气泡外层容器，卸载时为 null
   */
  const setBubbleRef = (id: number, el: HTMLDivElement | null) => {
    if (!el) {
      bubbleEls.current.delete(id)
      return
    }
    bubbleEls.current.set(id, el)
    // ref 回调先于绘制执行，不在这里就位就会在左上角闪一帧
    const p = opened.find((x) => x.id === id)
    if (p) {
      placeOne(p, el)
    }
  }

  /**
   * 只要有气泡开着就逐帧同步位置
   * 不用高德的 mapmove 驱动：手动拖图走的是 dragging/moveend 那一组，mapmove 不保证持续触发，
   * 气泡因此会滞留旧坐标；rAF 轮询与事件名无关，缩放动画/惯性平移/全屏改尺寸都跟得上
   */
  useEffect(() => {
    if (!opened.length) {
      return
    }
    placeBubbles()
    let raf = 0
    const loop = () => {
      placeBubbles()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  /** 进/退全屏 */
  const toggleFullscreen = () => {
    const el = wrapRef.current
    if (!el) {
      return
    }
    if (fsMode === 'native') {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined)
      }
      // 不等 fullscreenchange（个别内核退出时不发事件），直接回到内嵌态
      setFsMode('none')
      return
    }
    if (fsMode === 'css') {
      setFsMode('none')
      return
    }
    // 部分内核（iOS Safari）没有元素级 requestFullscreen，只能走伪全屏
    if (typeof el.requestFullscreen !== 'function') {
      setFsMode('css')
      return
    }
    el.requestFullscreen()
      .then(() => setFsMode('native'))
      // 被权限策略拒掉（如跨域 iframe 内）时退回伪全屏，保证按钮始终有反馈
      .catch(() => setFsMode('css'))
  }

  /** Esc 或浏览器 UI 退出原生全屏时同步状态，否则按钮文案与真实形态错位 */
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setFsMode((mode) => (mode === 'native' ? 'none' : mode))
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  /**
   * 容器尺寸变化后让高德重算画布
   * 用 ResizeObserver 而不是 window resize：进/出全屏时容器变了但窗口可能没变，
   * 漏掉这一次 resize 会让高德按旧视口尺寸换算坐标，气泡整体偏位
   */
  useEffect(() => {
    let raf = 0
    const scheduleResize = () => {
      // 全屏切换带过渡动画，推到下一帧等布局稳定，连续变化也只重算一次
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => mapInstance.current?.resize())
    }
    const el = wrapRef.current
    if (typeof ResizeObserver === 'undefined' || !el) {
      window.addEventListener('resize', scheduleResize)
      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', scheduleResize)
      }
    }
    const ro = new ResizeObserver(scheduleResize)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  /** 全屏切换后等布局落地再重算一次；伪全屏期间锁住页面滚动，避免滚轮缩放地图时把列表也拖走 */
  useEffect(() => {
    if (fsMode === 'none') {
      return
    }
    let prevOverflow = ''
    if (fsMode === 'css') {
      prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const timer = setTimeout(() => {
      const map = mapInstance.current
      if (!map) {
        return
      }
      map.resize()
      // 容器变宽后重新贴合点位，否则横屏下点位会挤在左半边
      if (markersRef.current.length > 1) {
        map.setFitView(markersRef.current, false, [40, 40, 40, 40])
      }
    }, 80)
    return () => {
      clearTimeout(timer)
      if (fsMode === 'css') {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [fsMode])

  const isFs = fsMode !== 'none'
  const wrapStyle: CSSProperties =
    fsMode === 'native'
      ? { position: 'relative', width: '100%', height: '100%', background: '#f5f5f5' }
      : fsMode === 'css'
        ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2000,
            background: '#f5f5f5',
          }
        : { position: 'relative', width: '100%' }

  return (
    <div ref={wrapRef} style={wrapStyle}>
      <div ref={mapRef} className={`w-full ${isFs ? '' : 'rounded-8px'}`} style={{ height: isFs ? '100%' : height, background: '#f5f5f5' }} />
      {/* 右上角操作条：z 高于气泡（气泡从 40 起递增），否则贴到右上角的气泡会盖住按钮；
          不用 antd Tooltip 做提示，原生全屏只渲染该元素子树，Portal 到 body 的浮层会看不见 */}
      <div className='absolute top-2 right-2 z-100 flex items-center gap-1'>
        {opened.length > 0 && (
          <button
            type='button'
            title={t('content.footprintCloseAll')}
            onClick={closeAll}
            className='
              h-28px px-2 flex items-center justify-center
              border-none rounded-6px cursor-pointer
              bg-white text-12px text-gray-600 shadow-0_1px_4px_rgba(0,0,0,0.2)
              hover:text-blue-500
            '
          >
            {t('content.footprintOpenCount', { n: opened.length })}
          </button>
        )}
        <button
          type='button'
          title={isFs ? t('public.exitFullscreen') : t('public.fullScreen')}
          onClick={toggleFullscreen}
          className='
            w-28px h-28px flex items-center justify-center
            border-none rounded-6px cursor-pointer
            bg-white text-15px text-gray-600 shadow-0_1px_4px_rgba(0,0,0,0.2)
            hover:text-blue-500
          '
        >
          {isFs ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </button>
      </div>

      {/* 自己渲染的气泡：底边中心锚定在点位上，后开的压在上层；
          left/top 只给初值 0，真实坐标由上面的 rAF 直接写 DOM（React 比对前后 style 不变就不会覆写） */}
      {opened.map((p, i) => (
        <div
          key={p.id}
          ref={(el) => setBubbleRef(p.id, el)}
          // zIndex 上限 90：不能追过右上角操作条的 z-100
          style={{ position: 'absolute', left: 0, top: 0, zIndex: 40 + Math.min(i, 50), transform: 'translate(-50%, -100%)' }}
        >
          <div style={BUBBLE_STYLE}>
            <button type='button' title={t('public.close')} onClick={() => toggleInfo(p)} style={CLOSE_BTN_STYLE}>
              ×
            </button>
            <div className='text-11px font-bold text-gray-800 truncate pr-14px'>{p.event}</div>
            {p.time && <div className='text-10px text-gray-400'>{p.time}</div>}
            {p.firstThumb ? (
              <img
                src={resolveFileUrl(p.firstThumb)}
                alt=''
                className='block w-full rounded-4px'
                style={{ height: 96, objectFit: 'cover', marginTop: 3 }}
              />
            ) : null}
            <a href={detailHref(p.id)} className='block mt-1 text-10px text-blue-500 no-underline hover:underline'>
              {t('content.footprintViewDetail')}
            </a>
            <div style={TAIL_STYLE} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default FootprintMap
