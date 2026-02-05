import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../../stores/projectStore'

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projectPath: null,
      projectName: null,
      files: [],
      isLoading: false,
      singleFileMode: false,
    })
  })

  describe('setProject', () => {
    it('should set project path and name', () => {
      useProjectStore.getState().setProject('/home/user/project', 'MyProject')
      const state = useProjectStore.getState()
      expect(state.projectPath).toBe('/home/user/project')
      expect(state.projectName).toBe('MyProject')
    })

    it('should clear singleFileMode when setting a project', () => {
      useProjectStore.getState().setSingleFileMode(true)
      expect(useProjectStore.getState().singleFileMode).toBe(true)
      useProjectStore.getState().setProject('/home/user/project', 'MyProject')
      expect(useProjectStore.getState().singleFileMode).toBe(false)
    })
  })

  describe('clearProject', () => {
    it('should reset all project state', () => {
      useProjectStore.getState().setProject('/path', 'Name')
      useProjectStore.getState().setFiles([
        { name: 'test.scad', path: 'test.scad', isDirectory: false },
      ])
      useProjectStore.getState().clearProject()
      const state = useProjectStore.getState()
      expect(state.projectPath).toBeNull()
      expect(state.projectName).toBeNull()
      expect(state.files).toEqual([])
      expect(state.singleFileMode).toBe(false)
    })
  })

  describe('singleFileMode', () => {
    it('should set singleFileMode to true', () => {
      useProjectStore.getState().setSingleFileMode(true)
      expect(useProjectStore.getState().singleFileMode).toBe(true)
    })

    it('should set singleFileMode to false', () => {
      useProjectStore.getState().setSingleFileMode(true)
      useProjectStore.getState().setSingleFileMode(false)
      expect(useProjectStore.getState().singleFileMode).toBe(false)
    })

    it('should allow single file mode without project path', () => {
      // In single file mode, projectPath is null but singleFileMode is true
      useProjectStore.getState().setSingleFileMode(true)
      const state = useProjectStore.getState()
      expect(state.projectPath).toBeNull()
      expect(state.singleFileMode).toBe(true)
    })
  })

  describe('setFiles', () => {
    it('should set the files list', () => {
      const files = [
        { name: 'a.scad', path: '/a.scad', isDirectory: false },
        { name: 'b.scad', path: '/b.scad', isDirectory: false },
      ]
      useProjectStore.getState().setFiles(files)
      expect(useProjectStore.getState().files).toEqual(files)
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      useProjectStore.getState().setLoading(true)
      expect(useProjectStore.getState().isLoading).toBe(true)
      useProjectStore.getState().setLoading(false)
      expect(useProjectStore.getState().isLoading).toBe(false)
    })
  })
})
