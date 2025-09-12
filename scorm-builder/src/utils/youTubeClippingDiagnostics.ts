/**
 * YouTube Clipping Diagnostics Utility
 * 
 * Provides enhanced diagnostic logging and validation tools for YouTube video clipping
 * in SCORM generation. This helps users verify that YouTube videos with clip timing
 * are being processed correctly.
 */

import { debugLogger } from './ultraSimpleLogger'

export interface YouTubeClipDiagnostics {
  videoId: string
  originalUrl: string
  clipStart?: number
  clipEnd?: number
  expectedEmbedUrl: string
  actualEmbedUrl?: string
  isProcessedCorrectly: boolean
  warnings: string[]
  errors: string[]
}

export interface YouTubeClipReport {
  projectId: string
  totalVideos: number
  clippedVideos: number
  successfullyProcessed: number
  diagnostics: YouTubeClipDiagnostics[]
  summary: {
    allClippingWorking: boolean
    issues: string[]
    recommendations: string[]
  }
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/i,
    /^([a-zA-Z0-9_-]{11})$/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

/**
 * Generate expected YouTube embed URL with clip timing parameters
 */
function generateExpectedEmbedUrl(videoId: string, clipStart?: number, clipEnd?: number): string {
  const baseUrl = `https://www.youtube.com/embed/${videoId}`
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1'
  })
  
  if (clipStart !== undefined && clipStart >= 0) {
    params.set('start', Math.floor(clipStart).toString())
  }
  
  if (clipEnd !== undefined && clipEnd > 0) {
    params.set('end', Math.floor(clipEnd).toString())
  }
  
  return `${baseUrl}?${params.toString()}`
}

/**
 * Validate YouTube clip timing values
 */
function validateClipTiming(clipStart?: number, clipEnd?: number): { warnings: string[], errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []
  
  // Check for invalid values
  if (clipStart !== undefined && clipStart < 0) {
    errors.push(`Invalid clipStart value: ${clipStart}. Must be >= 0.`)
  }
  
  if (clipEnd !== undefined && clipEnd <= 0) {
    errors.push(`Invalid clipEnd value: ${clipEnd}. Must be > 0.`)
  }
  
  // Check for logical issues
  if (clipStart !== undefined && clipEnd !== undefined && clipStart >= clipEnd) {
    errors.push(`clipStart (${clipStart}) must be less than clipEnd (${clipEnd}).`)
  }
  
  // Check for potential issues
  if (clipStart !== undefined && clipStart > 3600) {
    warnings.push(`clipStart (${clipStart}s) is over 1 hour. Verify this is correct.`)
  }
  
  if (clipEnd !== undefined && clipEnd > 7200) {
    warnings.push(`clipEnd (${clipEnd}s) is over 2 hours. Verify this is correct.`)
  }
  
  if (clipStart !== undefined && clipEnd !== undefined) {
    const duration = clipEnd - clipStart
    if (duration < 10) {
      warnings.push(`Clip duration is very short (${duration}s). Consider if this is intentional.`)
    }
    if (duration > 1800) {
      warnings.push(`Clip duration is very long (${duration}s). Consider if this is intentional.`)
    }
  }
  
  return { warnings, errors }
}

/**
 * Diagnose a single YouTube video for clipping functionality
 */
