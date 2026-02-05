// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AboutDialog from '../AboutDialog'

describe('AboutDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    appVersion: '0.1.0',
    openscadVersion: '2021.01',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AboutDialog {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders dialog when isOpen is true', () => {
    render(<AboutDialog {...defaultProps} />)
    expect(screen.getByTestId('about-dialog')).toBeInTheDocument()
  })

  it('displays dialog title', () => {
    render(<AboutDialog {...defaultProps} />)
    expect(screen.getByText('About ClawdCAD')).toBeInTheDocument()
  })

  it('displays ClawdCAD logo/title', () => {
    render(<AboutDialog {...defaultProps} />)
    // Should have a large ClawdCAD title
    const title = screen.getAllByText('ClawdCAD')
    expect(title.length).toBeGreaterThan(0)
  })

  it('displays app version', () => {
    render(<AboutDialog {...defaultProps} />)
    expect(screen.getByTestId('app-version')).toHaveTextContent('0.1.0')
  })

  it('displays OpenSCAD version when provided', () => {
    render(<AboutDialog {...defaultProps} />)
    expect(screen.getByTestId('openscad-version')).toHaveTextContent('2021.01')
  })

  it('does not display OpenSCAD version when not provided', () => {
    render(<AboutDialog {...defaultProps} openscadVersion={undefined} />)
    expect(screen.queryByTestId('openscad-version')).not.toBeInTheDocument()
  })

  it('displays Electron version from process.versions', () => {
    render(<AboutDialog {...defaultProps} />)
    // process.versions.electron should be available in the test environment
    const electronVersionText = screen.getByText(/Electron:/)
    expect(electronVersionText).toBeInTheDocument()
  })

  it('displays Node.js version from process.versions', () => {
    render(<AboutDialog {...defaultProps} />)
    const nodeVersionText = screen.getByText(/Node.js:/)
    expect(nodeVersionText).toBeInTheDocument()
  })

  it('displays Chrome version from process.versions', () => {
    render(<AboutDialog {...defaultProps} />)
    const chromeVersionText = screen.getByText(/Chrome:/)
    expect(chromeVersionText).toBeInTheDocument()
  })

  it('displays MIT license information', () => {
    render(<AboutDialog {...defaultProps} />)
    expect(screen.getByText('MIT License')).toBeInTheDocument()
    expect(screen.getByText(/Copyright © 2024 ClawdCAD Team/)).toBeInTheDocument()
  })

  it('displays application description', () => {
    render(<AboutDialog {...defaultProps} />)
    expect(screen.getByText(/all-in-one desktop application/i)).toBeInTheDocument()
  })

  it('calls onClose when Close button is clicked', () => {
    render(<AboutDialog {...defaultProps} />)
    const closeButton = screen.getByTestId('close-about-dialog')
    fireEvent.click(closeButton)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay is clicked', () => {
    render(<AboutDialog {...defaultProps} />)
    const overlay = screen.getByTestId('about-dialog-overlay')
    fireEvent.click(overlay)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when dialog content is clicked', () => {
    render(<AboutDialog {...defaultProps} />)
    const dialog = screen.getByTestId('about-dialog')
    fireEvent.click(dialog)
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('renders with both light and dark theme classes (dark: prefix system)', () => {
    render(<AboutDialog {...defaultProps} />)
    const dialog = screen.getByTestId('about-dialog')
    expect(dialog.className).toContain('bg-white')
    expect(dialog.className).toContain('text-gray-800')
  })

  it('displays links for GitHub, Documentation, and Report Issue', () => {
    render(<AboutDialog {...defaultProps} />)
    expect(screen.getByText('GitHub Repository')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText('Report Issue')).toBeInTheDocument()
  })
})
