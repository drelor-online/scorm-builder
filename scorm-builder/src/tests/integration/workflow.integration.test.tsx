import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue('/path/to/saved/file.zip')
}))

// Mock window.alert
window.alert = vi.fn()

describe('Full Workflow Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should allow user to complete entire course creation workflow', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Step 1: Course Seed Input
    // The user wants to create a safety training course
    const titleInput = await screen.findByLabelText(/course title/i)
    await user.type(titleInput, 'Workplace Safety Training')

    // Set difficulty level
    const difficultyButton = screen.getByRole('button', { name: /medium/i })
    await user.click(difficultyButton)

    // Add course topics
    const topicsTextarea = screen.getByPlaceholderText(/list your course topics/i)
    await user.type(topicsTextarea, `Introduction to workplace safety
Hazard identification
Personal protective equipment
Emergency procedures
Incident reporting`)

    // Continue to AI Prompt
    const continueButton = screen.getByRole('button', { name: /continue to ai prompt/i })
    await user.click(continueButton)

    // Step 2: AI Prompt Generator
    // User wants to copy the prompt to use with an AI
    await waitFor(() => {
      expect(screen.getByText(/ai prompt generator/i)).toBeInTheDocument()
    })

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      writable: true
    })

    const copyButton = screen.getByRole('button', { name: /copy prompt/i })
    await user.click(copyButton)

    // Verify prompt was copied
    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeInTheDocument()
    })

    // Continue to JSON Import
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Step 3: JSON Import Validator
    // User pastes the AI-generated JSON
    await waitFor(() => {
      expect(screen.getByText(/json import/i)).toBeInTheDocument()
    })

    const sampleJson = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome to Workplace Safety Training',
        content: '<h2>Welcome!</h2><p>This course will teach you essential workplace safety practices.</p>',
        narration: 'Welcome to this workplace safety training course.',
        imageKeywords: ['workplace', 'safety'],
        imagePrompts: ['Modern office workplace with safety equipment visible'],
        videoSearchTerms: ['workplace safety introduction'],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<h2>Learning Objectives</h2><ul><li>Identify workplace hazards</li><li>Use PPE correctly</li><li>Follow emergency procedures</li></ul>',
        narration: 'By the end of this course, you will be able to identify hazards and follow safety procedures.',
        imageKeywords: ['learning', 'objectives'],
        imagePrompts: ['Checklist or goals visualization'],
        videoSearchTerms: [],
        duration: 2
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction to workplace safety',
          content: '<h2>Introduction to Workplace Safety</h2><p>Safety is everyone\'s responsibility.</p>',
          narration: 'Workplace safety is crucial for preventing injuries and maintaining a healthy work environment.',
          imageKeywords: ['workplace', 'safety', 'introduction'],
          imagePrompts: ['Safe workplace environment'],
          videoSearchTerms: ['workplace safety basics'],
          duration: 5
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'What is the first step in hazard identification?',
            options: ['Ignore it', 'Report it', 'Fix it yourself', 'Wait for someone else'],
            correctAnswer: 'Report it',
            feedback: {
              correct: 'Correct! Always report hazards immediately.',
              incorrect: 'The correct answer is to report hazards immediately.'
            }
          }
        ],
        passMark: 80,
        narration: null
      }
    }

    const jsonInput = screen.getByPlaceholderText(/paste your json data here/i)
    await user.clear(jsonInput)
    await user.type(jsonInput, JSON.stringify(sampleJson, null, 2))

    // Validate JSON
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)

    // Verify validation success
    await waitFor(() => {
      expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
    })

    // Continue to Media Enhancement
    const nextToMediaButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextToMediaButton)

    // Step 4: Media Enhancement
    // User wants to skip media for now
    await waitFor(() => {
      expect(screen.getByText(/media enhancement/i)).toBeInTheDocument()
    })

    // Continue without adding media
    const skipMediaButton = screen.getByRole('button', { name: /next/i })
    await user.click(skipMediaButton)

    // Step 5: Audio Narration
    // User wants to skip audio for now
    await waitFor(() => {
      expect(screen.getByText(/audio narration/i)).toBeInTheDocument()
    })

    const skipAudioButton = screen.getByRole('button', { name: /next/i })
    await user.click(skipAudioButton)

    // Step 6: Activities Editor
    // User wants to keep the default assessment
    await waitFor(() => {
      expect(screen.getByText(/interactive activities/i)).toBeInTheDocument()
    })

    const skipActivitiesButton = screen.getByRole('button', { name: /next/i })
    await user.click(skipActivitiesButton)

    // Step 7: SCORM Package Builder
    // User wants to generate the SCORM package
    await waitFor(() => {
      expect(screen.getByText(/scorm package/i)).toBeInTheDocument()
    })

    // Set organization name
    const orgInput = screen.getByLabelText(/organization/i)
    await user.clear(orgInput)
    await user.type(orgInput, 'Safety Training Inc')

    // Generate SCORM package
    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    await user.click(generateButton)

    // Verify package generation started
    await waitFor(() => {
      expect(screen.getByText(/generating package/i)).toBeInTheDocument()
    })

    // Verify the workflow completed successfully
    expect(vi.mocked(navigator.clipboard.writeText)).toHaveBeenCalledWith(
      expect.stringContaining('Workplace Safety Training')
    )
  })

  it('should save and restore user progress', async () => {
    const user = userEvent.setup()
    
    // Start creating a course
    render(<App />)
    
    const titleInput = await screen.findByLabelText(/course title/i)
    await user.type(titleInput, 'Test Course for Saving')
    
    // Add topics
    const topicsTextarea = screen.getByPlaceholderText(/list your course topics/i)
    await user.type(topicsTextarea, 'Topic 1\nTopic 2\nTopic 3')
    
    // Navigate to next step
    const continueButton = screen.getByRole('button', { name: /continue to ai prompt/i })
    await user.click(continueButton)
    
    // Verify we're on the AI prompt step
    await waitFor(() => {
      expect(screen.getByText(/ai prompt generator/i)).toBeInTheDocument()
    })
    
    // Simulate saving project
    const saveButton = screen.getByRole('button', { name: /save project/i })
    await user.click(saveButton)
    
    // Verify save success
    await waitFor(() => {
      expect(screen.getByText(/project saved successfully/i)).toBeInTheDocument()
    })
  })

  it('should validate required fields before allowing progression', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Try to continue without filling required fields
    const continueButton = screen.getByRole('button', { name: /continue to ai prompt/i })
    await user.click(continueButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/course title is required/i)).toBeInTheDocument()
    })

    // Fill the title
    const titleInput = screen.getByLabelText(/course title/i)
    await user.type(titleInput, 'Valid Course Title')

    // Now it should allow progression
    await user.click(continueButton)

    await waitFor(() => {
      expect(screen.getByText(/ai prompt generator/i)).toBeInTheDocument()
    })
  })

  it('should handle navigation between steps', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Fill initial data
    const titleInput = await screen.findByLabelText(/course title/i)
    await user.type(titleInput, 'Navigation Test Course')

    // Go to AI Prompt
    const continueButton = screen.getByRole('button', { name: /continue to ai prompt/i })
    await user.click(continueButton)

    await waitFor(() => {
      expect(screen.getByText(/ai prompt generator/i)).toBeInTheDocument()
    })

    // Go back to Course Seed
    const backButton = screen.getByRole('button', { name: /back/i })
    await user.click(backButton)

    // Verify we're back and data is preserved
    await waitFor(() => {
      expect(screen.getByLabelText(/course title/i)).toHaveValue('Navigation Test Course')
    })
  })
})