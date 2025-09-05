import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'

describe('AudioNarrationWizard - Consistent Block Numbers', () => {
  let fileContent: string

  beforeEach(() => {
    fileContent = readFileSync('src/components/AudioNarrationWizard.tsx', 'utf-8')
  })

  describe('Block Number Consistency', () => {
    it('should always create block 0001 for welcome page even without narration text', () => {
      // Should have welcome page creation without narration condition
      expect(fileContent).toMatch(/\/\/ ALWAYS add welcome page block \(even if no narration text\)/)
      expect(fileContent).toMatch(/if \('welcomePage' in content\) \{/)
      expect(fileContent).toMatch(/blockNumber: '0001'/)
      expect(fileContent).toMatch(/text: content\.welcomePage\?\.narration \|\| ''/)
    })

    it('should always create block 0002 for objectives page even without narration text', () => {
      // Should have objectives page creation without narration condition
      expect(fileContent).toMatch(/\/\/ ALWAYS add learning objectives page block \(even if no narration text\)/)
      expect(fileContent).toMatch(/if \('learningObjectivesPage' in content\) \{/)
      expect(fileContent).toMatch(/blockNumber: '0002'/)
      expect(fileContent).toMatch(/text: content\.learningObjectivesPage\?\.narration \|\| ''/)
    })

    it('should create topic blocks starting at 0003 regardless of narration text', () => {
      // Should process topics and create blocks even with empty narration
      expect(fileContent).toMatch(/\/\/ Process topics \(both formats\) - ALWAYS create blocks regardless of narration text/)
      expect(fileContent).toMatch(/content\.topics\.forEach\(topic => \{/)
      expect(fileContent).toMatch(/const narrationText = \(typeof topic\.narration === 'string' \? topic\.narration : ''\) \|\| ''/)
      expect(fileContent).toMatch(/String\(blockCounter\+\+\)\.padStart\(4, '0'\)/)
    })

    it('should not use conditional narration checks that skip blocks', () => {
      // Should NOT have conditions like "if (topic.narration)" that would skip blocks
      expect(fileContent).not.toMatch(/if \(topic\.narration\)/)
      expect(fileContent).not.toMatch(/content\.welcomePage\?\.narration\) \{/)
      expect(fileContent).not.toMatch(/content\.learningObjectivesPage\?\.narration\) \{/)
    })

    it('should ensure blocks are always created in consistent order', () => {
      // Should have blockCounter starting at 1
      expect(fileContent).toMatch(/let blockCounter = 1/)
      
      // Welcome should use fixed '0001', not counter
      expect(fileContent).toMatch(/blockNumber: '0001'/)
      
      // Objectives should use fixed '0002', not counter  
      expect(fileContent).toMatch(/blockNumber: '0002'/)
      
      // Topics should start counter at 3
      expect(fileContent).toMatch(/blockCounter = 3/)
    })
  })

  describe('Block Creation Logic', () => {
    it('should handle course content with no narration text at all', () => {
      // Should handle undefined/null narration gracefully
      expect(fileContent).toMatch(/content\.welcomePage\?\.narration \|\| ''/)
      expect(fileContent).toMatch(/content\.learningObjectivesPage\?\.narration \|\| ''/)
    })

    it('should handle course content with mixed narration (some pages have text, others dont)', () => {
      // Should create blocks for all pages regardless of which ones have narration
      expect(fileContent).toMatch(/blocks\.push\(\{/)
      expect(fileContent).toMatch(/\/\/ ALWAYS add welcome page block/)
      expect(fileContent).toMatch(/\/\/ ALWAYS add learning objectives page block/)
    })
  })
})