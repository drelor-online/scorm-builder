import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('AIPromptGenerator - Dual Copy Buttons', () => {
  // Read the actual source file to verify dual copy buttons exist
  const filePath = resolve(__dirname, 'AIPromptGenerator.tsx')
  const fileContent = readFileSync(filePath, 'utf8')

  describe('Copy Button Implementation', () => {
    it('should have two copy button implementations in the code', () => {
      // Count occurrences of copy button elements
      const copyButtonMatches = fileContent.match(/data-testid="copy-prompt-button/g)
      expect(copyButtonMatches).toHaveLength(2)
    })

    it('should have distinct testids for top and bottom copy buttons', () => {
      // Should contain both test IDs
      expect(fileContent).toContain('data-testid="copy-prompt-button-top"')
      expect(fileContent).toContain('data-testid="copy-prompt-button-bottom"')
    })

    it('should have both buttons using the same handleCopy function', () => {
      // Both buttons should use the same onClick handler
      const onClickMatches = fileContent.match(/onClick={handleCopy}/g)
      expect(onClickMatches).toHaveLength(2)
    })

    it('should have proper accessibility attributes on both buttons', () => {
      // Both buttons should have aria-label
      const ariaLabelMatches = fileContent.match(/aria-label="Copy prompt to clipboard"/g)
      expect(ariaLabelMatches).toHaveLength(2)
    })

    it('should use same conditional rendering logic for both buttons', () => {
      // Both buttons should check the 'copied' state for conditional rendering
      const copiedCheckMatches = fileContent.match(/\{copied \? \(/g)
      expect(copiedCheckMatches).toHaveLength(2)
      
      // Both should show "Copied!" when copied is true
      const copiedTextMatches = fileContent.match(/Copied!/g)
      expect(copiedTextMatches).toHaveLength(2)
      
      // Both should show "Copy Prompt" when copied is false
      const copyPromptMatches = fileContent.match(/Copy Prompt/g) 
      expect(copyPromptMatches).toHaveLength(2)
    })

    it('should have consistent button styling classes', () => {
      // Both buttons should use the same styling
      const buttonClassMatches = fileContent.match(/className={styles\.copyButton}/g)
      expect(buttonClassMatches).toHaveLength(2)
    })

    it('should include copy icons for both buttons', () => {
      // Should have Copy icons for both buttons
      const copyIconMatches = fileContent.match(/<Copy size=\{16\} className=\{styles\.copyButtonIcon\}/g)
      expect(copyIconMatches).toHaveLength(2)
      
      // Should have Check icons for both buttons
      const checkIconMatches = fileContent.match(/<Check size=\{16\} className=\{styles\.copyButtonIcon\}/g)
      expect(checkIconMatches).toHaveLength(2)
    })
  })

  describe('CSS Styling', () => {
    it('should have CSS for top button container', () => {
      // Read the CSS file to verify styles
      const cssPath = resolve(__dirname, 'AIPromptGenerator.module.css')
      const cssContent = readFileSync(cssPath, 'utf8')
      
      expect(cssContent).toContain('.topButtonContainer')
      expect(cssContent).toContain('justify-content: flex-end')
      expect(cssContent).toContain('margin-bottom: 1rem')
    })

    it('should handle margin spacing for top button', () => {
      const cssPath = resolve(__dirname, 'AIPromptGenerator.module.css')
      const cssContent = readFileSync(cssPath, 'utf8')
      
      // Top button should have margin-top: 0 to override default
      expect(cssContent).toContain('.topButtonContainer .copyButton')
      expect(cssContent).toContain('margin-top: 0')
    })
  })
})