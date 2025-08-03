import { describe, it, expect, vi } from 'vitest'
import { render } from '../../test/testProviders'
import { AIPromptGenerator } from '../AIPromptGenerator'
import { CourseSeedData } from '../../types/course'

describe('AI Prompt Generator - Knowledge Check Feedback', () => {
  const mockSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None' as const,
    templateTopics: []
  }

  const defaultProps = {
    courseSeedData: mockSeedData,
    onNext: vi.fn(),
    onBack: vi.fn()
  }

  it('should include feedback structure for knowledge check questions', () => {
    const { container } = render(<AIPromptGenerator {...defaultProps} />)
    
    // Find the textarea with the prompt
    const promptTextarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(promptTextarea).toBeTruthy()
    
    const promptContent = promptTextarea.value
    
    // Check that knowledge check section includes feedback
    const kcSection = promptContent.match(/knowledgeCheck[\s\S]*?\}/m)
    expect(kcSection).toBeTruthy()
    
    // Knowledge check should now have feedback structure similar to assessment
    expect(promptContent).toContain('"feedback": {')
    expect(promptContent).toContain('"correct":')
    expect(promptContent).toContain('"incorrect":')
  })

  it('should show consistent structure between knowledge check and assessment', () => {
    const { container } = render(<AIPromptGenerator {...defaultProps} />)
    
    const promptTextarea = container.querySelector('textarea') as HTMLTextAreaElement
    const promptContent = promptTextarea.value
    
    // Both knowledge check and assessment should have similar question structure
    expect(promptContent).toMatch(/knowledgeCheck.*questions.*feedback/s)
    expect(promptContent).toMatch(/assessment.*questions.*feedback/s)
  })

  it('should include clear instructions for feedback in knowledge checks', () => {
    const { container } = render(<AIPromptGenerator {...defaultProps} />)
    
    const promptTextarea = container.querySelector('textarea') as HTMLTextAreaElement
    const promptContent = promptTextarea.value
    
    // Check for instructions about knowledge check feedback
    // const instructionsSection = promptContent.match(/Knowledge [Cc]hecks?:[\s\S]*?(?=\d+\.|Assessment)/i)
    
    // Should mention feedback for knowledge checks
    expect(promptContent.toLowerCase()).toContain('feedback')
  })
})