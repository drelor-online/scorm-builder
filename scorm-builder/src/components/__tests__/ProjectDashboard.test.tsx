import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProjectDashboard } from '../ProjectDashboard'
import React from 'react'

// Mock the storage context
const mockCreateProject = vi.fn()
const mockOpenProject = vi.fn()
const mockListProjects = vi.fn()
const mockDeleteProject = vi.fn()

vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: null,
    error: null,
    createProject: mockCreateProject,
    openProject: mockOpenProject,
    listProjects: mockListProjects,
    deleteProject: mockDeleteProject
  })
}))

describe('ProjectDashboard - Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListProjects.mockResolvedValue([])
  })
  
  it('should show welcome message when no projects exist', async () => {
    // Intent: New users should see a friendly welcome
    render(<ProjectDashboard onProjectSelected={vi.fn()} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Welcome to SCORM Builder/i)).toBeInTheDocument()
      expect(screen.getByText(/Create your first project/i)).toBeInTheDocument()
    })
  })
  
  it('should create a new project when user clicks create button', async () => {
    // Intent: User can create a new project easily
    const onProjectSelected = vi.fn()
    mockCreateProject.mockResolvedValue({ id: 'project-1', name: 'New Course' })
    
    render(<ProjectDashboard onProjectSelected={onProjectSelected} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading projects/i)).not.toBeInTheDocument()
    })
    
    const createButton = await screen.findByText(/Create New Project/i)
    fireEvent.click(createButton)
    
    // Should show input dialog
    const input = await screen.findByPlaceholderText(/Enter project name/i)
    fireEvent.change(input, { target: { value: 'Safety Training' } })
    
    const confirmButton = screen.getByText(/Create/i)
    fireEvent.click(confirmButton)
    
    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith('Safety Training')
      expect(mockOpenProject).toHaveBeenCalledWith('project-1')
      expect(onProjectSelected).toHaveBeenCalledWith('project-1')
    })
  })
  
  it('should display recent projects sorted by last accessed', async () => {
    // Intent: User sees their recent projects first
    mockListProjects.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Old Project',
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-01T00:00:00Z'
      },
      {
        id: 'project-2', 
        name: 'Recent Project',
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-15T00:00:00Z'
      }
    ])
    
    render(<ProjectDashboard onProjectSelected={vi.fn()} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading projects/i)).not.toBeInTheDocument()
    })
    
    await waitFor(() => {
      const projects = screen.getAllByTestId('project-card')
      expect(projects[0]).toHaveTextContent('Recent Project')
      expect(projects[1]).toHaveTextContent('Old Project')
    })
  })
  
  it('should open existing project when clicked', async () => {
    // Intent: User can continue working on existing projects
    const onProjectSelected = vi.fn()
    mockListProjects.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Existing Course',
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-10T00:00:00Z'
      }
    ])
    
    render(<ProjectDashboard onProjectSelected={onProjectSelected} />)
    
    const projectCard = await screen.findByText('Existing Course')
    fireEvent.click(projectCard)
    
    await waitFor(() => {
      expect(mockOpenProject).toHaveBeenCalledWith('project-1')
      expect(onProjectSelected).toHaveBeenCalledWith('project-1')
    })
  })
  
  it('should allow deleting projects with confirmation', async () => {
    // Intent: User can delete old projects but with safety confirmation
    mockListProjects.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Project to Delete',
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-01T00:00:00Z'
      }
    ])
    
    render(<ProjectDashboard onProjectSelected={vi.fn()} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading projects/i)).not.toBeInTheDocument()
    })
    
    const deleteButton = await screen.findByLabelText(/Delete project/i)
    fireEvent.click(deleteButton)
    
    // Should show confirmation dialog
    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument()
    
    const confirmDelete = screen.getByText(/Delete/i)
    fireEvent.click(confirmDelete)
    
    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('project-1')
    })
  })
  
  it('should show loading state while fetching projects', async () => {
    // Intent: User sees loading indicator while data loads
    mockListProjects.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 1000))
    )
    
    render(<ProjectDashboard onProjectSelected={vi.fn()} />)
    
    expect(screen.getByText(/Loading projects/i)).toBeInTheDocument()
  })
})