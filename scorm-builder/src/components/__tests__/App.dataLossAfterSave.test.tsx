import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import App from '../../App'
import { MockFileStorage } from '../../services/MockFileStorage'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../../contexts/NotificationContext'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn())
  })
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: (...paths: string[]) => Promise.resolve(paths.join('/'))
}))

const TestWrapper: React.FC<{ children: React.ReactNode; storage: MockFileStorage }> = ({ children, storage }) => (
  <NotificationProvider>
    <PersistentStorageProvider storage={storage}>
      <UnsavedChangesProvider>
        {children}
      </UnsavedChangesProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('App - Data Loss After Save', () => {
  let mockStorage: MockFileStorage
  
  beforeEach(async () => {
    vi.clearAllMocks()
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce data loss bug: save project, exit, reopen, data gone', async () => {
    // This test reproduces the exact user workflow from the bug report:
    // 1. Create project "Natural Gas Safety"
    // 2. Select "Safety" template 
    // 3. Add template topics
    // 4. Save project
    // 5. Exit to dashboard
    // 6. Open project
    // 7. BUG: Data is gone (template back to "None", topics empty)
    
    // Step 1: Start with dashboard, create new project
    const { rerender } = render(
      <TestWrapper storage={mockStorage}>
        <App />
      </TestWrapper>
    )
    
    // Should show dashboard initially
    await waitFor(() => {
      expect(screen.getByTestId('new-project-button')).toBeInTheDocument()
    })
    
    // Create project "Natural Gas Safety"
    fireEvent.click(screen.getByTestId('new-project-button'))
    const projectNameInput = screen.getByTestId('project-name-input')
    fireEvent.change(projectNameInput, { target: { value: 'Natural Gas Safety' } })
    fireEvent.keyDown(projectNameInput, { key: 'Enter', code: 'Enter' })
    
    // Wait for project creation and navigation to course seed
    await waitFor(() => {
      expect(screen.getByTestId('course-seed-input-form')).toBeInTheDocument()
    })
    
    // Verify initial state: title should be "Natural Gas Safety", template "None"
    expect(screen.getByDisplayValue('Natural Gas Safety')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Choose a template...')).toBeInTheDocument()
    
    // Step 2: Select "Safety" template
    const templateSelect = screen.getByTestId('template-select')
    fireEvent.change(templateSelect, { target: { value: 'Safety' } })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Safety')).toBeInTheDocument()
    })
    
    // Step 3: Add template topics
    const addTemplateTopicsButton = screen.getByTestId('add-template-topics')
    fireEvent.click(addTemplateTopicsButton)
    
    // Confirm adding template topics (this should add 10 topics to the textarea)
    await waitFor(() => {
      const confirmButton = screen.getByTestId('confirm-replace-topics')
      fireEvent.click(confirmButton)
    })
    
    // Verify topics were added
    await waitFor(() => {
      const topicsTextarea = screen.getByTestId('topics-textarea') as HTMLTextAreaElement
      expect(topicsTextarea.value).toContain('Workplace safety regulations')
      expect(topicsTextarea.value).toContain('Hazard identification')
    })
    
    // Step 4: Save project
    const saveButton = screen.getByTestId('save-button')
    fireEvent.click(saveButton)
    
    // Wait for save to complete
    await waitFor(() => {
      // Save button should be disabled during save, then re-enabled
      expect(screen.getByTestId('save-button')).not.toBeDisabled()
    }, { timeout: 5000 })
    
    // Step 5: Exit to dashboard
    const exitButton = screen.getByTestId('exit-button')
    fireEvent.click(exitButton)
    
    // Should be back on dashboard
    await waitFor(() => {
      expect(screen.getByTestId('new-project-button')).toBeInTheDocument()
    })
    
    // Step 6: Open the project again
    // Find the project in the dashboard
    await waitFor(() => {
      expect(screen.getByText('Natural Gas Safety')).toBeInTheDocument()
    })
    
    const openButton = screen.getByText('Open')
    fireEvent.click(openButton)
    
    // Wait for project to load
    await waitFor(() => {
      expect(screen.getByTestId('course-seed-input-form')).toBeInTheDocument()
    })
    
    // Step 7: Verify bug - data should be preserved but currently it's lost
    // BUG: These assertions will fail because the data is lost
    
    // Course title should still be "Natural Gas Safety"
    await waitFor(() => {
      expect(screen.getByDisplayValue('Natural Gas Safety')).toBeInTheDocument()
    })
    
    // Template should still be "Safety" (but currently reverts to "Choose a template...")
    await waitFor(() => {
      expect(screen.getByDisplayValue('Safety')).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Topics should still be populated (but currently empty)
    await waitFor(() => {
      const topicsTextarea = screen.getByTestId('topics-textarea') as HTMLTextAreaElement
      expect(topicsTextarea.value).toContain('Workplace safety regulations')
      expect(topicsTextarea.value).toContain('Hazard identification')
    }, { timeout: 5000 })
  }, 30000) // Increase timeout due to complex interactions
  
  it('should preserve course seed data across save/load operations', async () => {
    // Simpler test to isolate the save/load issue
    const seedData = {
      courseTitle: 'Test Course',
      difficulty: 4,
      template: 'Corporate',
      customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
      templateTopics: []
    }
    
    // Create project with specific ID
    const project = await mockStorage.createProject('Test Course')
    
    // Save course seed data using the generic saveContent method
    await mockStorage.saveContent('courseSeedData', seedData)
    
    // Simulate opening the project (this should load the saved data)
    await mockStorage.openProject(project.id)
    
    // Load the data back using the generic getContent method
    const loadedData = await mockStorage.getContent('courseSeedData')
    
    // Data should be preserved exactly
    expect(loadedData).toEqual(seedData)
  })
})