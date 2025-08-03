import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateProjectId } from '../../utils/idGenerator'

// Mock the idGenerator
vi.mock('../../utils/idGenerator', () => ({
  generateProjectId: vi.fn(() => 'project_550e8400-e29b-41d4-a716-446655440000')
}))

// Import after mocks
import { PersistentStorage } from '../PersistentStorage'

const mockGenerateProjectId = vi.mocked(generateProjectId)

describe('PersistentStorage - Project ID Generation', () => {
  let storage: PersistentStorage
  
  beforeEach(() => {
    storage = new PersistentStorage()
    vi.clearAllMocks()
    
    // Clear localStorage
    localStorage.clear()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })
  
  describe('createProject', () => {
    it('should use generateProjectId from idGenerator', async () => {
      const projectName = 'Test Project'
      
      const project = await storage.createProject(projectName)
      
      // Verify generateProjectId was called
      expect(mockGenerateProjectId).toHaveBeenCalled()
      
      // Verify the project has the mocked UUID
      expect(project.id).toBe('project_550e8400-e29b-41d4-a716-446655440000')
      expect(project.name).toBe(projectName)
    })
    
    
    it('should create unique project IDs for multiple projects', async () => {
      // Reset the mock to return different UUIDs
      mockGenerateProjectId
        .mockReturnValueOnce('project_11111111-1111-1111-1111-111111111111' as any)
        .mockReturnValueOnce('project_22222222-2222-2222-2222-222222222222' as any)
      
      const project1 = await storage.createProject('Project 1')
      const project2 = await storage.createProject('Project 2')
      
      // Verify generateProjectId was called twice
      expect(mockGenerateProjectId).toHaveBeenCalledTimes(2)
      
      // Verify different IDs
      expect(project1.id).toBe('project_11111111-1111-1111-1111-111111111111')
      expect(project2.id).toBe('project_22222222-2222-2222-2222-222222222222')
      expect(project1.id).not.toBe(project2.id)
    })
  })
})