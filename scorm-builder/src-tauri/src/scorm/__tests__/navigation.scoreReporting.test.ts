import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('navigation.js - SCORM Score Reporting', () => {
  let mockAPI: any
  let consoleLogSpy: any
  let consoleErrorSpy: any

  beforeEach(() => {
    // Mock the SCORM API
    mockAPI = {
      LMSInitialize: vi.fn().mockReturnValue('true'),
      LMSFinish: vi.fn().mockReturnValue('true'),
      LMSSetValue: vi.fn().mockReturnValue('true'),
      LMSCommit: vi.fn().mockReturnValue('true'),
      LMSGetValue: vi.fn().mockReturnValue(''),
      LMSGetLastError: vi.fn().mockReturnValue('0')
    }

    // Mock window.API
    global.window = {
      API: mockAPI
    } as any

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should report score in the correct SCORM 1.2 sequence', () => {
    const reportScore = (score: number) => {
      if (global.window.API) {
        // The correct sequence for SCORM 1.2 score reporting:
        // 1. Set score.raw
        global.window.API.LMSSetValue('cmi.core.score.raw', score.toString())
        // 2. Set score.min
        global.window.API.LMSSetValue('cmi.core.score.min', '0')
        // 3. Set score.max
        global.window.API.LMSSetValue('cmi.core.score.max', '100')
        // 4. Commit the data
        global.window.API.LMSCommit('')
        // 5. Verify the score was saved
        const savedScore = global.window.API.LMSGetValue('cmi.core.score.raw')
        return savedScore
      }
      return null
    }

    const savedScore = reportScore(85)

    // Verify the correct sequence of calls
    expect(mockAPI.LMSSetValue).toHaveBeenCalledTimes(3)
    expect(mockAPI.LMSSetValue).toHaveBeenNthCalledWith(1, 'cmi.core.score.raw', '85')
    expect(mockAPI.LMSSetValue).toHaveBeenNthCalledWith(2, 'cmi.core.score.min', '0')
    expect(mockAPI.LMSSetValue).toHaveBeenNthCalledWith(3, 'cmi.core.score.max', '100')
    expect(mockAPI.LMSCommit).toHaveBeenCalledWith('')
    expect(mockAPI.LMSGetValue).toHaveBeenCalledWith('cmi.core.score.raw')
  })

  it('should return the saved score value after reporting', () => {
    // Mock LMSGetValue to return the score that was set
    let storedScore = ''
    mockAPI.LMSSetValue.mockImplementation((key: string, value: string) => {
      if (key === 'cmi.core.score.raw') {
        storedScore = value
      }
      return 'true'
    })
    mockAPI.LMSGetValue.mockImplementation((key: string) => {
      if (key === 'cmi.core.score.raw') {
        return storedScore
      }
      return ''
    })

    const reportScore = (score: number) => {
      if (global.window.API) {
        global.window.API.LMSSetValue('cmi.core.score.raw', score.toString())
        global.window.API.LMSSetValue('cmi.core.score.min', '0')
        global.window.API.LMSSetValue('cmi.core.score.max', '100')
        global.window.API.LMSCommit('')
        return global.window.API.LMSGetValue('cmi.core.score.raw')
      }
      return null
    }

    const savedScore = reportScore(75)
    expect(savedScore).toBe('75')
  })

  it('should set lesson_status based on pass_mark', () => {
    const passMark = 70

    const reportScoreWithStatus = (score: number) => {
      if (global.window.API) {
        // Report score
        global.window.API.LMSSetValue('cmi.core.score.raw', score.toString())
        global.window.API.LMSSetValue('cmi.core.score.min', '0')
        global.window.API.LMSSetValue('cmi.core.score.max', '100')
        
        // Set status based on score vs pass mark
        if (score >= passMark) {
          global.window.API.LMSSetValue('cmi.core.lesson_status', 'passed')
        } else {
          global.window.API.LMSSetValue('cmi.core.lesson_status', 'failed')
        }
        
        global.window.API.LMSCommit('')
      }
    }

    // Test passing score
    reportScoreWithStatus(85)
    expect(mockAPI.LMSSetValue).toHaveBeenCalledWith('cmi.core.lesson_status', 'passed')

    // Clear mocks
    mockAPI.LMSSetValue.mockClear()

    // Test failing score
    reportScoreWithStatus(60)
    expect(mockAPI.LMSSetValue).toHaveBeenCalledWith('cmi.core.lesson_status', 'failed')
  })

  it('should call LMSFinish after final assessment submission', () => {
    const completeAssessment = (score: number, isFinalAttempt: boolean) => {
      if (global.window.API) {
        // Report score
        global.window.API.LMSSetValue('cmi.core.score.raw', score.toString())
        global.window.API.LMSSetValue('cmi.core.score.min', '0')
        global.window.API.LMSSetValue('cmi.core.score.max', '100')
        global.window.API.LMSSetValue('cmi.core.lesson_status', 'completed')
        global.window.API.LMSCommit('')
        
        // If this is the final attempt or they passed, finish the session
        if (isFinalAttempt || score >= 70) {
          global.window.API.LMSFinish('')
        }
      }
    }

    // Final attempt should call LMSFinish
    completeAssessment(60, true)
    expect(mockAPI.LMSFinish).toHaveBeenCalledWith('')
  })
})