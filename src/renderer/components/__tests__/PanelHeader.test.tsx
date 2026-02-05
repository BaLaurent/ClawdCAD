// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import PanelHeader from '../../components/PanelHeader'

describe('PanelHeader', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render the panel with header and content', () => {
    render(
      <PanelHeader title="Test Panel" testId="panel-test">
        <div data-testid="panel-content">Content</div>
      </PanelHeader>
    )
    expect(screen.getByTestId('panel-test')).toBeInTheDocument()
    expect(screen.getByTestId('panel-header-panel-test')).toBeInTheDocument()
    expect(screen.getByTestId('panel-content')).toBeInTheDocument()
    expect(screen.getByText('Test Panel')).toBeInTheDocument()
  })

  it('should not have draggable attribute on header', () => {
    render(
      <PanelHeader title="Test" testId="panel-nodrag">
        <div>Content</div>
      </PanelHeader>
    )
    const header = screen.getByTestId('panel-header-panel-nodrag')
    expect(header.getAttribute('draggable')).toBeNull()
  })

  it('should render actions when provided', () => {
    render(
      <PanelHeader
        title="With Actions"
        testId="panel-actions"
        actions={<button data-testid="action-btn">Click</button>}
      >
        <div>Content</div>
      </PanelHeader>
    )
    expect(screen.getByTestId('action-btn')).toBeInTheDocument()
  })

  it('should not render actions container when actions prop is not provided', () => {
    render(
      <PanelHeader title="No Actions" testId="panel-no-actions">
        <div>Content</div>
      </PanelHeader>
    )
    // The header should not have an actions wrapper div
    const header = screen.getByTestId('panel-header-panel-no-actions')
    // Only the h2 title should be a direct child
    expect(header.children.length).toBe(1)
  })

  it('should apply custom className', () => {
    render(
      <PanelHeader title="Styled" testId="panel-styled" className="bg-red-500">
        <div>Content</div>
      </PanelHeader>
    )
    const panel = screen.getByTestId('panel-styled')
    expect(panel.className).toContain('bg-red-500')
  })

  it('should apply custom style', () => {
    render(
      <PanelHeader title="Sized" testId="panel-sized" style={{ width: 300 }}>
        <div>Content</div>
      </PanelHeader>
    )
    const panel = screen.getByTestId('panel-sized')
    expect(panel.style.width).toBe('300px')
  })
})
