import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ManualTestRecorder } from '../ManualTestRecorder'

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve({
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockImageData')
  }))
}))

describe('ManualTestRecorder - JSON Export', () => {
  let recorder: ManualTestRecorder
  
  beforeEach(() => {
    // Setup DOM environment
    document.body.innerHTML = `
      <div id="test-content">
        <button id="test-button">Click Me</button>
        <input id="test-input" type="text" placeholder="Enter text" />
      </div>
    `
    
    recorder = new ManualTestRecorder({
      autoScreenshot: false,
      capturePerformance: false
    })
  })
  
  afterEach(() => {
    // Clean up
    if (recorder['isRecording']) {
      recorder.stop()
    }
    document.body.innerHTML = ''
  })
  
  it('should generate JSON report with correct structure', async () => {
    await recorder.start()
    
    // Simulate some actions
    const button = document.getElementById('test-button')
    const input = document.getElementById('test-input') as HTMLInputElement
    
    // Click button
    button?.click()
    
    // Type in input
    input.value = 'test value'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    
    // Add a note
    recorder.addNoteWithData('This is a test note', 'warning', ['ui-issue'])
    
    // Stop recording
    recorder.stop()
    
    // Get JSON report
    const jsonReport = recorder.generateJSONReport()
    
    // Verify structure
    expect(jsonReport).toHaveProperty('metadata')
    expect(jsonReport).toHaveProperty('actions')
    expect(jsonReport).toHaveProperty('screenshots')
    expect(jsonReport).toHaveProperty('notes')
    expect(jsonReport).toHaveProperty('errors')
    expect(jsonReport).toHaveProperty('performance')
    expect(jsonReport).toHaveProperty('summary')
    
    // Verify metadata
    expect(jsonReport.metadata).toMatchObject({
      sessionId: expect.stringMatching(/^session-\d+$/),
      startTime: expect.any(Number),
      endTime: expect.any(Number),
      duration: expect.any(Number),
      url: expect.any(String)
    })
    
    // Verify actions were captured
    expect(jsonReport.actions.length).toBeGreaterThan(0)
    expect(jsonReport.actions.some(a => a.type === 'click')).toBe(true)
    expect(jsonReport.actions.some(a => a.type === 'input')).toBe(true)
    
    // Verify note was captured
    expect(jsonReport.notes).toHaveLength(1)
    expect(jsonReport.notes[0]).toMatchObject({
      content: 'This is a test note',
      severity: 'warning',
      tags: ['ui-issue'],
      timestamp: expect.any(Number)
    })
    
    // Verify summary
    expect(jsonReport.summary).toMatchObject({
      totalActions: expect.any(Number),
      actionsByType: expect.any(Object),
      errorCount: 0,
      noteCount: 1,
      screenshotCount: expect.any(Number)
    })
  })
  
  it('should not include base64 image data in JSON', async () => {
    await recorder.start()
    
    // Take a screenshot
    await recorder.captureScreenshot('manual', 'Test screenshot')
    
    recorder.stop()
    
    const jsonReport = recorder.generateJSONReport()
    
    // Verify screenshots don't contain base64 data (start() adds one auto screenshot)
    expect(jsonReport.screenshots.length).toBeGreaterThanOrEqual(1)
    
    // Find the manual screenshot
    const manualScreenshot = jsonReport.screenshots.find(s => s.description === 'Test screenshot')
    expect(manualScreenshot).toBeDefined()
    
    expect(manualScreenshot).toMatchObject({
      id: expect.stringMatching(/^screenshot-\d+$/),
      timestamp: expect.any(Number),
      trigger: 'manual',
      description: 'Test screenshot',
      filename: expect.stringMatching(/^screenshot-\d+\.jpg$/)
    })
    
    // Should NOT have dataUrl property
    expect(manualScreenshot).not.toHaveProperty('dataUrl')
  })
  
  it('should capture errors in JSON report', async () => {
    await recorder.start()
    
    // Simulate an error
    const errorEvent = new ErrorEvent('error', {
      message: 'Test error message',
      filename: 'test.js',
      lineno: 42,
      colno: 10
    })
    
    window.dispatchEvent(errorEvent)
    
    recorder.stop()
    
    const jsonReport = recorder.generateJSONReport()
    
    // Verify error was captured
    expect(jsonReport.errors).toHaveLength(1)
    expect(jsonReport.errors[0]).toMatchObject({
      timestamp: expect.any(Number),
      message: 'Test error message',
      filename: 'test.js',
      lineno: 42,
      colno: 10
    })
    
    expect(jsonReport.summary.errorCount).toBe(1)
  })
  
  it('should generate lightweight JSON suitable for AI analysis', async () => {
    await recorder.start()
    
    // Perform various actions
    for (let i = 0; i < 10; i++) {
      document.getElementById('test-button')?.click()
    }
    
    recorder.addNoteWithData('UI looks broken', 'error', ['bug', 'visual'])
    recorder.addNoteWithData('Performance is slow', 'warning', ['performance'])
    
    recorder.stop()
    
    const jsonReport = recorder.generateJSONReport()
    const jsonString = JSON.stringify(jsonReport)
    
    // Verify JSON is reasonably sized (not including screenshots)
    expect(jsonString.length).toBeLessThan(50000) // 50KB max for JSON
    
    // Verify it contains the important data for AI analysis
    expect(jsonReport.notes).toHaveLength(2)
    expect(jsonReport.notes[0].severity).toBe('error')
    expect(jsonReport.notes[0].tags).toContain('bug')
    
    // Verify action patterns can be analyzed
    expect(jsonReport.summary.actionsByType['click']).toBeGreaterThanOrEqual(10)
  })
  
  it('should include page navigation history', async () => {
    await recorder.start()
    
    // Simulate navigation
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost/page1',
        pathname: '/page1'
      },
      writable: true
    })
    
    const popstateEvent = new PopStateEvent('popstate')
    window.dispatchEvent(popstateEvent)
    
    recorder.stop()
    
    const jsonReport = recorder.generateJSONReport()
    
    // Verify navigation was captured
    const navigationActions = jsonReport.actions.filter(a => a.type === 'navigation')
    expect(navigationActions.length).toBeGreaterThan(0)
  })
})