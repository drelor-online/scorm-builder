import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('AIPromptGenerator - Narration Limits', () => {
  // Read the actual source file to verify the prompt template
  const filePath = resolve(__dirname, 'AIPromptGenerator.tsx')
  const fileContent = readFileSync(filePath, 'utf8')

  describe('AI Prompt Template - Narration Duration and Character Limits', () => {
    it('should specify 1-2 minutes narration duration in welcome page prompt', () => {
      // Should contain the new duration specification for welcome page
      expect(fileContent).toContain('narration": "Narration text for welcome page (1-2 minutes')
      
      // Should NOT contain the old duration specification 
      expect(fileContent).not.toContain('narration": "Narration text for welcome page (2-3 minutes')
    })

    it('should specify 150-300 words narration length in welcome page prompt', () => {
      // Should contain the new word count specification
      expect(fileContent).toContain('approximately 150-300 words')
      
      // Should NOT contain the old word count specification
      expect(fileContent).not.toContain('approximately 300-500 words')
    })

    it('should specify maximum 1000 character limit in welcome page prompt', () => {
      // Should contain the new character limit specification
      expect(fileContent).toContain('maximum 1000 characters')
    })

    it('should specify 1-2 minutes narration duration in learning objectives prompt', () => {
      // Should contain the new duration specification for learning objectives
      expect(fileContent).toContain('narration": "Narration text for learning objectives (1-2 minutes')
      
      // Should NOT contain the old duration specification 
      expect(fileContent).not.toContain('narration": "Narration text for learning objectives (2-3 minutes')
    })

    it('should specify 1-2 minutes narration duration in topic pages prompt', () => {
      // Should contain the new duration specification for topic pages
      expect(fileContent).toContain('narration": "Narration text for this page (1-2 minutes')
      
      // Should NOT contain the old duration specification 
      expect(fileContent).not.toContain('narration": "Narration text for this page (2-3 minutes')
    })

    it('should specify updated narration requirements in general instructions', () => {
      // Should contain updated general instruction about narration length
      expect(fileContent).toContain('exactly ONE narration (single narration per page, 1-2 minutes long')
      
      // Should NOT contain the old instruction
      expect(fileContent).not.toContain('exactly ONE narration (single narration per page, 2-3 minutes long')
    })

    it('should specify updated word count in detailed instructions', () => {
      // Should contain updated detailed instruction
      expect(fileContent).toContain('Each topic page gets exactly one narration text (150-300 words for 1-2 minutes of speech')
      
      // Should NOT contain the old instruction
      expect(fileContent).not.toContain('Each topic page gets exactly one narration text (300-500 words for 2-3 minutes of speech')
    })
  })

  describe('Narration Quality and Character Limits', () => {
    it('should emphasize character limit compliance in instructions', () => {
      // Should mention character limits for quality control
      expect(fileContent).toContain('maximum 1000 characters')
    })

    it('should provide guidance for concise narration writing', () => {
      // Should encourage concise, focused content
      expect(fileContent).toMatch(/1-2 minutes|150-300 words|maximum 1000 characters/)
    })
  })

  describe('Backward Compatibility', () => {
    it('should not contain any references to old duration specifications', () => {
      // Ensure no old specifications remain
      expect(fileContent).not.toContain('2-3 minutes')
      expect(fileContent).not.toContain('300-500 words')
    })

    it('should maintain all other prompt functionality while updating narration limits', () => {
      // Should still contain essential prompt structure
      expect(fileContent).toContain('Generate a JSON response')
      expect(fileContent).toContain('welcomePage')
      expect(fileContent).toContain('learningObjectivesPage')
      expect(fileContent).toContain('topics')
      expect(fileContent).toContain('knowledgeCheck')
    })
  })
})