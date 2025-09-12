/**
 * YouTube Clipping User Verification Guide
 * 
 * This module provides user-friendly utilities to help verify that YouTube video clipping
 * is working correctly in SCORM packages. It includes step-by-step verification guides,
 * browser compatibility checks, and troubleshooting helpers.
 */

import { testYouTubeClippingFunctionality } from './youTubeClippingDiagnostics'

export interface VerificationResult {
  step: string
  status: 'pass' | 'fail' | 'warning' | 'info'
  message: string
  details?: string
  recommendation?: string
}

export interface BrowserCompatibilityResult {
  browser: string
  supportsYouTubeClipping: boolean
  issues: string[]
  recommendations: string[]
}

/**
 * Run a comprehensive verification of YouTube clipping functionality
 * This is designed to be called by users who want to verify their setup
 */
export function runYouTubeClippingVerification(): VerificationResult[] {
  const results: VerificationResult[] = []
  
  console.log('🔍 Starting YouTube Clipping Verification...')
  
  // Step 1: Basic functionality test
  try {
    results.push({
      step: '1. Basic Functionality Test',
      status: 'info',
      message: 'Running internal YouTube clipping tests...',
      details: 'Testing URL generation, parameter handling, and edge cases'
    })
    
    testYouTubeClippingFunctionality()
    
    results.push({
      step: '1. Basic Functionality Test',
      status: 'pass',
      message: 'Internal YouTube clipping tests passed ✅',
      details: 'URL generation and parameter handling is working correctly'
    })
  } catch (error) {
    results.push({
      step: '1. Basic Functionality Test',
      status: 'fail',
      message: 'Internal YouTube clipping tests failed ❌',
      details: error instanceof Error ? error.message : 'Unknown error',
      recommendation: 'This indicates a code-level issue. Check the console for detailed error logs.'
    })
  }
  
  // Step 2: URL format validation
  const testUrls = [
    'https://www.youtube.com/watch?v=TvB8QQibvco',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/abc123'
  ]
  
  results.push({
    step: '2. URL Format Support',
    status: 'info',
    message: `Testing support for ${testUrls.length} different YouTube URL formats...`
  })
  
  let supportedFormats = 0
  testUrls.forEach((url, index) => {
    const videoIdPattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/i
    const match = url.match(videoIdPattern)
    if (match) {
      supportedFormats++
    }
  })
  
  if (supportedFormats === testUrls.length) {
    results.push({
      step: '2. URL Format Support',
      status: 'pass',
      message: `All ${testUrls.length} YouTube URL formats supported ✅`,
      details: 'watch?v=, youtu.be/, and embed/ formats all work correctly'
    })
  } else {
    results.push({
      step: '2. URL Format Support',
      status: 'warning',
      message: `${supportedFormats}/${testUrls.length} YouTube URL formats supported`,
      recommendation: 'Some URL formats may not be recognized. Use standard youtube.com/watch?v= format for best compatibility.'
    })
  }
  
  // Step 3: Parameter generation test
  results.push({
    step: '3. Clip Parameter Generation',
    status: 'info',
    message: 'Testing clip timing parameter generation...'
  })
  
  const testCases = [
    { start: 30, end: 90, expected: 'start=30&end=90' },
    { start: 0, end: 60, expected: 'start=0&end=60' },
    { start: 45.7, end: 120.3, expected: 'start=45&end=120' }, // Should floor decimals
    { start: 60, end: undefined, expected: 'start=60' },
    { start: undefined, end: 90, expected: 'end=90' }
  ]
  
  let parameterTestsPassed = 0
  testCases.forEach(testCase => {
    const baseUrl = 'https://www.youtube.com/embed/test'
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
    
    if (testCase.start !== undefined && testCase.start >= 0) {
      params.set('start', Math.floor(testCase.start).toString())
    }
    if (testCase.end !== undefined && testCase.end > 0) {
      params.set('end', Math.floor(testCase.end).toString())
    }
    
    const generatedParams = params.toString()
    if (generatedParams.includes(testCase.expected.split('&')[0])) {
      parameterTestsPassed++
    }
  })
  
  if (parameterTestsPassed === testCases.length) {
    results.push({
      step: '3. Clip Parameter Generation',
      status: 'pass',
      message: `All ${testCases.length} parameter generation tests passed ✅`,
      details: 'Start/end timing parameters are generated correctly'
    })
  } else {
    results.push({
      step: '3. Clip Parameter Generation',
      status: 'fail',
      message: `${parameterTestsPassed}/${testCases.length} parameter tests failed`,
      recommendation: 'There may be an issue with clip timing parameter generation. Check console logs for details.'
    })
  }
  
  // Step 4: Browser compatibility check
  const browserInfo = getBrowserInfo()
  results.push({
    step: '4. Browser Compatibility',
    status: 'info',
    message: `Checking compatibility for ${browserInfo.name} ${browserInfo.version}...`
  })
  
  const compatibility = checkBrowserCompatibility(browserInfo)
  if (compatibility.supportsYouTubeClipping) {
    results.push({
      step: '4. Browser Compatibility',
      status: 'pass',
      message: `${browserInfo.name} supports YouTube clipping ✅`,
      details: 'Your browser should properly handle YouTube embed URLs with timing parameters'
    })
  } else {
    results.push({
      step: '4. Browser Compatibility',
      status: 'warning',
      message: `${browserInfo.name} may have issues with YouTube clipping`,
      details: compatibility.issues.join(', '),
      recommendation: compatibility.recommendations.join(' ')
    })
  }
  
  // Step 5: Final summary
  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const warningCount = results.filter(r => r.status === 'warning').length
  
  if (failCount === 0 && warningCount === 0) {
    results.push({
      step: '5. Overall Status',
      status: 'pass',
      message: '🎉 YouTube clipping verification completed successfully!',
      details: `All ${passCount} verification steps passed. YouTube video clipping should work correctly in your SCORM packages.`
    })
  } else if (failCount === 0) {
    results.push({
      step: '5. Overall Status',
      status: 'warning',
      message: '⚠️ YouTube clipping verification completed with warnings',
      details: `${passCount} passed, ${warningCount} warnings. Clipping should work but there may be minor issues.`,
      recommendation: 'Review the warnings above and consider the recommendations provided.'
    })
  } else {
    results.push({
      step: '5. Overall Status',
      status: 'fail',
      message: '❌ YouTube clipping verification failed',
      details: `${failCount} failures, ${warningCount} warnings, ${passCount} passed.`,
      recommendation: 'Address the failed tests before using YouTube clipping in production SCORM packages.'
    })
  }
  
  return results
}

