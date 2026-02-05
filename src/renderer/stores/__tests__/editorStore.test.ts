import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../../stores/editorStore'

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      openFiles: [],
      activeFilePath: null,
      editorContent: '',
      cursorLine: 1,
      cursorColumn: 1,
    })
  })

  describe('openFile', () => {
    it('should add file and set as active', () => {
      const file = { path: '/test/file.scad', name: 'file.scad', content: 'cube(10);', isDirty: false }
      useEditorStore.getState().openFile(file)
      const state = useEditorStore.getState()
      expect(state.openFiles).toHaveLength(1)
      expect(state.activeFilePath).toBe('/test/file.scad')
      expect(state.editorContent).toBe('cube(10);')
    })

    it('should not duplicate already open file', () => {
      const file = { path: '/test/file.scad', name: 'file.scad', content: 'cube(10);', isDirty: false }
      useEditorStore.getState().openFile(file)
      useEditorStore.getState().openFile(file)
      expect(useEditorStore.getState().openFiles).toHaveLength(1)
    })

    it('should switch to existing file content', () => {
      const file1 = { path: '/a.scad', name: 'a.scad', content: 'aaa', isDirty: false }
      const file2 = { path: '/b.scad', name: 'b.scad', content: 'bbb', isDirty: false }
      useEditorStore.getState().openFile(file1)
      useEditorStore.getState().openFile(file2)
      useEditorStore.getState().openFile(file1) // switch back
      expect(useEditorStore.getState().editorContent).toBe('aaa')
      expect(useEditorStore.getState().activeFilePath).toBe('/a.scad')
    })
  })

  describe('closeFile', () => {
    it('should remove file and activate previous', () => {
      const file1 = { path: '/a.scad', name: 'a.scad', content: 'aaa', isDirty: false }
      const file2 = { path: '/b.scad', name: 'b.scad', content: 'bbb', isDirty: false }
      useEditorStore.getState().openFile(file1)
      useEditorStore.getState().openFile(file2)
      useEditorStore.getState().closeFile('/b.scad')
      const state = useEditorStore.getState()
      expect(state.openFiles).toHaveLength(1)
      expect(state.activeFilePath).toBe('/a.scad')
      expect(state.editorContent).toBe('aaa')
    })

    it('should clear content when closing last file', () => {
      const file = { path: '/a.scad', name: 'a.scad', content: 'aaa', isDirty: false }
      useEditorStore.getState().openFile(file)
      useEditorStore.getState().closeFile('/a.scad')
      const state = useEditorStore.getState()
      expect(state.openFiles).toHaveLength(0)
      expect(state.activeFilePath).toBeNull()
      expect(state.editorContent).toBe('')
    })
  })

  describe('setEditorContent', () => {
    it('should update content and mark file dirty', () => {
      const file = { path: '/test.scad', name: 'test.scad', content: 'old', isDirty: false }
      useEditorStore.getState().openFile(file)
      useEditorStore.getState().setEditorContent('new content')
      const state = useEditorStore.getState()
      expect(state.editorContent).toBe('new content')
      expect(state.openFiles[0].isDirty).toBe(true)
      expect(state.openFiles[0].content).toBe('new content')
    })

    it('should just update content when no active file', () => {
      useEditorStore.getState().setEditorContent('some content')
      expect(useEditorStore.getState().editorContent).toBe('some content')
    })
  })

  describe('setActiveFile', () => {
    it('should switch active file and update editor content', () => {
      const file1 = { path: '/a.scad', name: 'a.scad', content: 'aaa', isDirty: false }
      const file2 = { path: '/b.scad', name: 'b.scad', content: 'bbb', isDirty: false }
      useEditorStore.getState().openFile(file1)
      useEditorStore.getState().openFile(file2)
      useEditorStore.getState().setActiveFile('/a.scad')
      expect(useEditorStore.getState().editorContent).toBe('aaa')
    })
  })

  describe('markDirty', () => {
    it('should set dirty flag on specific file', () => {
      const file = { path: '/test.scad', name: 'test.scad', content: 'content', isDirty: false }
      useEditorStore.getState().openFile(file)
      useEditorStore.getState().markDirty('/test.scad', true)
      expect(useEditorStore.getState().openFiles[0].isDirty).toBe(true)
    })

    it('should clear dirty flag', () => {
      const file = { path: '/test.scad', name: 'test.scad', content: 'content', isDirty: true }
      useEditorStore.getState().openFile(file)
      useEditorStore.getState().markDirty('/test.scad', false)
      expect(useEditorStore.getState().openFiles[0].isDirty).toBe(false)
    })
  })

  describe('setCursorPosition', () => {
    it('should update cursor line and column', () => {
      useEditorStore.getState().setCursorPosition(5, 12)
      const state = useEditorStore.getState()
      expect(state.cursorLine).toBe(5)
      expect(state.cursorColumn).toBe(12)
    })
  })
})
