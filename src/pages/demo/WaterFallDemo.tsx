import React, { useState, useEffect } from 'react'
import { Button, Tooltip, message } from 'antd'
import BasicContent from '@/components/Content/BasicContent'
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

// 瀑布图组件 - 使用SVG和div实现
const WaterFallChart: React.FC<{ 
  data: ResourceDataItem[]; 
  sortMode: SortMode; 
  formatTime: (milliseconds: number) => string 
}> = ({ data, sortMode, formatTime }) => {
  const [maxTime, setMaxTime] = useState(0)
  const [minTime, setMinTime] = useState(0)
  const [hoveredItem, setHoveredItem] = useState<ResourceDataItem | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const rowHeight = 30
  const paddingTop = 50 // 顶部空间用于时间刻度
  const nameColumnWidth = 200 // 资源名称列宽度
  const durationColumnWidth = 100 // 持续时长列宽度
  const paddingLeft = 20 // 左侧边距
  const paddingRight = 50
  const chartWidth = 1200
  const durationColumnX = paddingLeft + nameColumnWidth // 持续时长列X坐标
  const timeColumnX = durationColumnX + durationColumnWidth // 时间轴X坐标

  useEffect(() => {
    if (data.length > 0) {
      const startTimes = data.map((item) => item.startTime)
      const endTimes = data.map((item) => item.endTime)
      setMinTime(Math.min(...startTimes))
      setMaxTime(Math.max(...endTimes))
    }
  }, [data])

  // 计算图表高度
  const chartHeight = Math.max(150, data.length * rowHeight + paddingTop + 20)
  const usableWidth = chartWidth - timeColumnX - paddingRight

  // 时间转换为X坐标
  const timeToX = (time: number): number => {
    if (maxTime === minTime) return timeColumnX
    return timeColumnX + ((time - minTime) / (maxTime - minTime)) * usableWidth
  }

  // 生成时间刻度（移到顶部）
  const generateTimeTicks = () => {
    const ticks = []
    // 确定合适的刻度间隔，使其成为1000的倍数或100的倍数
    let step = Math.ceil((maxTime - minTime) / 6)
    // 调整step为更易读的数字
    if (step > 1000) {
      step = Math.ceil(step / 1000) * 1000
    } else if (step > 100) {
      step = Math.ceil(step / 100) * 100
    }

    const startTick = Math.floor(minTime / step) * step
    const endTick = Math.ceil(maxTime / step) * step

    for (let time = startTick; time <= endTick; time += step) {
      const x = timeToX(time)
      ticks.push(
        <g key={time}>
          <line x1={x} y1={paddingTop} x2={x} y2={chartHeight - 20} stroke='#e8e8e8' strokeWidth='1' strokeDasharray='2,2' />
          <text x={x} y={paddingTop - 10} textAnchor='middle' fill='#666' fontSize='12'>
            {formatTime(time)}
          </text>
        </g>,
      )
    }

    return ticks
  }

  // 处理鼠标悬浮事件
  const handleMouseEnter = (item: ResourceDataItem, event: React.MouseEvent) => {
    const svgRect = event.currentTarget.getBoundingClientRect()
    const svgContainer = event.currentTarget.closest('div')
    if (svgContainer) {
      const containerRect = svgContainer.getBoundingClientRect()
      setTooltipPosition({
        x: event.clientX - containerRect.left + 10,
        y: event.clientY - containerRect.top - 10
      })
      setHoveredItem(item)
    }
  }

  const handleMouseLeave = () => {
    setHoveredItem(null)
  }

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <svg 
        width={Math.max(chartWidth, usableWidth + paddingLeft + paddingRight)} 
        height={chartHeight} 
        style={{ border: '1px solid #f0f0f0' }}
      >
        {/* 水平轴 - 移到时间刻度下方 */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={chartWidth - paddingRight}
          y2={paddingTop}
          stroke="#333"
          strokeWidth="1"
        />
        
        {/* 列标题 */}
          <text x={paddingLeft} y={paddingTop - 10} textAnchor="start" fill="#666" fontSize="12" fontWeight="bold">
            资源名称
          </text>
          <text 
            x={durationColumnX} 
            y={paddingTop - 10} 
            textAnchor="start" 
            fill="#666" 
            fontSize="12" 
            fontWeight="bold"
            style={{ pointerEvents: 'auto', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={(e) => {
              e.stopPropagation();
              const event = new CustomEvent('sortDurationHeader');
              window.dispatchEvent(event);
            }}
          >
            持续时长
          </text>
        
        {/* 列分隔线 */}
        <line x1={durationColumnX} y1={paddingTop} x2={durationColumnX} y2={chartHeight - 20} stroke="#e8e8e8" strokeWidth="1" />
        <line x1={timeColumnX} y1={paddingTop} x2={timeColumnX} y2={chartHeight - 20} stroke="#e8e8e8" strokeWidth="1" />

        {/* 垂直网格线和时间刻度（顶部） */}
        {data.length > 0 && generateTimeTicks()}

        {/* 资源条和名称 */}
        {data.map((item, index) => {
          const startX = timeToX(item.startTime)
          const endX = timeToX(item.endTime)
          const barWidth = Math.max(endX - startX, 2) // 最小宽度2px
          const y = paddingTop + index * rowHeight + 10

          return (
            <g 
              key={item.key}
              onMouseEnter={(e) => handleMouseEnter(item, e)}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: 'pointer' }}
            >
              {/* 左侧资源名称 - 左对齐 */}
              <text 
                x={paddingLeft} 
                y={y + rowHeight / 2 - 2} 
                textAnchor="start" 
                fill="#333" 
                fontSize="12"
                style={{ pointerEvents: 'none' }}
              >
                <tspan x={paddingLeft}>{item.name}</tspan>
              </text>
              
              {/* 持续时长列 */}
              <text 
                x={durationColumnX} 
                y={y + rowHeight / 2 - 2} 
                textAnchor="start" 
                fill="#666" 
                fontSize="12"
                style={{ pointerEvents: 'none' }}
              >
                {formatTime(item.duration)}
              </text>

              {/* 开始时间点的竖线 */}
              <line
                x1={startX}
                y1={y}
                x2={startX}
                y2={y + rowHeight - 8}
                stroke="#1890ff"
                strokeWidth="1"
              />

              {/* 资源条 */}
              <rect
                x={startX}
                y={y}
                width={barWidth}
                height={rowHeight - 8}
                fill="#1890ff"
                opacity="0.8"
              />

              {/* 结束时间点的竖线 */}
              <line
                x1={endX}
                y1={y}
                x2={endX}
                y2={y + rowHeight - 8}
                stroke="#1890ff"
                strokeWidth="1"
              />

              {/* 移除资源条中间的持续时间文本，避免重复显示 */}
            </g>
          )
        })}
      </svg>

      {/* Ant Design Tooltip 替代原生 title */}
      {hoveredItem && (
        <div 
          style={{
            position: 'absolute',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 1000,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <div><strong>资源名称:</strong> {hoveredItem.name}</div>
          <div><strong>持续时间:</strong> {formatTime(hoveredItem.duration)}</div>
          <div><strong>开始时间:</strong> {formatTime(hoveredItem.startTime)}</div>
          <div><strong>结束时间:</strong> {formatTime(hoveredItem.endTime)}</div>
        </div>
      )}
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
    'images/user-avatar.png - 用户头像',
    'fonts/roboto.woff2 - Roboto字体',
  ]

  return resources
    .map((name, index) => {
      // 生成更合理的时间数据，更接近真实的加载场景
      const baseTime = index * 80 // 基础时间递增
      const randomOffset = Math.floor(Math.random() * 100) // 随机偏移
      const startTime = baseTime + randomOffset
      const duration = Math.floor(Math.random() * 400) + 100 // 随机持续时间，100-500ms
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

/**
 * 瀑布图演示页面
 * 展示静态资源加载时机和持续时长的瀑布图
 */
const WaterFallDemo = () => {
  const [messageApi] = message.useMessage()
  const [resourceData, setResourceData] = useState<ResourceDataItem[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('default')

  /**
   * 格式化时间显示，支持毫秒、秒、分钟
   */
  const formatTime = (milliseconds: number): string => {
    if (milliseconds >= 60000) {
      // 大于等于1分钟，显示为分钟
      return `${(milliseconds / 60000).toFixed(2)}min`;
    } else if (milliseconds >= 1000) {
      // 大于等于1秒，显示为秒
      return `${(milliseconds / 1000).toFixed(2)}s`;
    } else {
      // 小于1秒，显示为毫秒
      return `${milliseconds}ms`;
    }
  }

  /**
   * 处理持续时长列头点击，循环切换三种排序模式
   */
  const handleDurationHeaderClick = () => {
    // 循环切换排序模式：default -> durationAsc -> durationDesc -> default
    const newSortMode = sortMode === 'default' ? 'durationAsc' : 
                       sortMode === 'durationAsc' ? 'durationDesc' : 'default';
    
    setSortMode(newSortMode);
    
    let sortedData = [...resourceData];
    
    switch (newSortMode) {
      case 'durationAsc':
        // 按持续时长升序
        sortedData.sort((a, b) => a.duration - b.duration);
        break;
      case 'durationDesc':
        // 按持续时长降序
        sortedData.sort((a, b) => b.duration - a.duration);
        break;
      case 'default':
      default:
        // 默认按开始时间升序
        sortedData.sort((a, b) => a.startTime - b.startTime);
        break;
    }
    
    setResourceData(sortedData);
  }

  /**
   * 加载资源加载数据
   */
  const loadResourceData = () => {
    const data = generateResourceData()
    setResourceData([...data])
    setSortMode('default') // 重置为默认排序模式
  }

  // 监听持续时长列头的点击事件
  useEffect(() => {
    const handleSortDurationHeader = () => {
      handleDurationHeaderClick();
    };
    
    window.addEventListener('sortDurationHeader', handleSortDurationHeader as EventListener);
    
    return () => {
      window.removeEventListener('sortDurationHeader', handleSortDurationHeader as EventListener);
    };
  }, [sortMode, resourceData])

  // 渲染排序按钮
  const renderSortButtons = () => (
    <div className="sort-buttons">
      <Button 
        size="small" 
        onClick={() => setSortMode('default')}
        className={sortMode === 'default' ? 'active-sort' : ''}
      >
        重置默认排序
      </Button>
    </div>
  )

  return (
    <BasicContent>
      <div className='waterfall-demo-container'>
        <h2 className='waterfall-demo-title'>资源加载瀑布图演示</h2>

        <div className='waterfall-demo-header'>
        <Button type='primary' size='large' onClick={loadResourceData}>
          生成资源加载数据
        </Button>
        {resourceData.length > 0 && renderSortButtons()}
      </div>

        {resourceData.length > 0 ? (
          <div className='waterfall-demo-content'>
            {/* 合并表格和图表为一个视图 */}
            <div className='waterfall-combined-view'>
              <h3 className='waterfall-section-title'>资源加载时序与信息</h3>
              <WaterFallChart data={resourceData} sortMode={sortMode} formatTime={formatTime} />
            </div>
          </div>
        ) : (
          <div className='waterfall-empty-state'>
            <p className='waterfall-empty-text'>请点击上方按钮生成数据</p>
          </div>
        )}
      </div>
    </BasicContent>
  )
}

export default WaterFallDemo
