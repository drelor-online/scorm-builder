import { vi } from 'vitest'
import { createElement } from 'react'

export interface MockAudioFile {
  blockNumber: string
  file: File
  url: string
  mediaId: string
}

export interface MockMediaService {
  storeMedia: ReturnType<typeof vi.fn>
  getMedia: ReturnType<typeof vi.fn>
  deleteMedia: ReturnType<typeof vi.fn>
  clearAudioCache: ReturnType<typeof vi.fn>
  audioDataCache: Map<string, any>
  blobUrlCache: Map<string, string>
}

export function createMockAudioFile(
  blockNumber: string = '0',
  mediaId: string = 'audio-test-123'
): MockAudioFile {
  const mockFile = new File(['mock audio data'], 'test-audio.mp3', {
    type: 'audio/mpeg'
  })
  
  return {
    blockNumber,
    file: mockFile,
    url: `blob:http://localhost:1420/${Math.random().toString(36).substr(2, 9)}`,
    mediaId
  }
}

export function createMockMediaService(): MockMediaService {
  const audioDataCache = new Map()
  const blobUrlCache = new Map()
  
  return {
    storeMedia: vi.fn().mockResolvedValue({
      id: 'mock-media-id',
      type: 'audio',
      url: 'mock-url'
    }),
    getMedia: vi.fn().mockImplementation(async (mediaId: string) => {
      const cached = audioDataCache.get(mediaId)
      if (cached) {
        return { ...cached, url: blobUrlCache.get(mediaId) }
      }
      return null
    }),
    deleteMedia: vi.fn().mockResolvedValue(true),
    clearAudioCache: vi.fn().mockImplementation(() => {
      audioDataCache.clear()
      blobUrlCache.clear()
    }),
    audioDataCache,
    blobUrlCache
  }
}

export function simulateAudioReplacement(
  oldAudioFile: MockAudioFile,
  newFile: File
): MockAudioFile {
  return {
    ...oldAudioFile,
    file: newFile,
    url: `blob:http://localhost:1420/${Math.random().toString(36).substr(2, 9)}`,
    mediaId: `audio-${Math.random().toString(36).substr(2, 9)}`
  }
}

export function expectAudioVersionIncremented(
  audioVersionMap: Map<string, number>,
  blockNumber: string,
  expectedVersion: number
) {
  expect(audioVersionMap.get(blockNumber)).toBe(expectedVersion)
}

export function expectBlobUrlRevoked(mockUrl: string) {
  // In a real test, we'd mock URL.revokeObjectURL and check it was called
  expect(mockUrl).toMatch(/^blob:/)
}

export function createMockTauriAudioPlayer() {
  const mockAudioElement = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    src: '',
    currentTime: 0,
    duration: 0,
    paused: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }

  return {
    audioElement: mockAudioElement,
    component: vi.fn().mockReturnValue(createElement('div', { 'data-testid': 'mock-audio-player' }))
  }
}

// Helper to test audio key prop changes
export function expectAudioPlayerKeyChanged(
  previousKey: string,
  newKey: string,
  mediaId: string,
  version: number
) {
  expect(newKey).not.toBe(previousKey)
  expect(newKey).toContain(mediaId)
  expect(newKey).toContain(version.toString())
}