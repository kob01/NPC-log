import { DatePicker } from 'antd'

import { stringRang2DayjsRang } from './utils/helper'

import type { RangePickerProps } from 'antd/es/date-picker'

const { RangePicker } = DatePicker

const BasicRangePicker = (props: RangePickerProps) => {
  const { value } = props
  const params = { ...props }

  // 如果值不是dayjs类型则进行转换
  if (value) {
    params.value = stringRang2DayjsRang(value)
  }

  return <RangePicker {...params} />
}

export default BasicRangePicker
