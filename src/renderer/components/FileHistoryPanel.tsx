import { useGitStore } from '../stores/gitStore'
import { GitLogEntry } from '../../shared/types'

function relativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}

function HistoryCommitRow({ commit, filepath }: { commit: GitLogEntry; filepath: string }) {
  const gitStore = useGitStore()

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      data-testid="history-commit-row"
    >
      <span className="font-mono text-xs text-blue-400 w-16 shrink-0">{commit.oid.slice(0, 7)}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500 w-16 shrink-0">{relativeTime(commit.author.timestamp)}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{commit.message}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{commit.author.name}</span>
      <button
        className="text-xs px-3 py-1 rounded font-medium bg-blue-600 hover:bg-blue-500 text-white shrink-0"
        onClick={() => gitStore.openVersionPreview(filepath, commit.oid, commit.message)}
        data-testid="history-view-version"
      >
        View Version
      </button>
    </div>
  )
}

export default function FileHistoryPanel() {
  const gitStore = useGitStore()
  const { fileHistory } = gitStore

  if (!fileHistory.isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/80 dark:bg-black/80 flex flex-col z-50" data-testid="file-history-panel">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">HISTORY</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{fileHistory.filepath}</span>
          {!fileHistory.isLoading && (
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
              {fileHistory.commits.length} commit{fileHistory.commits.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
          onClick={() => gitStore.closeFileHistory()}
          data-testid="history-close"
        >
          Close
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        {fileHistory.isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-400 border-t-transparent mr-2" />
            Loading history...
          </div>
        ) : fileHistory.commits.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
            No commits found for this file
          </div>
        ) : (
          fileHistory.commits.map((commit) => (
            <HistoryCommitRow
              key={commit.oid}
              commit={commit}
              filepath={fileHistory.filepath}
            />
          ))
        )}
      </div>
    </div>
  )
}
