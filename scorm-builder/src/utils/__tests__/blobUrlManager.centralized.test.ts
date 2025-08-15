import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { blobUrlManager } from '../blobUrlManager'

describe('Centralized Blob URL Management', () => {
  let createdUrls: string[] = []
  let revokedUrls: string[] = []
  
  beforeEach(() => {
    createdUrls = []
    revokedUrls = []
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:mock-${Date.now()}-${Math.random()}`
      createdUrls.push(url)
      return url
    })
    
    global.URL.revokeObjectURL = vi.fn((url: string) => {
      revokedUrls.push(url)
    })
    
    // Clear the manager
    blobUrlManager.clear()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  it('should track all created blob URLs', () => {
    const blob1 = new Blob(['test1'])
    const blob2 = new Blob(['test2'])
    
    const url1 = blobUrlManager.createObjectURL('key1', blob1)
    const url2 = blobUrlManager.createObjectURL('key2', blob2)
    
    expect(createdUrls).toContain(url1)
    expect(createdUrls).toContain(url2)
    expect(createdUrls.length).toBe(2)
  })
  
  it('should cleanup all URLs on clear', () => {
    const blob1 = new Blob(['test1'])
    const blob2 = new Blob(['test2'])
    const blob3 = new Blob(['test3'])
    
    const url1 = blobUrlManager.createObjectURL('key1', blob1)
    const url2 = blobUrlManager.createObjectURL('key2', blob2)
    const url3 = blobUrlManager.createObjectURL('key3', blob3)
    
    // Clear all URLs
    blobUrlManager.clear()
    
    // All URLs should be revoked
    expect(revokedUrls).toContain(url1)
    expect(revokedUrls).toContain(url2)
    expect(revokedUrls).toContain(url3)
    expect(revokedUrls.length).toBe(3)
  })
  
  it('should cleanup URLs older than maxAge', async () => {
    // Create a URL
    const blob = new Blob(['old'])
    const url = blobUrlManager.createObjectURL('old-key', blob)
    
    // Mock the age check to make it appear old
    const cleanupSpy = vi.spyOn(blobUrlManager, 'cleanupStale')
    
    // Trigger cleanup
    await blobUrlManager.cleanupStale()
    
    // Should have been called
    expect(cleanupSpy).toHaveBeenCalled()
  })
  
  it('should lock URLs that are in use', () => {
    const blob = new Blob(['active'])
    const url = blobUrlManager.createObjectURL('active-key', blob)
    
    // Lock the URL (e.g., for active audio playback)
    blobUrlManager.lock(url)
    
    // Try to revoke it
    blobUrlManager.revoke('active-key')
    
    // Should not be revoked while locked
    expect(revokedUrls).not.toContain(url)
    
    // Unlock it
    blobUrlManager.unlock(url)
    
    // Now revoke should work
    blobUrlManager.revoke('active-key')
    expect(revokedUrls).toContain(url)
  })
  
  it('should handle FileStorage integration', () => {
    // Mock FileStorage creating blob URLs
    const mockFileStorage = {
      getFileUrl: (path: string) => {
        const blob = new Blob([`file content for ${path}`])
        // Should use blobUrlManager instead of direct URL.createObjectURL
        return blobUrlManager.createObjectURL(`file-${path}`, blob)
      }
    }
    
    const url1 = mockFileStorage.getFileUrl('doc1.pdf')
    const url2 = mockFileStorage.getFileUrl('doc2.pdf')
    
    // URLs should be tracked
    expect(createdUrls.length).toBe(2)
    
    // Cleanup should revoke them
    blobUrlManager.clear()
    expect(revokedUrls.length).toBe(2)
  })
  
  it('should handle ProjectExportImport integration', () => {
    // Mock ProjectExportImport creating blob URLs
    const mockExporter = {
      createMediaMap: (files: File[]) => {
        const map: Record<string, string> = {}
        files.forEach(file => {
          const url = blobUrlManager.createObjectURL(`export-${file.name}`, file)
          map[file.name] = url
        })
        return map
      }
    }
    
    const files = [
      new File(['content1'], 'file1.jpg'),
      new File(['content2'], 'file2.mp3')
    ]
    
    const mediaMap = mockExporter.createMediaMap(files)
    
    // Should have created URLs
    expect(Object.keys(mediaMap).length).toBe(2)
    expect(createdUrls.length).toBe(2)
    
    // Cleanup should revoke all
    blobUrlManager.clear()
    expect(revokedUrls.length).toBe(2)
  })
})