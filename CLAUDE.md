# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClawdCAD is an Electron desktop app for parametric 3D modeling with OpenSCAD. It bundles a Monaco code editor, Three.js 3D viewer, Claude AI assistant (via Agent SDK), and isomorphic-git — all in one shell. Offline-first, requires Claude Code CLI installed and authenticated.

## Commands

```bash
# Development
npm run dev                 # Concurrent: Vite dev server + Electron
npm run dev:renderer        # Vite dev server only (port 5173)
npm run dev:main            # TypeScript compile + launch Electron

# Build
npm run build               # Full build (renderer + electron)
npm run build:renderer      # Vite build only
npm run build:electron      # TypeScript compile main + preload

# Test
npm test                    # All unit + integration tests (Vitest)
npm run test:main           # Main process tests only
npm run test:renderer       # Renderer tests only
npm run test:coverage       # With coverage report
npm run test:e2e            # Playwright E2E (requires build + display server)

# Code quality
npm run lint                # ESLint
npm run type-check          # TypeScript check (renderer + main)
```

Run a single test file: `npx vitest run src/main/services/__tests__/FileService.test.ts`

## Architecture

### Process Model

Electron enforces strict separation between two processes:

**Main Process** (`src/main/`) — Node.js runtime. Handles filesystem, subprocesses, API calls, credential storage. Entry point: `src/main/index.ts` which registers all `ipcMain.handle()` handlers.

**Renderer Process** (`src/renderer/`) — React app in Chromium. No direct Node.js access. Communicates with Main via typed IPC through `window.electronAPI`.

**Preload Script** (`src/preload/index.ts`) — Bridge between processes. Uses `contextBridge.exposeInMainWorld()` to expose a typed API object. This is the only way the renderer can call main process services.

### IPC Flow

```
Renderer component → window.electronAPI.service.method()
  → preload/index.ts (contextBridge)
    → ipcRenderer.invoke('channel:action', args)
      → main/index.ts ipcMain.handle('channel:action')
        → Service class method
```

IPC channels are namespaced: `openscad:compile`, `file:read`, `git:status`, `keystore:setApiKey`, etc. All channel names and their signatures live in `src/main/index.ts` (handler side) and `src/preload/index.ts` (exposure side).

### Key Services (src/main/services/)

| Service | Purpose |
|---------|---------|
| `FileService` | File I/O with path traversal validation |
| `GitService` | Git ops via isomorphic-git (no external binary). Includes path traversal validation, `discardFile()`, merge conflict detection in pull, and detached HEAD protection in push/pull |
| `OpenScadRunner` | Spawns OpenSCAD CLI (`shell: false`) for compilation |
| `ClaudeService` | Claude Agent SDK integration (multi-turn, tool use, streaming) |
| `KeystoreService` | API key encryption via `electron.safeStorage` (legacy, unused by AI) |
| `PreferencesService` | User settings via `electron-store` |

### State Management (src/renderer/stores/)

Zustand stores, one per domain: `editorStore`, `compilerStore`, `chatStore`, `gitStore`, `projectStore`, `settingsStore`, `viewerStore`, `layoutStore`. Access pattern:

```typescript
const { value, action } = useMyStore()
// Or outside React:
useMyStore.getState().action()
```

### Layout System

Panel layout uses `PanelHeader` (`src/renderer/components/PanelHeader.tsx`) — a simple header bar with title, children, and optional `actions` prop. **No drag-and-drop.**

`layoutStore` manages panel visibility and sizing. It exposes 5 layout presets via `LAYOUT_PRESETS` array and `applyPreset(id)`:

| Preset | Panels Visible |
|--------|---------------|
| `default` | All panels |
| `code-focus` | Editor + console + file tree |
| `viewer-focus` | Viewer + file tree + chat + git |
| `side-by-side` | Editor + viewer + console |
| `presentation` | Viewer only |

Presets use `apply(current) => LayoutConfig` functions that modify visibility while preserving user's panel dimensions. Manual panel toggling clears `activePresetId`. Presets are accessible from the **View > Layout Presets** submenu in `MenuBar`.

