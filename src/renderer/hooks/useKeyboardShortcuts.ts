import { useEffect, useRef } from 'react'

export type Modifier = 'Ctrl' | 'Shift' | 'Alt' | 'Meta'
export type ShortcutContext = 'global' | 'editor'

export interface ShortcutDefinition {
  id: string
  key: string
  modifiers?: Modifier[]
  context?: ShortcutContext
  description: string
  handler: () => void
  preventDefault?: boolean
}

interface ShortcutRegistry {
  [key: string]: ShortcutDefinition
}

// Global registry to track all registered shortcuts
const globalRegistry: ShortcutRegistry = {}

/**
 * Normalize modifiers to a consistent format
 * Maps 'Ctrl' to 'Control' for compatibility with KeyboardEvent
 */
function normalizeModifier(modifier: Modifier): string {
  return modifier === 'Ctrl' ? 'Control' : modifier
}

/**
 * Generate a unique key for a shortcut based on modifiers and key
 */
function getShortcutKey(key: string, modifiers: Modifier[] = []): string {
  const sorted = [...modifiers].sort().map(normalizeModifier)
  return [...sorted, key.toLowerCase()].join('+')
}

/**
 * Check if the event matches the shortcut definition
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition
): boolean {
  const eventModifiers: string[] = []
  if (event.ctrlKey || event.metaKey) eventModifiers.push('Control')
  if (event.shiftKey) eventModifiers.push('Shift')
  if (event.altKey) eventModifiers.push('Alt')

  const shortcutModifiers = (shortcut.modifiers || []).map(normalizeModifier).sort()
  const eventModifiersSorted = eventModifiers.sort()

  // Check if modifiers match
  if (shortcutModifiers.length !== eventModifiersSorted.length) return false
  for (let i = 0; i < shortcutModifiers.length; i++) {
    if (shortcutModifiers[i] !== eventModifiersSorted[i]) return false
  }

  // Check if key matches (case-insensitive)
  return event.key.toLowerCase() === shortcut.key.toLowerCase()
}

/**
 * Centralized keyboard shortcut hook
 *
 * Features:
 * - Single source of truth for all keyboard shortcuts
 * - Automatic registration/unregistration on mount/unmount
 * - Conflict detection (warns if shortcut already registered)
 * - Support for modifier combinations (Ctrl, Shift, Alt, Meta)
 * - Context-aware shortcuts (global vs editor-only)
 * - Exposes registry for future shortcuts help dialog
 *
 * Usage:
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     id: 'save-file',
 *     key: 's',
 *     modifiers: ['Ctrl'],
 *     description: 'Save current file',
 *     handler: () => handleSave(),
 *   },
 *   {
 *     id: 'close-tab',
 *     key: 'w',
 *     modifiers: ['Ctrl'],
 *     description: 'Close current tab',
 *     handler: () => handleClose(),
 *   }
 * ])
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]) {
  const handlersRef = useRef<ShortcutDefinition[]>(shortcuts)

  // Update handlers ref when shortcuts change
  useEffect(() => {
    handlersRef.current = shortcuts
  }, [shortcuts])

  useEffect(() => {
    // Register shortcuts in global registry
    shortcuts.forEach((shortcut) => {
      const key = getShortcutKey(shortcut.key, shortcut.modifiers)
      if (globalRegistry[key]) {
        console.warn(
          `[useKeyboardShortcuts] Shortcut conflict detected: ${key} is already registered by "${globalRegistry[key].id}". New registration from "${shortcut.id}" will override it.`
        )
      }
      globalRegistry[key] = shortcut
    })

    // Keyboard event handler
    const handleKeyDown = (event: KeyboardEvent) => {
      // Find matching shortcut
      for (const shortcut of handlersRef.current) {
        if (matchesShortcut(event, shortcut)) {
          // Check context (if specified)
          if (shortcut.context === 'editor') {
            // Editor-only shortcut: only fire if Monaco editor has focus
            const target = event.target as HTMLElement
            const isMonaco = target.closest('.monaco-editor') !== null
            if (!isMonaco) continue
          }

          // Prevent default if specified (default: true)
          if (shortcut.preventDefault !== false) {
            event.preventDefault()
          }

          // Execute handler
          shortcut.handler()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      // Unregister shortcuts from global registry
      shortcuts.forEach((shortcut) => {
        const key = getShortcutKey(shortcut.key, shortcut.modifiers)
        if (globalRegistry[key]?.id === shortcut.id) {
          delete globalRegistry[key]
        }
      })

      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts])
}

/**
 * Get all registered shortcuts (for help dialog)
 */
export function getAllShortcuts(): ShortcutDefinition[] {
  return Object.values(globalRegistry)
}

/**
 * Format shortcut for display (e.g., "Ctrl+S")
 */
export function formatShortcut(shortcut: ShortcutDefinition): string {
  const modifiers = shortcut.modifiers || []
  const parts = [...modifiers, shortcut.key.toUpperCase()]
  return parts.join('+')
}
