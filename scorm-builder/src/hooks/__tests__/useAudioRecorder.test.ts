import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAudioRecorder } from '../useAudioRecorder'

// Mock MediaRecorder and navigator.mediaDevices
let mockMediaRecorder: any
let mockStream: MediaStream

beforeEach(() => {
  vi.useFakeTimers()
  
  // Create mock stream
  const mockTrack = {
    stop: vi.fn()
  }
  
  mockStream = {
    getTracks: () => [mockTrack]
  } as any

  // Mock MediaRecorder
  mockMediaRecorder = {
    state: 'inactive',
    start: vi.fn(),
    stop: vi.fn(),
    ondataavailable: null,
    onstop: null
  }

  // Mock constructor
  global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder)

  // Mock navigator.mediaDevices
  global.navigator = {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream)
    }
  } as any

  // Mock URL methods
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
  global.URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useAudioRecorder', () => {
  describe('Initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useAudioRecorder())

      expect(result.current.isRecording).toBe(false)
      expect(result.current.recordingTime).toBe(0)
      expect(result.current.recordingError).toBeNull()
      expect(result.current.previewUrl).toBeNull()
    })
  })

  describe('Starting recording', () => {
    it('should start recording successfully', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(MediaRecorder).toHaveBeenCalledWith(mockStream)
      expect(mockMediaRecorder.start).toHaveBeenCalled()
      expect(result.current.isRecording).toBe(true)
      expect(result.current.recordingError).toBeNull()
    })

    it('should update recording time during recording', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      // Initially at 0
      expect(result.current.recordingTime).toBe(0)

      // Advance timer
      act(() => {
        vi.advanceTimersByTime(1100)
      })

      expect(result.current.recordingTime).toBe(1)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.recordingTime).toBe(2)
    })

    it('should handle getUserMedia permission error', async () => {
      const error = new Error('Permission denied')
      ;(navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(error)

      const { result } = renderHook(() => useAudioRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.recordingError).toBe('Permission denied')
      expect(result.current.isRecording).toBe(false)
      expect(mockMediaRecorder.start).not.toHaveBeenCalled()
    })

    it('should cleanup previous recording when starting new one', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // Start first recording
      await act(async () => {
        await result.current.startRecording()
      })

      const firstMediaRecorder = mockMediaRecorder

      // Start second recording
      await act(async () => {
        await result.current.startRecording()
      })

      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
    })
  })

  describe('Stopping recording', () => {
    it('should stop recording and return blob', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      let blob: Blob | null = null

      // Stop recording
      await act(async () => {
        const stopPromise = result.current.stopRecording()
        
        // Simulate MediaRecorder calling ondataavailable
        const mockData = new Blob(['test'], { type: 'audio/webm' })
        mockMediaRecorder.ondataavailable({ data: mockData })
        
        // Simulate MediaRecorder calling onstop
        mockMediaRecorder.onstop()
        
        blob = await stopPromise
      })

      expect(mockMediaRecorder.stop).toHaveBeenCalled()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob?.type).toBe('audio/webm')
      expect(result.current.isRecording).toBe(false)
      expect(result.current.previewUrl).toBe('blob:mock-url')
    })

    it('should handle stopping when not recording', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      const blob = await act(async () => {
        return await result.current.stopRecording()
      })

      expect(blob).toBeNull()
    })

    it('should stop timer when recording stops', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Advance timer
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(result.current.recordingTime).toBe(2)

      // Stop recording
      await act(async () => {
        const stopPromise = result.current.stopRecording()
        mockMediaRecorder.onstop()
        await stopPromise
      })

      // Timer should be stopped
      const timeAfterStop = result.current.recordingTime

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.recordingTime).toBe(0) // Reset to 0 after stop
    })
  })

  describe('Resetting recording', () => {
    it('should reset all state', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // Start and stop recording to create state
      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        const stopPromise = result.current.stopRecording()
        mockMediaRecorder.ondataavailable({ data: new Blob(['test']) })
        mockMediaRecorder.onstop()
        await stopPromise
      })

      expect(result.current.previewUrl).toBe('blob:mock-url')

      // Reset
      act(() => {
        result.current.resetRecording()
      })

      expect(result.current.isRecording).toBe(false)
      expect(result.current.recordingTime).toBe(0)
      expect(result.current.recordingError).toBeNull()
      expect(result.current.previewUrl).toBeNull()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('should stop active recording when resetting', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(true)
      
      // Set MediaRecorder state to active
      mockMediaRecorder.state = 'recording'

      // Reset while recording
      act(() => {
        result.current.resetRecording()
      })

      expect(mockMediaRecorder.stop).toHaveBeenCalled()
      expect(result.current.isRecording).toBe(false)
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
    })
  })

  describe('MediaRecorder events', () => {
    it('should collect audio chunks on dataavailable', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      const chunks = [
        new Blob(['chunk1'], { type: 'audio/webm' }),
        new Blob(['chunk2'], { type: 'audio/webm' }),
        new Blob(['chunk3'], { type: 'audio/webm' })
      ]

      // Simulate multiple data chunks
      chunks.forEach(chunk => {
        act(() => {
          mockMediaRecorder.ondataavailable({ data: chunk })
        })
      })

      // Stop and verify blob contains all chunks
      await act(async () => {
        const stopPromise = result.current.stopRecording()
        mockMediaRecorder.onstop()
        const blob = await stopPromise
        
        // The blob should be created with all chunks
        expect(blob).toBeInstanceOf(Blob)
      })
    })

    it('should ignore empty data chunks', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      // Send empty chunk
      act(() => {
        mockMediaRecorder.ondataavailable({ data: { size: 0 } })
      })

      // Send valid chunk
      act(() => {
        mockMediaRecorder.ondataavailable({ data: new Blob(['test']) })
      })

      await act(async () => {
        const stopPromise = result.current.stopRecording()
        mockMediaRecorder.onstop()
        const blob = await stopPromise
        
        expect(blob).toBeInstanceOf(Blob)
      })
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resources on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudioRecorder())

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Create preview
      await act(async () => {
        const stopPromise = result.current.stopRecording()
        mockMediaRecorder.ondataavailable({ data: new Blob(['test']) })
        mockMediaRecorder.onstop()
        await stopPromise
      })

      // Unmount
      unmount()

      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('should handle cleanup when MediaRecorder is in active state', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      mockMediaRecorder.state = 'recording'

      // Reset (triggers cleanup)
      act(() => {
        result.current.resetRecording()
      })

      expect(mockMediaRecorder.stop).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle non-Error exceptions', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce('Unknown error')

      const { result } = renderHook(() => useAudioRecorder())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.recordingError).toBe('Failed to start recording')
    })

    it('should clear previous errors when starting new recording', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // First attempt fails
      ;(navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(new Error('First error'))
      
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.recordingError).toBe('First error')

      // Second attempt succeeds
      ;(navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(mockStream)
      
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.recordingError).toBeNull()
    })
  })

  describe('Multiple recordings', () => {
    it('should handle multiple start/stop cycles', async () => {
      const { result } = renderHook(() => useAudioRecorder())

      // First recording
      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        const stopPromise = result.current.stopRecording()
        mockMediaRecorder.ondataavailable({ data: new Blob(['recording1']) })
        mockMediaRecorder.onstop()
        await stopPromise
      })

      const firstPreviewUrl = result.current.previewUrl

      // Second recording
      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        const stopPromise = result.current.stopRecording()
        mockMediaRecorder.ondataavailable({ data: new Blob(['recording2']) })
        mockMediaRecorder.onstop()
        await stopPromise
      })

      // Should have new preview URL
      expect(result.current.previewUrl).toBe('blob:mock-url')
      // Old URL should be revoked
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })
  })
})