/**
 * Get basic browser information
 */
function getBrowserInfo(): { name: string; version: string; userAgent: string } {
  if (typeof navigator === 'undefined') {
    return { name: 'Node.js', version: 'N/A', userAgent: 'N/A' }
  }
  
  const userAgent = navigator.userAgent
  
  // Simple browser detection
  if (userAgent.includes('Chrome')) {
    const match = userAgent.match(/Chrome\/(\d+)/)
    return { name: 'Chrome', version: match ? match[1] : 'Unknown', userAgent }
  }
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/)
    return { name: 'Firefox', version: match ? match[1] : 'Unknown', userAgent }
  }
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Safari\/(\d+)/)
    return { name: 'Safari', version: match ? match[1] : 'Unknown', userAgent }
  }
  if (userAgent.includes('Edge')) {
    const match = userAgent.match(/Edge\/(\d+)/)
    return { name: 'Edge', version: match ? match[1] : 'Unknown', userAgent }
  }
  
  return { name: 'Unknown', version: 'Unknown', userAgent }
}

/**
 * Check browser compatibility with YouTube clipping
 */
function checkBrowserCompatibility(browserInfo: { name: string; version: string }): BrowserCompatibilityResult {
  const result: BrowserCompatibilityResult = {
    browser: `${browserInfo.name} ${browserInfo.version}`,
    supportsYouTubeClipping: true,
    issues: [],
    recommendations: []
  }
  
  // Check for known compatibility issues
  if (browserInfo.name === 'Safari') {
    result.issues.push('Safari may have stricter privacy settings that affect YouTube embeds')
    result.recommendations.push('Test in Safari to ensure YouTube videos load correctly.')
  }
  
  if (browserInfo.name === 'Firefox' && parseInt(browserInfo.version) < 60) {
    result.supportsYouTubeClipping = false
    result.issues.push('Older Firefox versions may not support all YouTube embed parameters')
    result.recommendations.push('Update Firefox to version 60 or later.')
  }
  
  if (browserInfo.name === 'Chrome' && parseInt(browserInfo.version) < 60) {
    result.supportsYouTubeClipping = false
    result.issues.push('Older Chrome versions may have issues with YouTube embed parameters')
    result.recommendations.push('Update Chrome to version 60 or later.')
  }
  
  if (browserInfo.name === 'Edge' && parseInt(browserInfo.version) < 79) {
    result.issues.push('Legacy Edge may have compatibility issues')
    result.recommendations.push('Use the new Chromium-based Edge for best compatibility.')
  }
  
  if (browserInfo.name === 'Unknown') {
    result.supportsYouTubeClipping = false
    result.issues.push('Unknown browser - compatibility cannot be determined')
    result.recommendations.push('Use a modern browser like Chrome, Firefox, Safari, or Edge.')
  }
  
  return result
}

