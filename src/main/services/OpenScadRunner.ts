import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'
import { preferencesService } from './PreferencesService'
import type { CompileResult } from '../../shared/types'

export type { CompileResult }

export interface BinaryCheckResult {
  exists: boolean
  path: string
  version: string
}

function getOpenScadBinaryPath(): string {
  const platform = process.platform
  const resourcesPath = app.isPackaged
    ? path.join(process.resourcesPath, 'openscad')
    : path.join(app.getAppPath(), 'resources', 'openscad')

  switch (platform) {
    case 'win32':
      return path.join(resourcesPath, 'win', 'openscad.exe')
    case 'darwin':
      return path.join(resourcesPath, 'mac', 'openscad')
    case 'linux':
      return path.join(resourcesPath, 'linux', 'openscad')
    default:
      return 'openscad' // fallback to PATH
  }
}

function findSystemOpenScad(): string | null {
  // Try common system paths as fallback
  const candidates = process.platform === 'win32'
    ? ['C:\\Program Files\\OpenSCAD\\openscad.exe', 'C:\\Program Files (x86)\\OpenSCAD\\openscad.exe']
    : process.platform === 'darwin'
      ? ['/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD', '/usr/local/bin/openscad', '/opt/homebrew/bin/openscad']
      : ['/usr/bin/openscad', '/usr/local/bin/openscad', '/snap/bin/openscad']

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function resolveBinaryPath(): string {
  const embedded = getOpenScadBinaryPath()
  if (fs.existsSync(embedded)) {
    return embedded
  }
  const system = findSystemOpenScad()
  if (system) {
    return system
  }
  // Last resort: hope it's on PATH
  return 'openscad'
}

interface SpawnResult {
  code: number | null
  stderr: string
}

function spawnCompile(binaryPath: string, inputPath: string, outputPath: string, timeout: number): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, ['-o', outputPath, inputPath], {
      shell: false,
      timeout,
    })

    let stderr = ''

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.stdout.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (err) => {
      resolve({ code: null, stderr: `Failed to spawn OpenSCAD: ${err.message}` })
    })

    child.on('close', (code) => {
      resolve({ code, stderr })
    })
  })
}

class OpenScadRunner {
  async compile(source: string): Promise<CompileResult> {
    const timeout = preferencesService.get('compiler')?.timeout ?? 600000
    const startTime = Date.now()
    const tmpDir = os.tmpdir()
    const timestamp = Date.now()
    const inputPath = path.join(tmpDir, `ClawdCAD_${timestamp}.scad`)
    const stlOutputPath = path.join(tmpDir, `ClawdCAD_${timestamp}.stl`)
    const offOutputPath = path.join(tmpDir, `ClawdCAD_${timestamp}.off`)

    const cleanup = () => {
      try { fs.unlinkSync(inputPath) } catch { /* ignore */ }
      try { fs.unlinkSync(stlOutputPath) } catch { /* ignore */ }
      try { fs.unlinkSync(offOutputPath) } catch { /* ignore */ }
    }

    try {
      fs.writeFileSync(inputPath, source, 'utf-8')
    } catch (err) {
      cleanup()
      return {
        success: false,
        stlBuffer: null,
        offData: null,
        stderr: `Failed to write temp file: ${err}`,
        duration: Date.now() - startTime,
      }
    }

    const binaryPath = resolveBinaryPath()

    // Run STL and OFF compilation in parallel
    const [stlResult, offResult] = await Promise.allSettled([
      spawnCompile(binaryPath, inputPath, stlOutputPath, timeout),
      spawnCompile(binaryPath, inputPath, offOutputPath, timeout),
    ])

    const duration = Date.now() - startTime

    // Extract STL result
    const stlSpawn = stlResult.status === 'fulfilled' ? stlResult.value : null
    const stlExists = fs.existsSync(stlOutputPath)

    let stlBuffer: ArrayBuffer | null = null
    const stderr = stlSpawn?.stderr ?? 'STL compilation failed'

    if (stlSpawn && stlSpawn.code === 0 && stlExists) {
      try {
        const nodeBuffer = fs.readFileSync(stlOutputPath)
        stlBuffer = nodeBuffer.buffer.slice(
          nodeBuffer.byteOffset,
          nodeBuffer.byteOffset + nodeBuffer.byteLength
        ) as ArrayBuffer
      } catch (err) {
        cleanup()
        return {
          success: false,
          stlBuffer: null,
          offData: null,
          stderr: `Failed to read STL output: ${err}`,
          duration,
        }
      }
    }

    // Extract OFF result (best-effort — failure doesn't block STL)
    let offData: string | null = null
    const offSpawn = offResult.status === 'fulfilled' ? offResult.value : null
    if (offSpawn && offSpawn.code === 0 && fs.existsSync(offOutputPath)) {
      try {
        offData = fs.readFileSync(offOutputPath, 'utf-8')
      } catch {
        // OFF read failure is non-fatal
      }
    }

    cleanup()

    if (stlBuffer) {
      return { success: true, stlBuffer, offData, stderr, duration }
    }

    return {
      success: false,
      stlBuffer: null,
      offData: null,
      stderr: stderr || `OpenSCAD exited with code ${stlSpawn?.code}`,
      duration,
    }
  }

  async checkBinary(): Promise<BinaryCheckResult> {
    const binaryPath = resolveBinaryPath()
    const exists = fs.existsSync(binaryPath) || binaryPath === 'openscad'

    if (!exists) {
      return { exists: false, path: binaryPath, version: '' }
    }

    return new Promise((resolve) => {
      const child = spawn(binaryPath, ['--version'], { shell: false, timeout: 5000 })
      let output = ''

      child.stdout.on('data', (data: Buffer) => { output += data.toString() })
      child.stderr.on('data', (data: Buffer) => { output += data.toString() })

      child.on('error', () => {
        resolve({ exists: false, path: binaryPath, version: '' })
      })

      child.on('close', (code) => {
        const version = output.trim().replace(/^OpenSCAD version /i, '')
        resolve({ exists: code === 0, path: binaryPath, version })
      })
    })
  }
}

export const openScadRunner = new OpenScadRunner()
