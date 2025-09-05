import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn()
}

const mockProps = {
  onNext: vi.fn(),
  onBack: vi.fn()
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

// Large JSON similar to what the user reported (20 topics, full structure)
const largeJsonWithManyTopics = {
  welcomePage: {
    id: 'welcome',
    title: '49 CFR 192 - Federal Pipeline Safety Regulations',
    content: '<h2>Welcome to 49 CFR 192 Training</h2><p>This training covers the federal safety standards for natural gas pipeline transportation systems.</p>',
    narration: 'Welcome to our comprehensive training on 49 CFR Part 192 Federal Pipeline Safety Regulations.',
    imageKeywords: ['pipeline', 'safety', 'regulations'],
    imagePrompts: ['federal pipeline safety training welcome'],
    videoSearchTerms: ['pipeline safety regulations introduction'],
    duration: 30
  },
  objectives: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: '<h2>Learning Objectives</h2><ul><li>Understanding Part 192 scope and applicability</li><li>Pipeline design and construction requirements</li><li>Operational safety standards</li></ul>',
    narration: 'By the end of this training, you will understand the key requirements of 49 CFR Part 192.',
    imageKeywords: ['objectives', 'learning', 'compliance'],
    imagePrompts: ['pipeline safety learning objectives'],
    videoSearchTerms: ['CFR 192 training objectives'],
    duration: 45
  },
  topics: Array.from({ length: 20 }, (_, i) => ({
    id: `topic-${i}`,
    title: `1.${i + 1}. Pipeline Safety Topic ${i + 1}`,
    content: `<h2>Topic ${i + 1}: Pipeline Safety Requirements</h2><p>This section covers detailed requirements for pipeline safety including design, construction, testing, and operational considerations under 49 CFR Part 192.</p>`,
    narration: `In this section, we'll explore the critical aspects of pipeline safety topic ${i + 1}.`,
    imageKeywords: ['pipeline', 'safety', 'regulations', 'CFR'],
    imagePrompts: [`pipeline safety topic ${i + 1} illustration`],
    videoSearchTerms: [`CFR 192 topic ${i + 1} requirements`],
    duration: 120,
    knowledgeCheck: {
      id: `kc-${i}`,
      title: `Knowledge Check ${i + 1}`,
      questions: [
        {
          id: `kc-q-${i}`,
          type: 'multiple-choice' as const,
          question: `What is the key requirement for pipeline safety topic ${i + 1}?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'Option A',
          feedback: 'Correct! This is the primary requirement for this safety topic.'
        }
      ]
    }
  })),
  assessment: {
    questions: Array.from({ length: 12 }, (_, i) => ({
      id: `assessment-q-${i}`,
      type: 'multiple-choice' as const,
      question: `Assessment Question ${i + 1}: Which regulation applies to pipeline safety requirement ${i + 1}?`,
      options: ['49 CFR 192.101', '49 CFR 192.201', '49 CFR 192.301', '49 CFR 192.401'],
      correctAnswer: '49 CFR 192.101',
      feedback: 'Correct! This regulation specifically addresses this safety requirement.'
    })),
    passMark: 80,
    narration: null
  }
}

describe('JSONImportValidator - Real World Large JSON Test', () => {
  let validationCallCount = 0

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    validationCallCount = 0
    
    // Spy on logger to count validation calls
    const originalLog = console.log
    console.log = vi.fn((...args) => {
      if (args[0]?.includes && args[0].includes('JSON validation successful (pre-processing)')) {
        validationCallCount++
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle large 20-topic JSON without infinite validation loops', async () => {
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Reset validation count before test
    validationCallCount = 0
    
    // Create the large JSON string (similar size to user's problem JSON)
    const largeJsonString = JSON.stringify(largeJsonWithManyTopics, null, 2)
    console.log('Test JSON size:', largeJsonString.length, 'characters')
    
    // Paste the large JSON
    act(() => {
      fireEvent.change(textarea, { 
        target: { value: largeJsonString } 
      })
    })

    // Wait for validation to complete - this should NOT hang
    await waitFor(() => {
      const result = screen.queryByText(/ready to import/i) || 
                    screen.queryByText(/unable to process/i) ||
                    screen.queryByText(/automatically fixed/i) ||
                    screen.queryByText(/too large/i)
      expect(result).toBeTruthy()
    }, { timeout: 8000 }) // Give it more time for large JSON
    
    // Allow any additional async operations to complete
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Should not have excessive validation calls (at most 2-3, definitely not dozens)
    expect(validationCallCount).toBeLessThan(5)
    console.log('Final validation call count:', validationCallCount)
    
    unmount()
  }, 15000) // Extended timeout for large JSON

  it('should provide feedback for JSON that exceeds size limits', async () => {
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Create JSON that definitely exceeds 500KB limit
    const megaLargeContent = 'x'.repeat(600000) // 600KB of content
    const oversizedJson = JSON.stringify({ content: megaLargeContent })
    
    act(() => {
      fireEvent.change(textarea, { 
        target: { value: oversizedJson } 
      })
    })

    // Should show size limit error quickly
    await waitFor(() => {
      const errorMessage = screen.queryByText(/too large/i) || screen.queryByText(/500KB/i)
      expect(errorMessage).toBeTruthy()
    }, { timeout: 3000 })
    
    unmount()
  }, 10000)
})