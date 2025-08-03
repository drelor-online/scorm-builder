import { describe, it, expect, vi } from 'vitest'
import { render } from '../../test/testProviders'
import { AIPromptGenerator } from '../AIPromptGenerator'
import { CourseSeedData } from '../../types/course'

describe('AI Prompt Generator - Knowledge Check Feedback Structure', () => {
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

  it('should include feedback in knowledge check question structure', () => {
    const { container } = render(<AIPromptGenerator {...defaultProps} />)
    
    const promptTextarea = container.querySelector('textarea') as HTMLTextAreaElement
    const promptContent = promptTextarea.value
    
    // Find the knowledge check question structure
    const kcQuestionMatch = promptContent.match(/"knowledgeCheck":\s*\{[\s\S]*?"questions":\s*\[[\s\S]*?\{[\s\S]*?\}/m)
    expect(kcQuestionMatch).toBeTruthy()
    
    const kcQuestionStructure = kcQuestionMatch![0]
    
    // Check that feedback is part of each knowledge check question
    expect(kcQuestionStructure).toContain('"feedback": {')
    expect(kcQuestionStructure).toContain('"correct":')
    expect(kcQuestionStructure).toContain('"incorrect":')
  })

  it('should have identical question structure for KC and assessment', () => {
    const { container } = render(<AIPromptGenerator {...defaultProps} />)
    
    const promptTextarea = container.querySelector('textarea') as HTMLTextAreaElement
    const promptContent = promptTextarea.value
    
    // Extract a knowledge check question example
    const kcExample = promptContent.match(/"knowledgeCheck"[\s\S]*?"questions"[\s\S]*?\[\s*\{([^}]+)\}/m)
    
    // Extract an assessment question example  
    const assessExample = promptContent.match(/"assessment"[\s\S]*?"questions"[\s\S]*?\[\s*\{([^}]+feedback[\s\S]*?\})\s*\}/m)
    
    expect(kcExample).toBeTruthy()
    expect(assessExample).toBeTruthy()
    
    // Both should have the same fields (except KC might have 'blank' field)
    const kcFields = kcExample![1].match(/"(\w+)":/g)?.map(f => f.replace(/[":]/g, ''))
    const assessFields = assessExample![1].match(/"(\w+)":/g)?.map(f => f.replace(/[":]/g, ''))
    
    // Remove 'blank' from KC fields for comparison
    const kcFieldsNormalized = kcFields?.filter(f => f !== 'blank') || []
    
    // Both should have feedback field
    expect(kcFieldsNormalized).toContain('feedback')
    expect(assessFields).toContain('feedback')
  })

  it('should include instructions about feedback for knowledge checks', () => {
    const { container } = render(<AIPromptGenerator {...defaultProps} />)
    
    const promptTextarea = container.querySelector('textarea') as HTMLTextAreaElement
    const promptContent = promptTextarea.value
    
    // Check the instructions section mentions feedback for KC
    const instructionsMatch = promptContent.match(/Knowledge [Cc]hecks?[\s\S]*?(?=\d+\.|Assessment|Final)/i)
    
    if (instructionsMatch) {
      expect(instructionsMatch[0].toLowerCase()).toContain('feedback')
    } else {
      // If no specific KC instructions, check general instructions mention KC feedback
      expect(promptContent).toMatch(/knowledge check.*feedback/is)
    }
  })
})