import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,fake')
  })
}))

// Mock ManualTestRecorder to avoid DOM issues in test
class MockManualTestRecorder {
  isRecording = false
  consoleLogs: any[] = []
  actions: any[] = []
  
  start() {
    this.isRecording = true
    // Intercept console.log
    const originalLog = console.log
    console.log = (...args: any[]) => {
      this.captureConsoleLog('log', args)
      originalLog(...args)
    }
  }
  
  stop() {
    this.isRecording = false
  }
  
  captureConsoleLog(level: string, args: any[]) {
    // This is where the circular reference issue happens
    this.consoleLogs.push({
      timestamp: Date.now(),
      level,
      message: args.map(arg => String(arg)).join(' '),
      args: args // This causes circular reference if args contains DOM elements
    })
  }
  
  generateJSONReport() {
    return {
      consoleLogs: this.consoleLogs,
      actions: this.actions
    }
  }
}

describe('ManualTestRecorder Circular Reference Handling', () => {
  let recorder: any
  let mockElement: any

  beforeEach(() => {
    // Create a mock DOM element with circular reference
    mockElement = {
      id: 'test-element',
      textContent: 'Test Element',
      __reactFiber: null
    }
    // Add circular reference
    mockElement.__reactFiber = {
      stateNode: mockElement,
      type: 'div'
    }
  })

  afterEach(() => {
    // Clean up
  })

  it('should handle circular references in console.log arguments', () => {
    // Create recorder instance using the mock
    recorder = new MockManualTestRecorder()
    
    // Start recording
    recorder.start()
    
    // Log an object with circular reference
    console.log('Testing circular reference:', mockElement)
    
    // Stop recording
    recorder.stop()
    
    // Get the JSON report - this WILL throw with current implementation
    expect(() => {
      const report = recorder.generateJSONReport()
      // This will fail due to circular reference in args
      const jsonString = JSON.stringify(report)
    }).toThrow('Converting circular structure to JSON')
  })

  it('should be fixed to sanitize console log args', () => {
    // This test demonstrates the FIX we need to implement
    class FixedMockRecorder extends MockManualTestRecorder {
      captureConsoleLog(level: string, args: any[]) {
        // FIX: Sanitize args to remove circular references
        const sanitizedArgs = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              // Try to stringify to check for circular references
              JSON.stringify(arg)
              return arg // It's safe
            } catch {
              // Has circular reference, return a safe representation
              if (arg.id) return { id: arg.id, type: 'DOMElement' }
              if (arg.constructor) return { type: arg.constructor.name }
              return { type: 'CircularObject' }
            }
          }
          return arg
        })
        
        this.consoleLogs.push({
          timestamp: Date.now(),
          level,
          message: args.map(arg => String(arg)).join(' '),
          args: sanitizedArgs // Use sanitized args
        })
      }
    }
    
    recorder = new FixedMockRecorder()
    recorder.start()
    
    // Log object with circular reference
    console.log('Testing circular reference:', mockElement)
    
    recorder.stop()
    
    // Should NOT throw after fix
    expect(() => {
      const report = recorder.generateJSONReport()
      const jsonString = JSON.stringify(report)
      expect(jsonString).toBeDefined()
    }).not.toThrow()
    
    // Check that args were sanitized
    const log = recorder.consoleLogs[0]
    expect(log.args[1]).toEqual({ id: 'test-element', type: 'DOMElement' })
  })
})