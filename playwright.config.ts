import { defineConfig } from '@playwright/test'
import path from 'path'
import os from 'os'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
  // Use system temp directory instead of /tmp/claude which may be read-only
  globalSetup: undefined,
  globalTeardown: undefined,
  // Set cache directory to writable location
  snapshotPathTemplate: path.join(os.tmpdir(), 'playwright-snapshots', '{testFilePath}', '{arg}{ext}'),
})
