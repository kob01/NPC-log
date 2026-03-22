import { DatePicker } from 'antd'

import { string2Dayjs } from './utils/helper'

import type { DatePickerProps } from 'antd'

const BasicDatePicker = (props: DatePickerProps) => {
  const { value } = props
  const params = { ...props }

  // 如果值不是dayjs类型则进行转换
  if (value) {
    params.value = string2Dayjs(value)
  }

  return <DatePicker {...params} />
}

export default BasicDatePicker
