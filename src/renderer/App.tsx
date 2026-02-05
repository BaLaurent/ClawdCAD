import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PanelSeparator from './components/PanelSeparator'
import PanelHeader from './components/PanelHeader'
import CodeEditor from './components/CodeEditor'
import SettingsPanel from './components/SettingsPanel'
import ChatPanel from './components/ChatPanel'
import GitPanel from './components/GitPanel'
import Viewer3D from './components/Viewer3D'
import FileTree, { type FileTreeHandle } from './components/FileTree'
import ConsolePanel from './components/ConsolePanel'
import DiffViewer from './components/DiffViewer'
import FileHistoryPanel from './components/FileHistoryPanel'
import VersionPreview from './components/VersionPreview'
import WelcomeScreen from './components/WelcomeScreen'
import MenuBar from './components/MenuBar'
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog'
import AboutDialog from './components/AboutDialog'
import { useChatStore } from './stores/chatStore'
import { useEditorStore } from './stores/editorStore'
import { useProjectStore } from './stores/projectStore'
import { useSettingsStore } from './stores/settingsStore'
import { useCompilerStore } from './stores/compilerStore'
import { useGitStore } from './stores/gitStore'
import { useLayoutStore, LAYOUT_PRESETS } from './stores/layoutStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { SAMPLE_SCAD } from './sampleFiles'

type IpcStatus = 'pending' | 'success' | 'no-electron' | 'error'

const DEFAULT_FILE_PATH = 'phone_stand.scad'

const MAIN_SCAD_TEMPLATE = `// Ne ClawdCAD Project
// Edit this file to start designing!

$fn = 64;

module main() {
    cube([20, 20, 20]);
}

main();
`

