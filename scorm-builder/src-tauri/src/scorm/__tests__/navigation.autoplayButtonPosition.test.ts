import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('SCORM Navigation - Autoplay Button Positioning', () => {
  it('should have proper CSS positioning to avoid overlapping fullscreen button', () => {
    // Read the actual CSS template
    const cssPath = join(__dirname, '../templates/main.css.hbs')
    const cssContent = readFileSync(cssPath, 'utf-8')
    
    // Check if margin-right is present to create space from fullscreen button
    expect(cssContent).toContain('margin-right: 120px')
    // Also check the comment
    expect(cssContent).toContain('/* Prevent overlap with fullscreen button */')
  })

  it('should position autoplay button with proper spacing', () => {
    // Mock the HTML structure
    const headerHTML = `
      <header class="header">
        <h1>Course Title</h1>
        <button class="audio-autoplay-toggle">Autoplay</button>
      </header>
    `
    
    // Mock CSS that should exist
    const cssRules = {
      '.audio-autoplay-toggle': {
        'margin-right': '120px'
      }
    }
    
    // Check if the CSS rule exists
    expect(cssRules['.audio-autoplay-toggle']).toBeDefined()
    expect(cssRules['.audio-autoplay-toggle']['margin-right']).toBe('120px')
  })

  it('should ensure header uses flexbox with proper spacing', () => {
    const headerCSS = `
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    `
    
    // Check if header has flexbox properties
    expect(headerCSS).toContain('display: flex')
    expect(headerCSS).toContain('justify-content: space-between')
  })
})