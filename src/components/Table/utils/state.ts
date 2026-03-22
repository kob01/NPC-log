import { createContext } from 'react'

import type { TableAction } from './reducer'
import type { Dispatch } from 'react'

interface ScrollContextProps {
  dispatch?: Dispatch<TableAction>
  renderLen: number
  start: number
  offsetStart: number
  rowHeight: number
  totalLen: number
}

export const ScrollContext = createContext<ScrollContextProps>({
  dispatch: undefined,
  renderLen: 1,
  start: 0,
  offsetStart: 0,
  rowHeight: 46,
  totalLen: 0,
})
