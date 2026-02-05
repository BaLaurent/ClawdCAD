import { getAllShortcuts, formatShortcut, type ShortcutDefinition } from '../hooks/useKeyboardShortcuts'

interface KeyboardShortcutsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  if (!isOpen) return null

  const shortcuts = getAllShortcuts()

  // Group shortcuts by category based on their description or ID
  const categorized: Record<string, ShortcutDefinition[]> = {
    File: [],
    Editor: [],
    View: [],
    Build: [],
    Navigation: [],
    Other: [],
  }

  shortcuts.forEach((shortcut) => {
    const desc = shortcut.description.toLowerCase()
    const id = shortcut.id.toLowerCase()

    // Check Build first (before Editor) since "compile" contains "code"
    if (desc.includes('compile') || desc.includes('build') || id.includes('compile') || id.includes('build')) {
      categorized.Build.push(shortcut)
    } else if (desc.includes('save') || desc.includes('open') || desc.includes('export') || desc.includes('project')) {
      categorized.File.push(shortcut)
    } else if (
      desc.includes('editor') ||
      desc.includes('code') ||
      id.includes('editor') ||
      shortcut.context === 'editor'
    ) {
      categorized.Editor.push(shortcut)
    } else if (desc.includes('toggle') || desc.includes('panel') || desc.includes('console') || desc.includes('theme')) {
      categorized.View.push(shortcut)
    } else if (desc.includes('tab') || desc.includes('navigate') || desc.includes('switch')) {
      categorized.Navigation.push(shortcut)
    } else {
      categorized.Other.push(shortcut)
    }
  })

  // Remove empty categories
  Object.keys(categorized).forEach((key) => {
    if (categorized[key].length === 0) {
      delete categorized[key]
    }
  })

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
      data-testid="keyboard-shortcuts-dialog-overlay"
    >
      <div
        className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-auto p-6 font-['Inter',sans-serif]"
        onClick={(e) => e.stopPropagation()}
        data-testid="keyboard-shortcuts-dialog"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700 hover:opacity-80 transition-opacity"
            data-testid="close-shortcuts-dialog"
          >
            Close
          </button>
        </div>

        <div className="space-y-6">
          {Object.entries(categorized).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400">{category}</h3>
              <div className="space-y-2">
                {items.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-opacity-50"
                    data-testid={`shortcut-${shortcut.id}`}
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd
                      className="bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-300 px-3 py-1 rounded text-xs font-mono font-semibold border border-gray-300 dark:border-gray-600"
                    >
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {shortcuts.length === 0 && (
          <p className="text-center text-gray-500 py-8">No keyboard shortcuts registered</p>
        )}
      </div>
    </div>
  )
}
