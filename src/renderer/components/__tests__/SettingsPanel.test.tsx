// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SettingsPanel from '../../components/SettingsPanel'
import { useSettingsStore } from '../../stores/settingsStore'

describe('SettingsPanel', () => {
  const mockOnClose = vi.fn()

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset settings store to defaults
    useSettingsStore.setState({
      preferences: {
        editor: { theme: 'dark', fontSize: 14, tabSize: 4, autoCompile: true, autoCompileDelay: 1500 },
        compiler: { timeout: 30000 },
        agent: { maxIterations: 5, maxTokens: 50000 },
        chat: { maxTokens: 10000 },
        viewer: { backgroundColor: '#1a1a2e', showGrid: true, showAxes: true },
        git: { authorName: 'ClawdCAD User', authorEmail: 'user@ClawdCAD.local' },
        language: 'fr',
        recentProjects: [],
      },
      isLoaded: true,
    })
  })

  it('should not render when isOpen is false', () => {
    render(<SettingsPanel isOpen={false} onClose={mockOnClose} />)
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
  })

  it('should display Settings title', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('should call onClose when close button clicked', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByTestId('settings-close'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show current theme value', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    const themeSelect = screen.getByTestId('settings-theme') as HTMLSelectElement
    expect(themeSelect.value).toBe('dark')
  })

  it('should show current font size', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    expect(screen.getByTestId('settings-fontsize-value').textContent).toBe('14')
  })

  it('should show grid checkbox as checked', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    const gridCheckbox = screen.getByTestId('settings-showgrid') as HTMLInputElement
    expect(gridCheckbox.checked).toBe(true)
  })

  it('should show axes checkbox as checked', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    const axesCheckbox = screen.getByTestId('settings-showaxes') as HTMLInputElement
    expect(axesCheckbox.checked).toBe(true)
  })

  it('should show Agent SDK status as checking initially', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    const status = screen.getByTestId('agent-sdk-status')
    expect(status).toBeInTheDocument()
    expect(status.textContent).toContain('Checking')
  })

  it('should show agent max iterations input with store value', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    const input = screen.getByTestId('settings-agent-max-iterations') as HTMLInputElement
    expect(input.value).toBe('5')
  })

  it('should show chat max tokens input with store value', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    const input = screen.getByTestId('settings-chat-max-tokens') as HTMLInputElement
    expect(input.value).toBe('10000')
  })

  it('should show language selector with fr selected', () => {
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    const langSelect = screen.getByTestId('settings-language') as HTMLSelectElement
    expect(langSelect.value).toBe('fr')
  })

  it('should call saveToElectron and onClose when Save clicked', async () => {
    vi.spyOn(useSettingsStore.getState(), 'saveToElectron').mockResolvedValue()
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByTestId('settings-save'))
    // saveToElectron is async, so wait a tick
    await vi.waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('should show Connected when testAgentSdk resolves true', async () => {
    window.electronAPI.ai.testAgentSdk = vi.fn().mockResolvedValue(true)
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    await vi.waitFor(() => {
      const status = screen.getByTestId('agent-sdk-status')
      expect(status.textContent).toContain('Connected')
    })
  })

  it('should show Not Available when testAgentSdk resolves false', async () => {
    window.electronAPI.ai.testAgentSdk = vi.fn().mockResolvedValue(false)
    render(<SettingsPanel isOpen={true} onClose={mockOnClose} />)
    await vi.waitFor(() => {
      const status = screen.getByTestId('agent-sdk-status')
      expect(status.textContent).toContain('Not Available')
    })
  })
})
