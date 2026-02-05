interface AboutDialogProps {
  isOpen: boolean
  onClose: () => void
  appVersion: string
  openscadVersion?: string
}

export default function AboutDialog({ isOpen, onClose, appVersion, openscadVersion }: AboutDialogProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
      data-testid="about-dialog-overlay"
    >
      <div
        className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl max-w-2xl w-full p-6 font-['Inter',sans-serif]"
        onClick={(e) => e.stopPropagation()}
        data-testid="about-dialog"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">About ClawdCAD</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-50 dark:bg-gray-700 hover:opacity-80 transition-opacity"
            data-testid="close-about-dialog"
          >
            Close
          </button>
        </div>

        <div className="space-y-6">
          {/* Logo placeholder - could add an icon/logo here */}
          <div className="text-center">
            <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2">ClawdCAD</div>
            <p className="text-sm text-gray-500">Parametric 3D Modeling with OpenSCAD</p>
          </div>

          {/* Version info */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded border border-gray-300 dark:border-gray-600">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold">ClawdCAD Version:</span>
                <span className="font-mono" data-testid="app-version">
                  {appVersion}
                </span>
              </div>
              {openscadVersion && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold">OpenSCAD Version:</span>
                  <span className="font-mono" data-testid="openscad-version">
                    {openscadVersion}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-semibold">Electron:</span>
                <span className="font-mono">{process.versions.electron || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Node.js:</span>
                <span className="font-mono">{process.versions.node || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Chrome:</span>
                <span className="font-mono">{process.versions.chrome || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm leading-relaxed">
              ClawdCAD is an all-in-one desktop application for parametric 3D modeling using OpenSCAD code. It combines
              a modern code editor, an AI assistant powered by Claude, a real-time 3D viewer, and native Git version
              control — all in a single Electron shell.
            </p>
          </div>

          {/* License */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded border border-gray-300 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <span className="font-semibold">License:</span>
              <span>MIT License</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Copyright © 2024 ClawdCAD Team. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="flex justify-center space-x-4 text-sm">
            <a href="#" className="text-blue-600 dark:text-blue-300 hover:underline" onClick={(e) => e.preventDefault()}>
              GitHub Repository
            </a>
            <span className="text-gray-500">•</span>
            <a href="#" className="text-blue-600 dark:text-blue-300 hover:underline" onClick={(e) => e.preventDefault()}>
              Documentation
            </a>
            <span className="text-gray-500">•</span>
            <a href="#" className="text-blue-600 dark:text-blue-300 hover:underline" onClick={(e) => e.preventDefault()}>
              Report Issue
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
