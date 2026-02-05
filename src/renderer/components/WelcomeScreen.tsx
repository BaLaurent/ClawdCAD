import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

interface WelcomeScreenProps {
  onNewProject: (projectName: string) => void
  onOpenFolder: () => void
  onOpenFile: () => void
  recentProjects: Array<{ name: string; path: string; lastOpened: number }>
  onOpenRecentProject: (path: string) => void
  onRemoveRecentProject: (path: string) => void
}

export default function WelcomeScreen({
  onNewProject,
  onOpenFolder,
  onOpenFile,
  recentProjects,
  onOpenRecentProject,
  onRemoveRecentProject,
}: WelcomeScreenProps) {
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)
  const theme = useSettingsStore((s) => s.preferences.editor.theme)

  const handleNewProject = () => {
    if (!newProjectName.trim()) return
    onNewProject(newProjectName.trim())
    setShowNewProjectDialog(false)
    setNewProjectName('')
  }

  const handleRemoveProject = (path: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening the project
    onRemoveRecentProject(path)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <>
      <div
        className="h-full flex items-center justify-center font-sans bg-gray-100 dark:bg-[#1a1a2e]"
        data-testid="welcome-screen"
        data-theme={theme}
      >
        <div className="max-w-2xl w-full px-8">
          {/* Logo and Title */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4 text-gray-800 dark:text-gray-200">
              ClawdCAD
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400">
              Parametric 3D Modeling with OpenSCAD
            </p>
            <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
              An all-in-one desktop application combining code editor, 3D viewer, AI assistant, and Git version control
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* Primary button */}
            <button
              className="text-white font-medium py-8 px-6 rounded-lg transition-colors flex flex-col items-center gap-3 shadow-lg hover:brightness-110 bg-blue-500"
              onClick={() => setShowNewProjectDialog(true)}
              data-testid="welcome-new-project-btn"
            >
              <span className="text-4xl">✚</span>
              <span className="text-lg">New Project</span>
              <span className="text-xs text-center text-blue-200">
                Create a new project folder with starter template
              </span>
            </button>

            {/* Secondary button */}
            <button
              className="font-medium py-8 px-6 rounded-lg transition-colors flex flex-col items-center gap-3 border-2 border-gray-300 dark:border-[#404040] text-gray-800 dark:text-gray-200 bg-transparent hover:bg-white dark:hover:bg-[#16213e]"
              onClick={onOpenFolder}
              data-testid="welcome-open-folder-btn"
            >
              <span className="text-4xl">📂</span>
              <span className="text-lg">Open Folder</span>
              <span className="text-xs text-center text-gray-500 dark:text-gray-400">
                Open an existing project folder
              </span>
            </button>

            {/* Ghost button */}
            <button
              className="font-medium py-8 px-6 rounded-lg transition-colors flex flex-col items-center gap-3 bg-transparent text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-[#16213e]/50"
              onClick={onOpenFile}
              data-testid="welcome-open-file-btn"
            >
              <span className="text-4xl">📄</span>
              <span className="text-lg">Open File</span>
              <span className="text-xs text-center text-gray-500 dark:text-gray-400">
                Open a single .scad file
              </span>
            </button>
          </div>

          {/* Recent Projects */}
          {recentProjects.length > 0 ? (
            <div className="mt-8" data-testid="recent-projects-section">
              <h2 className="text-lg font-semibold mb-3 text-gray-500 dark:text-gray-400">
                Recent Projects
              </h2>
              <div className="rounded-lg overflow-hidden bg-white dark:bg-[#16213e] border border-gray-300 dark:border-[#404040]">
                {recentProjects.slice(0, 5).map((project) => (
                  <div
                    key={project.path}
                    className="relative"
                    onMouseEnter={() => setHoveredProject(project.path)}
                    onMouseLeave={() => setHoveredProject(null)}
                  >
                    <button
                      className="w-full text-left px-4 py-3 transition-colors flex items-center justify-between border-b border-gray-300 dark:border-[#404040] hover:bg-blue-500/5 dark:hover:bg-blue-500/10"
                      onClick={() => onOpenRecentProject(project.path)}
                      data-testid="welcome-recent-project-item"
                      title={project.path}
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-medium text-gray-800 dark:text-gray-200"
                          data-testid="recent-project-name"
                        >
                          {project.name}
                        </div>
                        <div
                          className="text-xs truncate text-gray-400 dark:text-gray-500"
                          data-testid="recent-project-path"
                        >
                          {project.path}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div
                          className="text-xs text-gray-400 dark:text-gray-500"
                          data-testid="recent-project-date"
                        >
                          {formatDate(project.lastOpened)}
                        </div>
                        {hoveredProject === project.path && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="px-2 py-1 rounded transition-colors cursor-pointer text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-black/5 dark:hover:bg-[#404040]/50"
                            onClick={(e) => handleRemoveProject(project.path, e)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRemoveProject(project.path, e as unknown as React.MouseEvent) }}
                            data-testid="recent-project-remove-btn"
                            title="Remove from list"
                          >
                            ✕
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="mt-8 text-center text-gray-400 dark:text-gray-500"
              data-testid="recent-projects-empty"
            >
              <p>No recent projects yet. Create or open a project to get started!</p>
            </div>
          )}

          {/* Getting Started Tips */}
          <div className="mt-12 text-center text-xs text-gray-400 dark:text-gray-500">
            <p>Tip: ClawdCAD embeds OpenSCAD, Git, and AI assistance all in one app</p>
            <p className="mt-1">Press Ctrl+Shift+B to compile | Ctrl+S to save | Ctrl+` to toggle console</p>
          </div>
        </div>
      </div>

      {/* New Project Dialog */}
      {showNewProjectDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          data-testid="welcome-new-project-dialog"
        >
          <div className="rounded-lg shadow-xl p-6 w-96 bg-white dark:bg-[#16213e] border border-gray-300 dark:border-[#404040]">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
              New Project
            </h3>
            <label className="block text-sm mb-1 text-gray-500 dark:text-gray-400">
              Project Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded text-sm focus:outline-none bg-gray-100 dark:bg-[#1a1a2e] border border-gray-300 dark:border-[#404040] text-gray-800 dark:text-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              placeholder="my-openscad-project"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewProject()
                if (e.key === 'Escape') {
                  setShowNewProjectDialog(false)
                  setNewProjectName('')
                }
              }}
              autoFocus
              data-testid="welcome-new-project-name-input"
            />
            <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
          {/* eslint-disable-next-line react/no-unescaped-entities */}
              A folder with this name will be created. You'll choose where to save it next.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              {/* Ghost cancel button */}
              <button
                className="px-4 py-2 text-sm transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                onClick={() => {
                  setShowNewProjectDialog(false)
                  setNewProjectName('')
                }}
              >
                Cancel
              </button>
              {/* Primary create button */}
              <button
                className="px-4 py-2 text-sm text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-110 bg-blue-500"
                onClick={handleNewProject}
                disabled={!newProjectName.trim()}
                data-testid="welcome-create-project-btn"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
