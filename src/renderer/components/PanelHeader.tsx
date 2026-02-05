import type { ReactNode } from 'react'

interface PanelHeaderProps {
  title: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  testId?: string
  actions?: ReactNode
}

/**
 * Panel wrapper with a simple header bar displaying a title and optional action buttons.
 */
export default function PanelHeader({
  title,
  children,
  className = '',
  style,
  testId,
  actions,
}: PanelHeaderProps) {
  return (
    <div
      className={`relative ${className}`}
      style={style}
      data-testid={testId}
    >
      {/* Header */}
      <div
        className="px-3 py-2 select-none border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center gap-2"
        data-testid={testId ? `panel-header-${testId}` : undefined}
      >
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex-1">{title}</h2>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col">
        {children}
      </div>
    </div>
  )
}
