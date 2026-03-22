import ApiTreeSelect from '@/components/Selects/ApiTreeSelect'
import { getGames } from '@/servers/platform/game'

import type { TreeSelectProps } from 'antd'

/**
 * @description: 游戏下拉组件
 */
const GameSelect = (props: TreeSelectProps) => (
  <>
    <ApiTreeSelect {...props} multiple api={getGames} fieldNames={{ label: 'name', value: 'id' }} />
  </>
)

export default GameSelect
