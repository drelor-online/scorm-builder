import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoSaveNarration } from '../useAutoSaveNarration'
import React from 'react'

// Create mocks
const mockSaveContent = vi.fn()
const mockGetContent = vi.fn()
const mockStoreMedia = vi.fn()
const mockGetMedia = vi.fn()

// Mock the storage context
vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    error: null,
    saveContent: mockSaveContent,
    getContent: mockGetContent,
    storeMedia: mockStoreMedia,
    getMedia: mockGetMedia
  })
}))

describe('useAutoSaveNarration Hook - Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveContent.mockResolvedValue(undefined)
    mockGetContent.mockResolvedValue(null)
    mockStoreMedia.mockResolvedValue(undefined)
    mockGetMedia.mockResolvedValue(null)
  })
  
  it('should save narration text when content changes', async () => {
    // Intent: When user types narration, it should auto-save
    const topicId = 'topic-1'
    const { result } = renderHook(() => useAutoSaveNarration(topicId))
    
    expect(result.current.isReady).toBe(true)
    
    const narration = 'This is the narration text'
    await act(async () => {
      await result.current.saveNarration(narration)
    })
    
    // Storage should have been called
    expect(mockSaveContent).toHaveBeenCalledWith(
      `${topicId}-narration`,
      expect.objectContaining({
        topicId,
        narration,
        timestamp: expect.any(Number)
      })
    )
  })
  
  it('should not save if content has not changed', async () => {
    // Intent: Avoid unnecessary saves when content is the same
    const topicId = 'topic-1'
    const { result } = renderHook(() => useAutoSaveNarration(topicId))
    
    const narration = 'Same text'
    
    await act(async () => {
      await result.current.saveNarration(narration)
      await result.current.saveNarration(narration) // Same text
    })
    
    // Should only be called once
    expect(mockSaveContent).toHaveBeenCalledTimes(1)
  })
  
  it('should save audio file with metadata', async () => {
    // Intent: Audio files should be saved with proper metadata
    const topicId = 'topic-1'
    const { result } = renderHook(() => useAutoSaveNarration(topicId))
    
    const file = new File(['audio data'], 'narration.mp3', { type: 'audio/mp3' })
    
    await act(async () => {
      await result.current.saveAudioFile(file)
    })
    
    expect(mockStoreMedia).toHaveBeenCalledWith(
      `${topicId}-audio`,
      file,
      'audio',
      expect.objectContaining({
        fileName: 'narration.mp3',
        size: file.size,
        duration: 0,
        timestamp: expect.any(Number)
      })
    )
  })
  
  it('should load saved narration', async () => {
    // Intent: Previously saved narration should be loaded
    const topicId = 'topic-1'
    const savedNarration = 'Previously saved text'
    
    mockGetContent.mockResolvedValue({
      topicId,
      narration: savedNarration,
      timestamp: Date.now()
    })
    
    const { result } = renderHook(() => useAutoSaveNarration(topicId))
    
    let loaded
    await act(async () => {
      loaded = await result.current.loadNarration()
    })
    
    expect(loaded).toBe(savedNarration)
  })
  
  it('should load saved audio file', async () => {
    // Intent: Previously saved audio should be loaded as File
    const topicId = 'topic-1'
    const audioBlob = new Blob(['audio'], { type: 'audio/mp3' })
    
    mockGetMedia.mockResolvedValue({
      id: `${topicId}-audio`,
      blob: audioBlob,
      type: 'audio/mp3',
      mediaType: 'audio',
      metadata: { fileName: 'saved.mp3' },
      timestamp: Date.now()
    })
    
    const { result } = renderHook(() => useAutoSaveNarration(topicId))
    
    let loaded
    await act(async () => {
      loaded = await result.current.loadAudioFile()
    })
    
    expect(loaded).toBeInstanceOf(File)
    expect(loaded?.name).toBe('saved.mp3')
  })
})