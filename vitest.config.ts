import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  cacheDir: path.join(__dirname, 'node_modules/.vitest-cache'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@': path.resolve(__dirname, './src/renderer'),
      'monaco-editor': path.resolve(__dirname, './src/renderer/__tests__/__mocks__/monaco-editor.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    environmentMatchGlobs: [
      ['src/renderer/**', 'jsdom'],
    ],
    setupFiles: ['src/renderer/__tests__/setup.ts'],
  },
})
