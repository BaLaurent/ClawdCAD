import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useProjectStore, type ProjectFile } from '../stores/projectStore'
import { useEditorStore } from '../stores/editorStore'
import { SAMPLE_FILES } from '../sampleFiles'

/** Look up sample content by filename (browser mode fallback) */
function getSampleContent(filename: string): string | undefined {
  return SAMPLE_FILES[filename]
}

interface FileTreeItemProps {
  file: ProjectFile
  depth: number
  onFileClick: (file: ProjectFile) => void
  onContextMenu: (e: React.MouseEvent, file: ProjectFile) => void
  defaultExpanded?: boolean
}

function FileTreeItem({ file, depth, onFileClick, onContextMenu, defaultExpanded = true }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const editorStore = useEditorStore()
  const isActive = file.path === editorStore.activeFilePath
  const isOpen = editorStore.openFiles.some(f => f.path === file.path)
  const openFile = editorStore.openFiles.find(f => f.path === file.path)

  const isScadFile = file.name.endsWith('.scad')

  const handleClick = () => {
    if (file.isDirectory) {
      setExpanded(!expanded)
    } else {
      onFileClick(file)
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-1 px-2 py-1 text-sm cursor-pointer rounded ${
          isActive
            ? 'bg-blue-900/30 text-blue-300'
            : isOpen
            ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, file)}
        data-testid="file-tree-item"
        data-filepath={file.path}
      >
        {file.isDirectory ? (
          <span className="text-xs w-4 text-center">{expanded ? '▾' : '▸'}</span>
        ) : (
          <span className="text-xs w-4" />
        )}
        <span className="text-xs">
          {file.isDirectory ? (expanded ? '📂' : '📁') : isScadFile ? '🔧' : '📄'}
        </span>
        <span className="truncate">{file.name}</span>
        {openFile?.isDirty && <span className="text-yellow-400 text-xs ml-auto">●</span>}
      </div>
      {file.isDirectory && expanded && file.children?.map(child => (
        <FileTreeItem
          key={child.path}
          file={child}
          depth={depth + 1}
          onFileClick={onFileClick}
          onContextMenu={onContextMenu}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </>
  )
}

interface ContextMenuState {
  x: number
  y: number
  file: ProjectFile | null
  visible: boolean
}

export interface FileTreeHandle {
  newFile: () => void
  newFolder: () => void
  collapseAll: () => void
  refresh: () => void
}

const FileTree = forwardRef<FileTreeHandle>(function FileTree(_props, ref) {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, file: null, visible: false })
  const [showNewFileInput, setShowNewFileInput] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<ProjectFile | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [collapseKey, setCollapseKey] = useState(0)
  const [defaultExpanded, setDefaultExpanded] = useState(true)

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(m => ({ ...m, visible: false }))
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Load directory listing when project path changes
  const refreshFiles = useCallback(async () => {
    if (!projectStore.projectPath) return
    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.listDir(projectStore.projectPath)
      if (!result.error) {
        projectStore.setFiles(result.files as ProjectFile[])
      }
    }
  }, [projectStore])

  useEffect(() => {
    if (!projectStore.projectPath) return

    refreshFiles()

    // Set up file watcher
    if (window.electronAPI?.file) {
      window.electronAPI.file.watch(projectStore.projectPath)
      const unsubscribe = window.electronAPI.file.onFileChanged(() => {
        refreshFiles()
      })
      return () => {
        unsubscribe()
        window.electronAPI?.file?.stopWatch()
      }
    }
  }, [projectStore, projectStore.projectPath, refreshFiles])

  const handleFileClick = useCallback(async (file: ProjectFile) => {
    if (file.isDirectory) return

    // Check if already open
    const existing = editorStore.openFiles.find(f => f.path === file.path)
    if (existing) {
      editorStore.setActiveFile(file.path)
      return
    }

    // Read file content via IPC
    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.read(file.path)
      if (!result.error) {
        editorStore.openFile({
          path: file.path,
          name: file.name,
          content: result.content,
          isDirty: false,
        })
      }
    } else {
      // Browser mode: check if there's sample content available
      const sampleContent = getSampleContent(file.name)
      editorStore.openFile({
        path: file.path,
        name: file.name,
        content: sampleContent || `// ${file.name}\n`,
        isDirty: false,
      })
    }
  }, [editorStore])

  const handleContextMenu = useCallback((e: React.MouseEvent, file: ProjectFile) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, file, visible: true })
  }, [])

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file: null, visible: true })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(m => ({ ...m, visible: false }))
  }, [])

  const handleNewFile = useCallback(async () => {
    if (!newFileName.trim() || !projectStore.projectPath) return
    const dirPath = contextMenu.file?.isDirectory ? contextMenu.file.path : projectStore.projectPath
    const filePath = `${dirPath}/${newFileName.trim()}`

    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.create(filePath, '')
      if (result.success) {
        await refreshFiles()
        // Open the new file
        editorStore.openFile({
          path: filePath,
          name: newFileName.trim(),
          content: '',
          isDirty: false,
        })
      }
    }
    setShowNewFileInput(false)
    setNewFileName('')
  }, [newFileName, contextMenu.file, projectStore, editorStore, refreshFiles])

  const handleNewFolder = useCallback(async () => {
    if (!newFolderName.trim() || !projectStore.projectPath) return
    const dirPath = contextMenu.file?.isDirectory ? contextMenu.file.path : projectStore.projectPath
    const folderPath = `${dirPath}/${newFolderName.trim()}`

    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.createDir(folderPath)
      if (!result.error) {
        await refreshFiles()
      }
    }
    setShowNewFolderInput(false)
    setNewFolderName('')
  }, [newFolderName, contextMenu.file, projectStore, refreshFiles])

  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return
    const dir = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/'))
    const newPath = `${dir}/${renameValue.trim()}`

    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.rename(renameTarget.path, newPath)
      if (result.success && projectStore.projectPath) {
        await refreshFiles()
      }
    }
    setRenameTarget(null)
    setRenameValue('')
  }, [renameTarget, renameValue, projectStore, refreshFiles])

  const handleDelete = useCallback(async (file: ProjectFile) => {
    if (window.electronAPI?.file) {
      const result = await window.electronAPI.file.delete(file.path)
      if (result.success && projectStore.projectPath) {
        // Close if open in editor
        editorStore.closeFile(file.path)
        await refreshFiles()
      }
    }
  }, [projectStore, editorStore, refreshFiles])

  const handleCollapseAll = useCallback(() => {
    setDefaultExpanded(false)
    setCollapseKey(k => k + 1)
  }, [])

  const triggerNewFile = useCallback(() => {
    setShowNewFileInput(true)
  }, [])

  const triggerNewFolder = useCallback(() => {
    setShowNewFolderInput(true)
  }, [])

  // Expose API to parent via ref
  useImperativeHandle(ref, () => ({
    newFile: triggerNewFile,
    newFolder: triggerNewFolder,
    collapseAll: handleCollapseAll,
    refresh: refreshFiles,
  }), [triggerNewFile, triggerNewFolder, handleCollapseAll, refreshFiles])

  // No project open - show empty state
  if (!projectStore.projectPath) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm" data-testid="file-tree-empty">
        <div className="text-2xl mb-2">📁</div>
        <p>No project open</p>
        <p className="text-xs mt-1">Open or create a project to get started</p>
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-auto"
      data-testid="file-tree"
      onContextMenu={handleRootContextMenu}
    >
      {projectStore.files.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">
          <p>Empty project</p>
        </div>
      ) : (
        projectStore.files.map(file => (
          <FileTreeItem
            key={`${file.path}-${collapseKey}`}
            file={file}
            depth={0}
            onFileClick={handleFileClick}
            onContextMenu={handleContextMenu}
            defaultExpanded={defaultExpanded}
          />
        ))
      )}

      {/* New File Input */}
      {showNewFileInput && (
        <div className="px-2 py-1">
          <input
            type="text"
            className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none"
            placeholder="filename.scad"
            value={newFileName}
            onChange={e => setNewFileName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNewFile()
              if (e.key === 'Escape') { setShowNewFileInput(false); setNewFileName('') }
            }}
            autoFocus
            data-testid="new-file-input"
          />
        </div>
      )}

      {/* New Folder Input */}
      {showNewFolderInput && (
        <div className="px-2 py-1">
          <input
            type="text"
            className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none"
            placeholder="folder-name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNewFolder()
              if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName('') }
            }}
            autoFocus
            data-testid="new-folder-input"
          />
        </div>
      )}

      {/* Rename Input */}
      {renameTarget && (
        <div className="px-2 py-1">
          <input
            type="text"
            className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none"
            placeholder="new name"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') { setRenameTarget(null); setRenameValue('') }
            }}
            autoFocus
            data-testid="rename-input"
          />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg py-1 z-50 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="context-menu"
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            onClick={() => {
              setShowNewFileInput(true)
              closeContextMenu()
            }}
          >
            New File
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            onClick={() => {
              setShowNewFolderInput(true)
              closeContextMenu()
            }}
          >
            New Folder
          </button>
          {contextMenu.file && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => {
                  setRenameTarget(contextMenu.file)
                  setRenameValue(contextMenu.file?.name || '')
                  closeContextMenu()
                }}
              >
                Rename
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => {
                  if (contextMenu.file) handleDelete(contextMenu.file)
                  closeContextMenu()
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
})

export default FileTree
