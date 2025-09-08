import { describe, test, expect, vi, beforeEach } from 'vitest'
import { EmergencyDataRecovery } from './emergencyDataRecovery'
import { MediaService } from '../services/MediaService'
import { FileStorage } from '../services/FileStorage'

/**
 * BEHAVIOR TEST: Emergency Data Recovery Utility
 * 
 * This test verifies the emergency data recovery utility can
 * detect contamination, recover valuable data, and perform cleanup.
 */

// Mock implementations
const mockFileStorage: Partial<FileStorage> = {
  storeMedia: vi.fn(),
  getMedia: vi.fn(),
  deleteMedia: vi.fn()
}

const mockMediaService = {
  listAllMedia: vi.fn(),
  cleanContaminatedMedia: vi.fn()
}

describe('EmergencyDataRecovery', () => {
  let recovery: EmergencyDataRecovery
  
  beforeEach(() => {
    vi.clearAllMocks()
    recovery = new EmergencyDataRecovery(
      mockMediaService as any,
      mockFileStorage as any
    )
  })

  test('EMERGENCY SCAN: Should detect and report contamination comprehensively', async () => {
    console.log('[TEST] 🚨 Testing comprehensive contamination detection')
    
    // Mock contaminated project data
    const contaminatedMedia = [
      {
        id: 'image-contaminated-1',
        type: 'image',
        pageId: 'page-1',
        fileName: 'contaminated.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          originalName: 'contaminated.jpg',
          // Contamination that should be detected
          clipStart: 30,
          clipEnd: 60,
          youtubeUrl: 'https://youtube.com/watch?v=contaminated'
        }
      },
      {
        id: 'audio-contaminated-2',
        type: 'audio',
        pageId: 'page-2',
        fileName: 'contaminated.mp3',
        metadata: {
          type: 'audio',
          pageId: 'page-2',
          originalName: 'contaminated.mp3',
          // Different contamination pattern
          isYouTube: true,
          embedUrl: 'https://youtube.com/embed/audio-contaminated'
        }
      },
      {
        id: 'video-legitimate-3',
        type: 'video',
        pageId: 'page-3',
        fileName: 'legitimate.mp4',
        metadata: {
          type: 'video',
          pageId: 'page-3',
          originalName: 'legitimate.mp4',
          // This should NOT be flagged as contamination
          isYouTube: true,
          clipStart: 45,
          clipEnd: 75,
          youtubeUrl: 'https://youtube.com/watch?v=legitimate'
        }
      },
      {
        id: 'image-clean-4',
        type: 'image',
        pageId: 'page-4',
        fileName: 'clean.png',
        metadata: {
          type: 'image',
          pageId: 'page-4',
          originalName: 'clean.png',
          mimeType: 'image/png'
        }
      }
    ]
    
    mockMediaService.listAllMedia.mockResolvedValue(contaminatedMedia)
    mockMediaService.cleanContaminatedMedia.mockResolvedValue({
      cleaned: ['image-contaminated-1', 'audio-contaminated-2'],
      errors: []
    })
    
    const report = await recovery.performEmergencyScan({
      projectId: 'test-project-123',
      performCleanup: true,
      attemptClipTimingRecovery: true,
      dryRun: false
    })
    
    console.log('[TEST] 📊 Emergency scan report:', report)
    
    // Should scan all media
    expect(report.mediaItemsScanned).toBe(4)
    
    // Should detect contamination in image and audio, but not video or clean image
    expect(report.contaminatedItems).toContain('image-contaminated-1')
    expect(report.contaminatedItems).toContain('audio-contaminated-2')
    expect(report.contaminatedItems).not.toContain('video-legitimate-3') // Legitimate video
    expect(report.contaminatedItems).not.toContain('image-clean-4') // Clean image
    
    // Should perform cleanup
    expect(report.cleanedItems).toContain('image-contaminated-1')
    expect(report.cleanedItems).toContain('audio-contaminated-2')
    
    // Should recover clip timing data
    const imageRecovery = report.recoveredClipTiming.find(r => r.mediaId === 'image-contaminated-1')
    expect(imageRecovery).toBeDefined()
    expect(imageRecovery?.recoveredClipStart).toBe(30)
    expect(imageRecovery?.recoveredClipEnd).toBe(60)
    expect(imageRecovery?.originalUrl).toBe('https://youtube.com/watch?v=contaminated')
    
    // Should generate recommendations
    expect(report.recommendations.length).toBeGreaterThan(0)
    expect(report.recommendations.some(r => r.includes('contaminated media items found'))).toBe(true)
  })

  test('RECOVERY MODE: Should recover clip timing data before cleanup', async () => {
    console.log('[TEST] 🎯 Testing clip timing recovery preservation')
    
    const mediaWithValuableData = [
      {
        id: 'contaminated-but-valuable',
        type: 'image',
        pageId: 'page-1',
        fileName: 'valuable.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          originalName: 'valuable.jpg',
          // Valuable timing data that should be preserved
          clipStart: 120,
          clipEnd: 180,
          youtubeUrl: 'https://youtube.com/watch?v=valuable-content',
          title: 'Important Training Video Segment'
        }
      }
    ]
    
    mockMediaService.listAllMedia.mockResolvedValue(mediaWithValuableData)
    
    const report = await recovery.performEmergencyScan({
      projectId: 'valuable-data-project',
      performCleanup: false, // Don't cleanup, just recover
      attemptClipTimingRecovery: true,
      dryRun: true
    })
    
    console.log('[TEST] 💾 Recovery data:', report.recoveredClipTiming)
    
    expect(report.recoveredClipTiming).toHaveLength(1)
    const recovered = report.recoveredClipTiming[0]
    expect(recovered.mediaId).toBe('contaminated-but-valuable')
    expect(recovered.recoveredClipStart).toBe(120)
    expect(recovered.recoveredClipEnd).toBe(180)
    expect(recovered.originalUrl).toBe('https://youtube.com/watch?v=valuable-content')
    
    // Should not have cleaned anything in dry run mode
    expect(report.cleanedItems).toHaveLength(0)
  })

  test('COMPREHENSIVE ANALYSIS: Should analyze different contamination patterns', async () => {
    console.log('[TEST] 🔍 Testing contamination pattern analysis')
    
    const diverseContamination = [
      {
        id: 'snake-case-contamination',
        type: 'audio',
        pageId: 'page-1',
        fileName: 'snake.mp3',
        metadata: {
          type: 'audio',
          // Snake case contamination
          clip_start: 45,
          youtube_url: 'https://youtube.com/snake-case'
        }
      },
      {
        id: 'uppercase-contamination',
        type: 'image',
        pageId: 'page-2',
        fileName: 'upper.jpg',
        metadata: {
          type: 'image',
          // Uppercase contamination
          CLIP_START: 30,
          YOUTUBE_URL: 'https://youtube.com/uppercase'
        }
      },
      {
        id: 'mixed-contamination',
        type: 'image',
        pageId: 'page-3',
        fileName: 'mixed.png',
        metadata: {
          type: 'image',
          // Mixed case contamination
          youTubeUrl: 'https://youtube.com/mixed-case',
          embedURL: 'https://youtube.com/embed/mixed'
        }
      }
    ]
    
    mockMediaService.listAllMedia.mockResolvedValue(diverseContamination)
    mockMediaService.cleanContaminatedMedia.mockResolvedValue({
      cleaned: ['snake-case-contamination', 'uppercase-contamination', 'mixed-contamination'],
      errors: []
    })
    
    const report = await recovery.performEmergencyScan({
      projectId: 'diverse-contamination',
      performCleanup: true,
      attemptClipTimingRecovery: true
    })
    
    // Should detect all contamination patterns
    expect(report.contaminatedItems).toHaveLength(3)
    expect(report.contaminatedItems).toContain('snake-case-contamination')
    expect(report.contaminatedItems).toContain('uppercase-contamination')
    expect(report.contaminatedItems).toContain('mixed-contamination')
    
    // Should clean all contaminated items
    expect(report.cleanedItems).toHaveLength(3)
  })

  test('ERROR HANDLING: Should handle and report processing errors gracefully', async () => {
    console.log('[TEST] 🛡️ Testing error handling and resilience')
    
    const problematicMedia = [
      {
        id: 'good-item',
        type: 'image',
        pageId: 'page-1',
        fileName: 'good.jpg',
        metadata: {
          type: 'image',
          clipStart: 30 // Contamination that should be processed
        }
      },
      {
        id: 'problematic-item',
        type: 'image',
        pageId: 'page-2',
        fileName: 'problematic.jpg',
        metadata: null // This will cause processing error
      }
    ]
    
    mockMediaService.listAllMedia.mockResolvedValue(problematicMedia)
    mockMediaService.cleanContaminatedMedia.mockResolvedValue({
      cleaned: ['good-item'],
      errors: ['Failed to clean problematic-item: Cannot read properties of null']
    })
    
    const report = await recovery.performEmergencyScan({
      projectId: 'error-handling-test',
      performCleanup: true
    })
    
    // Should process what it can
    expect(report.mediaItemsScanned).toBe(2)
    expect(report.contaminatedItems).toContain('good-item')
    expect(report.cleanedItems).toContain('good-item')
    
    // Should capture and report errors
    expect(report.errors.length).toBeGreaterThan(0)
    
    // Should generate error-related recommendations
    const errorRecommendation = report.recommendations.find(r => r.includes('errors occurred'))
    expect(errorRecommendation).toBeDefined()
  })

  test('REPORT GENERATION: Should generate comprehensive human-readable reports', async () => {
    console.log('[TEST] 📋 Testing report generation and formatting')
    
    const sampleReport = {
      projectId: 'sample-project',
      scanDate: '2023-01-01T00:00:00Z',
      mediaItemsScanned: 10,
      contaminatedItems: ['item-1', 'item-2'],
      cleanedItems: ['item-1'],
      recoveredClipTiming: [
        {
          mediaId: 'item-1',
          originalUrl: 'https://youtube.com/watch?v=recovered',
          recoveredClipStart: 30,
          recoveredClipEnd: 60
        }
      ],
      errors: ['Sample error'],
      recommendations: [
        'CRITICAL: 2 contaminated media items found',
        'RECOMMENDED: Run aggressive cleanup'
      ]
    }
    
    const reportText = recovery.generateRecoveryReportText(sampleReport)
    
    console.log('[TEST] 📄 Generated report preview:')
    console.log(reportText.substring(0, 500) + '...')
    
    // Report should contain key information
    expect(reportText).toContain('EMERGENCY DATA RECOVERY REPORT')
    expect(reportText).toContain('sample-project')
    expect(reportText).toContain('Total Media Items: 10')
    expect(reportText).toContain('Contaminated Items: 2')
    expect(reportText).toContain('CONTAMINATION DETECTED')
    expect(reportText).toContain('CLEANUP PERFORMED')
    expect(reportText).toContain('CLIP TIMING RECOVERED')
    expect(reportText).toContain('ERRORS')
    expect(reportText).toContain('RECOMMENDATIONS')
    expect(reportText).toContain('Emergency Data Recovery Utility')
  })

  test('BACKUP CREATION: Should create emergency backups before operations', async () => {
    console.log('[TEST] 💾 Testing emergency backup creation')
    
    const backupResult = await recovery.createEmergencyBackup('test-project-backup')
    
    console.log('[TEST] 💾 Backup result:', backupResult)
    
    expect(backupResult.success).toBe(true)
    expect(backupResult.backupPath).toBeDefined()
    expect(backupResult.backupPath).toContain('emergency-backup-')
    expect(backupResult.backupPath).toContain('test-project-backup')
    expect(backupResult.error).toBeUndefined()
  })

  test('PERFORMANCE: Should handle large contaminated datasets efficiently', async () => {
    console.log('[TEST] ⚡ Testing performance with large contaminated dataset')
    
    // Generate 100 contaminated items
    const largeContaminatedDataset = Array.from({ length: 100 }, (_, index) => ({
      id: `contaminated-${index}`,
      type: 'image',
      pageId: `page-${index % 10}`,
      fileName: `image-${index}.jpg`,
      metadata: {
        type: 'image',
        // Various contamination patterns
        ...(index % 3 === 0 && { clipStart: 30 }),
        ...(index % 3 === 1 && { youtubeUrl: `https://youtube.com/video-${index}` }),
        ...(index % 3 === 2 && { isYouTube: true })
      }
    }))
    
    mockMediaService.listAllMedia.mockResolvedValue(largeContaminatedDataset)
    mockMediaService.cleanContaminatedMedia.mockResolvedValue({
      cleaned: largeContaminatedDataset.map(item => item.id),
      errors: []
    })
    
    const startTime = performance.now()
    
    const report = await recovery.performEmergencyScan({
      projectId: 'performance-test',
      performCleanup: true,
      attemptClipTimingRecovery: true
    })
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    console.log('[TEST] ⚡ Performance metrics:')
    console.log(`[TEST] ⚡ - Duration: ${duration}ms`)
    console.log(`[TEST] ⚡ - Items processed: ${report.mediaItemsScanned}`)
    console.log(`[TEST] ⚡ - Items per ms: ${report.mediaItemsScanned / duration}`)
    
    expect(report.mediaItemsScanned).toBe(100)
    expect(report.contaminatedItems.length).toBe(100) // All should be contaminated
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    
    // Should generate appropriate recommendations for high contamination rate
    const severeContaminationWarning = report.recommendations.find(r => r.includes('SEVERE'))
    expect(severeContaminationWarning).toBeDefined()
  })
})