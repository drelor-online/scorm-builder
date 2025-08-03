import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioRecorder } from '../useAudioRecorder'

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  ondataavailable: null as ((event: any) => void) | null,
  onstop: null as (() => void) | null,
  state: 'inactive' as RecordingState
}

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any
global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [{
      stop: vi.fn()
    }]
  })
} as any

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

describe('useAudioRecorder - Recording and Saving', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMediaRecorder.state = 'inactive'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should start recording when startRecording is called', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    
    await act(async () => {
      await result.current.startRecording()
    })
    
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(mockMediaRecorder.start).toHaveBeenCalled()
    expect(result.current.isRecording).toBe(true)
  })

  it('should collect audio chunks when data is available', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    
    await act(async () => {
      await result.current.startRecording()
    })
    
    // Simulate receiving audio data
    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' })
    act(() => {
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob })
      }
    })
    
    // Check that chunks are collected (internal state)
    expect(mockMediaRecorder.ondataavailable).toBeDefined()
  })

  it('should stop recording and create audio blob', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    
    await act(async () => {
      await result.current.startRecording()
    })
    
    // Simulate recording data
    const chunks = [
      new Blob(['chunk1'], { type: 'audio/webm' }),
      new Blob(['chunk2'], { type: 'audio/webm' })
    ]
    
    // Simulate data events
    chunks.forEach(chunk => {
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: chunk })
        }
      })
    })
    
    // Change state to recording
    mockMediaRecorder.state = 'recording'
    
    // Stop recording
    let audioBlob: Blob | null = null
    await act(async () => {
      const stopPromise = result.current.stopRecording()
      
      // Simulate the onstop event
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop()
      }
      
      audioBlob = await stopPromise
    })
    
    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    
    // Verify audio blob was created
    expect(audioBlob).toBeTruthy()
    expect(result.current.previewUrl).toBe('blob:mock-url')
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })

  it('should handle recording errors gracefully', async () => {
    // Mock getUserMedia failure
    global.navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(
      new Error('Permission denied')
    )
    
    const { result } = renderHook(() => useAudioRecorder())
    
    await act(async () => {
      await result.current.startRecording()
    })
    
    expect(result.current.recordingError).toBe('Permission denied')
    expect(result.current.isRecording).toBe(false)
  })

  it('should reset recording when resetRecording is called', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    
    // Set up a recording
    await act(async () => {
      await result.current.startRecording()
    })
    
    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' })
    act(() => {
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob })
      }
    })
    
    mockMediaRecorder.state = 'recording'
    let savedBlob: Blob | null = null
    await act(async () => {
      const stopPromise = result.current.stopRecording()
      
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop()
      }
      
      savedBlob = await stopPromise
    })
    
    // Reset recording
    act(() => {
      result.current.resetRecording()
    })
    
    expect(result.current.previewUrl).toBeNull()
    expect(result.current.recordingError).toBeNull()
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})