import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { UnifiedMediaProvider, useUnifiedMedia } from '../UnifiedMediaContext'
import { createMediaService } from '../../services/MediaService'
import React from 'react'

// Mock dependencies
vi.mock('../../services/MediaService', () => ({
  MediaService: {
    getInstance: vi.fn(),
    clearInstance: vi.fn()
  },
  createMediaService: vi.fn()
}))

vi.mock('../PersistentStorageContext', () => ({
  useStorage: () => ({
    currentProjectId: 'test-project',
    fileStorage: {}
  })
}))

describe('UnifiedMediaContext - Project ID Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock createMediaService to track what projectId it receives
    vi.mocked(createMediaService).mockReturnValue({
      storeMedia: vi.fn(),
      getMedia: vi.fn(),
      deleteMedia: vi.fn(),
      storeYouTubeVideo: vi.fn(),
      listMediaForPage: vi.fn().mockReturnValue([]),
      listAllMedia: vi.fn().mockReturnValue([]),
      createBlobUrl: vi.fn()
    } as any)
  })

  it('should extract project ID from full Windows path with project name', () => {
    const fullPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural_Gas_Safety_1754444630422.scormproj'
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId={fullPath}>
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    // Verify createMediaService was called with extracted ID
    expect(createMediaService).toHaveBeenCalledWith(
      '1754444630422',
      expect.anything()
    )
  })

  it('should extract project ID from Unix-style path', () => {
    const fullPath = '/home/user/projects/TestProject_1234567890.scormproj'
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId={fullPath}>
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    expect(createMediaService).toHaveBeenCalledWith(
      '1234567890',
      expect.anything()
    )
  })

  it('should handle project ID without underscore in filename', () => {
    const fullPath = 'C:\\Users\\sierr\\Documents\\1754444630422.scormproj'
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId={fullPath}>
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    expect(createMediaService).toHaveBeenCalledWith(
      '1754444630422',
      expect.anything()
    )
  })

  it('should pass through plain project ID unchanged', () => {
    const projectId = '1754444630422'
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId={projectId}>
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    expect(createMediaService).toHaveBeenCalledWith(
      '1754444630422',
      expect.anything()
    )
  })

  it('should handle empty project ID', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId="">
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    expect(createMediaService).toHaveBeenCalledWith(
      '',
      expect.anything()
    )
  })

  it('should handle non-standard project ID format', () => {
    const projectId = 'custom-project-id'
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId={projectId}>
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    // Should pass through unchanged if it doesn't match known patterns
    expect(createMediaService).toHaveBeenCalledWith(
      'custom-project-id',
      expect.anything()
    )
  })

  it('should extract ID from path with multiple underscores', () => {
    const fullPath = 'C:\\Projects\\Test_Project_Name_9876543210.scormproj'
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId={fullPath}>
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    // Should extract the last number after underscore before .scormproj
    expect(createMediaService).toHaveBeenCalledWith(
      '9876543210',
      expect.anything()
    )
  })

  it('should handle project path with spaces', () => {
    const fullPath = 'C:\\Users\\sierr\\My Documents\\SCORM Projects\\Course Name_1234567890.scormproj'
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UnifiedMediaProvider projectId={fullPath}>
        {children}
      </UnifiedMediaProvider>
    )
    
    renderHook(() => useUnifiedMedia(), { wrapper })
    
    expect(createMediaService).toHaveBeenCalledWith(
      '1234567890',
      expect.anything()
    )
  })
})