### File Tree (`src/renderer/components/FileTree.tsx`)

`FileTree` is a `forwardRef` component exposing `FileTreeHandle` with 4 imperative methods: `newFile()`, `newFolder()`, `collapseAll()`, `refresh()`. These are wired to quick action buttons in the sidebar `PanelHeader` via `actions` prop in `App.tsx`.

**Context menu**: Right-click works on both files/folders AND empty space. The `ContextMenuState` has a `visible: boolean` flag decoupled from `file: ProjectFile | null`. Empty space shows "New File" + "New Folder"; files/folders additionally show "Rename" + "Delete" (separated by a divider). Item-level `handleContextMenu` uses `e.stopPropagation()` to prevent the root handler from overriding the file reference.

**Collapse All**: Uses a `collapseKey` counter — incrementing it changes item keys (`${file.path}-${collapseKey}`), forcing React to remount all `FileTreeItem` with `defaultExpanded=false`. The `defaultExpanded` prop propagates recursively to children.

**New Folder**: Mirrors `handleNewFile` pattern but calls `window.electronAPI.file.createDir()`. Both use the extracted `refreshFiles` callback for tree reload.

### Shared Types

`src/shared/types.ts` — TypeScript interfaces shared between main and renderer (e.g., `CompileResult`, `Preferences`, `PanelConfig`). Both tsconfigs reference this directory.

## Path Aliases

- `@/*` → `src/renderer/`
- `@shared/*` → `src/shared/`

Defined in `tsconfig.json` (renderer) and `vitest.config.ts`.

## Testing

Three-tier strategy. Vitest config auto-selects environment: `jsdom` for `src/renderer/**`, Node for `src/main/**`.

- **Unit tests**: `src/main/services/__tests__/` — mock `fs`, `electron`, `child_process`, `isomorphic-git`
- **Component/store tests**: `src/renderer/*/__tests__/` — global mock of `window.electronAPI` in `src/renderer/__tests__/setup.ts`
- **E2E**: `e2e/` — Playwright with `_electron.launch()`, needs built app + display server

Tmp dir override: tests use `TMPDIR=$PWD/.tmp` to avoid writing to system temp.

## Security Constraints

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- FileService validates paths against directory traversal
- OpenSCAD spawned with `shell: false`
- API keys stored via OS-native encryption (never in renderer)
- All sensitive ops run in main process only

## Build Output

```
dist/main/
  main/       → Compiled main process (CommonJS)
  renderer/   → Vite build output (ESM)
  preload/    → Compiled preload script
```

Main process tsconfig outputs CommonJS to `dist/main/`. Renderer uses Vite with `base: './'` for file:// URLs.

## Git Integration

### Git Preferences

`Preferences.git` stores configurable author identity (`authorName`, `authorEmail`), defaulting to `'ClawdCAD User'` / `'user@ClawdCAD.local'`. Used by `gitStore.commit()`, `gitStore.initRepo()`, and `GitPanel.handleCommit()` instead of hardcoded values. Persisted via `settingsStore.saveToElectron()`.

### Git Safety

- **Push/Pull**: If `currentBranch()` returns null (detached HEAD), operations return an explicit error instead of silently falling back to `'main'`.
- **Path traversal**: `getFileContent()` and `discardFile()` validate filepaths via `path.resolve()` + `startsWith()` check before any filesystem or git operation.
- **Merge conflicts**: `pull()` detects conflict-related errors and returns a user-friendly message.

### Discard File Flow

`discardFile(filepath)` restores a file to its HEAD version via `git.checkout({ filepaths: [filepath] })`. Full stack: `GitService.discardFile()` → `git:discard` IPC → `preload.git.discard` → `gitStore.discardFile()` → discard button in `GitPanel` (only for `modified`/`deleted` unstaged files, with confirmation dialog).

### Git Status Auto-Refresh

