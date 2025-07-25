import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectDashboard } from '../ProjectDashboard'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock date-fns to avoid any date formatting issues in tests
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => 'just now'
}))

// Mock the storage hook
const mockStorage = {
  isInitialized: true,
  currentProjectId: null,
  error: null,
  createProject: vi.fn(),
  openProject: vi.fn(),
  openProjectFromFile: vi.fn(),
  listProjects: vi.fn(),
  deleteProject: vi.fn(),
  storeMedia: vi.fn(),
  storeYouTubeVideo: vi.fn(),
  getMedia: vi.fn(),
  getMediaForTopic: vi.fn(),
  saveContent: vi.fn(),
  getContent: vi.fn(),
  saveCourseMetadata: vi.fn(),
  getCourseMetadata: vi.fn(),
  saveAiPrompt: vi.fn(),
  getAiPrompt: vi.fn(),
  saveAudioSettings: vi.fn(),
  getAudioSettings: vi.fn(),
  saveScormConfig: vi.fn(),
  getScormConfig: vi.fn(),
  exportProject: vi.fn(),
  saveProject: vi.fn(),
  saveProjectAs: vi.fn(),
  migrateFromLocalStorage: vi.fn()
}

vi.mock('../../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => mockStorage
}))

describe('ProjectDashboard with FileStorage', () => {
  const mockOnProjectSelected = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.currentProjectId = null
  })
  
  it('should show "Open Project File" button', async () => {
    mockStorage.listProjects.mockResolvedValue([])
    
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    await waitFor(() => {
      expect(screen.getByText('Open Project File')).toBeInTheDocument()
    })
  })
  
  it('should handle opening a project from file', async () => {
    mockStorage.listProjects.mockResolvedValue([])
    mockStorage.openProjectFromFile.mockResolvedValue(undefined)
    mockStorage.currentProjectId = 'opened-project-123'
    
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    await waitFor(() => {
      expect(screen.getByText('Open Project File')).toBeInTheDocument()
    })
    
    const openButton = screen.getByText('Open Project File')
    fireEvent.click(openButton)
    
    await waitFor(() => {
      expect(mockStorage.openProjectFromFile).toHaveBeenCalled()
      expect(mockOnProjectSelected).toHaveBeenCalledWith('opened-project-123')
    })
  })
  
  it('should show recent projects from FileStorage', async () => {
    // FileStorage already returns projects sorted by most recent first
    const projects = [
      { 
        id: 'recent-project', 
        name: 'Recent Project', 
        created: '2024-01-01T00:00:00.000Z',
        lastModified: new Date().toISOString()
      },
      { 
        id: 'medium-project', 
        name: 'Medium Project', 
        created: '2024-01-01T00:00:00.000Z',
        lastModified: '2024-06-01T00:00:00.000Z'
      },
      { 
        id: 'old-project', 
        name: 'Old Project', 
        created: '2024-01-01T00:00:00.000Z',
        lastModified: '2024-01-01T00:00:00.000Z'
      }
    ]
    
    mockStorage.listProjects.mockResolvedValue(projects)
    
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    await waitFor(() => {
      const projectCards = screen.getAllByTestId('project-card')
      expect(projectCards).toHaveLength(3)
      
      // Projects should be in the order returned by FileStorage (already sorted)
      expect(projectCards[0]).toHaveTextContent('Recent Project')
      expect(projectCards[1]).toHaveTextContent('Medium Project')
      expect(projectCards[2]).toHaveTextContent('Old Project')
    })
  })
  
  it('should show "Open Existing Project" in empty state', async () => {
    mockStorage.listProjects.mockResolvedValue([])
    
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    await waitFor(() => {
      expect(screen.getByText('Open Existing Project')).toBeInTheDocument()
    })
    
    const openButton = screen.getByText('Open Existing Project')
    fireEvent.click(openButton)
    
    await waitFor(() => {
      expect(mockStorage.openProjectFromFile).toHaveBeenCalled()
    })
  })
  
  it('should handle external project files in the list', async () => {
    const projects = [
      { 
        id: 'local-project', 
        name: 'Local Project', 
        created: '2024-01-01T00:00:00.000Z',
        lastModified: '2024-06-01T00:00:00.000Z'
      },
      { 
        id: 'external-project', 
        name: 'External Project (from Desktop)', 
        created: '2024-01-01T00:00:00.000Z',
        lastModified: new Date().toISOString()
      }
    ]
    
    mockStorage.listProjects.mockResolvedValue(projects)
    
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    await waitFor(() => {
      expect(screen.getByText('External Project (from Desktop)')).toBeInTheDocument()
    })
    
    // Clicking should open the external project
    const externalProjectCard = screen.getByText('External Project (from Desktop)').closest('[data-testid="project-card"]')
    const clickableArea = externalProjectCard!.querySelector('div[style*="cursor: pointer"]')
    fireEvent.click(clickableArea!)
    
    await waitFor(() => {
      expect(mockStorage.openProject).toHaveBeenCalledWith('external-project')
      expect(mockOnProjectSelected).toHaveBeenCalledWith('external-project')
    })
  })
  
  it('should update project list after creating a new project', async () => {
    mockStorage.listProjects.mockResolvedValue([])
    mockStorage.createProject.mockResolvedValue({
      id: 'new-project-123',
      name: 'New Test Project',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    })
    
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    await waitFor(() => {
      expect(screen.getByText('Create Your First Project')).toBeInTheDocument()
    })
    
    // Click create button
    fireEvent.click(screen.getByText('Create Your First Project'))
    
    // Enter project name
    const input = screen.getByPlaceholderText('Enter project name')
    fireEvent.change(input, { target: { value: 'New Test Project' } })
    
    // Submit - find the create button in the modal
    const createButtons = screen.getAllByText('Create')
    const createButton = createButtons.find(btn => btn.closest('.modal-actions'))
    fireEvent.click(createButton!)
    
    await waitFor(() => {
      expect(mockStorage.createProject).toHaveBeenCalledWith('New Test Project')
      expect(mockStorage.openProject).toHaveBeenCalledWith('new-project-123')
      expect(mockOnProjectSelected).toHaveBeenCalledWith('new-project-123')
    })
  })
  
  it('should handle errors when opening project files', async () => {
    mockStorage.listProjects.mockResolvedValue([])
    mockStorage.openProjectFromFile.mockRejectedValue(new Error('File access denied'))
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    await waitFor(() => {
      expect(screen.getByText('Open Project File')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Open Project File'))
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to open project file:', expect.any(Error))
      expect(mockOnProjectSelected).not.toHaveBeenCalled()
    })
    
    consoleSpy.mockRestore()
  })
})