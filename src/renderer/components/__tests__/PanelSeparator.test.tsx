// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PanelSeparator from '../PanelSeparator'

describe('PanelSeparator', () => {
  afterEach(() => {
    cleanup()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  it('renders with vertical direction and col-resize cursor', () => {
    render(
      <PanelSeparator
        direction="vertical"
        onDrag={vi.fn()}
        onDoubleClick={vi.fn()}
        testId="vert-sep"
      />
    )
    const sep = screen.getByTestId('vert-sep')
    expect(sep).toBeInTheDocument()
    expect(sep.className).toContain('cursor-col-resize')
    expect(sep.className).toContain('w-1')
  })

  it('renders with horizontal direction and row-resize cursor', () => {
    render(
      <PanelSeparator
        direction="horizontal"
        onDrag={vi.fn()}
        onDoubleClick={vi.fn()}
        testId="horiz-sep"
      />
    )
    const sep = screen.getByTestId('horiz-sep')
    expect(sep).toBeInTheDocument()
    expect(sep.className).toContain('cursor-row-resize')
    expect(sep.className).toContain('h-1')
  })

  it('calls onDrag with delta on mouse move', () => {
    const onDrag = vi.fn()
    render(
      <PanelSeparator
        direction="vertical"
        onDrag={onDrag}
        onDoubleClick={vi.fn()}
        testId="drag-sep"
      />
    )
    const sep = screen.getByTestId('drag-sep')

    // Start drag at x=100
    fireEvent.mouseDown(sep, { clientX: 100, clientY: 0 })

    // Move to x=150 → delta = +50
    fireEvent.mouseMove(document, { clientX: 150, clientY: 0 })
    expect(onDrag).toHaveBeenCalledWith(50)

    // Move to x=130 → delta = -20 from last position (150)
    fireEvent.mouseMove(document, { clientX: 130, clientY: 0 })
    expect(onDrag).toHaveBeenCalledWith(-20)
    expect(onDrag).toHaveBeenCalledTimes(2)

    fireEvent.mouseUp(document)
  })

  it('calls onDrag with delta on horizontal mouse move', () => {
    const onDrag = vi.fn()
    render(
      <PanelSeparator
        direction="horizontal"
        onDrag={onDrag}
        onDoubleClick={vi.fn()}
        testId="hdrag-sep"
      />
    )
    const sep = screen.getByTestId('hdrag-sep')

    // Start drag at y=200
    fireEvent.mouseDown(sep, { clientX: 0, clientY: 200 })

    // Move to y=260 → delta = +60
    fireEvent.mouseMove(document, { clientX: 0, clientY: 260 })
    expect(onDrag).toHaveBeenCalledWith(60)

    fireEvent.mouseUp(document)
  })

  it('calls onDoubleClick handler', () => {
    const onDoubleClick = vi.fn()
    render(
      <PanelSeparator
        direction="vertical"
        onDrag={vi.fn()}
        onDoubleClick={onDoubleClick}
        testId="dbl-sep"
      />
    )
    fireEvent.doubleClick(screen.getByTestId('dbl-sep'))
    expect(onDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('uses custom testId', () => {
    render(
      <PanelSeparator
        direction="vertical"
        onDrag={vi.fn()}
        onDoubleClick={vi.fn()}
        testId="my-custom-id"
      />
    )
    expect(screen.getByTestId('my-custom-id')).toBeInTheDocument()
  })

  it('uses default testId when none provided', () => {
    render(
      <PanelSeparator
        direction="vertical"
        onDrag={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    )
    expect(screen.getByTestId('panel-separator')).toBeInTheDocument()
  })

  it('cleans up event listeners on mouse up', () => {
    const onDrag = vi.fn()
    render(
      <PanelSeparator
        direction="vertical"
        onDrag={onDrag}
        onDoubleClick={vi.fn()}
        testId="cleanup-sep"
      />
    )
    const sep = screen.getByTestId('cleanup-sep')

    // Start drag
    fireEvent.mouseDown(sep, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(document, { clientX: 120, clientY: 0 })
    expect(onDrag).toHaveBeenCalledTimes(1)

    // Release mouse
    fireEvent.mouseUp(document)

    // Body style should be restored
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')

    // Further mouse moves must NOT trigger onDrag
    onDrag.mockClear()
    fireEvent.mouseMove(document, { clientX: 200, clientY: 0 })
    fireEvent.mouseMove(document, { clientX: 300, clientY: 0 })
    expect(onDrag).not.toHaveBeenCalled()
  })

  it('sets body cursor and userSelect during drag', () => {
    render(
      <PanelSeparator
        direction="vertical"
        onDrag={vi.fn()}
        onDoubleClick={vi.fn()}
        testId="style-sep"
      />
    )
    fireEvent.mouseDown(screen.getByTestId('style-sep'), { clientX: 0, clientY: 0 })
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')
    fireEvent.mouseUp(document)
  })

  it('sets row-resize cursor during horizontal drag', () => {
    render(
      <PanelSeparator
        direction="horizontal"
        onDrag={vi.fn()}
        onDoubleClick={vi.fn()}
        testId="hstyle-sep"
      />
    )
    fireEvent.mouseDown(screen.getByTestId('hstyle-sep'), { clientX: 0, clientY: 0 })
    expect(document.body.style.cursor).toBe('row-resize')
    fireEvent.mouseUp(document)
  })
})