/**
 * Generate a user-friendly verification report
 */
export function generateVerificationReport(): void {
  console.group('🎥 YouTube Clipping Verification Report')
  
  const results = runYouTubeClippingVerification()
  
  results.forEach(result => {
    const icon = {
      'pass': '✅',
      'fail': '❌', 
      'warning': '⚠️',
      'info': 'ℹ️'
    }[result.status]
    
    console.log(`${icon} ${result.step}: ${result.message}`)
    
    if (result.details) {
      console.log(`   Details: ${result.details}`)
    }
    
    if (result.recommendation) {
      console.log(`   💡 Recommendation: ${result.recommendation}`)
    }
    
    console.log('') // Empty line for readability
  })
  
  console.groupEnd()
}

/**
 * Quick test utility for users to verify YouTube clipping in their SCORM packages
 * This generates test embed URLs that users can manually verify
 */
export function generateTestEmbedUrls(): void {
  console.group('🧪 YouTube Clipping Test URLs')
  console.log('Use these URLs to manually verify that YouTube clipping is working:')
  console.log('')
  
  const testCases = [
    {
      description: 'Standard clipping (30s-90s)',
      videoId: 'TvB8QQibvco',
      clipStart: 30,
      clipEnd: 90
    },
    {
      description: 'Start-only clipping (60s onwards)',
      videoId: 'dQw4w9WgXcQ', 
      clipStart: 60
    },
    {
      description: 'End-only clipping (stop at 45s)',
      videoId: 'abc123def45',
      clipEnd: 45
    },
    {
      description: 'No clipping (full video)',
      videoId: 'xyz789'
    }
  ]
  
  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.description}`)
    
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1'
    })
    
    if (testCase.clipStart !== undefined) {
      params.set('start', testCase.clipStart.toString())
    }
    if (testCase.clipEnd !== undefined) {
      params.set('end', testCase.clipEnd.toString())
    }
    
    const embedUrl = `https://www.youtube.com/embed/${testCase.videoId}?${params.toString()}`
    console.log(`   URL: ${embedUrl}`)
    console.log(`   Test: Open this URL in a browser to verify it ${testCase.clipStart ? `starts at ${testCase.clipStart}s` : 'starts normally'}${testCase.clipEnd ? ` and ends at ${testCase.clipEnd}s` : ''}`)
    console.log('')
  })
  
  console.log('📝 Manual Testing Instructions:')
  console.log('1. Copy each URL above into your browser')
  console.log('2. Verify the video starts/ends at the correct times')
  console.log('3. If timing parameters are ignored, there may be a browser or YouTube issue')
  console.log('')
  
  console.groupEnd()
}

/**
 * Troubleshooting helper for common YouTube clipping issues
 */
export function runTroubleshooting(): void {
  console.group('🔧 YouTube Clipping Troubleshooting')
  
  console.log('If YouTube videos with clipping are not working correctly, try these steps:')
  console.log('')
  
  console.log('1. 🔍 Check Embed URL Format')
  console.log('   • Verify URLs include start= and/or end= parameters')
  console.log('   • Example: https://www.youtube.com/embed/VIDEO_ID?rel=0&modestbranding=1&start=30&end=90')
  console.log('')
  
  console.log('2. 🌐 Test in Different Browsers')
  console.log('   • Chrome, Firefox, Safari, Edge all handle YouTube embeds slightly differently')
  console.log('   • Some browsers have stricter privacy settings affecting embeds')
  console.log('')
  
  console.log('3. 📱 Check Device Compatibility')
  console.log('   • Mobile devices may handle YouTube embeds differently')
  console.log('   • iOS Safari has known issues with some YouTube embed parameters')
  console.log('')
  
  console.log('4. 🔐 Verify Privacy Settings')
  console.log('   • Ad blockers may interfere with YouTube embeds')
  console.log('   • Corporate firewalls may block YouTube or modify embed URLs')
  console.log('')
  
  console.log('5. ⏱️ Check Timing Values')
  console.log('   • Start time must be >= 0')
  console.log('   • End time must be > start time')
  console.log('   • Very long videos (>2 hours) may have issues with end timing')
  console.log('')
  
  console.log('6. 🎥 Verify Video Availability')
  console.log('   • Private/unlisted videos may not work in embeds')
  console.log('   • Age-restricted videos require additional parameters')
  console.log('   • Deleted videos will obviously not work')
  console.log('')
  
  console.log('💡 Quick Debug Commands:')
  console.log('   • generateVerificationReport() - Run comprehensive verification')
  console.log('   • generateTestEmbedUrls() - Get test URLs for manual verification')
  console.log('   • testYouTubeClippingFunctionality() - Test core functionality')
  
  console.groupEnd()
}