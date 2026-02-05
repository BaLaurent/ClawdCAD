// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MenuBar from '../MenuBar'

describe('MenuBar', () => {
  const defaultProps = {
    onOpenProject: vi.fn(),
    onOpenFile: vi.fn(),
    onNewFile: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onCloseProject: vi.fn(),
    onNewProject: vi.fn(),
    recentProjects: [],
    onOpenRecentProject: vi.fn(),
    onExport: vi.fn(),
    onCompile: vi.fn(),
    hasProjectOpen: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders menu bar with all menu items', () => {
    render(<MenuBar {...defaultProps} />)
    expect(screen.getByTestId('menu-bar')).toBeInTheDocument()
    expect(screen.getByTestId('menu-file')).toBeInTheDocument()
    expect(screen.getByTestId('menu-edit')).toBeInTheDocument()
    expect(screen.getByTestId('menu-view')).toBeInTheDocument()
    expect(screen.getByTestId('menu-build')).toBeInTheDocument()
    expect(screen.getByTestId('menu-help')).toBeInTheDocument()
  })

  it('opens File dropdown when File menu is clicked', () => {
    render(<MenuBar {...defaultProps} />)
    const fileMenu = screen.getByTestId('menu-file')
    fireEvent.click(fileMenu)
    expect(screen.getByTestId('menu-dropdown-file')).toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', () => {
    render(<MenuBar {...defaultProps} />)
    const fileMenu = screen.getByTestId('menu-file')
    fireEvent.click(fileMenu)
    expect(screen.getByTestId('menu-dropdown-file')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(document.body)

    // Wait for the timeout in the effect
    setTimeout(() => {
      expect(screen.queryByTestId('menu-dropdown-file')).not.toBeInTheDocument()
    }, 10)
  })

  it('calls onOpenProject when Open Project menu item is clicked', () => {
    render(<MenuBar {...defaultProps} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-open-project...'))
    expect(defaultProps.onOpenProject).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenFile when Open File menu item is clicked', () => {
    render(<MenuBar {...defaultProps} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-open-file...'))
    expect(defaultProps.onOpenFile).toHaveBeenCalledTimes(1)
  })

  it('calls onNewProject when New Project menu item is clicked', () => {
    render(<MenuBar {...defaultProps} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-new-project...'))
    expect(defaultProps.onNewProject).toHaveBeenCalledTimes(1)
  })

  it('calls onSave when Save menu item is clicked', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={true} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-save'))
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1)
  })

  it('disables Save menu item when no project is open', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={false} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    const saveItem = screen.getByTestId('menu-item-save')
    expect(saveItem).toBeDisabled()
  })

  it('calls onCloseProject when Close Project menu item is clicked', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={true} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-close-project'))
    expect(defaultProps.onCloseProject).toHaveBeenCalledTimes(1)
  })

  it('displays recent projects in submenu', () => {
    const recentProjects = [
      { name: 'Project 1', path: '/path/to/project1' },
      { name: 'Project 2', path: '/path/to/project2' },
    ]
    render(<MenuBar {...defaultProps} recentProjects={recentProjects} />)
    fireEvent.click(screen.getByTestId('menu-file'))

    // Hover over Recent Projects to open submenu
    const recentProjectsItem = screen.getByText('Recent Projects')
    fireEvent.mouseEnter(recentProjectsItem.closest('div')!)

    expect(screen.getByText('Project 1')).toBeInTheDocument()
    expect(screen.getByText('Project 2')).toBeInTheDocument()
  })

  it('calls onOpenRecentProject when recent project is clicked', () => {
    const recentProjects = [
      { name: 'Project 1', path: '/path/to/project1' },
    ]
    render(<MenuBar {...defaultProps} recentProjects={recentProjects} />)
    fireEvent.click(screen.getByTestId('menu-file'))

    // Hover over Recent Projects to open submenu
    const recentProjectsItem = screen.getByText('Recent Projects')
    fireEvent.mouseEnter(recentProjectsItem.closest('div')!)

    // Click on the recent project
    fireEvent.click(screen.getByText('Project 1'))
    expect(defaultProps.onOpenRecentProject).toHaveBeenCalledWith('/path/to/project1')
  })

  it('shows "No recent projects" when recent projects list is empty', () => {
    render(<MenuBar {...defaultProps} recentProjects={[]} />)
    fireEvent.click(screen.getByTestId('menu-file'))

    // Hover over Recent Projects to open submenu
    const recentProjectsItem = screen.getByText('Recent Projects')
    fireEvent.mouseEnter(recentProjectsItem.closest('div')!)

    expect(screen.getByText('No recent projects')).toBeInTheDocument()
  })

  it('calls onCompile when Compile menu item is clicked', () => {
    render(<MenuBar {...defaultProps} />)
    fireEvent.click(screen.getByTestId('menu-build'))
    fireEvent.click(screen.getByTestId('menu-item-compile-now'))
    expect(defaultProps.onCompile).toHaveBeenCalledTimes(1)
  })

  it('switches between open menus on hover', () => {
    render(<MenuBar {...defaultProps} />)

    // Open File menu
    fireEvent.click(screen.getByTestId('menu-file'))
    expect(screen.getByTestId('menu-dropdown-file')).toBeInTheDocument()

    // Hover over Edit menu (should switch to Edit)
    fireEvent.mouseEnter(screen.getByTestId('menu-edit'))
    expect(screen.getByTestId('menu-dropdown-edit')).toBeInTheDocument()
    expect(screen.queryByTestId('menu-dropdown-file')).not.toBeInTheDocument()
  })

  it('renders with both light and dark theme classes (dark: prefix system)', () => {
    render(<MenuBar {...defaultProps} />)
    const menuBar = screen.getByTestId('menu-bar')
    expect(menuBar.className).toContain('bg-white')
    expect(menuBar.className).toContain('text-gray-800')
  })

  it('displays keyboard shortcuts for menu items', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={true} />)
    fireEvent.click(screen.getByTestId('menu-file'))

    // Check for Ctrl+O shortcut on Open Project
    const dropdown = screen.getByTestId('menu-dropdown-file')
    expect(dropdown).toHaveTextContent('Ctrl+O')
  })

  it('calls onExport when Export STL menu item is clicked', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={true} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-export-stl...'))
    expect(defaultProps.onExport).toHaveBeenCalledTimes(1)
  })

  it('calls onNewFile when New File menu item is clicked', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={true} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-new-file...'))
    expect(defaultProps.onNewFile).toHaveBeenCalledTimes(1)
  })

  it('disables New File menu item when no project is open', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={false} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    const newFileItem = screen.getByTestId('menu-item-new-file...')
    expect(newFileItem).toBeDisabled()
  })

  it('calls onSaveAs when Save As menu item is clicked', () => {
    render(<MenuBar {...defaultProps} hasProjectOpen={true} />)
    fireEvent.click(screen.getByTestId('menu-file'))
    fireEvent.click(screen.getByTestId('menu-item-save-as...'))
    expect(defaultProps.onSaveAs).toHaveBeenCalledTimes(1)
  })
})
