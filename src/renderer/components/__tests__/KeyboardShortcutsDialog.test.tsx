// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import KeyboardShortcutsDialog from '../KeyboardShortcutsDialog'

// Mock the useKeyboardShortcuts module
vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  getAllShortcuts: vi.fn(() => [
    {
      id: 'save-file',
      key: 's',
      modifiers: ['Ctrl'],
      description: 'Save current file',
      handler: () => {},
    },
    {
      id: 'compile-now',
      key: 'b',
      modifiers: ['Ctrl', 'Shift'],
      description: 'Compile code now',
      handler: () => {},
    },
    {
      id: 'toggle-console',
      key: '`',
      modifiers: ['Ctrl'],
      description: 'Toggle console panel',
      handler: () => {},
    },
    {
      id: 'open-project',
      key: 'o',
      modifiers: ['Ctrl'],
      description: 'Open project folder',
      handler: () => {},
    },
  ]),
  formatShortcut: vi.fn((shortcut) => {
    const modifiers = shortcut.modifiers || []
    const parts = [...modifiers, shortcut.key.toUpperCase()]
    return parts.join('+')
  }),
}))

describe('KeyboardShortcutsDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<KeyboardShortcutsDialog {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders dialog when isOpen is true', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    expect(screen.getByTestId('keyboard-shortcuts-dialog')).toBeInTheDocument()
  })

  it('displays dialog title', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
  })

  it('displays all registered shortcuts', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    expect(screen.getByText('Save current file')).toBeInTheDocument()
    expect(screen.getByText('Compile code now')).toBeInTheDocument()
    expect(screen.getByText('Toggle console panel')).toBeInTheDocument()
    expect(screen.getByText('Open project folder')).toBeInTheDocument()
  })

  it('displays formatted keybindings for shortcuts', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Shift+B')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+`')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+O')).toBeInTheDocument()
  })

  it('categorizes shortcuts correctly', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    // Should have category headings
    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.getByText('Build')).toBeInTheDocument()
    expect(screen.getByText('View')).toBeInTheDocument()
  })

  it('calls onClose when Close button is clicked', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    const closeButton = screen.getByTestId('close-shortcuts-dialog')
    fireEvent.click(closeButton)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay is clicked', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    const overlay = screen.getByTestId('keyboard-shortcuts-dialog-overlay')
    fireEvent.click(overlay)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when dialog content is clicked', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    const dialog = screen.getByTestId('keyboard-shortcuts-dialog')
    fireEvent.click(dialog)
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('renders with both light and dark theme classes (dark: prefix system)', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    const dialog = screen.getByTestId('keyboard-shortcuts-dialog')
    expect(dialog.className).toContain('bg-white')
    expect(dialog.className).toContain('text-gray-800')
  })

  it('displays each shortcut with testid', () => {
    render(<KeyboardShortcutsDialog {...defaultProps} />)
    expect(screen.getByTestId('shortcut-save-file')).toBeInTheDocument()
    expect(screen.getByTestId('shortcut-compile-now')).toBeInTheDocument()
    expect(screen.getByTestId('shortcut-toggle-console')).toBeInTheDocument()
    expect(screen.getByTestId('shortcut-open-project')).toBeInTheDocument()
  })
})
