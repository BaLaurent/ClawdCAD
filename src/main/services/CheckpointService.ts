import fs from 'fs'
import path from 'path'

export interface CheckpointFile {
  path: string
  originalContent: string | null // null = file didn't exist before
}

export interface Checkpoint {
  id: string
  timestamp: number
  description: string
  files: CheckpointFile[]
  finalized: boolean
}

const MAX_CHECKPOINTS_PER_PROJECT = 20

class CheckpointService {
  private checkpoints: Map<string, Checkpoint[]> = new Map() // keyed by projectDir

  createCheckpoint(projectDir: string, description: string): Checkpoint {
    const checkpoint: Checkpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      description,
      files: [],
      finalized: false,
    }

    let projectCheckpoints = this.checkpoints.get(projectDir)
    if (!projectCheckpoints) {
      projectCheckpoints = []
      this.checkpoints.set(projectDir, projectCheckpoints)
    }

    projectCheckpoints.push(checkpoint)

    // FIFO: drop oldest if over limit
    while (projectCheckpoints.length > MAX_CHECKPOINTS_PER_PROJECT) {
      projectCheckpoints.shift()
    }

    return checkpoint
  }

  snapshotFile(checkpointId: string, filePath: string): void {
    const checkpoint = this.findCheckpoint(checkpointId)
    if (!checkpoint || checkpoint.finalized) return

    // Only snapshot each file once per checkpoint
    if (checkpoint.files.some(f => f.path === filePath)) return

    let originalContent: string | null = null
    try {
      originalContent = fs.readFileSync(filePath, 'utf-8')
    } catch {
      // File doesn't exist yet — originalContent stays null
    }

    checkpoint.files.push({ path: filePath, originalContent })
  }

  finalizeCheckpoint(checkpointId: string): void {
    const checkpoint = this.findCheckpoint(checkpointId)
    if (!checkpoint) return

    // If no files were modified, remove the checkpoint entirely
    if (checkpoint.files.length === 0) {
      this.removeCheckpoint(checkpointId)
      return
    }

    checkpoint.finalized = true
  }

  undoCheckpoint(checkpointId: string): { restoredFiles: string[] } {
    const checkpoint = this.findCheckpoint(checkpointId)
    if (!checkpoint) return { restoredFiles: [] }

    const restoredFiles: string[] = []

    for (const file of checkpoint.files) {
      try {
        if (file.originalContent === null) {
          // File was created by AI — delete it
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
            restoredFiles.push(file.path)
          }
        } else {
          // File existed — restore original content
          const dir = path.dirname(file.path)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          fs.writeFileSync(file.path, file.originalContent, 'utf-8')
          restoredFiles.push(file.path)
        }
      } catch (err) {
        console.error(`CheckpointService: failed to restore ${file.path}:`, err)
      }
    }

    // Remove the checkpoint after undo
    this.removeCheckpoint(checkpointId)

    return { restoredFiles }
  }

  listCheckpoints(projectDir: string): Omit<Checkpoint, 'finalized'>[] {
    const projectCheckpoints = this.checkpoints.get(projectDir) || []
    return projectCheckpoints
      .filter(cp => cp.finalized)
      .map(({ finalized: _, ...rest }) => rest)
  }

  private findCheckpoint(checkpointId: string): Checkpoint | undefined {
    for (const checkpoints of this.checkpoints.values()) {
      const found = checkpoints.find(cp => cp.id === checkpointId)
      if (found) return found
    }
    return undefined
  }

  private removeCheckpoint(checkpointId: string): void {
    for (const [projectDir, checkpoints] of this.checkpoints.entries()) {
      const idx = checkpoints.findIndex(cp => cp.id === checkpointId)
      if (idx !== -1) {
        checkpoints.splice(idx, 1)
        if (checkpoints.length === 0) {
          this.checkpoints.delete(projectDir)
        }
        return
      }
    }
  }
}

export const checkpointService = new CheckpointService()
