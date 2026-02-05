// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import WelcomeScreen from '../../components/WelcomeScreen'
import { useSettingsStore } from '../../stores/settingsStore'

describe('WelcomeScreen', () => {
  const mockOnNewProject = vi.fn()
  const mockOnOpenFolder = vi.fn()
  const mockOnOpenFile = vi.fn()
  const mockOnOpenRecentProject = vi.fn()
  const mockOnRemoveRecentProject = vi.fn()

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset settings store to dark theme defaults
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

  const recentProjects = [
    { name: 'Project Alpha', path: '/home/user/projects/alpha', lastOpened: Date.now() - 1000 },
    { name: 'Project Beta', path: '/home/user/projects/beta', lastOpened: Date.now() - 86400000 * 2 },
    { name: 'Project Gamma', path: '/home/user/projects/gamma', lastOpened: Date.now() - 86400000 * 5 },
  ]

  const renderWelcomeScreen = (projects = recentProjects) => {
    return render(
      <WelcomeScreen
        onNewProject={mockOnNewProject}
        onOpenFolder={mockOnOpenFolder}
        onOpenFile={mockOnOpenFile}
        recentProjects={projects}
        onOpenRecentProject={mockOnOpenRecentProject}
        onRemoveRecentProject={mockOnRemoveRecentProject}
      />
    )
  }

  it('should render the welcome screen', () => {
    renderWelcomeScreen()
    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
    expect(screen.getByText('ClawdCAD')).toBeInTheDocument()
  })

  it('should show action buttons for New Project, Open Folder, Open File', () => {
    renderWelcomeScreen()
    expect(screen.getByTestId('welcome-new-project-btn')).toBeInTheDocument()
    expect(screen.getByTestId('welcome-open-folder-btn')).toBeInTheDocument()
    expect(screen.getByTestId('welcome-open-file-btn')).toBeInTheDocument()
  })

  it('should display recent projects section with at least 2 projects', () => {
    renderWelcomeScreen()
    expect(screen.getByTestId('recent-projects-section')).toBeInTheDocument()
    const items = screen.getAllByTestId('welcome-recent-project-item')
    expect(items.length).toBe(3)
  })

  it('should show project name, path, and last opened date for each entry', () => {
    renderWelcomeScreen()
    const names = screen.getAllByTestId('recent-project-name')
    const paths = screen.getAllByTestId('recent-project-path')
    const dates = screen.getAllByTestId('recent-project-date')

    expect(names[0].textContent).toBe('Project Alpha')
    expect(paths[0].textContent).toBe('/home/user/projects/alpha')
    expect(dates[0].textContent).toBe('Today')

    expect(names[1].textContent).toBe('Project Beta')
    expect(paths[1].textContent).toBe('/home/user/projects/beta')
    expect(dates[1].textContent).toBe('2 days ago')
  })

  it('should order projects by most recently opened first', () => {
    renderWelcomeScreen()
    const names = screen.getAllByTestId('recent-project-name')
    expect(names[0].textContent).toBe('Project Alpha')
    expect(names[1].textContent).toBe('Project Beta')
    expect(names[2].textContent).toBe('Project Gamma')
  })

  it('should show empty state message when no recent projects exist', () => {
    renderWelcomeScreen([])
    expect(screen.getByTestId('recent-projects-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('recent-projects-section')).not.toBeInTheDocument()
  })

  it('should call onOpenRecentProject when a project is clicked', () => {
    renderWelcomeScreen()
    const items = screen.getAllByTestId('welcome-recent-project-item')
    fireEvent.click(items[0])
    expect(mockOnOpenRecentProject).toHaveBeenCalledWith('/home/user/projects/alpha')
  })

  it('should call onOpenFolder when Open Folder button is clicked', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-open-folder-btn'))
    expect(mockOnOpenFolder).toHaveBeenCalled()
  })

  it('should call onOpenFile when Open File button is clicked', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-open-file-btn'))
    expect(mockOnOpenFile).toHaveBeenCalled()
  })

  it('should show new project dialog when New Project is clicked', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    expect(screen.getByTestId('welcome-new-project-dialog')).toBeInTheDocument()
  })

  it('should have name input and create button in new project dialog', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    expect(screen.getByTestId('welcome-new-project-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('welcome-create-project-btn')).toBeInTheDocument()
  })

  it('should disable create button when project name is empty', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const createBtn = screen.getByTestId('welcome-create-project-btn')
    expect(createBtn).toBeDisabled()
  })

  it('should enable create button when project name is entered', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const input = screen.getByTestId('welcome-new-project-name-input')
    fireEvent.change(input, { target: { value: 'my-test-project' } })
    const createBtn = screen.getByTestId('welcome-create-project-btn')
    expect(createBtn).not.toBeDisabled()
  })

  it('should call onNewProject with trimmed name when create is clicked', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const input = screen.getByTestId('welcome-new-project-name-input')
    fireEvent.change(input, { target: { value: '  my-project  ' } })
    fireEvent.click(screen.getByTestId('welcome-create-project-btn'))
    expect(mockOnNewProject).toHaveBeenCalledWith('my-project')
  })

  it('should call onNewProject when Enter is pressed in name input', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const input = screen.getByTestId('welcome-new-project-name-input')
    fireEvent.change(input, { target: { value: 'enter-project' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnNewProject).toHaveBeenCalledWith('enter-project')
  })

  it('should close new project dialog when Escape is pressed', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    expect(screen.getByTestId('welcome-new-project-dialog')).toBeInTheDocument()
    const input = screen.getByTestId('welcome-new-project-name-input')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('welcome-new-project-dialog')).not.toBeInTheDocument()
  })

  it('should close new project dialog and reset input after creating', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const input = screen.getByTestId('welcome-new-project-name-input')
    fireEvent.change(input, { target: { value: 'test-project' } })
    fireEvent.click(screen.getByTestId('welcome-create-project-btn'))
    // Dialog should close after creation
    expect(screen.queryByTestId('welcome-new-project-dialog')).not.toBeInTheDocument()
  })

  it('should show remove button on hover over a recent project', () => {
    renderWelcomeScreen()
    const items = screen.getAllByTestId('welcome-recent-project-item')
    // Before hover, no remove button visible
    expect(screen.queryByTestId('recent-project-remove-btn')).not.toBeInTheDocument()
    // Hover over the first project's parent container
    const container = items[0].closest('.relative') as HTMLElement
    fireEvent.mouseEnter(container)
    expect(screen.getByTestId('recent-project-remove-btn')).toBeInTheDocument()
  })

  it('should call onRemoveRecentProject when remove button is clicked', () => {
    renderWelcomeScreen()
    const items = screen.getAllByTestId('welcome-recent-project-item')
    const container = items[0].closest('.relative') as HTMLElement
    fireEvent.mouseEnter(container)
    const removeBtn = screen.getByTestId('recent-project-remove-btn')
    fireEvent.click(removeBtn)
    expect(mockOnRemoveRecentProject).toHaveBeenCalledWith('/home/user/projects/alpha')
  })

  it('should not open project when remove button is clicked', () => {
    renderWelcomeScreen()
    const items = screen.getAllByTestId('welcome-recent-project-item')
    const container = items[0].closest('.relative') as HTMLElement
    fireEvent.mouseEnter(container)
    const removeBtn = screen.getByTestId('recent-project-remove-btn')
    fireEvent.click(removeBtn)
    // Remove was called but open was NOT called
    expect(mockOnRemoveRecentProject).toHaveBeenCalledWith('/home/user/projects/alpha')
    expect(mockOnOpenRecentProject).not.toHaveBeenCalled()
  })

  it('should hide remove button when mouse leaves a recent project', () => {
    renderWelcomeScreen()
    const items = screen.getAllByTestId('welcome-recent-project-item')
    const container = items[0].closest('.relative') as HTMLElement
    fireEvent.mouseEnter(container)
    expect(screen.getByTestId('recent-project-remove-btn')).toBeInTheDocument()
    fireEvent.mouseLeave(container)
    expect(screen.queryByTestId('recent-project-remove-btn')).not.toBeInTheDocument()
  })

  // Design System Tests (Feature #64)
  it('should use design system dark background class for welcome screen', () => {
    renderWelcomeScreen()
    const welcomeScreen = screen.getByTestId('welcome-screen')
    expect(welcomeScreen.className).toContain('dark:bg-[#1a1a2e]')
  })

  it('should expose theme via data-theme attribute', () => {
    renderWelcomeScreen()
    const welcomeScreen = screen.getByTestId('welcome-screen')
    expect(welcomeScreen.getAttribute('data-theme')).toBe('dark')
  })

  it('should use primary blue class for New Project button', () => {
    renderWelcomeScreen()
    const newProjectBtn = screen.getByTestId('welcome-new-project-btn')
    expect(newProjectBtn.className).toContain('bg-blue-500')
  })

  it('should use design system surface class for recent projects list', () => {
    renderWelcomeScreen()
    const recentSection = screen.getByTestId('recent-projects-section')
    const listContainer = recentSection.querySelector('.rounded-lg.overflow-hidden')
    expect(listContainer).toBeTruthy()
    expect((listContainer as HTMLElement).className).toContain('dark:bg-[#16213e]')
  })

  it('should use design system border class for secondary button', () => {
    renderWelcomeScreen()
    const openFolderBtn = screen.getByTestId('welcome-open-folder-btn')
    expect(openFolderBtn.className).toContain('dark:border-[#404040]')
  })

  it('should use design system text class for title', () => {
    renderWelcomeScreen()
    const title = screen.getByText('ClawdCAD')
    expect(title.className).toContain('dark:text-gray-200')
  })

  it('should apply font-sans class for Inter font family', () => {
    renderWelcomeScreen()
    const welcomeScreen = screen.getByTestId('welcome-screen')
    expect(welcomeScreen.classList.contains('font-sans')).toBe(true)
  })

  it('should use secondary button style (border, transparent bg) for Open Folder', () => {
    renderWelcomeScreen()
    const openFolderBtn = screen.getByTestId('welcome-open-folder-btn')
    expect(openFolderBtn.className).toContain('bg-transparent')
    expect(openFolderBtn.className).toContain('border-2')
  })

  it('should use ghost button style (transparent bg, no border) for Open File', () => {
    renderWelcomeScreen()
    const openFileBtn = screen.getByTestId('welcome-open-file-btn')
    expect(openFileBtn.className).toContain('bg-transparent')
    expect(openFileBtn.className).not.toContain('border-2')
  })

  it('should use primary blue class for dialog Create Project button', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const createBtn = screen.getByTestId('welcome-create-project-btn')
    expect(createBtn.className).toContain('bg-blue-500')
  })

  it('should use design system surface class for dialog background', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const dialog = screen.getByTestId('welcome-new-project-dialog')
    const dialogPanel = dialog.querySelector('.rounded-lg.shadow-xl')
    expect(dialogPanel).toBeTruthy()
    expect((dialogPanel as HTMLElement).className).toContain('dark:bg-[#16213e]')
  })

  it('should format dates correctly', () => {
    const now = Date.now()
    const projects = [
      { name: 'Today', path: '/a', lastOpened: now },
      { name: 'Yesterday', path: '/b', lastOpened: now - 86400000 },
      { name: 'Three Days', path: '/c', lastOpened: now - 86400000 * 3 },
      { name: 'Old', path: '/d', lastOpened: now - 86400000 * 30 },
    ]
    renderWelcomeScreen(projects)
    const dates = screen.getAllByTestId('recent-project-date')
    expect(dates[0].textContent).toBe('Today')
    expect(dates[1].textContent).toBe('Yesterday')
    expect(dates[2].textContent).toBe('3 days ago')
    // Old project shows locale date string
    expect(dates[3].textContent).toBeTruthy()
  })

  // Light theme tests
  describe('light theme', () => {
    beforeEach(() => {
      useSettingsStore.setState((state) => ({
        preferences: {
          ...state.preferences,
          editor: { ...state.preferences.editor, theme: 'light' as const },
        },
      }))
    })

    it('should use light background Tailwind class', () => {
      renderWelcomeScreen()
      const welcomeScreen = screen.getByTestId('welcome-screen')
      expect(welcomeScreen.className).toContain('bg-gray-100')
    })

    it('should expose light theme via data-theme attribute', () => {
      renderWelcomeScreen()
      const welcomeScreen = screen.getByTestId('welcome-screen')
      expect(welcomeScreen.getAttribute('data-theme')).toBe('light')
    })

    it('should use dark text Tailwind class for title in light mode', () => {
      renderWelcomeScreen()
      const title = screen.getByText('ClawdCAD')
      expect(title.className).toContain('text-gray-800')
    })

    it('should use light border Tailwind class for secondary button', () => {
      renderWelcomeScreen()
      const openFolderBtn = screen.getByTestId('welcome-open-folder-btn')
      expect(openFolderBtn.className).toContain('border-gray-300')
    })

    it('should have white background Tailwind class for recent projects list', () => {
      renderWelcomeScreen()
      const recentSection = screen.getByTestId('recent-projects-section')
      const listContainer = recentSection.querySelector('.rounded-lg.overflow-hidden')
      expect(listContainer).toBeTruthy()
      expect((listContainer as HTMLElement).className).toContain('bg-white')
    })

    it('should have white background Tailwind class for dialog in light mode', () => {
      renderWelcomeScreen()
      fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
      const dialog = screen.getByTestId('welcome-new-project-dialog')
      const dialogPanel = dialog.querySelector('.rounded-lg.shadow-xl')
      expect(dialogPanel).toBeTruthy()
      expect((dialogPanel as HTMLElement).className).toContain('bg-white')
    })
  })

  // Limit recent projects to 5 displayed
  it('should display at most 5 recent projects', () => {
    const manyProjects = Array.from({ length: 8 }, (_, i) => ({
      name: `Project ${i}`,
      path: `/home/user/projects/p${i}`,
      lastOpened: Date.now() - i * 86400000,
    }))
    renderWelcomeScreen(manyProjects)
    const items = screen.getAllByTestId('welcome-recent-project-item')
    expect(items.length).toBe(5)
  })

  // Not call onNewProject when name is whitespace-only
  it('should not call onNewProject when name is whitespace-only', () => {
    renderWelcomeScreen()
    fireEvent.click(screen.getByTestId('welcome-new-project-btn'))
    const input = screen.getByTestId('welcome-new-project-name-input')
    fireEvent.change(input, { target: { value: '   ' } })
    // Button should remain disabled since trim() is empty
    const createBtn = screen.getByTestId('welcome-create-project-btn')
    expect(createBtn).toBeDisabled()
  })

  // Subtitle text
  it('should display the subtitle tagline', () => {
    renderWelcomeScreen()
    expect(screen.getByText('Parametric 3D Modeling with OpenSCAD')).toBeInTheDocument()
  })

  // Keyboard tips
  it('should show keyboard shortcut tips', () => {
    renderWelcomeScreen()
    expect(screen.getByText(/Ctrl\+Shift\+B to compile/)).toBeInTheDocument()
  })
})