- After `handleSave` and `handleNewFile` in `App.tsx`, `gitStore.refreshStatus()` is called.
- A debounced (500ms) file watcher in `App.tsx` listens to `file:changed` events and triggers `gitStore.refreshStatus()`.

### Git Menu

`MenuBar` has a `Git` menu (between Build and Help) with: Initialize Repository, Commit, Push, Pull, Refresh Status. Wired in `App.tsx` to `gitStore` actions.

### DiffViewer Syntax Highlighting

`DiffViewer.tsx` uses `getLanguageFromPath(filepath)` to determine Monaco language from file extension (e.g., `.scad` → `cpp`, `.ts` → `typescript`). Falls back to `plaintext`.

### Type Safety

`GitFileStatus.status` is a union type `'modified' | 'added' | 'deleted' | 'untracked' | 'unmodified'` (exported as `GitFileStatusType` from `shared/types.ts`), not a plain `string`.

### File History & Version Preview

Two entry points for browsing historical file versions:

1. **Expandable commits in GitPanel** — Click a commit to expand and see its changed files (A/M/D badges). Click a file to open VersionPreview.
2. **"History" button in editor tab bar** — Visible when `gitStore.isGitRepo && editorStore.activeFilePath`. Opens FileHistoryPanel for the active file.

**Backend** (`GitService`):
- `fileLog(dir, filepath, depth)` — Per-file git log via `git.log({ filepath })`. Validates filepath against path traversal.
- `getCommitFiles(dir, oid)` — Compares parent and commit trees via two `git.walk()` calls, diffing blob OIDs to detect added/modified/deleted files. Root commits (no parent) treat all files as 'added'.

**IPC**: `git:file-log`, `git:commit-files` channels.

**Store** (`gitStore`): Three new state domains — `expandedCommitOid`/`commitFilesForExpanded` (GitPanel expand), `fileHistory` (FileHistoryPanel overlay), `versionPreview` (VersionPreview overlay). Each has its own `isOpen`/`isLoading` flags.

**VersionPreview** (`src/renderer/components/VersionPreview.tsx`):
- Fullscreen overlay with read-only Monaco editor + isolated 3D mini-viewer for `.scad` files
- 3D preview compiles via `window.electronAPI.openscad.compile()` into local `useState` — does NOT touch `viewerStore` or `compilerStore`
- Uses geometry parsers from `src/renderer/utils/geometryParsers.ts`
- "Revert to This" button calls `editorStore.setEditorContent()` (marks file dirty, user can Ctrl+Z)

**FileHistoryPanel** (`src/renderer/components/FileHistoryPanel.tsx`):
- Fullscreen overlay listing per-file commits with "View Version" buttons
- Opens VersionPreview on top when a version is selected

**Shared type**: `CommitFileEntry { filepath: string; status: 'added' | 'modified' | 'deleted' }` in `shared/types.ts`.

## AI Integration (Claude Agent SDK)

The AI chat uses **only** the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). There is no direct Anthropic API mode.

- **ClaudeService** (`src/main/services/ClaudeService.ts`) — Dynamically imports the ESM-only Agent SDK via `Function('return import(...)')()` (cached in `_sdkCache`). Sends queries with `permissionMode: 'bypassPermissions'` and configurable `maxTurns`.
- **No API key needed** — Authentication is handled by the Claude Code CLI session on the host machine.
- **Tool use** — The Agent SDK provides its own tools (read/write/edit files, bash, etc.). Tool calls and results are forwarded to the renderer via IPC events (`ai:tool-call-start`, `ai:tool-call-result`).
- **Custom tools** — `ClaudeService` has a `registerTool()` / `unregisterTool()` API. Registered tools are bundled into an in-process MCP server (`ClawdCAD-tools`) via `createSdkMcpServer()` and passed to `query()` via `options.mcpServers`. See below for details.
- **Chat store** (`src/renderer/stores/chatStore.ts`) — Tool calls are inserted inline into `messages[]` as pending `toolExecution` messages (no `result` yet). `addToolResult` updates the existing message via `.map()` to preserve chronological order.
- **Editor reload** — After AI stream ends, `ChatPanel.tsx` re-reads the active file from disk and updates the Monaco editor + triggers auto-compile if enabled.
- **Preferences** — `agent.maxIterations` controls max tool rounds per message (default: 5). `agent.maxTokens` and `chat.maxTokens` control response length.

