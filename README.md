# ClawdCAD

**Parametric 3D modeling with AI, powered by OpenSCAD and Claude.**

ClawdCAD is an Electron desktop app that bundles a Monaco code editor, Three.js 3D viewer, Claude AI assistant, and full Git integration into a single offline-first shell. Write OpenSCAD code, see live 3D previews with per-face colors, and let Claude help you design — all without leaving the app.

<!-- TODO: Add screenshot here -->
<!-- ![ClawdCAD Screenshot](docs/screenshot.png) -->

---

## Download

Pre-built binaries for v0.1.0:

| Platform | File | Size |
|----------|------|------|
| Windows | [ClawdCAD Setup 0.1.0.exe](https://github.com/BaLaurent/claude-openscad/releases/tag/v0.1.0) | 133 MB |
| Linux (AppImage) | [ClawdCAD-0.1.0.AppImage](https://github.com/BaLaurent/claude-openscad/releases/tag/v0.1.0) | 182 MB |
| Linux (Debian/Ubuntu) | [ClawdCAD_0.1.0_amd64.deb](https://github.com/BaLaurent/claude-openscad/releases/tag/v0.1.0) | 139 MB |

> macOS builds are not yet available (requires a macOS machine or CI to build).

## Installation

### Windows

Run `ClawdCAD Setup 0.1.0.exe`. The installer lets you choose the installation directory. You may see a SmartScreen warning on first launch — the installer is not code-signed yet.

### Linux (AppImage)

```bash
chmod +x ClawdCAD-0.1.0.AppImage
./ClawdCAD-0.1.0.AppImage
```

### Linux (Debian/Ubuntu)

```bash
sudo dpkg -i ClawdCAD_0.1.0_amd64.deb
```

### Runtime Dependencies

ClawdCAD runs standalone, but two external tools extend its capabilities:

| Dependency | Required? | Purpose |
|------------|-----------|---------|
| [OpenSCAD](https://openscad.org/) 2021.01+ | **Yes** — for 3D compilation | Detected automatically, or set path in Settings |
| [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) | Optional | Enables the AI assistant (must be authenticated via `claude auth login`) |

> Everything except 3D compilation and AI chat works without these dependencies.

---

## Features

- **Monaco Code Editor** — Full OpenSCAD syntax highlighting, autocomplete, and multi-file editing
- **Live 3D Viewer** — Three.js-powered preview with STL + OFF dual compilation for per-face vertex colors
- **AI Assistant** — Claude Agent SDK integration with tool use (compile, capture viewport, paste images)
- **Built-in Git** — isomorphic-git powered version control: commit, push, pull, diff, file history, and version preview
- **Layout Presets** — Switch between Code Focus, Viewer Focus, Side-by-Side, Presentation, and Default layouts
- **Light & Dark Themes** — Tailwind-driven theming with `dark:` class system
- **Offline-First** — No server required. Runs entirely on your machine (Claude CLI must be authenticated)

## Building from Source

Requires [Node.js](https://nodejs.org/) 20+ and npm.

```bash
# Clone
git clone https://github.com/BaLaurent/claude-openscad.git
cd claude-openscad

# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Build production executables
npm run dist:linux    # AppImage + .deb
npm run dist:win      # NSIS installer (needs Wine on Linux)
npm run dist:mac      # DMG (needs macOS)
npm run dist          # Current platform
```

Development mode starts both the Vite dev server (port 5173) and Electron concurrently. Built packages are output to `release/`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server + Electron (hot reload) |
| `npm run build` | Full production build (renderer + electron) |
| `npm start` | Launch built Electron app |
| `npm test` | Run all unit & integration tests |
| `npm run test:main` | Main process tests only |
| `npm run test:renderer` | Renderer tests only |
| `npm run test:coverage` | Tests with coverage report |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run dist` | Build + package for current platform |
| `npm run dist:linux` | Build + package AppImage & .deb |
| `npm run dist:win` | Build + package Windows NSIS installer |
| `npm run dist:mac` | Build + package macOS DMG |

## Architecture

ClawdCAD follows Electron's strict process separation:

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer (React)                      │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐  │
│  │  Monaco   │ │ Three.js │ │  Chat   │ │  Git Panel │  │
│  │  Editor   │ │  Viewer  │ │  Panel  │ │  + History │  │
│  └──────────┘ └──────────┘ └─────────┘ └────────────┘  │
│                     Zustand Stores                       │
├─────────────────────── IPC ──────────────────────────────┤
│                 Preload (contextBridge)                   │
├──────────────────────────────────────────────────────────┤
│                   Main Process (Node.js)                  │
│  ┌────────────┐ ┌───────────┐ ┌──────────────────────┐  │
│  │ FileService│ │ GitService│ │    ClaudeService     │  │
│  │            │ │ (isogit)  │ │  (Agent SDK + MCP)   │  │
│  └────────────┘ └───────────┘ └──────────────────────┘  │
│  ┌────────────────────┐ ┌────────────────────────────┐  │
│  │  OpenScadRunner    │ │  PreferencesService        │  │
│  │  (dual STL+OFF)    │ │  (electron-store)          │  │
│  └────────────────────┘ └────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Process Model

| Process | Runtime | Role |
|---------|---------|------|
| **Main** (`src/main/`) | Node.js | Filesystem, subprocesses, API calls, security |
| **Renderer** (`src/renderer/`) | Chromium | React UI, state management, 3D rendering |
| **Preload** (`src/preload/`) | Bridge | Typed IPC via `contextBridge` |

### Key Services

| Service | What it does |
|---------|-------------|
| `FileService` | File I/O with path traversal protection |
| `GitService` | Full Git via isomorphic-git — no external binary needed |
| `OpenScadRunner` | Dual STL+OFF compilation with `shell: false` |
| `ClaudeService` | Agent SDK with custom MCP tools (compile, viewport capture) |
| `PreferencesService` | Persistent settings via `electron-store` |
| `CheckpointService` | Git-based undo snapshots |

### State Management

Zustand stores, one per domain:

| Store | Domain |
|-------|--------|
| `editorStore` | Active file, content, dirty state |
| `compilerStore` | STL/OFF compile results |
| `viewerStore` | 3D viewer options (colors, grid, axes) |
| `chatStore` | AI messages, tool calls, pending images |
| `gitStore` | Status, commits, history, version preview |
| `layoutStore` | Panel visibility, sizing, presets |
| `settingsStore` | Preferences sync with main process |
| `projectStore` | Current project path |

## AI Integration

ClawdCAD uses the [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) exclusively — no direct API calls.

The AI assistant has access to three custom MCP tools:

| Tool | Purpose |
|------|---------|
| `compile_openscad` | Compile OpenSCAD code and return results |
| `capture_viewport` | Screenshot the 3D viewport as PNG |
| `view_user_attachments` | Access images the user pasted into chat |

These tools are registered at runtime via `ClaudeService.registerTool()` and served through an in-process MCP server.

### Image Paste

Paste images from clipboard directly into the chat textarea. They appear as thumbnails and are forwarded to Claude via the `view_user_attachments` MCP tool.

## OpenSCAD Compilation

ClawdCAD runs two OpenSCAD processes in parallel for each compile:

1. **STL** — Primary mesh output for the 3D viewer
2. **OFF** — Secondary output carrying per-face color data

OFF failure is non-fatal. When OFF colors are available, the viewer palette toggle lets you switch between original colors and a uniform mesh color.

## Git Integration

Full version control without leaving the app:

- **GitPanel** — Status, staging, commit, push, pull
- **DiffViewer** — Side-by-side diffs with syntax highlighting
- **File History** — Per-file commit log with version preview
- **Version Preview** — View any historical version with 3D preview for `.scad` files
- **Discard** — Revert modified files to HEAD
- **Auto-refresh** — Git status updates after save and on file changes

## Keyboard Shortcuts

Press `?` in the app to see all shortcuts. Key ones:

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save file |
| `Ctrl+B` | Compile |
| `Ctrl+Shift+B` | Auto-compile toggle |
| `Ctrl+Enter` | Send chat message |

## Project Structure

```
src/
├── main/                   # Electron main process
│   ├── index.ts            # IPC handlers & window setup
│   └── services/           # Backend services (6 + tests)
├── preload/
│   └── index.ts            # contextBridge API
├── renderer/
│   ├── App.tsx             # Root component
│   ├── components/         # 18 React components
│   ├── stores/             # 8 Zustand stores
│   ├── hooks/              # Custom React hooks
│   └── utils/              # Geometry parsers (STL, OFF)
└── shared/
    └── types.ts            # Shared TypeScript interfaces
```

## Testing

Three-tier strategy:

| Tier | Tool | Environment | Location |
|------|------|-------------|----------|
| Unit | Vitest | Node | `src/main/services/__tests__/` |
| Component | Vitest + Testing Library | jsdom | `src/renderer/*/__tests__/` |
| E2E | Playwright | Electron | `e2e/` |

```bash
# Run all tests
npm test

# Single file
npx vitest run src/main/services/__tests__/FileService.test.ts

# With coverage
npm run test:coverage
```

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Path traversal validation on all file operations
- OpenSCAD spawned with `shell: false`
- API keys stored via OS-native encryption (never in renderer)
- All sensitive operations run in main process only

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 28 |
| UI | React 18, Tailwind CSS 3 |
| Editor | Monaco Editor |
| 3D | Three.js + React Three Fiber |
| AI | Claude Agent SDK |
| Git | isomorphic-git |
| State | Zustand |
| Build | Vite 5, TypeScript 5 |
| Test | Vitest, Playwright, Testing Library |

## License

MIT
