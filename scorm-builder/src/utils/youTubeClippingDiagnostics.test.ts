/**
 * Tests for YouTube Clipping Diagnostics
 */

import { describe, test, expect } from 'vitest'
import { diagnoseYouTubeVideo, generateYouTubeClipReport } from './youTubeClippingDiagnostics'

describe('YouTube Clipping Diagnostics', () => {
  test('diagnoses YouTube video with both clip start and end correctly', () => {
    const diagnosis = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=TvB8QQibvco',
      60,
      120,
      'https://www.youtube.com/embed/TvB8QQibvco?rel=0&modestbranding=1&start=60&end=120'
    )

    expect(diagnosis.videoId).toBe('TvB8QQibvco')
    expect(diagnosis.clipStart).toBe(60)
    expect(diagnosis.clipEnd).toBe(120)
    expect(diagnosis.isProcessedCorrectly).toBe(true)
    expect(diagnosis.errors).toHaveLength(0)
    expect(diagnosis.expectedEmbedUrl).toBe('https://www.youtube.com/embed/TvB8QQibvco?rel=0&modestbranding=1&start=60&end=120')
  })

  test('diagnoses YouTube video with only start time', () => {
    const diagnosis = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      30,
      undefined,
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=30'
    )

    expect(diagnosis.videoId).toBe('dQw4w9WgXcQ')
    expect(diagnosis.clipStart).toBe(30)
    expect(diagnosis.clipEnd).toBeUndefined()
    expect(diagnosis.isProcessedCorrectly).toBe(true)
    expect(diagnosis.expectedEmbedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=30')
  })

  test('diagnoses YouTube video with invalid URL', () => {
    const diagnosis = diagnoseYouTubeVideo(
      'https://invalid-url.com/video',
      30,
      60
    )

    expect(diagnosis.videoId).toBe('INVALID')
    expect(diagnosis.isProcessedCorrectly).toBe(false)
    expect(diagnosis.errors).toContain('Could not extract YouTube video ID from URL: https://invalid-url.com/video')
  })

  test('detects embed URL mismatch', () => {
    const diagnosis = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=TvB8QQibvco',
      60,
      120,
      'https://www.youtube.com/embed/TvB8QQibvco?rel=0&modestbranding=1' // Missing timing params
    )

    expect(diagnosis.isProcessedCorrectly).toBe(false)
    expect(diagnosis.errors).toHaveLength(1)
    expect(diagnosis.errors[0]).toContain('Embed URL mismatch')
  })

  test('validates clip timing values', () => {
    // Test invalid clipStart
    const diagnosisInvalidStart = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=test',
      -10,
      60
    )
    expect(diagnosisInvalidStart.errors.some(e => e.includes('Invalid clipStart'))).toBe(true)

    // Test invalid clipEnd  
    const diagnosisInvalidEnd = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=test',
      30,
      0
    )
    expect(diagnosisInvalidEnd.errors.some(e => e.includes('Invalid clipEnd'))).toBe(true)

    // Test start >= end
    const diagnosisInvalidRange = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=test',
      90,
      60
    )
    expect(diagnosisInvalidRange.errors.some(e => e.includes('clipStart (90) must be less than clipEnd (60)'))).toBe(true)
  })

  test('generates warnings for edge cases', () => {
    // Test very long start time
    const diagnosisLongStart = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=test',
      3700, // Over 1 hour
      4000
    )
    expect(diagnosisLongStart.warnings.some(w => w.includes('clipStart (3700s) is over 1 hour'))).toBe(true)

    // Test very short clip
    const diagnosisShortClip = diagnoseYouTubeVideo(
      'https://www.youtube.com/watch?v=test',
      30,
      35 // Only 5 seconds
    )
    expect(diagnosisShortClip.warnings.some(w => w.includes('Clip duration is very short (5s)'))).toBe(true)
  })

  test('generates comprehensive report for multiple videos', () => {
    const videos = [
      {
        url: 'https://www.youtube.com/watch?v=video1',
        clipStart: 30,
        clipEnd: 90,
        actualEmbedUrl: 'https://www.youtube.com/embed/video1?rel=0&modestbranding=1&start=30&end=90'
      },
      {
        url: 'https://www.youtube.com/watch?v=video2',
        clipStart: 60,
        actualEmbedUrl: 'https://www.youtube.com/embed/video2?rel=0&modestbranding=1&start=60'
      },
      {
        url: 'https://www.youtube.com/watch?v=video3',
        actualEmbedUrl: 'https://www.youtube.com/embed/video3?rel=0&modestbranding=1'
      }
    ]

    const report = generateYouTubeClipReport('test-project', videos)

    expect(report.projectId).toBe('test-project')
    expect(report.totalVideos).toBe(3)
    expect(report.clippedVideos).toBe(2) // video1 and video2 have clipping
    expect(report.successfullyProcessed).toBe(3) // All should process correctly
    expect(report.summary.allClippingWorking).toBe(true)
    expect(report.diagnostics).toHaveLength(3)
  })

  test('identifies issues in report when videos fail processing', () => {
    const videos = [
      {
        url: 'https://www.youtube.com/watch?v=video1',
        clipStart: 30,
        clipEnd: 90,
        actualEmbedUrl: 'https://www.youtube.com/embed/video1?rel=0&modestbranding=1' // Missing timing
      },
      {
        url: 'https://invalid-url.com/video',
        clipStart: 60
      }
    ]

    const report = generateYouTubeClipReport('test-project', videos)

    expect(report.totalVideos).toBe(2)
    expect(report.successfullyProcessed).toBe(0) // Both should fail
    expect(report.summary.allClippingWorking).toBe(false)
    expect(report.summary.issues.length).toBeGreaterThan(0)
    expect(report.summary.recommendations.length).toBeGreaterThan(0)
  })
})