function App() {
  const [ipcStatus, setIpcStatus] = useState<IpcStatus>('pending')
  const [ipcResponse, setIpcResponse] = useState<string>('Testing IPC...')
  const [platformInfo, setPlatformInfo] = useState<string>('')
  const [preferencesInfo, setPreferencesInfo] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [rightTab, setRightTab] = useState<'chat' | 'git'>('chat')
  const [bottomTab, setBottomTab] = useState<'problems' | 'console'>('problems')
  const [showRecentProjects, setShowRecentProjects] = useState(false)
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [missingProjectPath, setMissingProjectPath] = useState<string | null>(null)
  const [showKeyboardShortcutsDialog, setShowKeyboardShortcutsDialog] = useState(false)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [openscadVersion] = useState<string | undefined>(undefined)

  // Panel sizing state (pixels) — Feature #65: resizable panels
  const MIN_PANEL_SIZE = 100
  const MAX_SIDEBAR_WIDTH = 600
  const [leftPanelWidth, setLeftPanelWidth] = useState(256)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [viewerHeight, setViewerHeight] = useState(256)
  const [isAnimating, setIsAnimating] = useState(false)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const centerColumnRef = useRef<HTMLDivElement>(null)
  const fileTreeRef = useRef<FileTreeHandle>(null)

  // Zustand stores
  const isStreaming = useChatStore((s) => s.isStreaming)
  const editorStore = useEditorStore()
  const projectStore = useProjectStore()
  const settingsStore = useSettingsStore()
  const compilerStore = useCompilerStore()
  const gitStore = useGitStore()
  const layoutStore = useLayoutStore()

  // Panel visibility convenience variables (Fix #1: wire up View menu toggles)
  const editorVisible = layoutStore.isPanelVisible('editor')
  const viewerVisible = layoutStore.isPanelVisible('viewer')
  const consoleVisible = layoutStore.isPanelVisible('console')
  const chatVisible = layoutStore.isPanelVisible('chat')
  const gitVisible = layoutStore.isPanelVisible('git')
  const rightSidebarVisible = chatVisible || gitVisible

  // Zoom level state (Fix #3: zoom controls)
  const [zoomLevel, setZoomLevel] = useState(0)

  // Sync dark class on <html> element for Tailwind dark: prefix
  const currentTheme = settingsStore.preferences.editor.theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', currentTheme === 'dark')
  }, [currentTheme])

  // Auto-switch rightTab when one panel is hidden
  useEffect(() => {
    if (chatVisible && !gitVisible) setRightTab('chat')
    else if (!chatVisible && gitVisible) setRightTab('git')
  }, [chatVisible, gitVisible])

  // Reset layout handler (Feature #69)
  const handleResetLayout = useCallback(() => {
    layoutStore.resetLayout()
    // Reset all panel sizes to defaults
    setLeftPanelWidth(256)
    setRightPanelWidth(320)
    setViewerHeight(256)
    layoutStore.saveToElectron()
  }, [layoutStore])

  // Panel separator drag handlers
  const handleLeftSeparatorDrag = useCallback((delta: number) => {
    setLeftPanelWidth((prev) => {
      const newWidth = Math.max(120, Math.min(prev + delta, 500))
      // Save to layoutStore for persistence (Feature #68)
      layoutStore.setLayout({
        ...layoutStore.layout,
        leftWidth: newWidth,
      })
      layoutStore.saveToElectron()
      return newWidth
    })
  }, [layoutStore])

  const handleLeftSeparatorDoubleClick = useCallback(() => {
    if (!mainContainerRef.current) return
    const totalWidth = mainContainerRef.current.offsetWidth
    const halfWidth = Math.round(totalWidth / 2)
    setIsAnimating(true)
    setLeftPanelWidth(halfWidth)
    setTimeout(() => setIsAnimating(false), 150)
  }, [])

  const handleViewerSeparatorDrag = useCallback((delta: number) => {
    // Feature #75: Negate delta so dragging up increases viewer height
    // (separator is above the viewer, so positive delta = drag down = shrink viewer)
    setViewerHeight((prev) => {
      const newHeight = Math.max(80, Math.min(prev - delta, 600))
      // Save to layoutStore for persistence (Feature #68)
      layoutStore.setLayout({
        ...layoutStore.layout,
        viewerHeight: newHeight,
      })
      layoutStore.saveToElectron()
      return newHeight
    })
  }, [layoutStore])

  const handleViewerSeparatorDoubleClick = useCallback(() => {
    if (!centerColumnRef.current) return
    const totalHeight = centerColumnRef.current.offsetHeight
    const halfHeight = Math.round(totalHeight / 2)
    setIsAnimating(true)
    setViewerHeight(halfHeight)
    setTimeout(() => setIsAnimating(false), 150)
  }, [])

  const handleCompile = useCallback(async () => {
    if (compilerStore.isCompiling) return
    const source = editorStore.editorContent
    compilerStore.setCompiling(true)
    compilerStore.clearErrors()
    compilerStore.setLastCompiledSource(source)

    if (!window.electronAPI?.openscad) {
      // Browser mode: simulate a compile error for demo
      compilerStore.setCompileResult({
        success: false,
        stlBuffer: null,
        offData: null,
        stderr: 'ERROR: OpenSCAD not available in browser mode',
        duration: 0,
      })
      return
    }

    try {
      const result = await window.electronAPI.openscad.compile(source)
      compilerStore.setCompileResult(result)
    } catch (err) {
      compilerStore.setCompileResult({
        success: false,
        stlBuffer: null,
        offData: null,
        stderr: `ERROR: Compilation failed: ${err}`,
        duration: 0,
      })
    }
  }, [compilerStore, editorStore.editorContent])

  // Auto-compile debounce timer ref
  const autoCompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-compile: debounced compilation when editor content changes
  useEffect(() => {
    if (!settingsStore.preferences.editor.autoCompile) return
    if (compilerStore.isCompiling) return
    if (isStreaming) return  // AI handles compilation via compile_openscad tool

    // Skip if source unchanged since last compile
    if (editorStore.editorContent === compilerStore.lastCompiledSource) return

    // Clear previous timer
    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current)
    }

    const delay = settingsStore.preferences.editor.autoCompileDelay || 1500
    autoCompileTimerRef.current = setTimeout(() => {
      handleCompile()
    }, delay)

    return () => {
      if (autoCompileTimerRef.current) {
        clearTimeout(autoCompileTimerRef.current)
      }
    }
  }, [editorStore.editorContent, settingsStore.preferences.editor.autoCompile, settingsStore.preferences.editor.autoCompileDelay, compilerStore.isCompiling, compilerStore.lastCompiledSource, handleCompile, isStreaming])

  // Open a project directory: scan files, populate sidebar, reset tabs, update title
  const openProject = useCallback(async (dirPath: string) => {
    const name = dirPath.split(/[/\\]/).pop() || dirPath
    projectStore.setLoading(true)

    // Stop existing file watcher
    if (window.electronAPI?.file) {
      await window.electronAPI.file.stopWatch()
    }

    // Set project in store
    projectStore.setProject(dirPath, name)

    // Set git project directory (Feature #50: Git operations target active project)
    gitStore.setProjectDir(dirPath)

    // Reset editor tabs
    editorStore.openFiles.forEach(f => editorStore.closeFile(f.path))

    // Scan directory and populate sidebar
    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.listDir(dirPath)
      if (!result.error) {
        projectStore.setFiles(result.files)
      }
      // Start watching
      await window.electronAPI.file.watch(dirPath)
    }

    // Update window title
    if (window.electronAPI?.setWindowTitle) {
      await window.electronAPI.setWindowTitle(`ClawdCAD - ${name}`)
    }

    // Add to recent projects and persist
    settingsStore.addRecentProject(dirPath, name)
    settingsStore.saveToElectron()

    projectStore.setLoading(false)

    // Auto-open main.scad if it exists
    if (window.electronAPI?.file) {
      const mainScadPath = dirPath + '/main.scad'
      const readResult = await window.electronAPI.file.read(mainScadPath)
      if (!readResult.error) {
        editorStore.openFile({
          path: mainScadPath,
          name: 'main.scad',
          content: readResult.content,
          isDirty: false,
        })
      }
    }

    // Check if project is a git repo and refresh status (Features #50, #51)
    if (window.electronAPI?.git) {
      await gitStore.checkIsGitRepo()
      if (gitStore.isGitRepo) {
        await gitStore.refreshStatus()
        await gitStore.refreshBranches()
      }
    }
  }, [projectStore, editorStore, settingsStore, gitStore])

  // Handle "Open Project" button: show native directory picker
  const handleOpenProject = useCallback(async () => {
    if (!window.electronAPI?.file) return
    const result = await window.electronAPI.file.openDirectoryDialog()
    if (result.canceled || result.filePaths.length === 0) return
    await openProject(result.filePaths[0])
  }, [openProject])

  // Handle "New Project": create dir + main.scad template
  const handleNewProject = useCallback(async (projectName: string) => {
    if (!window.electronAPI?.file) return
    if (!projectName.trim()) return

    // Ask user to pick parent directory
    const result = await window.electronAPI.file.openDirectoryDialog()
    if (result.canceled || result.filePaths.length === 0) return

    const parentDir = result.filePaths[0]
    const projectDir = parentDir + '/' + projectName.trim()

    // Create project directory
    const mkdirResult = await window.electronAPI.file.createDir(projectDir)
    if (mkdirResult.error) return

    // Create main.scad template
    await window.electronAPI.file.create(projectDir + '/main.scad', MAIN_SCAD_TEMPLATE)

    // Open the new project
    await openProject(projectDir)
    setShowNewProjectDialog(false)
    setNewProjectName('')
  }, [openProject])

  // Handle "Open File" from welcome screen or toolbar (Feature #61)
  const handleOpenSingleFile = useCallback(async () => {
    if (!window.electronAPI?.file) return

    const result = await window.electronAPI.file.openDialog()
    if (result.canceled || result.filePaths.length === 0) return

    const filePath = result.filePaths[0]
    const readResult = await window.electronAPI.file.read(filePath)
    if (readResult.error) return

    // Clear any existing project
    projectStore.clearProject()

    // Reset editor tabs
    editorStore.openFiles.forEach(f => editorStore.closeFile(f.path))

    // Open the file in single file mode
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    editorStore.openFile({
      path: filePath,
      name: fileName,
      content: readResult.content,
      isDirty: false,
    })

    // Set single file mode flag
    projectStore.setSingleFileMode(true)

    // Update window title
    if (window.electronAPI?.setWindowTitle) {
      await window.electronAPI.setWindowTitle(`ClawdCAD - ${fileName}`)
    }

    // Trigger auto-compile if enabled
    if (settingsStore.preferences.editor.autoCompile) {
      // The auto-compile effect will trigger after editorContent updates
    }
  }, [projectStore, editorStore, settingsStore.preferences.editor.autoCompile])

  // Toast state for error messages
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 5000)
  }, [])

  // Handle opening a recent project (with folder existence check)
  const handleOpenRecentProject = useCallback(async (path: string) => {
    setShowRecentProjects(false)

    // Check if folder exists by trying to list it
    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.listDir(path)
      if (result.error) {
        showToast(`Project folder not found: ${path}. Remove from recent list?`)
        setMissingProjectPath(path)
        return
      }
    }

    await openProject(path)
  }, [openProject, showToast])

  // Handle closing the current project (Feature #63: returns to welcome screen)
  const handleCloseProject = useCallback(async () => {
    // Stop file watcher
    if (window.electronAPI?.file) {
      await window.electronAPI.file.stopWatch()
    }

    // Close all editor tabs
    editorStore.openFiles.forEach(f => editorStore.closeFile(f.path))

    // Clear project state (this makes showWelcomeScreen true)
    projectStore.clearProject()

    // Reset window title
    if (window.electronAPI?.setWindowTitle) {
      await window.electronAPI.setWindowTitle('ClawdCAD')
    }

    // Clear git state
    gitStore.setProjectDir('')

    // Reset compiler state
    compilerStore.clearErrors()
  }, [projectStore, editorStore, gitStore, compilerStore])

  // Save current file via IPC
  const handleSave = useCallback(async () => {
    const activeFile = editorStore.openFiles.find(f => f.path === editorStore.activeFilePath)
    if (!activeFile) return

    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.save(activeFile.path, activeFile.content)
      if (result.success) {
        editorStore.markDirty(activeFile.path, false)
        // Refresh git status after save
        if (gitStore.isGitRepo) {
          gitStore.refreshStatus()
        }
      }
    } else {
      // Browser mode: just clear dirty flag
      editorStore.markDirty(activeFile.path, false)
    }
  }, [editorStore, gitStore])

  // Feature #81: Create new file in current project
  const handleNewFile = useCallback(async () => {
    if (!window.electronAPI?.file) return
    if (!projectStore.projectPath) {
      showToast('Please open a project first')
      return
    }

    // Prompt for filename
    const fileName = window.prompt('Enter filename (with .scad extension):')
    if (!fileName) return // User cancelled

    // Ensure .scad extension
    const normalizedName = fileName.endsWith('.scad') ? fileName : `${fileName}.scad`
    const newFilePath = `${projectStore.projectPath}/${normalizedName}`

    // Create file with empty content
    const result = await window.electronAPI.file.create(newFilePath, '// New OpenSCAD file\n\n')
    if (result.error) {
      showToast(`Failed to create file: ${result.error}`)
      return
    }

    // Read the file back
    const readResult = await window.electronAPI.file.read(newFilePath)
    if (readResult.error) {
      showToast(`Failed to read new file: ${readResult.error}`)
      return
    }

    // Open in editor
    editorStore.openFile({
      path: newFilePath,
      name: normalizedName,
      content: readResult.content,
      isDirty: false,
    })

    // Refresh file tree
    const dirResult = await window.electronAPI.file.listDir(projectStore.projectPath)
    if (!dirResult.error && dirResult.files) {
      projectStore.setFiles(dirResult.files)
    }

    // Refresh git status after new file
    if (gitStore.isGitRepo) {
      gitStore.refreshStatus()
    }
  }, [projectStore, editorStore, gitStore, showToast])

  // Feature #82: Save As - save current file to new location
  const handleSaveAs = useCallback(async () => {
    if (!window.electronAPI?.file) return
    const activeFile = editorStore.openFiles.find(f => f.path === editorStore.activeFilePath)
    if (!activeFile) return

    // Open native save dialog
    const result = await window.electronAPI.file.openDialog({
      filters: [{ name: 'OpenSCAD Files', extensions: ['scad'] }],
      defaultPath: activeFile.name,
    })

    if (result.canceled || result.filePaths.length === 0) return

    const newPath = result.filePaths[0]
    const saveResult = await window.electronAPI.file.save(newPath, activeFile.content)

    if (saveResult.error) {
      showToast(`Save failed: ${saveResult.error}`)
      return
    }

    // Close old file and open new one
    editorStore.closeFile(activeFile.path)
    const fileName = newPath.split(/[/\\]/).pop() || newPath
    editorStore.openFile({
      path: newPath,
      name: fileName,
      content: activeFile.content,
      isDirty: false,
    })

    // If saved within project, refresh file tree
    if (projectStore.projectPath && newPath.startsWith(projectStore.projectPath)) {
      const dirResult = await window.electronAPI.file.listDir(projectStore.projectPath)
      if (!dirResult.error && dirResult.files) {
        projectStore.setFiles(dirResult.files)
      }
    }
  }, [editorStore, projectStore, showToast])

  // Feature #83: Export STL (reuses existing functionality)
  // Used in MenuBar component via onExport prop (line 720)
  const handleExportStl = useCallback(async () => {
    if (!window.electronAPI?.file) return
    if (!compilerStore.lastStl) {
      showToast('No compiled model to export. Compile first.')
      return
    }

    try {
      const result = await window.electronAPI.file.saveStl(compilerStore.lastStl)
      if (result.success) {
        showToast(`STL exported to ${result.filePath}`)
      } else if (result.error) {
        showToast(`Export failed: ${result.error}`)
      }
      // User cancelled dialog - no toast needed
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showToast(`Export failed: ${message}`)
    }
  }, [compilerStore.lastStl, showToast])

  // Feature #85: Monaco Editor commands (Undo, Redo, Cut, Copy, Paste)
  const handleUndo = useCallback(() => {
    const editor = editorStore.monacoEditorInstance
    if (editor) {
      const before = editor.getValue()
      editor.trigger('menu', 'undo', null)
      // Detect empty undo stack: if content didn't change, nothing to undo
      requestAnimationFrame(() => {
        if (editor.getValue() === before) {
          editorStore.setCanUndo(false)
        }
      })
    }
  }, [editorStore])

  const handleRedo = useCallback(() => {
    const editor = editorStore.monacoEditorInstance
    if (editor) {
      const before = editor.getValue()
      editor.trigger('menu', 'redo', null)
      // Detect empty redo stack: if content didn't change, nothing to redo
      requestAnimationFrame(() => {
        if (editor.getValue() === before) {
          editorStore.setCanRedo(false)
        }
      })
    }
  }, [editorStore])

  const handleCut = useCallback(() => {
    const editor = editorStore.monacoEditorInstance
    if (editor) {
      editor.trigger('menu', 'editor.action.clipboardCutAction', null)
    }
  }, [editorStore])

  const handleCopy = useCallback(() => {
    const editor = editorStore.monacoEditorInstance
    if (editor) {
      editor.trigger('menu', 'editor.action.clipboardCopyAction', null)
    }
  }, [editorStore])

  const handlePaste = useCallback(() => {
    const editor = editorStore.monacoEditorInstance
    if (editor) {
      editor.trigger('menu', 'editor.action.clipboardPasteAction', null)
    }
  }, [editorStore])

  // Feature #86: Monaco Editor Find/Replace
  const handleFind = useCallback(() => {
    const editor = editorStore.monacoEditorInstance
    if (editor) {
      editor.trigger('menu', 'actions.find', null)
    }
  }, [editorStore])

  const handleReplace = useCallback(() => {
    const editor = editorStore.monacoEditorInstance
    if (editor) {
      editor.trigger('menu', 'editor.action.startFindReplaceAction', null)
    }
  }, [editorStore])


  // Feature #87: Panel visibility toggles
  const handleToggleEditor = useCallback(() => {
    layoutStore.togglePanelVisibility('editor')
  }, [layoutStore])

  const handleToggleViewer = useCallback(() => {
    layoutStore.togglePanelVisibility('viewer')
  }, [layoutStore])

  const handleToggleChatPanel = useCallback(() => {
    layoutStore.togglePanelVisibility('chat')
  }, [layoutStore])

  const handleToggleGitPanel = useCallback(() => {
    layoutStore.togglePanelVisibility('git')
  }, [layoutStore])

  const handleToggleConsole = useCallback(() => {
    layoutStore.togglePanelVisibility('console')
  }, [layoutStore])

  // Feature #88: Zoom controls
  const handleZoomIn = useCallback(async () => {
    if (window.electronAPI?.zoom) {
      const newLevel = await window.electronAPI.zoom.set(zoomLevel + 0.5)
      setZoomLevel(newLevel)
    } else {
      // Browser fallback
      const newLevel = zoomLevel + 0.5
      document.body.style.zoom = `${100 + newLevel * 20}%`
      setZoomLevel(newLevel)
    }
  }, [zoomLevel])

  const handleZoomOut = useCallback(async () => {
    if (window.electronAPI?.zoom) {
      const newLevel = await window.electronAPI.zoom.set(zoomLevel - 0.5)
      setZoomLevel(newLevel)
    } else {
      const newLevel = zoomLevel - 0.5
      document.body.style.zoom = `${100 + newLevel * 20}%`
      setZoomLevel(newLevel)
    }
  }, [zoomLevel])

  const handleResetZoom = useCallback(async () => {
    if (window.electronAPI?.zoom) {
      const newLevel = await window.electronAPI.zoom.set(0)
      setZoomLevel(newLevel)
    } else {
      document.body.style.zoom = '100%'
      setZoomLevel(0)
    }
  }, [])

  // Open file via native dialog
  const handleOpenFile = useCallback(async () => {
    if (!window.electronAPI?.file) return

    const result = await window.electronAPI.file.openDialog()
    if (result.canceled || result.filePaths.length === 0) return

    for (const filePath of result.filePaths) {
      const readResult = await window.electronAPI.file.read(filePath)
      if (!readResult.error) {
        const name = filePath.split(/[/\\]/).pop() || filePath
        editorStore.openFile({
          path: filePath,
          name,
          content: readResult.content,
          isDirty: false,
        })
      }
    }
  }, [editorStore])

  // Centralized keyboard shortcuts using useKeyboardShortcuts hook
  const shortcuts = useMemo(() => [
    {
      id: 'new-file',
      key: 'n',
      modifiers: ['Ctrl' as const],
      description: 'Create new file',
      handler: handleNewFile,
    },
    {
      id: 'save-file',
      key: 's',
      modifiers: ['Ctrl' as const],
      description: 'Save current file',
      handler: handleSave,
    },
    {
      id: 'save-as',
      key: 's',
      modifiers: ['Ctrl' as const, 'Shift' as const],
      description: 'Save as new file',
      handler: handleSaveAs,
    },
    {
      id: 'open-file',
      key: 'o',
      modifiers: ['Ctrl' as const],
      description: 'Open file dialog',
      handler: handleOpenFile,
    },
    {
      id: 'close-tab',
      key: 'w',
      modifiers: ['Ctrl' as const],
      description: 'Close current tab',
      handler: () => {
        if (editorStore.activeFilePath) {
          editorStore.closeFile(editorStore.activeFilePath)
        }
      },
    },
    {
      id: 'next-tab',
      key: 'Tab',
      modifiers: ['Ctrl' as const],
      description: 'Cycle to next tab',
      handler: () => {
        const openFiles = editorStore.openFiles
        if (openFiles.length > 1) {
          const currentIndex = openFiles.findIndex(f => f.path === editorStore.activeFilePath)
          const nextIndex = (currentIndex + 1) % openFiles.length
          editorStore.setActiveFile(openFiles[nextIndex].path)
        }
      },
    },
    {
      id: 'prev-tab',
      key: 'Tab',
      modifiers: ['Ctrl' as const, 'Shift' as const],
      description: 'Cycle to previous tab',
      handler: () => {
        const openFiles = editorStore.openFiles
        if (openFiles.length > 1) {
          const currentIndex = openFiles.findIndex(f => f.path === editorStore.activeFilePath)
          const prevIndex = (currentIndex - 1 + openFiles.length) % openFiles.length
          editorStore.setActiveFile(openFiles[prevIndex].path)
        }
      },
    },
    {
      id: 'compile',
      key: 'B',
      modifiers: ['Ctrl' as const, 'Shift' as const],
      description: 'Compile OpenSCAD',
      handler: handleCompile,
    },
    {
      id: 'toggle-console',
      key: '`',
      modifiers: ['Ctrl' as const],
      description: 'Toggle console panel',
      handler: () => layoutStore.togglePanelVisibility('console'),
    },
  ], [handleNewFile, handleSave, handleSaveAs, handleOpenFile, handleCompile, editorStore, layoutStore])

  useKeyboardShortcuts(shortcuts)

  // Close recent projects dropdown when clicking outside
  useEffect(() => {
    if (!showRecentProjects) return
    const handleClick = () => setShowRecentProjects(false)
    // Delay to avoid catching the click that opened it
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClick)
    }
  }, [showRecentProjects])


  // Determine if welcome screen should be shown:
  // Show welcome screen in Electron mode when no project is open and no single file is open
  const hasProjectOpen = !!projectStore.projectPath
  const hasSingleFile = projectStore.singleFileMode
  const isElectronMode = !!window.electronAPI?.file
  const showWelcomeScreen = isElectronMode && !hasProjectOpen && !hasSingleFile

  // Initialize stores on mount (Feature #68: load saved layout)
  useEffect(() => {
    // Load settings from Electron (or keep defaults)
    settingsStore.loadFromElectron()

    // Load saved layout from Electron (Feature #68)
    const loadLayout = async () => {
      await layoutStore.loadFromElectron()
      // Apply loaded panel sizes to local state
      const { layout } = layoutStore
      setLeftPanelWidth(layout.leftWidth)
      setRightPanelWidth(layout.rightWidth)
      setViewerHeight(layout.viewerHeight)
    }
    loadLayout()

    // In browser mode, load sample project automatically for demo purposes
    if (!window.electronAPI?.file) {
      projectStore.setProject('/sample', 'Sample Project')
      projectStore.setFiles([
        { name: 'phone_stand.scad', path: 'phone_stand.scad', isDirectory: false },
        { name: 'gear.scad', path: 'gear.scad', isDirectory: false },
        { name: 'box.scad', path: 'box.scad', isDirectory: false },
      ])

      // Open sample file in editor store
      editorStore.openFile({
        path: DEFAULT_FILE_PATH,
        name: 'phone_stand.scad',
        content: SAMPLE_SCAD,
        isDirty: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced git refresh + live editor reload on file system changes
  const gitRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!window.electronAPI?.file) return

    const cleanup = window.electronAPI.file.onFileChanged((watchEvent, filePath) => {
      // Git refresh (gated on git repo)
      if (gitStore.isGitRepo) {
        if (gitRefreshTimerRef.current) clearTimeout(gitRefreshTimerRef.current)
        gitRefreshTimerRef.current = setTimeout(() => gitStore.refreshStatus(), 500)
      }

      // Live reload active file during AI streaming
      if (watchEvent === 'change' && useChatStore.getState().isStreaming) {
        const activeFile = useEditorStore.getState().activeFilePath
        if (activeFile && filePath === activeFile) {
          window.electronAPI.file.read(activeFile).then((result) => {
            if (!result.error) {
              const current = useEditorStore.getState().editorContent
              if (result.content !== current) {
                useEditorStore.getState().setEditorContent(result.content)
                useEditorStore.getState().markDirty(activeFile, false)
              }
            }
          })
        }
      }
    })

    return () => {
      cleanup()
      if (gitRefreshTimerRef.current) clearTimeout(gitRefreshTimerRef.current)
    }
  }, [gitStore, gitStore.isGitRepo])

  useEffect(() => {
    const testIPC = async () => {
      if (!window.electronAPI) {
        setIpcStatus('no-electron')
        setIpcResponse('Running in browser (no Electron)')
        setPlatformInfo('Browser mode')
        return
      }

      try {
        const pingResponse = await window.electronAPI.ping('Hello from renderer!')
        setIpcResponse(pingResponse)
        const platform = await window.electronAPI.getPlatform()
        setPlatformInfo(`Platform: ${platform}`)
        const prefs = await window.electronAPI.preferences.getAll()
        setPreferencesInfo(`Theme: ${prefs.editor.theme}, Font: ${prefs.editor.fontSize}px`)
        setIpcStatus('success')
      } catch (error) {
        setIpcStatus('error')
        setIpcResponse(`IPC Error: ${error}`)
      }
    }
    testIPC()
  }, [])

  // Feature #57: Show welcome screen when no project is open (Electron mode)
  if (showWelcomeScreen) {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <WelcomeScreen
          onNewProject={handleNewProject}
          onOpenFolder={handleOpenProject}
          onOpenFile={handleOpenSingleFile}
          recentProjects={settingsStore.preferences.recentProjects}
          onOpenRecentProject={handleOpenRecentProject}
          onRemoveRecentProject={(path) => {
            settingsStore.removeRecentProject(path)
            settingsStore.saveToElectron()
          }}
        />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Menu Bar (Features #77-83) */}
      <MenuBar
        onOpenProject={handleOpenProject}
        onOpenFile={handleOpenFile}
        onNewFile={handleNewFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onCloseProject={handleCloseProject}
        onNewProject={() => setShowNewProjectDialog(true)}
        recentProjects={settingsStore.preferences.recentProjects}
        onOpenRecentProject={handleOpenRecentProject}
        onExport={handleExportStl}
        onCompile={handleCompile}
        hasProjectOpen={!!projectStore.projectPath}
        onToggleTheme={() => {
          const newTheme = settingsStore.preferences.editor.theme === 'dark' ? 'light' : 'dark'
          settingsStore.updateEditorSetting('theme', newTheme)
          settingsStore.saveToElectron()
        }}
        onToggleAutoCompile={() => {
          settingsStore.updateEditorSetting('autoCompile', !settingsStore.preferences.editor.autoCompile)
          settingsStore.saveToElectron()
        }}
        autoCompileEnabled={settingsStore.preferences.editor.autoCompile}
        onShowKeyboardShortcuts={() => {
          // TODO: implement keyboard shortcuts dialog
          alert('Keyboard shortcuts:\n\nCtrl+N: New File\nCtrl+S: Save\nCtrl+Shift+S: Save As\nCtrl+O: Open File\nCtrl+W: Close Tab\nCtrl+Shift+B: Compile')
        }}
        onShowAbout={() => {
          alert('ClawdCAD\n\nParametric 3D Modeling with OpenSCAD\n\nVersion: 0.1.0')
        }}
        onQuit={() => {
          if (window.electronAPI) {
            window.close()
          }
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onFind={handleFind}
        onReplace={handleReplace}

        onToggleEditor={handleToggleEditor}
        onToggleViewer={handleToggleViewer}
        onToggleChatPanel={handleToggleChatPanel}
        onToggleGitPanel={handleToggleGitPanel}
        onToggleConsole={handleToggleConsole}
        editorVisible={layoutStore.isPanelVisible('editor')}
        viewerVisible={layoutStore.isPanelVisible('viewer')}
        chatPanelVisible={layoutStore.isPanelVisible('chat')}
        gitPanelVisible={layoutStore.isPanelVisible('git')}
        consoleVisible={layoutStore.isPanelVisible('console')}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        layoutPresets={LAYOUT_PRESETS}
        activePresetId={layoutStore.activePresetId}
        onApplyPreset={(presetId) => {
          layoutStore.applyPreset(presetId)
          if (presetId === 'default') {
            setLeftPanelWidth(256)
            setRightPanelWidth(320)
            setViewerHeight(256)
          }
        }}
        onResetLayout={handleResetLayout}
        onGitInit={() => gitStore.initRepo(true)}
        onGitCommit={() => {
          // Focus the git panel and switch to git tab
          if (!gitVisible) layoutStore.togglePanelVisibility('git')
          setRightTab('git')
        }}
        onGitPush={() => gitStore.push()}
        onGitPull={() => gitStore.pull()}
        onGitRefresh={() => {
          gitStore.refreshStatus()
          gitStore.refreshHistory()
          gitStore.refreshBranches()
        }}
      />
      {/* Top Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">ClawdCAD</h1>
          {projectStore.projectName ? (
            <span className="text-sm text-gray-700 dark:text-gray-300" data-testid="project-title">— {projectStore.projectName}</span>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">Parametric 3D Modeling with OpenSCAD</span>
          )}
          {/* Project management buttons */}
          <div className="flex items-center gap-1 ml-2">
            <button
              className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
              onClick={handleOpenProject}
              data-testid="open-project-btn"
              title="Open Project (select directory)"
            >
              📂 Open
            </button>
            <button
              className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
              onClick={() => setShowNewProjectDialog(true)}
              data-testid="new-project-btn"
              title="New Project"
            >
              ✚ New
            </button>
            {/* Close Project button (Feature #63) */}
            {projectStore.projectPath && (
              <button
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-red-700 text-gray-700 dark:text-gray-300 rounded"
                onClick={handleCloseProject}
                data-testid="close-project-btn"
                title="Close current project"
              >
                ✕ Close
              </button>
            )}
            <div className="relative">
              <button
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                onClick={() => setShowRecentProjects(prev => !prev)}
                data-testid="recent-projects-btn"
                title="Recent Projects"
              >
                🕐 Recent
              </button>
              {/* Recent Projects Dropdown */}
              {showRecentProjects && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50" data-testid="recent-projects-dropdown">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400">Recent Projects</div>
                  {settingsStore.preferences.recentProjects.length === 0 ? (
                    <div className="p-3 text-xs text-gray-400 dark:text-gray-500">No recent projects</div>
                  ) : (
                    settingsStore.preferences.recentProjects.map((rp) => (
                      <button
                        key={rp.path}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                        onClick={() => handleOpenRecentProject(rp.path)}
                        data-testid="recent-project-item"
                        title={rp.path}
                      >
                        <div className="text-gray-700 dark:text-gray-300 font-medium truncate">{rp.name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{rp.path}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-3">
          <span data-testid="ipc-status" className={
            ipcStatus === 'success' ? 'text-green-400' :
            ipcStatus === 'error' ? 'text-red-400' :
            ipcStatus === 'no-electron' ? 'text-yellow-400' :
            'text-gray-400'
          }>
            {ipcStatus === 'success' ? '● IPC Connected' :
             ipcStatus === 'no-electron' ? '○ Browser Mode' :
             ipcStatus === 'error' ? '✕ IPC Error' :
             '◌ Connecting...'}
          </span>
          <span data-testid="ipc-response">{ipcResponse}</span>
          <span>{platformInfo}</span>
          {preferencesInfo && <span>{preferencesInfo}</span>}
          <button
            className={`px-3 py-1 rounded text-sm font-medium ${
              compilerStore.isCompiling
                ? 'bg-yellow-600 text-white cursor-wait'
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
            onClick={handleCompile}
            data-testid="compile-button"
            title="Compile OpenSCAD (Ctrl+Shift+B)"
            disabled={compilerStore.isCompiling}
          >
            {compilerStore.isCompiling ? '⟳ Compiling...' : '▶ Compile'}
          </button>
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={handleResetLayout}
            data-testid="reset-layout-button"
            title="Reset Layout"
          >
            ⊞ Reset Layout
          </button>
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setShowSettings(true)}
            data-testid="settings-button"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* New Project Dialog */}
      {showNewProjectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="new-project-dialog">
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Project</h3>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Project Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-sm focus:border-blue-500 focus:outline-none"
              placeholder="my-openscad-project"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNewProject(newProjectName) }}
              autoFocus
              data-testid="new-project-name-input"
            />
                        <p /* eslint-disable-line react/no-unescaped-entities */ className="text-xs text-gray-500 mt-1">{/* eslint-disable-next-line */}A folder with this name will be created. You'll choose where to save it next.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                onClick={() => { setShowNewProjectDialog(false); setNewProjectName('') }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded"
                onClick={() => handleNewProject(newProjectName)}
                disabled={!newProjectName.trim()}
                data-testid="create-project-btn"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden" ref={mainContainerRef}>
        {/* Left Sidebar - Project Tree (hidden in single file mode) */}
        {!projectStore.singleFileMode && (<>
        <PanelHeader
          title={projectStore.projectName ? `PROJECT - ${projectStore.projectName}` : 'PROJECT'}
          className={`bg-white dark:bg-gray-800 flex-shrink-0 flex flex-col overflow-hidden${isAnimating ? ' transition-all duration-150 ease-in-out' : ''}`}
          style={{ width: leftPanelWidth }}
          testId="file-tree-sidebar"
          actions={<>
            <button
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
              onClick={() => fileTreeRef.current?.newFile()}
              title="New File"
            >
              📄
            </button>
            <button
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
              onClick={() => fileTreeRef.current?.newFolder()}
              title="New Folder"
            >
              📁
            </button>
            <button
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
              onClick={() => fileTreeRef.current?.collapseAll()}
              title="Collapse All"
            >
              ⏷
            </button>
            <button
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
              onClick={() => fileTreeRef.current?.refresh()}
              title="Refresh"
            >
              ↻
            </button>
          </>}
        >
          <div className="flex-1 overflow-auto">
            <FileTree ref={fileTreeRef} />
          </div>

          {/* Store Status (debug info) */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700" data-testid="store-status">
            <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
              <div data-testid="editor-store-status">
                Editor: {editorStore.openFiles.length} file{editorStore.openFiles.length !== 1 ? 's' : ''} open
              </div>
              <div data-testid="project-store-status">
                Project: {projectStore.projectPath ? 'loaded' : 'empty'}
              </div>
              <div data-testid="settings-store-status">
                Settings: {settingsStore.isLoaded ? 'loaded' : 'defaults'}
                {' '}(theme: {settingsStore.preferences.editor.theme})
              </div>
            </div>
          </div>
        </PanelHeader>
        <PanelSeparator
          direction="vertical"
          onDrag={handleLeftSeparatorDrag}
          onDoubleClick={handleLeftSeparatorDoubleClick}
          testId="file-tree-separator"
        />
        </>)}

        {/* Center - Editor and Viewer */}
        <div className="flex-1 flex flex-col min-w-0" ref={centerColumnRef}>
          {/* Editor Area */}
          {editorVisible && (
          <PanelHeader
            title="Code Editor"
            className="flex-1 min-h-0 flex flex-col bg-gray-50 dark:bg-gray-900"
            testId="editor-panel"
          >
            {/* Editor Tab Bar */}
            <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 flex items-center" data-testid="tab-bar">
              {editorStore.openFiles.map((file) => (
                <div
                  key={file.path}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer border-t-2 rounded-t ${
                    file.path === editorStore.activeFilePath
                      ? 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-blue-500'
                      : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  data-testid="editor-tab"
                  onClick={() => editorStore.setActiveFile(file.path)}
                >
                  <span className="text-xs">📄</span>
                  <span>{file.name}</span>
                  {file.isDirty && <span className="text-yellow-400 ml-1">●</span>}
                  <button
                    className="ml-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white text-xs"
                    data-testid="tab-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      editorStore.closeFile(file.path)
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Spacer to push undo/redo to the right */}
              <div className="flex-1" />

              {/* Undo/Redo buttons - Purple when active, gray when disabled */}
              <button
                className={`px-2 py-1 mx-0.5 rounded text-sm font-bold transition-colors ${
                  editorStore.canUndo
                    ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                onClick={handleUndo}
                disabled={!editorStore.canUndo}
                title="Undo (Ctrl+Z)"
                data-testid="btn-undo"
              >
                ↩ Undo
              </button>
              <button
                className={`px-2 py-1 mx-0.5 mr-2 rounded text-sm font-bold transition-colors ${
                  editorStore.canRedo
                    ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                onClick={handleRedo}
                disabled={!editorStore.canRedo}
                title="Redo (Ctrl+Shift+Z)"
                data-testid="btn-redo"
              >
                Redo ↪
              </button>

              {/* History button — only visible when git repo + active file */}
              {gitStore.isGitRepo && editorStore.activeFilePath && projectStore.projectPath && (
                <button
                  className="px-2 py-1 mx-0.5 rounded text-sm font-medium transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => {
                    const relativePath = editorStore.activeFilePath!.startsWith(projectStore.projectPath + '/')
                      ? editorStore.activeFilePath!.slice(projectStore.projectPath!.length + 1)
                      : editorStore.activeFilePath!
                    gitStore.openFileHistory(relativePath)
                  }}
                  title="View file history"
                  data-testid="btn-history"
                >
                  History
                </button>
              )}
            </div>

            {/* Editor Content */}
            <div className="flex-1 min-h-0" data-testid="editor-area">
              <CodeEditor
                value={editorStore.editorContent}
                onChange={(val) => editorStore.setEditorContent(val)}
                language="openscad"
                fontSize={settingsStore.preferences.editor.fontSize}
                tabSize={settingsStore.preferences.editor.tabSize}
              />
            </div>
          </PanelHeader>
          )}

          {/* Editor/Viewer Separator (only when both are visible) */}
          {editorVisible && viewerVisible && (
          <PanelSeparator
            direction="horizontal"
            onDrag={handleViewerSeparatorDrag}
            onDoubleClick={handleViewerSeparatorDoubleClick}
            testId="viewer-separator"
          />
          )}

          {/* 3D Viewer Area */}
          {viewerVisible && (
          <PanelHeader
            title="3D Viewer"
            className={`${editorVisible ? 'flex-shrink-0' : 'flex-1 min-h-0'} bg-gray-100 dark:bg-gray-850 flex flex-col${isAnimating ? ' transition-all duration-150 ease-in-out' : ''}`}
            style={editorVisible ? { height: viewerHeight } : undefined}
            testId="viewer-area"
          >
            <div className="flex-1 relative">
              <Viewer3D />
              {compilerStore.lastStl && (
                <div className="absolute bottom-1 left-2 text-xs text-gray-400 dark:text-gray-500 bg-white/70 dark:bg-gray-900/70 px-2 py-0.5 rounded">
                  STL: {(compilerStore.lastStl.byteLength / 1024).toFixed(1)} KB | {compilerStore.compileDuration}ms
                </div>
              )}
            </div>
          </PanelHeader>
          )}

          {/* Bottom Panel (Problems + Console) */}
          {consoleVisible && (
            <div className="h-40 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-col" data-testid="bottom-panel">
              {/* Tab Bar */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2" data-testid="bottom-panel-tabs">
                <button
                  className={`px-3 py-1 text-xs font-medium border-b-2 ${
                    bottomTab === 'problems'
                      ? 'text-blue-400 border-blue-400'
                      : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  onClick={() => setBottomTab('problems')}
                  data-testid="bottom-tab-problems"
                >
                  PROBLEMS
                  {compilerStore.errors.length > 0 && (
                    <span className="ml-1 bg-red-600 text-white px-1.5 py-0.5 rounded-full text-xs" data-testid="error-count">
                      {compilerStore.errors.length}
                    </span>
                  )}
                </button>
                <button
                  className={`px-3 py-1 text-xs font-medium border-b-2 ${
                    bottomTab === 'console'
                      ? 'text-blue-400 border-blue-400'
                      : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  onClick={() => setBottomTab('console')}
                  data-testid="bottom-tab-console"
                >
                  CONSOLE
                  {compilerStore.consoleEntries.length > 0 && (
                    <span className="ml-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-xs">
                      {compilerStore.consoleEntries.length}
                    </span>
                  )}
                </button>
                <button
                  className="ml-auto text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1"
                  onClick={() => layoutStore.togglePanelVisibility('console')}
                  data-testid="bottom-panel-collapse"
                  title="Collapse panel (Ctrl+`)"
                >
                  ▾
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-auto" data-testid="problems-panel">
                {bottomTab === 'problems' ? (
                  <div className="px-4 py-1">
                    {compilerStore.errors.length === 0 ? (
                      <div className="text-xs text-gray-400 dark:text-gray-500 py-1">No problems detected</div>
                    ) : (
                      compilerStore.errors.map((err, i) => (
                        <div
                          key={i}
                          className={`text-xs py-0.5 flex items-start gap-2 ${
                            err.severity === 'error' ? 'text-red-400' : 'text-yellow-400'
                          }`}
                          data-testid="problem-item"
                        >
                          <span>{err.severity === 'error' ? '✕' : '⚠'}</span>
                          <span>Ln {err.line}, Col {err.column}</span>
                          <span className="flex-1">{err.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <ConsolePanel />
                )}
              </div>
            </div>
          )}

          {/* Collapsed bottom panel toggle */}
          {!consoleVisible && (
            <div className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-2 py-0.5 flex items-center">
              <button
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-0.5 flex items-center gap-1"
                onClick={() => layoutStore.togglePanelVisibility('console')}
                data-testid="bottom-panel-expand"
                title="Expand panel (Ctrl+`)"
              >
                ▴ Problems
                {compilerStore.errors.length > 0 && (
                  <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-xs">
                    {compilerStore.errors.length}
                  </span>
                )}
                {' / Console'}
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar - Chat / Git Tabs (hidden when both panels are toggled off) */}
        {rightSidebarVisible && (<>
        <PanelSeparator
          direction="vertical"
          onDrag={(delta) => {
            setRightPanelWidth(prev => {
              const newWidth = Math.max(MIN_PANEL_SIZE, Math.min(prev - delta, MAX_SIDEBAR_WIDTH))
              // Save to layoutStore for persistence (Feature #68)
              layoutStore.setLayout({
                ...layoutStore.layout,
                rightWidth: newWidth,
              })
              layoutStore.saveToElectron()
              return newWidth
            })
          }}
          onDoubleClick={() => {
            setRightPanelWidth(320)
            layoutStore.setLayout({
              ...layoutStore.layout,
              rightWidth: 320,
            })
            layoutStore.saveToElectron()
          }}
          testId="separator-right"
        />
        <div style={{ width: rightPanelWidth, minWidth: MIN_PANEL_SIZE, maxWidth: MAX_SIDEBAR_WIDTH }} className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex border-b border-gray-200 dark:border-gray-700" data-testid="right-sidebar-tabs">
            {chatVisible && (
            <button
              className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${
                rightTab === 'chat'
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setRightTab('chat')}
              data-testid="tab-chat"
            >
              Chat
            </button>
            )}
            {gitVisible && (
            <button
              className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${
                rightTab === 'git'
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setRightTab('git')}
              data-testid="tab-git"
            >
              Git
            </button>
            )}
          </div>
          {/* Panel Content */}
          <div className="flex-1 min-h-0 flex flex-col">
            {rightTab === 'chat' ? <ChatPanel /> : <GitPanel />}
          </div>
        </div>
        </>)}
      </div>

      {/* Diff Viewer Overlay (Feature #41) */}
      <DiffViewer />

      {/* File History Overlay */}
      <FileHistoryPanel />

      {/* Version Preview Overlay (code + 3D) */}
      <VersionPreview />

      {/* Toast notification (Feature #62: missing project error) */}
      {toastMessage && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-red-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-4" data-testid="toast-message">
          <span>{toastMessage}</span>
          {missingProjectPath && (
            <button
              className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1 rounded"
              data-testid="toast-remove-btn"
              onClick={() => {
                settingsStore.removeRecentProject(missingProjectPath)
                settingsStore.saveToElectron()
                setMissingProjectPath(null)
                setToastMessage(null)
              }}
            >
              Remove
            </button>
          )}
          <button
            className="text-gray-200 dark:text-gray-300 hover:text-white text-xs"
            onClick={() => { setToastMessage(null); setMissingProjectPath(null) }}
            data-testid="toast-dismiss-btn"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 border-t px-4 py-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400" data-testid="status-bar">
        <div className="flex items-center gap-4">
          {/* Branch indicator (Feature #43) */}
          {gitStore.currentBranch && (
            <span className="text-purple-400" data-testid="status-bar-branch" title="Current git branch">
              ⎇ {gitStore.currentBranch}
            </span>
          )}
          <span data-testid="app-status" className={
            compilerStore.compileStatus === 'compiling' ? 'text-yellow-400' :
            compilerStore.compileStatus === 'success' ? 'text-green-400' :
            compilerStore.compileStatus === 'error' ? 'text-red-400' :
            'text-gray-400'
          }>
            {compilerStore.compileStatus === 'compiling' ? '⟳ Compiling...' :
             compilerStore.compileStatus === 'success' ? `✓ Compiled (${compilerStore.compileDuration}ms)` :
             compilerStore.compileStatus === 'error' ? `✕ ${compilerStore.errors.length} error${compilerStore.errors.length !== 1 ? 's' : ''}` :
             '● Ready'}
          </span>
          {settingsStore.preferences.editor.autoCompile && (
            <span className="text-gray-400 dark:text-gray-500" data-testid="autocompile-indicator" title="Auto-compile enabled">⚡ Auto</span>
          )}
          <span data-testid="cursor-position">
            Ln {editorStore.cursorLine}, Col {editorStore.cursorColumn}
          </span>
          <span data-testid="line-count">Lines: {editorStore.editorContent.split('\n').length}</span>
        </div>
        <div className="flex items-center gap-4">
          <span data-testid="file-encoding">UTF-8</span>
          <span data-testid="current-language">OpenSCAD</span>
          <span data-testid="ipc-mode">{ipcStatus === 'success' ? 'Electron IPC Active' : ipcStatus === 'no-electron' ? 'Browser Mode (No IPC)' : 'IPC Status Unknown'}</span>
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog (Feature #90) */}
      <KeyboardShortcutsDialog
        isOpen={showKeyboardShortcutsDialog}
        onClose={() => setShowKeyboardShortcutsDialog(false)}
      />

      {/* About Dialog (Feature #90) */}
      <AboutDialog
        isOpen={showAboutDialog}
        onClose={() => setShowAboutDialog(false)}
        appVersion="0.1.0"
        openscadVersion={openscadVersion}
      />
    </div>
  )
}

export default App