export function diagnoseYouTubeVideo(
  videoUrl: string,
  clipStart?: number,
  clipEnd?: number,
  actualEmbedUrl?: string
): YouTubeClipDiagnostics {
  const videoId = extractYouTubeId(videoUrl)
  const { warnings, errors } = validateClipTiming(clipStart, clipEnd)
  
  if (!videoId) {
    return {
      videoId: 'INVALID',
      originalUrl: videoUrl,
      clipStart,
      clipEnd,
      expectedEmbedUrl: '',
      actualEmbedUrl,
      isProcessedCorrectly: false,
      warnings,
      errors: [...errors, `Could not extract YouTube video ID from URL: ${videoUrl}`]
    }
  }
  
  const expectedEmbedUrl = generateExpectedEmbedUrl(videoId, clipStart, clipEnd)
  const isProcessedCorrectly = actualEmbedUrl ? actualEmbedUrl === expectedEmbedUrl : true
  
  if (actualEmbedUrl && !isProcessedCorrectly) {
    errors.push(`Embed URL mismatch. Expected: ${expectedEmbedUrl}, Got: ${actualEmbedUrl}`)
  }
  
  return {
    videoId,
    originalUrl: videoUrl,
    clipStart,
    clipEnd,
    expectedEmbedUrl,
    actualEmbedUrl,
    isProcessedCorrectly,
    warnings,
    errors
  }
}

/**
 * Generate a comprehensive diagnostic report for all YouTube videos in a project
 */
export function generateYouTubeClipReport(
  projectId: string,
  videos: Array<{
    url: string
    clipStart?: number
    clipEnd?: number
    actualEmbedUrl?: string
  }>
): YouTubeClipReport {
  debugLogger.info('YOUTUBE_DIAGNOSTICS', 'Starting YouTube clip diagnostics', {
    projectId,
    videoCount: videos.length
  })
  
  const diagnostics = videos.map(video => 
    diagnoseYouTubeVideo(video.url, video.clipStart, video.clipEnd, video.actualEmbedUrl)
  )
  
  const totalVideos = diagnostics.length
  const clippedVideos = diagnostics.filter(d => d.clipStart !== undefined || d.clipEnd !== undefined).length
  const successfullyProcessed = diagnostics.filter(d => d.isProcessedCorrectly && d.errors.length === 0).length
  
  // Generate summary
  const allClippingWorking = successfullyProcessed === totalVideos
  const issues: string[] = []
  const recommendations: string[] = []
  
  // Collect all unique errors and warnings
  const allErrors = diagnostics.flatMap(d => d.errors)
  const allWarnings = diagnostics.flatMap(d => d.warnings)
  
  if (allErrors.length > 0) {
    issues.push(`${allErrors.length} error(s) found in YouTube video processing`)
  }
  
  if (allWarnings.length > 0) {
    issues.push(`${allWarnings.length} warning(s) found in YouTube video configuration`)
  }
  
  // Generate recommendations
  if (clippedVideos > 0 && successfullyProcessed < totalVideos) {
    recommendations.push('Some YouTube videos with clipping are not processing correctly. Check the detailed diagnostics below.')
  }
  
  if (clippedVideos === 0 && totalVideos > 0) {
    recommendations.push('No YouTube videos have clip timing. If you expected clipped videos, verify that clipStart/clipEnd values are properly set.')
  }
  
  if (allClippingWorking && clippedVideos > 0) {
    recommendations.push('All YouTube videos with clipping are processing correctly!')
  }
  
  const report: YouTubeClipReport = {
    projectId,
    totalVideos,
    clippedVideos,
    successfullyProcessed,
    diagnostics,
    summary: {
      allClippingWorking,
      issues,
      recommendations
    }
  }
  
  debugLogger.info('YOUTUBE_DIAGNOSTICS', 'YouTube clip diagnostics completed', {
    projectId,
    totalVideos,
    clippedVideos,
    successfullyProcessed,
    allClippingWorking,
    issueCount: issues.length
  })
  
  return report
}

/**
 * Log diagnostic report to console in a user-friendly format
 */
