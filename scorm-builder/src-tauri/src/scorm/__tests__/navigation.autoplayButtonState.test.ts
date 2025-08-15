import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('SCORM Navigation - Autoplay Button State', () => {
  it('should update play/pause button when audio autoplays successfully', () => {
    // Read the actual navigation.js template
    const jsPath = join(__dirname, '../templates/navigation.js.hbs')
    const jsContent = readFileSync(jsPath, 'utf-8')
    
    // Check if the autoplay code updates the play/pause button
    expect(jsContent).toContain('// Attempt to play audio')
    expect(jsContent).toContain('audio.play()')
    
    // After successful play, the button should be updated
    // Looking for code that updates the play button to pause after autoplay
    const autoplaySection = jsContent.match(/if \(autoplayEnabled\) \{[\s\S]*?\}[\s]*\}/)?.[0] || ''
    
    // Check if there's a .then() handler for successful play
    expect(autoplaySection).toMatch(/audio\.play\(\)\.then\(/)
    
    // Check if the button is updated to pause icon after successful play
    expect(autoplaySection).toContain('playPauseBtn.innerHTML = \'⏸\'')
    expect(autoplaySection).toContain('playPauseBtn.setAttribute(\'data-playing\', \'true\')')
  })

  it('should have proper promise handling for audio autoplay', () => {
    const jsPath = join(__dirname, '../templates/navigation.js.hbs')
    const jsContent = readFileSync(jsPath, 'utf-8')
    
    // Check for proper promise chain
    expect(jsContent).toMatch(/audio\.play\(\)[\s]*\.then\([\s]*\(\)[\s]*=>[\s]*\{/)
    expect(jsContent).toMatch(/\.catch\([\s]*error[\s]*=>[\s]*\{/)
  })

  it('should maintain play button state when autoplay is blocked', () => {
    const jsPath = join(__dirname, '../templates/navigation.js.hbs')
    const jsContent = readFileSync(jsPath, 'utf-8')
    
    // Check that catch block doesn't incorrectly update button state
    const catchBlock = jsContent.match(/\.catch\([\s]*error[\s]*=>[\s]*\{[\s\S]*?\}\)/)?.[0] || ''
    
    // The catch block should NOT update the button to pause
    expect(catchBlock).not.toContain('playPauseBtn.innerHTML = \'⏸\'')
    expect(catchBlock).not.toContain('playPauseBtn.setAttribute(\'data-playing\', \'true\')')
  })
})