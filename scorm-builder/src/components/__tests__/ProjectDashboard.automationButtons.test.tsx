import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProjectDashboard } from '../ProjectDashboard'
import { MemoryRouter } from 'react-router-dom'

// Mock contexts
vi.mock('../../contexts/PersistentStorageContext', () => ({
  usePersistentStorage: () => ({
    loadProjectIds: vi.fn().mockResolvedValue([]),
    getProject: vi.fn(),
    deleteProject: vi.fn(),
    saveProject: vi.fn(),
    listAllProjects: vi.fn().mockResolvedValue([])
  }),
  useStorage: () => ({
    loading: false,
    error: null,
    projects: [],
    refreshProjects: vi.fn(),
    deleteProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn()
  })
}))

vi.mock('@tauri-apps/api/dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/api/fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn()
}))

describe('ProjectDashboard - Automation Buttons', () => {
  it('should NOT display Run Automation button', () => {
    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>
    )
    
    // The button should not exist
    const automationButton = screen.queryByText(/Run Automation/i)
    expect(automationButton).not.toBeInTheDocument()
  })
  
  it('should NOT display View Screenshots button', () => {
    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>
    )
    
    // The button should not exist
    const screenshotsButton = screen.queryByText(/View Screenshots/i)
    expect(screenshotsButton).not.toBeInTheDocument()
  })
  
  it('should NOT have any automation-related buttons in the header', () => {
    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>
    )
    
    // Check that no automation-related test IDs exist
    const runAutomationButton = screen.queryByTestId('run-automation-button')
    const viewScreenshotsButton = screen.queryByTestId('view-screenshots-button')
    
    expect(runAutomationButton).not.toBeInTheDocument()
    expect(viewScreenshotsButton).not.toBeInTheDocument()
  })
})