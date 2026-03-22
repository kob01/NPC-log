import ApiSelect from '@/components/Selects/ApiSelect'
import { getPartner } from '@/servers/platform/partner'

import type { SelectProps } from 'antd'

/**
 * @description: 合作公司下拉组件
 */
const PartnerSelect = (props: SelectProps) => (
  <ApiSelect
    {...props}
    api={getPartner}
    mode='multiple'
    fieldNames={{ label: 'name', value: 'id' }}
  />
)

export default PartnerSelect
