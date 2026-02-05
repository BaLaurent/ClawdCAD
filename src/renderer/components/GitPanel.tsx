import { useState, useEffect, useCallback } from 'react'
import { useGitStore } from '../stores/gitStore'
import { useSettingsStore } from '../stores/settingsStore'
import { GitFileStatus, GitLogEntry, CommitFileEntry } from '../../shared/types'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  modified: { label: 'M', color: 'text-yellow-400' },
  added: { label: 'A', color: 'text-green-400' },
  untracked: { label: '?', color: 'text-gray-500 dark:text-gray-400' },
  deleted: { label: 'D', color: 'text-red-400' },
}

function FileItem({
  file,
  onAction,
  onDiffClick,
  onDiscard,
  actionLabel,
}: {
  file: GitFileStatus
  onAction: () => void
  onDiffClick: () => void
  onDiscard?: () => void
  actionLabel: string
}) {
  const statusInfo = STATUS_LABELS[file.status] || { label: '?', color: 'text-gray-500 dark:text-gray-400' }
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer group"
      data-testid={`git-file-${file.staged ? 'staged' : 'unstaged'}`}
      title={`Click to view diff, right buttons to ${actionLabel.toLowerCase()}`}
    >
      <span className={`font-mono text-xs w-4 ${statusInfo.color}`}>{statusInfo.label}</span>
      <span
        className="flex-1 text-gray-700 dark:text-gray-300 truncate hover:underline"
        onClick={onDiffClick}
        data-testid="git-file-diff-click"
      >
        {file.filepath}
      </span>
      {onDiscard && (
        <button
          className="text-xs text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-300 px-1"
          onClick={onDiscard}
          data-testid="git-file-discard"
          title="Discard changes (restore to HEAD)"
        >
          ✕
        </button>
      )}
      <button
        className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-700 dark:hover:text-gray-300 px-1"
        onClick={onAction}
        data-testid={`git-file-action-${file.staged ? 'unstage' : 'stage'}`}
      >
        {actionLabel}
      </button>
    </div>
  )
}

function relativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}

const COMMIT_FILE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  added: { label: 'A', color: 'text-green-400' },
  modified: { label: 'M', color: 'text-yellow-400' },
  deleted: { label: 'D', color: 'text-red-400' },
}

