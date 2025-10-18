import { Column } from '@ant-design/plots'
import React from 'react'

// 定义数据项类型
interface WaterFallDataItem {
  month: string
  profit?: number
  start: number
  end: number
}

// 定义组件props类型
interface WaterFallProps {
  data: WaterFallDataItem[]
}

const WaterFall: React.FC<WaterFallProps> = ({ data }) => {
  const config = {
    data,
    xField: 'month',
    yField: ['start', 'end'],
    colorField: (d: WaterFallDataItem) => (d.month === 'Total' ? 'Total' : d.profit! > 0 ? 'Increase' : 'Decrease'),
    axis: {
      y: { labelFormatter: '~s' },
    },
    tooltip: {
      items: ['start', 'end'],
    },
  }

  return <Column {...config} />
}

export default WaterFall