### Custom Tool Registration

Custom tools give the AI assistant access to ClawdCAD-specific capabilities (compilation, preview, etc.) beyond the Agent SDK's built-in file/bash tools.

**API** (`ClaudeService`):
- `registerTool(toolDef)` — Register an `SdkMcpToolDefinition`
- `unregisterTool(name)` — Remove by name
- `getRegisteredTools()` — List registered tool names

**Adding a new tool** (in `src/main/index.ts` → `registerCustomTools()`):

```typescript
claudeService.registerTool(
  sdk.tool(
    'my_tool_name',
    'Description visible to the AI model',
    { param: z.string().describe('What this param is for') },
    async ({ param }) => {
      // Execute logic in main process...
      return { content: [{ type: 'text', text: 'result' }] }
    }
  )
)
```

**How it works**: At each `sendMessage()` call, `buildMcpServers()` checks if tools are registered. If so, it creates a `ClawdCAD-tools` MCP server via `createSdkMcpServer()` and injects it into the `query()` options. Claude sees these as native MCP tools.

**Currently registered tools**:
- `compile_openscad` — compiles OpenSCAD source via `OpenScadRunner`, returns success/error output, forwards result to renderer via `ai:compile-result` IPC.
- `capture_viewport` — captures the 3D viewport as a PNG screenshot via `executeJavaScript()` + `canvas.toDataURL()`. Returns image to Claude and forwards base64 to renderer via `ai:viewport-captured` IPC.
- `view_user_attachments` — returns images the user pasted into the chat. `ClaudeService.pendingUserImages` stores them per-message, cleared after the query completes. Uses the same `{ type: 'image', data, mimeType }` MCP content format as `capture_viewport`.

