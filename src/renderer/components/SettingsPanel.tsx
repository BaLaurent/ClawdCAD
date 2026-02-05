import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}


export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { preferences, updateEditorSetting, updateViewerSetting, updateAgentSetting, updateChatSetting, setPreferences, saveToElectron } = useSettingsStore()
  const [agentSdkStatus, setAgentSdkStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')

  const handleTestAgentSdk = async () => {
    setAgentSdkStatus('checking')
    try {
      const available = await window.electronAPI.ai.testAgentSdk()
      setAgentSdkStatus(available ? 'available' : 'unavailable')
    } catch {
      setAgentSdkStatus('unavailable')
    }
  }

  // Test Agent SDK connection when panel opens
  useEffect(() => {
    if (!isOpen) return
    handleTestAgentSdk()
  }, [isOpen])

  if (!isOpen) return null

  const handleFontSizeChange = (size: number) => {
    updateEditorSetting('fontSize', size)
  }

  const handleThemeChange = (theme: 'dark' | 'light') => {
    updateEditorSetting('theme', theme)
  }

  const handleTabSizeChange = (tabSize: number) => {
    updateEditorSetting('tabSize', tabSize)
  }

  const handleAutoCompileChange = (enabled: boolean) => {
    updateEditorSetting('autoCompile', enabled)
  }

  const handleGridChange = (show: boolean) => {
    updateViewerSetting('showGrid', show)
  }

  const handleAxesChange = (show: boolean) => {
    updateViewerSetting('showAxes', show)
  }

  const handleLanguageChange = (lang: 'fr' | 'en') => {
    setPreferences({ ...preferences, language: lang })
  }

  const handleSave = async () => {
    await saveToElectron()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="settings-overlay">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 w-[480px] max-h-[80vh] overflow-y-auto" data-testid="settings-panel">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={onClose}
            data-testid="settings-close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Editor Settings */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase">Editor</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Theme</label>
                <select
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-3 py-1 text-sm border border-gray-300 dark:border-gray-600"
                  value={preferences.editor.theme}
                  onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light')}
                  data-testid="settings-theme"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Font Size</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={preferences.editor.fontSize}
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                    className="w-24"
                    data-testid="settings-fontsize-slider"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 w-8 text-right" data-testid="settings-fontsize-value">
                    {preferences.editor.fontSize}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Tab Size</label>
                <select
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-3 py-1 text-sm border border-gray-300 dark:border-gray-600"
                  value={preferences.editor.tabSize}
                  onChange={(e) => handleTabSizeChange(Number(e.target.value))}
                  data-testid="settings-tabsize"
                >
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Auto Compile</label>
                <input
                  type="checkbox"
                  checked={preferences.editor.autoCompile}
                  onChange={(e) => handleAutoCompileChange(e.target.checked)}
                  className="rounded"
                  data-testid="settings-autocompile"
                />
              </div>
            </div>
          </section>

          {/* Viewer Settings */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase">3D Viewer</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Show Grid</label>
                <input
                  type="checkbox"
                  checked={preferences.viewer.showGrid}
                  onChange={(e) => handleGridChange(e.target.checked)}
                  className="rounded"
                  data-testid="settings-showgrid"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Show Axes</label>
                <input
                  type="checkbox"
                  checked={preferences.viewer.showAxes}
                  onChange={(e) => handleAxesChange(e.target.checked)}
                  className="rounded"
                  data-testid="settings-showaxes"
                />
              </div>
            </div>
          </section>

          {/* AI Assistant */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase">AI Assistant (Claude Agent SDK)</h3>
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Connection Status</label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      agentSdkStatus === 'available'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                        : agentSdkStatus === 'checking'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700'
                    }`}
                    data-testid="agent-sdk-status"
                  >
                    {agentSdkStatus === 'available' ? '✓ Connected' :
                     agentSdkStatus === 'checking' ? '⟳ Checking...' :
                     '⚠ Not Available'}
                  </span>
                  <button
                    className="text-xs text-gray-500 hover:text-gray-300 px-1"
                    onClick={handleTestAgentSdk}
                    disabled={agentSdkStatus === 'checking'}
                    data-testid="test-agent-sdk"
                  >
                    ⟳
                  </button>
                </div>
              </div>

              {agentSdkStatus === 'unavailable' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700/50 rounded p-3 text-xs text-yellow-800 dark:text-yellow-300">
                  <div className="font-medium mb-1">Claude Code CLI required</div>
                  <div className="text-yellow-600 dark:text-yellow-400/80">
                    Run <code className="bg-yellow-100 dark:bg-yellow-950 px-1 rounded">claude</code> in terminal to install and authenticate.
                  </div>
                </div>
              )}

              {/* Settings */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Chat Mode Max Tokens</label>
                  <input
                    type="number"
                    min="512"
                    max="200000"
                    step="512"
                    className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={preferences.chat.maxTokens}
                    onChange={(e) => updateChatSetting('maxTokens', Number(e.target.value))}
                    data-testid="settings-chat-max-tokens"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Maximum response length for single-turn chat (default: 4096)
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Agent/Iterate Mode Max Tokens</label>
                  <input
                    type="number"
                    min="4096"
                    max="200000"
                    step="1024"
                    className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={preferences.agent.maxTokens}
                    onChange={(e) => updateAgentSetting('maxTokens', Number(e.target.value))}
                    data-testid="settings-agent-max-tokens"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Maximum tokens for iterative code generation with auto-fix (default: 50000)
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Max Tool Rounds</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={preferences.agent.maxIterations}
                    onChange={(e) => updateAgentSetting('maxIterations', Number(e.target.value))}
                    data-testid="settings-agent-max-iterations"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Maximum tool use rounds per chat message (default: 5)
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Git Remote (Feature #42) */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase">Git Remote</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Remote URL (HTTPS only)</label>
                <input
                  className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="https://github.com/user/repo.git"
                  data-testid="settings-remote-url"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Git Auth Token</label>
                <input
                  type="password"
                  className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="ghp_... or personal access token"
                  data-testid="settings-git-token"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Token stored securely via KeystoreService for push/pull authentication
                </div>
              </div>
            </div>
          </section>

          {/* Language */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase">Language</h3>
            <select
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-3 py-1 text-sm border border-gray-300 dark:border-gray-600"
              value={preferences.language}
              onChange={(e) => handleLanguageChange(e.target.value as 'fr' | 'en')}
              data-testid="settings-language"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
            onClick={handleSave}
            data-testid="settings-save"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}
