import React, { useState, useEffect, useRef } from 'react'
import { Button, Tooltip } from 'antd'
import './WaterFallDemo.less'

// 定义资源加载数据类型
interface ResourceDataItem {
  name: string
  startTime: number
  endTime: number
  duration: number
  key: string
}

// 排序模式类型
type SortMode = 'default' | 'durationAsc' | 'durationDesc'

// 瀑布图组件 - 使用div实现，采用flex布局
const WaterFallChart: React.FC<{
  data: ResourceDataItem[]
  formatTime: (milliseconds: number) => string
}> = ({ data, formatTime }) => {
  const [maxTime, setMaxTime] = useState(0)
  const [minTime, setMinTime] = useState(0)
  const [hoveredItem, setHoveredItem] = useState<ResourceDataItem | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('default')
  const containerRef = useRef<HTMLDivElement>(null)
  const timeRangeRef = useRef<HTMLDivElement>(null)

  const rowHeight = 30
  const paddingTop = 36 // 顶部空间用于时间刻度
  const nameColumnWidth = 200 // 资源名称列宽度
  const durationColumnWidth = 100 // 持续时长列宽度
  const paddingLeft = 20 // 左侧边距
  const paddingRight = 50

  useEffect(() => {
    if (data.length > 0) {
      const startTimes = data.map((item) => item.startTime)
      const endTimes = data.map((item) => item.endTime)
      setMinTime(Math.min(...startTimes))
      setMaxTime(Math.max(...endTimes))
    } else {
      setMinTime(0)
      setMaxTime(1000)
    }
  }, [data])

  // 处理排序模式变化
  const handleSortChange = () => {
    const newSortMode = sortMode === 'default' ? 'durationAsc' : sortMode === 'durationAsc' ? 'durationDesc' : 'default'
    setSortMode(newSortMode)
  }

  // 根据排序模式对数据进行排序
  const getSortedData = () => {
    if (sortMode === 'default') {
      return data
    } else if (sortMode === 'durationAsc') {
      return [...data].sort((a, b) => a.duration - b.duration)
    } else if (sortMode === 'durationDesc') {
      return [...data].sort((a, b) => b.duration - a.duration)
    }
    return data
  }

  const sortedData = getSortedData()

  // 计算图表高度
  const chartHeight = Math.max(150, data.length * rowHeight + paddingTop + 20)

  // 基于时间区间区域的实际宽度计算可用宽度
  const usableWidth = () => {
    if (!timeRangeRef.current) return 800 // 默认值
    return timeRangeRef.current.clientWidth - paddingRight
  }

  const timeToX = (time: number): number => {
    if (maxTime === minTime) return 0 // 相对于时间区间区域的左侧边缘
    console.log('time', time)
    console.log('minTime', minTime)
    console.log('maxTime', maxTime)
    if (time - minTime < 0) return 0 // 时间小于最小时间时，返回0{

    return ((time - minTime) / (maxTime - minTime)) * usableWidth()
  }

  const generateTimeTicks = () => {
    const ticks = []
    // 确定合适的刻度间隔，使其成为1000的倍数或100的倍数
    let step = Math.ceil((maxTime - minTime) / 8)
    // 调整step为更易读的数字
    if (step > 1000) {
      step = Math.ceil(step / 1000) * 1000
    } else if (step > 100) {
      step = Math.ceil(step / 100) * 100
    }

    // 优化时间轴范围计算，解决间隔过大问题
    const startTick = Math.floor(minTime / step) * step

    // 计算扩展因子：根据数据范围动态调整
    const dataRange = maxTime - minTime
    let extensionFactor = 0.1 // 默认扩展10%

    // 当数据范围较大时，减少扩展比例；数据范围较小时，适当增加扩展比例
    if (dataRange > 5000) {
      extensionFactor = 0.05 // 大范围数据扩展5%
    } else if (dataRange < 1000) {
      extensionFactor = 0.15 // 小范围数据扩展15%
    }

    // 计算结束刻度，确保至少有一个完整的step间隔
    const endTick = Math.max(Math.ceil(maxTime / step) * step, maxTime + step * extensionFactor)

    // 确保时间轴不会太短
    const minimumEndTick = startTick + step * 3
    const finalEndTick = Math.max(endTick, minimumEndTick)

    for (let time = startTick; time <= finalEndTick; time += step) {
      const x = timeToX(time)
      ticks.push(
        <div
          key={time}
          style={{
            position: 'absolute',
            left: x,
            top: paddingTop - 35,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            zIndex: 9,
          }}
        >
          {formatTime(time)}
        </div>,
      )
    }

    return ticks
  }

  // 计算资源条的位置和尺寸
  const getResourceBarStyle = (item: ResourceDataItem, index: number) => {
    const startX = timeToX(item.startTime)
    const endX = timeToX(item.endTime)
    const barWidth = Math.max(endX - startX, 5) // 最小宽度5px
    const y = paddingTop + index * rowHeight + 10

    // 统一使用蓝色
    const backgroundColor = '#1890ff'

    return {
      position: 'absolute',
      left: startX,
      top: y,
      width: barWidth,
      height: rowHeight - 8,
      backgroundColor,
      borderRadius: '4px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
      opacity: hoveredItem?.key !== item.key ? 1 : 0.8,
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        overflowX: 'auto',
        height: chartHeight,
        display: 'flex',
      }}
    >
      <div
        style={{
          width: nameColumnWidth + paddingLeft,
          height: chartHeight,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {/* 资源名称列标题 */}
        <div
          style={{
            position: 'absolute',
            left: paddingLeft,
            top: 0,
            width: nameColumnWidth,
            height: paddingTop,
            backgroundColor: '#f0f5ff',
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: paddingLeft,
            top: 0,
            width: nameColumnWidth,
            height: paddingTop,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
          }}
        >
          <span
            style={{
              color: '#262626',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            资源名称
          </span>
        </div>
        {/* 资源名称列表 */}
        {sortedData.map((item, index) => {
          const y = paddingTop + index * rowHeight + 10
          return (
            <div key={`name-${item.key}`}>
              {/* 左侧资源名称 - 左对齐，添加文本超长截断和Tooltip */}
              <Tooltip title={item.name} placement='right' mouseEnterDelay={0.1} mouseLeaveDelay={0.1}>
                <div
                  style={{
                    position: 'absolute',
                    left: paddingLeft,
                    top: y,
                    color: '#262626',
                    fontSize: '12px',
                    transform: 'translateY(-50%)',
                    width: nameColumnWidth - 10,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    zIndex: 1,
                  }}
                >
                  {item.name}
                </div>
              </Tooltip>
            </div>
          )
        })}
      </div>

      {/* 持续时长列 */}
      <div
        style={{
          width: durationColumnWidth,
          height: chartHeight,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: durationColumnWidth,
            height: paddingTop,
            backgroundColor: '#f0f5ff',
            zIndex: 2,
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: durationColumnWidth,
            height: paddingTop,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 3,
          }}
          onClick={handleSortChange}
        >
          <span
            style={{
              color: '#262626',
              fontSize: '13px',
              fontWeight: '600',
              marginRight: '4px',
            }}
          >
            持续时长
          </span>
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: sortMode === 'durationDesc' ? 'none' : '8px solid #1890ff',
              borderBottom: sortMode === 'durationDesc' ? '8px solid #1890ff' : 'none',
              opacity: sortMode === 'default' ? 0.3 : 1,
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            top: paddingTop,
            width: 1,
            height: chartHeight - paddingTop,
            backgroundColor: '#d9d9d9',
          }}
        />
        {/* 持续时长列表 */}
        {sortedData.map((item, index) => {
          const y = paddingTop + index * rowHeight + 10
          return (
            <div key={`duration-${item.key}`}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: y + rowHeight / 2 - 2,
                  color: '#1890ff',
                  fontSize: '12px',
                  fontWeight: '500',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  zIndex: 1,
                  textAlign: 'center',
                  width: durationColumnWidth,
                }}
              >
                {formatTime(item.duration)}
              </div>
            </div>
          )
        })}
      </div>

      {/* 时间区间区域 - 自适应宽度 */}
      <div
        ref={timeRangeRef}
        style={{
          flexGrow: 1,
          height: chartHeight,
          minWidth: 800, // 最小宽度确保图表可读性
          position: 'relative',
        }}
      >
        {/* 垂直网格线和时间刻度（顶部） */}
        {data.length > 0 && generateTimeTicks()}
        {/* 资源条和名称 */}
        {sortedData.map((item, index) => {
          return (
            <div key={item.key}>
              <Tooltip
                title={
                  <div>
                    <div>
                      <strong>资源名称:</strong> {item.name}
                    </div>
                    <div>
                      <strong>持续时间:</strong> {formatTime(item.duration)}
                    </div>
                    <div>
                      <strong>开始时间:</strong> {formatTime(item.startTime)}
                    </div>
                    <div>
                      <strong>结束时间:</strong> {formatTime(item.endTime)}
                    </div>
                  </div>
                }
                overlayInnerStyle={{ textAlign: 'left' }}
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
              >
                <div style={getResourceBarStyle(item, index)} onMouseEnter={() => setHoveredItem(item)} onMouseLeave={() => setHoveredItem(null)} />
              </Tooltip>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 生成模拟的资源加载数据
const generateResourceData = (): ResourceDataItem[] => {
  const resources = [
    'main.js - 主入口脚本',
    'vendors.js - 第三方库打包文件',
    'app.css - 应用样式文件',
    'logo.svg - 网站Logo',
    'background.jpg - 背景图片',
    'icon-font.ttf - 图标字体',
    'manifest.json - 应用清单',
    'service-worker.js - 服务工作线程',
    'analytics.js - 统计分析脚本',
    'config.json - 配置文件',
    'index.html - 入口HTML文件',
    'polyfills.js - 兼容性补丁',
    'chunk-01.js - 代码分割块',
    'chunk-02.js - 代码分割块',
    'chunk-03.js - 代码分割块',
    'lazy-module.js - 懒加载模块',
    'data.json - 初始数据文件',
    'i18n/en.json - 英文语言包',
    'images/user-user-user-avatar.png - 用户头像',
    'fonts/roboto.woff2 - Roboto字体',
  ]

  return resources
    .map((name, index) => {
      const baseTime = index * 80 // 基础时间递增
      const randomOffset = Math.floor(Math.random() * 100) // 随机偏移
      const startTime = baseTime + randomOffset

      // 添加一些超长加载时长的测试数据
      let duration: number
      if (index === 2) {
        duration = 900 + Math.floor(Math.random() * 200) // 2-2.5小时
      } else if (index === 5) {
        duration = 300 + Math.floor(Math.random() * 60) // 30-40分钟
      } else if (index === 8) {
        duration = 100 + Math.floor(Math.random() * 30) // 10-15分钟
      } else {
        duration = Math.floor(Math.random() * 400) + 100 // 随机持续时间，100-500ms
      }

      const endTime = startTime + duration

      return {
        name,
        startTime,
        endTime,
        duration,
        key: `resource-${index}`,
      }
    })
    .sort((a, b) => a.startTime - b.startTime) // 默认按开始时间升序
}

const WaterFallDemo = () => {
  const [resourceData, setResourceData] = useState<ResourceDataItem[]>([])

  const formatTime = (milliseconds: number): string => {
    if (milliseconds >= 3600000) {
      return `${(milliseconds / 3600000).toFixed(2)}h`
    } else if (milliseconds >= 60000) {
      return `${(milliseconds / 60000).toFixed(2)}min`
    } else if (milliseconds >= 1000) {
      return `${(milliseconds / 1000).toFixed(2)}s`
    } else {
      return `${milliseconds}ms`
    }
  }

  const loadResourceData = () => {
    const data = generateResourceData()
    setResourceData([...data])
  }

  return (
    <>
      <Button type='primary' size='large' onClick={loadResourceData}>
        生成资源加载数据
      </Button>

      <WaterFallChart data={resourceData} formatTime={formatTime} />
    </>
  )
}

export default WaterFallDemo
