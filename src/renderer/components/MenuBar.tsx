import { useState, useRef, useEffect } from 'react'
import type { LayoutPreset } from '../stores/layoutStore'

type MenuItem =
  | {
      separator: true
    }
  | {
      label: string
      onClick?: () => void
      separator?: false
      submenu?: MenuItem[]
      disabled?: boolean
      shortcut?: string
    }

interface MenuBarProps {
  onOpenProject?: () => void
  onOpenFile?: () => void
  onNewFile?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onCloseProject?: () => void
  onNewProject?: () => void
  recentProjects?: Array<{ name: string; path: string }>
  onOpenRecentProject?: (path: string) => void
  onExport?: () => void
  onCompile?: () => void
  hasProjectOpen?: boolean
  onToggleEditor?: () => void
  onToggleViewer?: () => void
  onToggleChatPanel?: () => void
  onToggleGitPanel?: () => void
  onToggleConsole?: () => void
  onToggleTheme?: () => void
  onToggleAutoCompile?: () => void
  autoCompileEnabled?: boolean
  editorVisible?: boolean
  viewerVisible?: boolean
  chatPanelVisible?: boolean
  gitPanelVisible?: boolean
  consoleVisible?: boolean
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void
  onShowKeyboardShortcuts?: () => void
  onShowAbout?: () => void
  onQuit?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onCut?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onFind?: () => void
  onReplace?: () => void
  layoutPresets?: LayoutPreset[]
  activePresetId?: string | null
  onApplyPreset?: (presetId: string) => void
  onResetLayout?: () => void
  // Git menu
  onGitInit?: () => void
  onGitCommit?: () => void
  onGitPush?: () => void
  onGitPull?: () => void
  onGitRefresh?: () => void
}

