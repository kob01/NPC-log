import { Transfer } from 'antd'
import { useState } from 'react'

import type { TransferProps } from 'antd'
import type { TransferItem } from 'antd/es/transfer'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

const BasicTransfer = (props: Props) => {
  const { value } = props
  const [targetKeys, setTargetKeys] = useState(value || [])

  /**
   * 更改数据
   * @param targetKeys - 显示在右侧框数据的key集合
   */
  const onChange: TransferProps<TransferItem>['onChange'] = (targetKeys) => {
    setTargetKeys(targetKeys as string[])
    props?.onChange?.(targetKeys as string[])
  }

  return <Transfer {...props} targetKeys={targetKeys} onChange={onChange} />
}

export default BasicTransfer
