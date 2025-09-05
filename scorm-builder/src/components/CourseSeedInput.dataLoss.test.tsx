import { render, screen, waitFor } from '../test/testProviders'
import { vi } from 'vitest'
import { CourseSeedInput } from './CourseSeedInput'
import { CourseSeedData } from '../types/course'

// Mock the storage
const mockStorage = {
  currentProjectId: '123',
  isInitialized: true,
  saveCourseSeedData: vi.fn(),
  getContent: vi.fn().mockResolvedValue(null),
  listProjects: vi.fn().mockResolvedValue([])
}

vi.mock('../contexts/PersistentStorageContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useStorage: () => mockStorage
  }
})

describe('CourseSeedInput - Data Loss Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load saved template and topics when reopening project', async () => {
    // Simulate the saved project data that should be loaded
    const savedData: CourseSeedData = {
      courseTitle: 'Natural Gas Safety',
      template: 'Safety',
      difficulty: 3,
      customTopics: ['Hazard identification', 'Personal protective equipment', 'Emergency procedures'],
      templateTopics: []
    }

    const mockOnSubmit = vi.fn()
    const mockOnSave = vi.fn()

    // First render - component mounts WITHOUT initial data (fresh component)
    const { rerender } = render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
      />
    )

    // Wait for component to mount with default state
    await waitFor(() => {
      const templateSelect = screen.getByTestId('template-select') as HTMLSelectElement
      expect(templateSelect.value).toBe('None') // Should start with default
    })

    // Now simulate loading project data - this is where the bug occurs
    // The userHasChangedTemplate logic incorrectly prevents data loading
    rerender(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={savedData}
      />
    )

    // After receiving initialData, fields should be populated from saved data
    await waitFor(() => {
      const titleInput = screen.getByTestId('course-title-input') as HTMLInputElement
      const templateSelect = screen.getByTestId('template-select') as HTMLSelectElement
      const topicsTextarea = screen.getByTestId('topics-textarea') as HTMLTextAreaElement

      // BUG: These should be loaded from saved data but the sync logic prevents it
      // because userHasChangedTemplate returns true when template goes from 'None' to 'Safety'
      expect(titleInput.value).toBe('Natural Gas Safety')
      expect(templateSelect.value).toBe('Safety') // This is the key bug - stays 'None'
      expect(topicsTextarea.value).toBe('Hazard identification\nPersonal protective equipment\nEmergency procedures')
    })
  })

  it('should prevent sync when template has actually been changed by user', async () => {
    // This test simulates the race condition where the user has made changes
    // but initialData arrives late and would overwrite user changes
    const initialData: CourseSeedData = {
      courseTitle: 'Original Title',
      template: 'Safety',
      difficulty: 3,
      customTopics: ['Original Topic'],
      templateTopics: []
    }

    const mockOnSubmit = vi.fn()
    const mockOnSave = vi.fn()

    const { rerender } = render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
      />
    )

    // User changes template to 'Corporate' BEFORE initialData is provided
    const templateSelect = screen.getByTestId('template-select') as HTMLSelectElement
    templateSelect.value = 'Corporate'
    templateSelect.dispatchEvent(new Event('change', { bubbles: true }))

    await waitFor(() => {
      expect(templateSelect.value).toBe('Corporate')
    })

    // Now initialData arrives late (common in loading scenarios)
    // The sync logic should NOT overwrite the user's Corporate selection with Safety
    rerender(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={initialData}
      />
    )

    // Template should remain 'Corporate' (user's choice) not 'Safety' (from initialData)
    await waitFor(() => {
      expect(templateSelect.value).toBe('Corporate') // Should preserve user changes
    })
  })
})