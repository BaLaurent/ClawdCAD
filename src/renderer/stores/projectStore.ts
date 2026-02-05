import { create } from 'zustand'

export interface ProjectFile {
  name: string
  path: string
  isDirectory: boolean
  children?: ProjectFile[]
}

interface ProjectState {
  projectPath: string | null
  projectName: string | null
  files: ProjectFile[]
  isLoading: boolean
  singleFileMode: boolean

  setProject: (path: string, name: string) => void
  setFiles: (files: ProjectFile[]) => void
  setLoading: (loading: boolean) => void
  clearProject: () => void
  setSingleFileMode: (singleFileMode: boolean) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectPath: null,
  projectName: null,
  files: [],
  isLoading: false,
  singleFileMode: false,

  setProject: (path, name) => set({ projectPath: path, projectName: name, singleFileMode: false }),
  setFiles: (files) => set({ files }),
  setLoading: (loading) => set({ isLoading: loading }),
  clearProject: () => set({ projectPath: null, projectName: null, files: [], singleFileMode: false }),
  setSingleFileMode: (singleFileMode) => set({ singleFileMode }),
}))
