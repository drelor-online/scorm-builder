import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('SCORM templates - fullscreen mode', () => {
  it('should keep sidebar visible in fullscreen mode', () => {
    // Read the main.css.hbs template
    const cssPath = path.join(__dirname, '..', 'main.css.hbs')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')
    
    // Check that sidebar is NOT hidden in fullscreen mode
    // The old CSS would have: body.fullscreen-mode .sidebar { display: none; }
    // We want to ensure this rule doesn't exist
    expect(cssContent).not.toMatch(/body\.fullscreen-mode\s+\.sidebar\s*{\s*display:\s*none/i)
    
    // Check that the sidebar remains visible (no hidden styles)
    const fullscreenSidebarMatch = cssContent.match(/body\.fullscreen-mode\s+\.sidebar\s*{([^}]*)}/i)
    if (fullscreenSidebarMatch) {
      const sidebarStyles = fullscreenSidebarMatch[1]
      expect(sidebarStyles).not.toMatch(/display:\s*none/i)
      expect(sidebarStyles).not.toMatch(/visibility:\s*hidden/i)
      expect(sidebarStyles).not.toMatch(/opacity:\s*0/i)
    }
  })
  
  it('should adjust layout for fullscreen mode with visible sidebar', () => {
    const cssPath = path.join(__dirname, '..', 'main.css.hbs')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')
    
    // Check that main area should NOT have margin-left: 0 in fullscreen
    const fullscreenMainMatch = cssContent.match(/body\.fullscreen-mode\s+\.main-area\s*{([^}]*)}/i)
    if (fullscreenMainMatch) {
      const mainStyles = fullscreenMainMatch[1]
      // Should NOT reset margin-left to 0
      expect(mainStyles).not.toMatch(/margin-left:\s*0/i)
    }
  })
})