export function logYouTubeClipReport(report: YouTubeClipReport): void {
  console.group(`🎥 YouTube Clipping Diagnostics - Project: ${report.projectId}`)
  
  // Summary
  console.log(`📊 Summary:`)
  console.log(`   Total Videos: ${report.totalVideos}`)
  console.log(`   Videos with Clipping: ${report.clippedVideos}`)
  console.log(`   Successfully Processed: ${report.successfullyProcessed}`)
  console.log(`   Status: ${report.summary.allClippingWorking ? '✅ All Working' : '⚠️  Issues Found'}`)
  
  // Issues and recommendations
  if (report.summary.issues.length > 0) {
    console.log(`\n🚨 Issues:`)
    report.summary.issues.forEach(issue => console.log(`   • ${issue}`))
  }
  
  if (report.summary.recommendations.length > 0) {
    console.log(`\n💡 Recommendations:`)
    report.summary.recommendations.forEach(rec => console.log(`   • ${rec}`))
  }
  
  // Detailed diagnostics
  if (report.diagnostics.some(d => d.errors.length > 0 || d.warnings.length > 0 || !d.isProcessedCorrectly)) {
    console.log(`\n🔍 Detailed Diagnostics:`)
    
    report.diagnostics.forEach((diag, index) => {
      const hasIssues = diag.errors.length > 0 || diag.warnings.length > 0 || !diag.isProcessedCorrectly
      if (hasIssues) {
        console.group(`Video ${index + 1}: ${diag.videoId}`)
        console.log(`URL: ${diag.originalUrl}`)
        
        if (diag.clipStart !== undefined || diag.clipEnd !== undefined) {
          console.log(`Clipping: start=${diag.clipStart || 'none'}, end=${diag.clipEnd || 'none'}`)
        }
        
        if (diag.expectedEmbedUrl) {
          console.log(`Expected Embed: ${diag.expectedEmbedUrl}`)
        }
        
        if (diag.actualEmbedUrl) {
          console.log(`Actual Embed: ${diag.actualEmbedUrl}`)
        }
        
        if (diag.errors.length > 0) {
          console.log(`❌ Errors:`, diag.errors)
        }
        
        if (diag.warnings.length > 0) {
          console.log(`⚠️  Warnings:`, diag.warnings)
        }
        
        console.groupEnd()
      }
    })
  }
  
  console.groupEnd()
}

/**
 * Test utility: Verify that YouTube clipping is working for a set of test cases
 */
export function testYouTubeClippingFunctionality(): void {
  console.log('🧪 Testing YouTube Clipping Functionality...')
  
  const testCases = [
    {
      description: 'Standard YouTube video with both start and end',
      url: 'https://www.youtube.com/watch?v=TvB8QQibvco',
      clipStart: 60,
      clipEnd: 120,
      expectedEmbedUrl: 'https://www.youtube.com/embed/TvB8QQibvco?rel=0&modestbranding=1&start=60&end=120'
    },
    {
      description: 'YouTube video with only start time',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      clipStart: 30,
      expectedEmbedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=30'
    },
    {
      description: 'YouTube video with only end time',
      url: 'https://www.youtube.com/watch?v=abc123def45',
      clipEnd: 90,
      expectedEmbedUrl: 'https://www.youtube.com/embed/abc123def45?rel=0&modestbranding=1&end=90'
    },
    {
      description: 'YouTube video with no clipping',
      url: 'https://www.youtube.com/watch?v=xyz789',
      expectedEmbedUrl: 'https://www.youtube.com/embed/xyz789?rel=0&modestbranding=1'
    }
  ]
  
  testCases.forEach((testCase, index) => {
    console.log(`\n🎯 Test Case ${index + 1}: ${testCase.description}`)
    
    const diagnosis = diagnoseYouTubeVideo(
      testCase.url,
      testCase.clipStart,
      testCase.clipEnd,
      testCase.expectedEmbedUrl
    )
    
    console.log(`   Video ID: ${diagnosis.videoId}`)
    console.log(`   Expected: ${diagnosis.expectedEmbedUrl}`)
    console.log(`   Status: ${diagnosis.isProcessedCorrectly ? '✅ PASS' : '❌ FAIL'}`)
    
    if (diagnosis.errors.length > 0) {
      console.log(`   Errors:`, diagnosis.errors)
    }
    
    if (diagnosis.warnings.length > 0) {
      console.log(`   Warnings:`, diagnosis.warnings)
    }
  })
  
  console.log('\n✅ YouTube Clipping Functionality Test Complete')
}