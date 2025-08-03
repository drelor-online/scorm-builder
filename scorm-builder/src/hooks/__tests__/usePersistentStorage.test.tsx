import { describe, it, expect, act, beforeEach } from 'vitest'
import { renderHook, act , waitFor } from '../../test/testProviders'
import 'fake-indexeddb/auto'
import { usePersistentStorage } from '../usePersistentStorage'

describe('usePersistentStorage Hook - Intent Tests', () => {
  beforeEach(async () => {
    // Clear IndexedDB
    const deleteDB = () => {
      return new Promise<void>((resolve) => {
        const deleteReq = indexedDB.deleteDatabase('SCORMBuilderDB')
        deleteReq.onsuccess = () => resolve()
        deleteReq.onerror = () => resolve()
        deleteReq.onblocked = () => resolve()
      })
    }
    await deleteDB()
    
    localStorage.clear()
  })
  
  it('should initialize storage on mount', async () => {
    // Intent: When component mounts, storage should be initialized
    const { result } = renderHook(() => usePersistentStorage())
    
    expect(result.current.isInitialized).toBe(false)
    
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
    })
    
    expect(result.current.error).toBeNull()
  })
  
  it('should create and open a new project', async () => {
    // Intent: User creates a new project and it becomes the current project
    const { result } = renderHook(() => usePersistentStorage())
    
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
    })
    
    let project
    await act(async () => {
      project = await result.current.createProject('Test Course')
    })
    
    expect(project).toBeDefined()
    expect(result.current.currentProjectId).toBe(project.id)
  })
  
  it('should persist media through the hook', async () => {
    // Intent: Media stored through the hook should be retrievable
    const { result } = renderHook(() => usePersistentStorage())
    
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
    })
    
    await act(async () => {
      await result.current.createProject('Test Course')
    })
    
    const blob = new Blob(['test'], { type: 'image/png' })
    
    await act(async () => {
      await result.current.storeMedia('test-image', blob, 'image', {
        title: 'Test Image'
      })
    })
    
    let retrieved
    await act(async () => {
      retrieved = await result.current.getMedia('test-image')
    })
    
    expect(retrieved).toBeDefined()
    expect(retrieved?.metadata?.title).toBe('Test Image')
  })
  
  it('should auto-save content', async () => {
    // Intent: Content saved through the hook should persist
    const { result } = renderHook(() => usePersistentStorage())
    
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
    })
    
    await act(async () => {
      await result.current.createProject('Test Course')
    })
    
    const content = {
      topicId: 'topic-1',
      title: 'Introduction',
      content: 'Welcome to the course'
    }
    
    await act(async () => {
      await result.current.saveContent('topic-1', content)
    })
    
    let retrieved
    await act(async () => {
      retrieved = await result.current.getContent('topic-1')
    })
    
    expect(retrieved).toEqual(content)
  })
  
  it('should list all projects', async () => {
    // Intent: All created projects should be listed
    const { result } = renderHook(() => usePersistentStorage())
    
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
    })
    
    await act(async () => {
      await result.current.createProject('Course 1')
      await result.current.createProject('Course 2')
    })
    
    let projects
    await act(async () => {
      projects = await result.current.listProjects()
    })
    
    expect(projects).toHaveLength(2)
    expect(projects[0].name).toBe('Course 2') // Most recent first
  })
})