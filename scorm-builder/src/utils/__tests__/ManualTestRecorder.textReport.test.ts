import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ManualTestRecorder } from '../ManualTestRecorder'

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve({
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockImageData')
  }))
}))

describe('ManualTestRecorder - Text Report', () => {
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
  
  it('should generate a readable text report', async () => {
    await recorder.start()
    
    // Simulate some actions
    const button = document.getElementById('test-button')
    button?.click()
    
    // Add notes with different severities
    recorder.addNoteWithData('UI button is misaligned', 'error', ['ui', 'bug'])
    recorder.addNoteWithData('Consider adding tooltips', 'info', ['enhancement'])
    recorder.addNoteWithData('Performance could be improved', 'warning', ['performance'])
    
    // Simulate an error
    const errorEvent = new ErrorEvent('error', {
      message: 'Cannot read property of undefined',
      filename: 'app.js',
      lineno: 123
    })
    window.dispatchEvent(errorEvent)
    
    recorder.stop()
    
    // Generate text report
    const textReport = recorder.generateTextReport()
    
    // Verify report structure
    expect(textReport).toContain('TEST SESSION REPORT')
    expect(textReport).toContain('Session ID:')
    expect(textReport).toContain('Duration:')
    
    // Verify notes section
    expect(textReport).toContain('USER NOTES:')
    expect(textReport).toContain('[error] UI button is misaligned')
    expect(textReport).toContain('[warning] Performance could be improved')
    expect(textReport).toContain('[info] Consider adding tooltips')
    
    // Verify errors section
    expect(textReport).toContain('ERRORS:')
    expect(textReport).toContain('Cannot read property of undefined')
    expect(textReport).toContain('app.js:123')
    
    // Verify actions summary
    expect(textReport).toContain('ACTIONS SUMMARY:')
    expect(textReport).toContain('Total Actions:')
    expect(textReport).toContain('click:')
  })
  
  it('should generate a markdown report', async () => {
    await recorder.start()
    
    // Perform actions
    document.getElementById('test-button')?.click()
    recorder.addNoteWithData('Critical issue found', 'critical', ['blocker'])
    
    recorder.stop()
    
    const markdownReport = recorder.generateMarkdownReport()
    
    // Verify markdown formatting
    expect(markdownReport).toContain('# Test Session Report')
    expect(markdownReport).toContain('## Session Information')
    expect(markdownReport).toContain('## User Notes')
    expect(markdownReport).toContain('### Critical Issues')
    expect(markdownReport).toContain('- **Critical issue found**')
    expect(markdownReport).toContain('## Actions Summary')
    expect(markdownReport).toContain('| Action Type | Count |')
    expect(markdownReport).toContain('|------------|-------|')
  })
  
  it('should format notes by severity in text report', async () => {
    await recorder.start()
    
    // Add notes of different severities
    recorder.addNoteWithData('Critical bug', 'critical', ['bug'])
    recorder.addNoteWithData('Major issue', 'error', ['bug'])
    recorder.addNoteWithData('Minor problem', 'warning', ['ui'])
    recorder.addNoteWithData('Suggestion', 'info', ['enhancement'])
    
    recorder.stop()
    
    const textReport = recorder.generateTextReport()
    
    // Verify notes are grouped by severity
    const criticalIndex = textReport.indexOf('[critical]')
    const errorIndex = textReport.indexOf('[error]')
    const warningIndex = textReport.indexOf('[warning]')
    const infoIndex = textReport.indexOf('[info]')
    
    // Critical should come before error
    expect(criticalIndex).toBeLessThan(errorIndex)
    // Error should come before warning
    expect(errorIndex).toBeLessThan(warningIndex)
    // Warning should come before info
    expect(warningIndex).toBeLessThan(infoIndex)
  })
  
  it('should include timestamps in text report', async () => {
    await recorder.start()
    
    const startTime = Date.now()
    
    recorder.addNoteWithData('Test note', 'info')
    
    recorder.stop()
    
    const textReport = recorder.generateTextReport()
    
    // Verify timestamp format (HH:MM:SS)
    expect(textReport).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)
    
    // Verify date is included
    const today = new Date().toLocaleDateString()
    expect(textReport).toContain(today)
  })
})