function CommitItem({
  commit,
  isExpanded,
  commitFiles,
  isLoadingFiles,
  onToggle,
  onFileClick,
}: {
  commit: GitLogEntry
  isExpanded: boolean
  commitFiles: CommitFileEntry[]
  isLoadingFiles: boolean
  onToggle: () => void
  onFileClick: (filepath: string) => void
}) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700/50 last:border-0" data-testid="commit-item">
      <div
        className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 w-3">{isExpanded ? '\u25BE' : '\u25B8'}</span>
          <span className="font-mono text-xs text-blue-400">{commit.oid.slice(0, 7)}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(commit.author.timestamp)}</span>
        </div>
        <div className="text-gray-700 dark:text-gray-300 text-xs mt-0.5 truncate pl-5">{commit.message}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 pl-5">{commit.author.name}</div>
      </div>
      {isExpanded && (
        <div className="bg-gray-100 dark:bg-gray-900/50 px-2 py-1" data-testid="commit-files">
          {isLoadingFiles ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-4 py-1 animate-pulse">Loading files...</div>
          ) : commitFiles.length === 0 ? (
            <div className="text-xs text-gray-400 dark:text-gray-600 px-4 py-1">No file changes</div>
          ) : (
            commitFiles.map((file) => {
              const statusInfo = COMMIT_FILE_STATUS_LABELS[file.status] || { label: '?', color: 'text-gray-500 dark:text-gray-400' }
              return (
                <div
                  key={file.filepath}
                  className="flex items-center gap-2 px-4 py-0.5 text-xs hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFileClick(file.filepath)
                  }}
                  data-testid="commit-file-entry"
                >
                  <span className={`font-mono w-3 ${statusInfo.color}`}>{statusInfo.label}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate hover:text-gray-800 dark:hover:text-gray-200">{file.filepath}</span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function GitPanel() {
  const gitStore = useGitStore()
  const [commitMessage, setCommitMessage] = useState('')
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null)
  const [showRemoteConfig, setShowRemoteConfig] = useState(false)
  const [remoteUrlInput, setRemoteUrlInput] = useState('')
  const [branchError, setBranchError] = useState<string | null>(null)

  // Load status on mount (Feature #50: projectDir is now set by App.tsx openProject)
  useEffect(() => {
    // Only refresh if projectDir is set (will be set when project is opened)
    if (gitStore.projectDir) {
      gitStore.refreshStatus()
      gitStore.refreshHistory()
      gitStore.refreshBranches()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitStore.projectDir])

  const handleStage = useCallback((filepath: string) => {
    gitStore.stageFile(filepath)
  }, [gitStore])

  const handleUnstage = useCallback((filepath: string) => {
    gitStore.unstageFile(filepath)
  }, [gitStore])

  const handleDiscard = useCallback(async (filepath: string) => {
    const confirmed = window.confirm(`Discard changes to "${filepath}"? This will restore the file to the HEAD version.`)
    if (!confirmed) return
    await gitStore.discardFile(filepath)
  }, [gitStore])

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || gitStore.stagedFiles.length === 0) return

    // Sync local message to store before committing
    gitStore.setCommitMessage(commitMessage)

    const gitPrefs = useSettingsStore.getState().preferences.git ?? { authorName: 'ClawdCAD User', authorEmail: 'user@ClawdCAD.local' }
    const result = await gitStore.commit({
      name: gitPrefs.authorName,
      email: gitPrefs.authorEmail,
    })

    if (result.success) {
      setCommitMessage('')
      setCommitSuccess(result.oid?.slice(0, 7) || 'done')
      setTimeout(() => setCommitSuccess(null), 3000)
    }
  }, [commitMessage, gitStore])

  const handleRefresh = useCallback(() => {
    gitStore.refreshStatus()
    gitStore.refreshHistory()
    gitStore.refreshBranches()
  }, [gitStore])

  const handleConfigureRemote = useCallback(async () => {
    if (!remoteUrlInput.trim()) return
    if (!remoteUrlInput.startsWith('https://')) {
      gitStore.clearRemoteMessages()
      return
    }
    await gitStore.configureRemote(remoteUrlInput.trim())
    setShowRemoteConfig(false)
  }, [remoteUrlInput, gitStore])

  const handleCreateBranch = useCallback(async () => {
    const name = gitStore.newBranchName.trim()
    if (!name) return
    setBranchError(null)
    const result = await gitStore.createBranch(name)
    if (!result.success) {
      setBranchError(result.error || 'Failed to create branch')
    }
  }, [gitStore])

  const handleSwitchBranch = useCallback(async (branch: string) => {
    setBranchError(null)
    const result = await gitStore.switchBranch(branch)
    if (!result.success && result.error !== 'Cancelled') {
      setBranchError(result.error || 'Failed to switch branch')
    }
  }, [gitStore])

  return (
    <div className="flex flex-col h-full" data-testid="git-panel">
      {/* Header with branch indicator and push/pull */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">GIT</h2>
          {gitStore.currentBranch && (
            <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full" data-testid="current-branch-badge">
              {gitStore.currentBranch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Push Button */}
          <button
            className={`text-xs px-2 py-1 rounded ${
              gitStore.isPushing
                ? 'bg-blue-800 text-blue-300 cursor-wait'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            onClick={() => gitStore.push()}
            disabled={gitStore.isPushing}
            data-testid="git-push"
            title="Push to remote"
          >
            {gitStore.isPushing ? '⟳ Pushing...' : '↑ Push'}
          </button>
          {/* Pull Button */}
          <button
            className={`text-xs px-2 py-1 rounded ${
              gitStore.isPulling
                ? 'bg-blue-800 text-blue-300 cursor-wait'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            onClick={() => gitStore.pull()}
            disabled={gitStore.isPulling}
            data-testid="git-pull"
            title="Pull from remote"
          >
            {gitStore.isPulling ? '⟳ Pulling...' : '↓ Pull'}
          </button>
          {/* Remote Config */}
          <button
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setShowRemoteConfig(!showRemoteConfig)}
            data-testid="git-remote-config"
            title="Configure remote"
          >
            ⚙
          </button>
          {/* Refresh */}
          <button
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={handleRefresh}
            data-testid="git-refresh"
            title="Refresh git status"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {/* Remote Config Panel */}
        {showRemoteConfig && (
          <div className="mb-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3" data-testid="remote-config-panel">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">REMOTE CONFIGURATION</div>
            <input
              className="w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 mb-2"
              placeholder="https://github.com/user/repo.git"
              value={remoteUrlInput}
              onChange={(e) => setRemoteUrlInput(e.target.value)}
              data-testid="remote-url-input"
            />
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 text-xs rounded font-medium ${
                  !remoteUrlInput.trim() || !remoteUrlInput.startsWith('https://')
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
                disabled={!remoteUrlInput.trim() || !remoteUrlInput.startsWith('https://')}
                onClick={handleConfigureRemote}
                data-testid="remote-save"
              >
                Save Remote
              </button>
              <button
                className="px-3 py-1 text-xs rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                onClick={() => setShowRemoteConfig(false)}
              >
                Cancel
              </button>
            </div>
            {!remoteUrlInput.startsWith('https://') && remoteUrlInput.trim() && (
              <div className="text-xs text-yellow-400 mt-1">HTTPS remotes only (no SSH)</div>
            )}
          </div>
        )}

        {/* Remote Error/Success Messages */}
        {gitStore.remoteError && (
          <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-xs text-red-300 mb-3" data-testid="remote-error">
            {gitStore.remoteError}
          </div>
        )}
        {gitStore.remoteSuccess && (
          <div className="bg-green-900/30 border border-green-700 rounded px-3 py-2 text-xs text-green-300 mb-3" data-testid="remote-success">
            ✓ {gitStore.remoteSuccess}
          </div>
        )}

        {/* Error */}
        {gitStore.error && (
          <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-xs text-red-300 mb-3" data-testid="git-error">
            {gitStore.error}
          </div>
        )}

        {/* Commit Success Toast */}
        {commitSuccess && (
          <div className="bg-green-900/30 border border-green-700 rounded px-3 py-2 text-xs text-green-300 mb-3" data-testid="commit-success">
            ✓ Committed: {commitSuccess}
          </div>
        )}

        {/* Branch Management (Feature #43) */}
        <div className="mb-3" data-testid="branch-section">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
            BRANCHES
            <button
              className="text-xs text-blue-400 hover:text-blue-300"
              onClick={() => gitStore.setShowCreateBranch(!gitStore.showCreateBranch)}
              data-testid="create-branch-toggle"
              title="Create new branch"
            >
              + New
            </button>
          </div>

          {/* Create Branch Form */}
          {gitStore.showCreateBranch && (
            <div className="mb-2 flex gap-1" data-testid="create-branch-form">
              <input
                className="flex-1 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                placeholder="branch-name"
                value={gitStore.newBranchName}
                onChange={(e) => gitStore.setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                data-testid="new-branch-input"
              />
              <button
                className={`px-2 py-1 text-xs rounded ${
                  !gitStore.newBranchName.trim()
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
                disabled={!gitStore.newBranchName.trim()}
                onClick={handleCreateBranch}
                data-testid="create-branch-confirm"
              >
                Create
              </button>
            </div>
          )}

          {branchError && (
            <div className="text-xs text-red-400 mb-1 px-2" data-testid="branch-error">{branchError}</div>
          )}

          {/* Branch List */}
          {gitStore.branches.length > 0 && (
            <div className="space-y-0.5" data-testid="branch-list">
              {gitStore.branches.map((branch) => (
                <div
                  key={branch.name}
                  className={`flex items-center gap-2 px-2 py-1 text-xs rounded cursor-pointer ${
                    branch.current
                      ? 'bg-purple-600/20 text-purple-300'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  onClick={() => !branch.current && handleSwitchBranch(branch.name)}
                  data-testid="branch-item"
                >
                  <span className="font-mono">{branch.current ? '●' : '○'}</span>
                  <span className="flex-1 truncate">{branch.name}</span>
                  {branch.current && <span className="text-xs text-purple-400">current</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commit Form */}
        <div className="mb-3" data-testid="commit-form">
          <textarea
            className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:border-blue-500"
            rows={3}
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            data-testid="commit-input"
          />
          <button
            className={`w-full mt-1 px-3 py-1.5 rounded text-sm font-medium ${
              gitStore.isCommitting || !commitMessage.trim() || gitStore.stagedFiles.length === 0
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            onClick={handleCommit}
            disabled={gitStore.isCommitting || !commitMessage.trim() || gitStore.stagedFiles.length === 0}
            data-testid="commit-button"
          >
            {gitStore.isCommitting ? 'Committing...' : `Commit (${gitStore.stagedFiles.length} staged)`}
          </button>
        </div>

        {/* Staged Changes */}
        <div className="mb-3" data-testid="staged-section">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
            STAGED CHANGES
            {gitStore.stagedFiles.length > 0 && (
              <span className="bg-green-600/30 text-green-400 px-1.5 py-0.5 rounded-full text-xs">
                {gitStore.stagedFiles.length}
              </span>
            )}
          </div>
          {gitStore.stagedFiles.length === 0 ? (
            <div className="text-xs text-gray-400 dark:text-gray-600 px-2 py-1">No staged changes</div>
          ) : (
            gitStore.stagedFiles.map((file) => (
              <FileItem
                key={file.filepath}
                file={file}
                onAction={() => handleUnstage(file.filepath)}
                onDiffClick={() => gitStore.openDiff(file.filepath, true)}
                actionLabel="Unstage"
              />
            ))
          )}
        </div>

        {/* Unstaged Changes */}
        <div className="mb-3" data-testid="unstaged-section">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
            UNSTAGED CHANGES
            {gitStore.unstagedFiles.length > 0 && (
              <span className="bg-yellow-600/30 text-yellow-400 px-1.5 py-0.5 rounded-full text-xs">
                {gitStore.unstagedFiles.length}
              </span>
            )}
          </div>
          {gitStore.isLoading ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 animate-pulse">Loading...</div>
          ) : gitStore.unstagedFiles.length === 0 ? (
            <div className="text-xs text-gray-400 dark:text-gray-600 px-2 py-1">No unstaged changes</div>
          ) : (
            gitStore.unstagedFiles.map((file) => (
              <FileItem
                key={file.filepath}
                file={file}
                onAction={() => handleStage(file.filepath)}
                onDiffClick={() => gitStore.openDiff(file.filepath, false)}
                onDiscard={(file.status === 'modified' || file.status === 'deleted') ? () => handleDiscard(file.filepath) : undefined}
                actionLabel="Stage"
              />
            ))
          )}
        </div>

        {/* Commit History */}
        <div data-testid="commit-history">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">RECENT COMMITS</div>
          {gitStore.isLoadingHistory ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 animate-pulse">Loading...</div>
          ) : gitStore.commits.length === 0 ? (
            <div className="text-xs text-gray-400 dark:text-gray-600 px-2 py-1">No commits yet</div>
          ) : (
            gitStore.commits.map((commit) => (
              <CommitItem
                key={commit.oid}
                commit={commit}
                isExpanded={gitStore.expandedCommitOid === commit.oid}
                commitFiles={gitStore.expandedCommitOid === commit.oid ? gitStore.commitFilesForExpanded : []}
                isLoadingFiles={gitStore.expandedCommitOid === commit.oid && gitStore.isLoadingCommitFiles}
                onToggle={() => gitStore.toggleCommitExpand(commit.oid)}
                onFileClick={(filepath) => gitStore.openVersionPreview(filepath, commit.oid, commit.message)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
