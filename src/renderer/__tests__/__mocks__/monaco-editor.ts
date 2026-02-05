import { vi } from 'vitest'

export const editor = {
  create: vi.fn(),
  createModel: vi.fn(),
  createDiffEditor: vi.fn(() => ({
    setModel: vi.fn(),
    dispose: vi.fn(),
  })),
}

export default {
  editor,
}