**Important: MCP tool result sidechannel** — The Agent SDK does NOT relay MCP tool results back in the stream (`tool_result`/`tool_output` events only fire for built-in SDK tools). Custom tools must send data to the renderer directly via `mainWindow.webContents.send()` from within the tool handler. The `compile_openscad` and `capture_viewport` tools use this pattern. `view_user_attachments` does not need it (images are already displayed in the user's chat bubble).

**ToolExecutionBubble** handles any tool name generically. Tool names are cleaned by stripping the `mcp__ClawdCAD-tools__` prefix via `call.name.split('__').pop()`, then mapped to human-readable summaries (e.g., "Compiled OpenSCAD", "Captured 3D viewport"). For tools with `imageData` in their result, it auto-expands and renders an inline `<img>` preview.

### Image Paste in Chat

Users can paste images from clipboard into the AI chat textarea. The flow:

1. **Paste** (`ChatPanel.tsx` `onPaste`) — reads `image/*` items from clipboard, converts via `FileReader.readAsDataURL()`, stores as `ImageAttachment` in `chatStore.pendingImages`
2. **Preview** — thumbnail strip (64px) above textarea with hover-to-remove X buttons
3. **Send** — images attached to the `ChatMessage`, passed through IPC to `ClaudeService`
4. **ClaudeService** — stores images in `pendingUserImages`, appends instruction to text prompt telling Claude to call `view_user_attachments`
5. **MCP tool** — `view_user_attachments` returns images as MCP image content blocks (same format as `capture_viewport`)
6. **Cleanup** — `pendingUserImages` cleared after query completes or errors

**Type**: `ImageAttachment { id: string; data: string; mediaType: string }` in `shared/types.ts`. `ChatMessage` has optional `images?: ImageAttachment[]` field.

**Note**: The `AsyncIterable<SDKUserMessage>` path for multimodal prompts was attempted but crashes the CLI with exit code 1. The MCP tool approach is the proven workaround.

## Theme System (Light/Dark Mode)

### How It Works

Tailwind CSS `darkMode: 'class'` is configured in `tailwind.config.js`. The `<html>` element starts with `class="dark"` (set in `index.html`) to prevent flash-of-wrong-theme. A `useEffect` in `App.tsx` syncs the class with the settings store:

```typescript
document.documentElement.classList.toggle('dark', currentTheme === 'dark')
```

### Class Convention

All components use light-first defaults with `dark:` variants. Standard mapping:

| Pattern | Example |
|---------|---------|
| Background | `bg-gray-50 dark:bg-gray-900` |
| Surface | `bg-white dark:bg-gray-800` |
| Text primary | `text-gray-900 dark:text-white` |
| Text secondary | `text-gray-500 dark:text-gray-400` |
| Border | `border-gray-200 dark:border-gray-700` |
| Hover | `hover:bg-gray-200 dark:hover:bg-gray-700` |

WelcomeScreen uses Tailwind arbitrary values for design system colors: `dark:bg-[#1a1a2e]`, `dark:bg-[#16213e]`, `dark:border-[#404040]`.

### Monaco Editor Theme

`CodeEditor.tsx`, `DiffViewer.tsx`, and `VersionPreview.tsx` read `useSettingsStore((s) => s.preferences.editor.theme)` and pass `theme={editorTheme === 'dark' ? 'vs-dark' : 'vs'}` to Monaco.

### Important Notes

- Theme is driven by CSS class on `<html>`, **not** by props. MenuBar, AboutDialog, and KeyboardShortcutsDialog do NOT accept a `theme` prop.
- In jsdom tests, Tailwind classes don't produce computed styles. Test theme by checking `className.toContain('bg-white')` etc., never `style.backgroundColor`.

## Dual Compilation (STL + OFF)

### Overview

`OpenScadRunner.compile()` runs two OpenSCAD processes in parallel via `Promise.allSettled()` — one outputting `.stl` (for export), one outputting `.off` (for per-face colors). OFF failure never blocks STL success.

### CompileResult

`CompileResult` (defined in `src/shared/types.ts`) includes `offData: string | null`. All manual constructions of `CompileResult` (in `App.tsx`, `ChatPanel.tsx`, test setup) must include `offData: null`.

### Geometry Parsers (`src/renderer/utils/geometryParsers.ts`)

Extracted from Viewer3D.tsx. Exports: `isAsciiSTL()`, `parseSTLAscii()`, `parseSTLBinary()`, `parseOFF()`. Imported by both `Viewer3D.tsx` (main viewer) and `VersionPreview.tsx` (historical preview).

### OFF Parser (`parseOFF()`)

- Handles OpenSCAD's compact header format: `OFF 8 6 0` (header + counts on one line) and standard format (`OFF` alone then counts on next line)
- Fan-triangulates polygons (OpenSCAD emits quads for cubes)
- Normalizes 0-255 color values to 0-1 for Three.js
- Sets `color` attribute on BufferGeometry when face colors are present

### Color Toggle

- `viewerStore` has `useOriginalColors: boolean` (default: `true`) and `hasVertexColors: boolean` (default: `false`)
- `compilerStore` has `lastOff: string | null` alongside `lastStl`
- Viewer3D geometry effect tries OFF first (has colors), falls back to STL
- `meshStandardMaterial` uses `vertexColors={true}` + `color="#ffffff"` for original colors (white avoids tinting), or `vertexColors={false}` + `color={meshColor}` for uniform color. **Important**: the material needs a `key` prop that changes with `vertexColors` to force React Three Fiber to remount it (Three.js requires shader recompilation when `vertexColors` changes)
- ViewerToolbar palette toggle: purple when active, gray/disabled when `hasVertexColors === false`
- Color picker is disabled when original colors are active

### spawnCompile Helper

`spawnCompile(binaryPath, inputPath, outputPath, timeout)` extracts the `spawn` → `stderr` → `close` pattern into a reusable function returning `Promise<{ code, stderr }>`.