export default function MenuBar({
  onOpenProject,
  onOpenFile,
  onNewFile,
  onSave,
  onSaveAs,
  onCloseProject,
  onNewProject,
  recentProjects = [],
  onOpenRecentProject,
  onExport,
  onCompile,
  hasProjectOpen = false,
  onToggleEditor,
  onToggleViewer,
  onToggleChatPanel,
  onToggleGitPanel,
  onToggleConsole,
  onToggleTheme,
  onToggleAutoCompile,
  autoCompileEnabled = true,
  editorVisible = true,
  viewerVisible = true,
  chatPanelVisible = true,
  gitPanelVisible = true,
  consoleVisible = true,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onShowKeyboardShortcuts,
  onShowAbout,
  onQuit,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFind,
  onReplace,
  layoutPresets = [],
  activePresetId = null,
  onApplyPreset,
  onResetLayout,
  onGitInit,
  onGitCommit,
  onGitPush,
  onGitPull,
  onGitRefresh,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null)
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Build menu structure
  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New Project...', onClick: onNewProject },
      { label: 'New File...', onClick: onNewFile, shortcut: 'Ctrl+N', disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Open Project...', onClick: onOpenProject, shortcut: 'Ctrl+O' },
      { label: 'Open File...', onClick: onOpenFile, shortcut: 'Ctrl+Shift+O' },
      {
        label: 'Recent Projects',
        submenu:
          recentProjects.length > 0
            ? recentProjects.map((rp) => ({
                label: rp.name,
                onClick: () => onOpenRecentProject?.(rp.path),
              }))
            : [{ label: 'No recent projects', disabled: true }],
      },
      { separator: true },
      { label: 'Close Project', onClick: onCloseProject, disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Save', onClick: onSave, shortcut: 'Ctrl+S', disabled: !hasProjectOpen },
      { label: 'Save As...', onClick: onSaveAs, shortcut: 'Ctrl+Shift+S', disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Export STL...', onClick: onExport, disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Quit', onClick: onQuit, shortcut: 'Ctrl+Q' },
    ],
    Edit: [
      { label: 'Undo', onClick: onUndo, shortcut: 'Ctrl+Z', disabled: !hasProjectOpen },
      { label: 'Redo', onClick: onRedo, shortcut: 'Ctrl+Shift+Z', disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Cut', onClick: onCut, shortcut: 'Ctrl+X', disabled: !hasProjectOpen },
      { label: 'Copy', onClick: onCopy, shortcut: 'Ctrl+C', disabled: !hasProjectOpen },
      { label: 'Paste', onClick: onPaste, shortcut: 'Ctrl+V', disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Find...', onClick: onFind, shortcut: 'Ctrl+F', disabled: !hasProjectOpen },
      { label: 'Replace...', onClick: onReplace, shortcut: 'Ctrl+H', disabled: !hasProjectOpen },
    ],
    View: [
      {
        label: editorVisible ? '✓ Toggle Editor' : 'Toggle Editor',
        onClick: onToggleEditor
      },
      {
        label: viewerVisible ? '✓ Toggle 3D Viewer' : 'Toggle 3D Viewer',
        onClick: onToggleViewer
      },
      {
        label: chatPanelVisible ? '✓ Toggle Chat Panel' : 'Toggle Chat Panel',
        onClick: onToggleChatPanel
      },
      {
        label: gitPanelVisible ? '✓ Toggle Git Panel' : 'Toggle Git Panel',
        onClick: onToggleGitPanel
      },
      {
        label: consoleVisible ? '✓ Toggle Console' : 'Toggle Console',
        onClick: onToggleConsole,
        shortcut: 'Ctrl+`'
      },
      { separator: true },
      {
        label: 'Layout Presets',
        submenu: [
          ...layoutPresets.map((preset) => ({
            label: `${activePresetId === preset.id ? '✓ ' : ''}${preset.icon} ${preset.name}`,
            onClick: () => onApplyPreset?.(preset.id),
          })),
          { separator: true as const },
          { label: 'Reset to Default', onClick: onResetLayout },
        ],
      },
      { separator: true },
      { label: 'Toggle Theme (Dark/Light)', onClick: onToggleTheme },
      { separator: true },
      { label: 'Zoom In', onClick: onZoomIn, shortcut: 'Ctrl+=' },
      { label: 'Zoom Out', onClick: onZoomOut, shortcut: 'Ctrl+-' },
      { label: 'Reset Zoom', onClick: onResetZoom, shortcut: 'Ctrl+0' },
    ],
    Build: [
      { label: 'Compile Now', onClick: onCompile, shortcut: 'Ctrl+Shift+B' },
      { separator: true },
      {
        label: autoCompileEnabled ? '✓ Auto-compile' : 'Auto-compile',
        onClick: onToggleAutoCompile,
      },
    ],
    Git: [
      { label: 'Initialize Repository', onClick: onGitInit, disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Commit...', onClick: onGitCommit, disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Push', onClick: onGitPush, disabled: !hasProjectOpen },
      { label: 'Pull', onClick: onGitPull, disabled: !hasProjectOpen },
      { separator: true },
      { label: 'Refresh Status', onClick: onGitRefresh, disabled: !hasProjectOpen },
    ],
    Help: [
      { label: 'Keyboard Shortcuts', onClick: onShowKeyboardShortcuts },
      { separator: true },
      { label: 'OpenSCAD Documentation', disabled: true },
      { label: 'ClawdCAD Guide', disabled: true },
      { separator: true },
      { label: 'About ClawdCAD', onClick: onShowAbout },
    ],
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const isInsideMenu = Object.values(menuRefs.current).some((ref) => ref?.contains(target))
      if (!isInsideMenu) {
        setOpenMenu(null)
        setHoveredMenu(null)
      }
    }
    // Delay to avoid catching the click that opened the menu
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenu])

  // Handle menu item click
  const handleMenuClick = (menuName: string) => {
    if (openMenu === menuName) {
      setOpenMenu(null)
      setHoveredMenu(null)
    } else {
      setOpenMenu(menuName)
      setHoveredMenu(null)
    }
  }

  // Handle menu hover when a menu is already open
  const handleMenuHover = (menuName: string) => {
    if (openMenu) {
      setOpenMenu(menuName)
      setHoveredMenu(null)
    } else {
      setHoveredMenu(menuName)
    }
  }

  const handleItemClick = (item: MenuItem) => {
    if ('separator' in item && item.separator) return
    if ('disabled' in item && item.disabled) return
    if ('submenu' in item && item.submenu) return
    if ('onClick' in item) {
      item.onClick?.()
    }
    setOpenMenu(null)
    setHoveredMenu(null)
  }

  const renderMenuItem = (item: MenuItem, index: number) => {
    if (item.separator) {
      return <div key={`sep-${index}`} className="my-1 border-t border-gray-200 dark:border-gray-700" />
    }

    if (item.submenu) {
      return (
        <div
          key={index}
          className={`group relative px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
            item.disabled ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'
          } ${!item.disabled && 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          onMouseEnter={() => !item.disabled && setHoveredMenu(`submenu-${index}`)}
          onMouseLeave={() => setHoveredMenu(null)}
        >
          <span>{item.label}</span>
          <span className="ml-4 text-gray-500">▸</span>
          {/* Submenu dropdown */}
          {hoveredMenu === `submenu-${index}` && !item.disabled && (
            <div
              className="absolute left-full top-0 ml-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg min-w-[200px] z-50"
              onMouseEnter={() => setHoveredMenu(`submenu-${index}`)}
            >
              {item.submenu.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
            </div>
          )}
        </div>
      )
    }

    return (
      <button
        key={index}
        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
          item.disabled ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
        }`}
        onClick={() => handleItemClick(item)}
        disabled={item.disabled}
        data-testid={`menu-item-${item.label.toLowerCase().replace(/\s+/g, '-').replace(/✓/g, '')}`}
      >
        <span>{item.label}</span>
        {item.shortcut && <span className="ml-4 text-xs text-gray-500">{item.shortcut}</span>}
      </button>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 px-2 py-1 flex items-center font-['Inter',sans-serif]" data-testid="menu-bar">
      {Object.keys(menus).map((menuName) => (
        <div
          key={menuName}
          ref={(el) => (menuRefs.current[menuName] = el)}
          className="relative"
          onMouseEnter={() => handleMenuHover(menuName)}
        >
          <button
            className={`px-3 py-1 text-sm rounded ${
              openMenu === menuName || hoveredMenu === menuName ? 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-100 dark:bg-gray-700' : ''
            }`}
            onClick={() => handleMenuClick(menuName)}
            data-testid={`menu-${menuName.toLowerCase()}`}
          >
            {menuName}
          </button>
          {/* Dropdown */}
          {openMenu === menuName && (
            <div
              className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg min-w-[240px] z-50"
              data-testid={`menu-dropdown-${menuName.toLowerCase()}`}
            >
              {menus[menuName].map((item, index) => renderMenuItem(item, index))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
