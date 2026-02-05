import { useCallback, useRef } from 'react'

interface PanelSeparatorProps {
  /** 'vertical' = left|right panels, 'horizontal' = top|bottom panels */
  direction: 'vertical' | 'horizontal'
  /** Called during drag with pixel offset from start */
  onDrag: (delta: number) => void
  /** Called on double-click to equalize adjacent panels */
  onDoubleClick: () => void
  /** data-testid for testing */
  testId?: string
}

export default function PanelSeparator({
  direction,
  onDrag,
  onDoubleClick,
  testId = 'panel-separator',
}: PanelSeparatorProps) {
  const startPos = useRef(0)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startPos.current = direction === 'vertical' ? e.clientX : e.clientY

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return
        const current = direction === 'vertical' ? moveEvent.clientX : moveEvent.clientY
        const delta = current - startPos.current
        startPos.current = current
        onDrag(delta)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    },
    [direction, onDrag]
  )

  const isVertical = direction === 'vertical'

  return (
    <div
      data-testid={testId}
      className={`${
        isVertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
      } bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 active:bg-blue-400 flex-shrink-0 z-10`}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
    />
  )
}
