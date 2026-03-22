import { Resizable } from 'react-resizable'

import type { HTMLAttributes, SyntheticEvent } from 'react'
import type { ResizeCallbackData } from 'react-resizable'

/** 自定义拖拽  */
const ResizableTitle = (
  props: HTMLAttributes<unknown> & {
    onResize: (e: SyntheticEvent<Element>, data: ResizeCallbackData) => void
    width: number
  }
) => {
  const { onResize, width, ...restProps } = props

  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className='react-resizable-handle'
          onClick={(e) => {
            e.stopPropagation()
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  )
}

export default ResizableTitle
