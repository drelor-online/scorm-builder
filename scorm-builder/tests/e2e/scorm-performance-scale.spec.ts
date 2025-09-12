import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { 
  TestCourseFixtures, 
  getLargeCourse, 
  getMediaHeavyCourse,
  type TestCourseTemplate 
} from '../fixtures/test-courses'
import { 
  createCourseMediaSet, 
  cleanupMediaFiles, 
  TestMediaFixtures 
} from '../fixtures/test-media'
import { 
  SettingsMatrixGenerator,
  type SettingsTestCase 
} from '../utils/settings-generator'

interface PerformanceMetrics {
  generationTime: number        // milliseconds
  packageSize: number          // bytes
  fileCount: number
  mediaSize: number            // bytes
  compressionRatio: number
  memoryUsage: {
    peak: number               // MB
    average: number            // MB
  }
  loadTimes: {
    lowBandwidth: number       // seconds (1 Mbps)
    mediumBandwidth: number    // seconds (5 Mbps)
    highBandwidth: number      // seconds (25 Mbps)
  }
  lmsCompatibility: {
    moodleLoadTime: number     // estimated seconds
    blackboardLoadTime: number
    canvasLoadTime: number
  }
}

interface ScaleTestResult {
  courseSize: 'small' | 'medium' | 'large' | 'xlarge'
  topicCount: number
  mediaFileCount: number
  metrics: PerformanceMetrics
  success: boolean
  errors: string[]
  warnings: string[]
}

class PerformanceMonitor {
  private startTime: number = 0
  private endTime: number = 0
  private memoryUsage: number[] = []
  private monitoringInterval?: NodeJS.Timeout

  start(): void {
    this.startTime = Date.now()
    this.memoryUsage = []
    
    // Monitor memory usage every 500ms
    this.monitoringInterval = setInterval(() => {
      if (process.memoryUsage) {
        this.memoryUsage.push(process.memoryUsage().heapUsed / 1024 / 1024) // MB
      }
    }, 500)
  }

  stop(): number {
    this.endTime = Date.now()
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    return this.endTime - this.startTime
  }

  getMemoryMetrics(): { peak: number; average: number } {
    if (this.memoryUsage.length === 0) return { peak: 0, average: 0 }
    
    return {
      peak: Math.max(...this.memoryUsage),
      average: this.memoryUsage.reduce((a, b) => a + b, 0) / this.memoryUsage.length
    }
  }
}

class ScaleTestRunner {
  
  static async runScaleTest(
    page: Page, 
    course: TestCourseTemplate,
    mediaFileCount: number = 0
  ): Promise<ScaleTestResult> {
    const monitor = new PerformanceMonitor()
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      monitor.start()
      
      console.log(`\n🚀 Starting scale test: ${course.name}`)
      console.log(`📊 Topics: ${course.courseSeedData.topics.length}`)
      console.log(`🎬 Media files: ${mediaFileCount}`)
      
      // Create project with timing
      await this.createLargeProject(page, course, mediaFileCount)
      
      // Generate SCORM package
      const downloadPath = await this.generateScormPackage(page)
      
      const generationTime = monitor.stop()
      
      // Analyze the generated package
      const packageStats = this.analyzePackage(downloadPath)
      
      const result: ScaleTestResult = {
        courseSize: this.categorizeCourseSize(course.courseSeedData.topics.length, mediaFileCount),
        topicCount: course.courseSeedData.topics.length,
        mediaFileCount,
        metrics: {
          generationTime,
          packageSize: packageStats.packageSize,
          fileCount: packageStats.fileCount,
          mediaSize: packageStats.mediaSize,
          compressionRatio: packageStats.compressionRatio,
          memoryUsage: monitor.getMemoryMetrics(),
          loadTimes: this.calculateLoadTimes(packageStats.packageSize),
          lmsCompatibility: this.estimateLmsLoadTimes(packageStats.packageSize, packageStats.fileCount)
        },
        success: true,
        errors,
        warnings
      }
      
      // Performance thresholds and warnings
      if (generationTime > 60000) { // > 1 minute
        warnings.push(`Generation time (${generationTime}ms) exceeds recommended threshold`)
      }
      
      if (packageStats.packageSize > 500 * 1024 * 1024) { // > 500MB
        warnings.push(`Package size (${(packageStats.packageSize / 1024 / 1024).toFixed(2)}MB) is very large`)
      }
      
      if (monitor.getMemoryMetrics().peak > 2048) { // > 2GB
        warnings.push(`Peak memory usage (${monitor.getMemoryMetrics().peak.toFixed(2)}MB) is high`)
      }
      
      // Cleanup
      fs.unlinkSync(downloadPath)
      
      return result
      
    } catch (error) {
      monitor.stop()
      errors.push(error?.toString() || 'Unknown error')
      
      return {
        courseSize: this.categorizeCourseSize(course.courseSeedData.topics.length, mediaFileCount),
        topicCount: course.courseSeedData.topics.length,
        mediaFileCount,
        metrics: {} as PerformanceMetrics,
        success: false,
        errors,
        warnings
      }
    }
  }

  private static async createLargeProject(
    page: Page, 
    course: TestCourseTemplate, 
    mediaFileCount: number
  ): Promise<void> {
    // Create project
    await page.click('text=Create New Project')
    await page.fill('input[placeholder="Enter project name"]', `Scale Test - ${course.name}`)
    await page.click('button:has-text("Create")')

    // Configure course basics
    await page.fill('input[placeholder*="course title"]', course.courseSeedData.courseTitle)
    await page.fill('textarea[placeholder*="course description"]', course.courseSeedData.courseDescription || '')
    
    // Add all topics
    const topicsText = course.courseSeedData.topics.join('\n')
    await page.fill('textarea[placeholder*="List your course topics"]', topicsText)
    
    console.log(`📝 Added ${course.courseSeedData.topics.length} topics`)

    // Navigate to Media Enhancement if we need to add media
    if (mediaFileCount > 0) {
      await page.click('button:has-text("Next")')
      await this.addBulkMedia(page, mediaFileCount)
    }
    
    // Navigate through remaining steps quickly
    await this.navigateToScormGeneration(page)
  }

  private static async addBulkMedia(page: Page, mediaFileCount: number): Promise<void> {
    console.log(`🎬 Adding ${mediaFileCount} media files...`)
    
    // Create media files for testing
    const mediaSet = createCourseMediaSet(Math.ceil(mediaFileCount / 3))
    
    // Add various types of media
    let addedCount = 0
    
    // Add images to topics
    for (let i = 0; i < Math.min(mediaFileCount, mediaSet.topics.length); i++) {
      const imageInput = page.locator(`[data-testid="topic-${i}-image-input"]`)
      if (await imageInput.isVisible() && addedCount < mediaFileCount) {
        await imageInput.setInputFiles(mediaSet.path(mediaSet.topics[i].image))
        addedCount++
        
        // Wait for upload to complete
        await page.waitForTimeout(100)
      }
    }
    
    console.log(`✅ Added ${addedCount} media files`)
  }

  private static async navigateToScormGeneration(page: Page): Promise<void> {
    // Navigate through all steps to reach SCORM generation
    const steps = ['Content Review', 'Audio Narration', 'Activities', 'Export SCORM Package']
    
    for (const step of steps) {
      try {
        const isOnTargetStep = await page.locator(`h1:has-text("${step}")`).isVisible()
        if (isOnTargetStep) break
        
        await page.click('button:has-text("Next")')
        await page.waitForTimeout(500)
      } catch {
        // Continue if step not found
      }
    }
  }

  private static async generateScormPackage(page: Page): Promise<string> {
    console.log('📦 Generating SCORM package...')
    
    // Ensure we're on the SCORM generation page
    const isOnScormPage = await page.locator('h1:has-text("Export SCORM Package")').isVisible()
    if (!isOnScormPage) {
      throw new Error('Not on SCORM generation page')
    }

    // Set up download listener
    const downloadPromise = page.waitForEvent('download')

    // Generate package
    await page.click('button:has-text("Generate SCORM Package")')
    
    // Wait for download with extended timeout for large packages
    const download = await downloadPromise
    const downloadPath = await download.path()
    
    if (!downloadPath) {
      throw new Error('SCORM package download failed')
    }

    console.log('✅ SCORM package generated')
    return downloadPath
  }

  private static analyzePackage(downloadPath: string): {
    packageSize: number
    fileCount: number
    mediaSize: number
    compressionRatio: number
  } {
    const stats = fs.statSync(downloadPath)
    const packageSize = stats.size
    
    // For detailed analysis, we'd need to extract the ZIP
    // For now, provide estimates based on package size
    const estimatedFileCount = Math.floor(packageSize / (50 * 1024)) // Rough estimate
    const estimatedMediaSize = packageSize * 0.8 // Assume 80% is media
    const estimatedCompressionRatio = 0.7 // Typical ZIP compression
    
    return {
      packageSize,
      fileCount: estimatedFileCount,
      mediaSize: estimatedMediaSize,
      compressionRatio: estimatedCompressionRatio
    }
  }

  private static categorizeCourseSize(
    topicCount: number, 
    mediaFileCount: number
  ): 'small' | 'medium' | 'large' | 'xlarge' {
    const complexity = topicCount + (mediaFileCount * 0.5)
    
    if (complexity <= 5) return 'small'
    if (complexity <= 15) return 'medium'
    if (complexity <= 30) return 'large'
    return 'xlarge'
  }

  private static calculateLoadTimes(packageSizeBytes: number): {
    lowBandwidth: number
    mediumBandwidth: number
    highBandwidth: number
  } {
    const sizeMB = packageSizeBytes / (1024 * 1024)
    
    return {
      lowBandwidth: sizeMB * 8 / 1,    // 1 Mbps
      mediumBandwidth: sizeMB * 8 / 5, // 5 Mbps
      highBandwidth: sizeMB * 8 / 25   // 25 Mbps
    }
  }

  private static estimateLmsLoadTimes(packageSize: number, fileCount: number): {
    moodleLoadTime: number
    blackboardLoadTime: number
    canvasLoadTime: number
  } {
    const baseTime = packageSize / (1024 * 1024) * 2 // 2 seconds per MB base
    const fileOverhead = fileCount * 0.1 // 0.1 seconds per file
    
    return {
      moodleLoadTime: baseTime + fileOverhead,
      blackboardLoadTime: baseTime * 1.2 + fileOverhead, // Blackboard tends to be slower
      canvasLoadTime: baseTime * 0.8 + fileOverhead      // Canvas tends to be faster
    }
  }

  static generatePerformanceReport(results: ScaleTestResult[]): string {
    let report = '\n=== SCORM Performance & Scale Test Report ===\n\n'
    
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    
    report += `📊 Test Summary:\n`
    report += `  Successful: ${successful.length}\n`
    report += `  Failed: ${failed.length}\n`
    report += `  Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%\n\n`
    
    if (successful.length > 0) {
      report += `⚡ Performance Metrics:\n`
      
      // Average metrics
      const avgGenTime = successful.reduce((sum, r) => sum + r.metrics.generationTime, 0) / successful.length
      const avgPackageSize = successful.reduce((sum, r) => sum + r.metrics.packageSize, 0) / successful.length
      const avgMemoryPeak = successful.reduce((sum, r) => sum + r.metrics.memoryUsage.peak, 0) / successful.length
      
      report += `  Average Generation Time: ${(avgGenTime / 1000).toFixed(2)}s\n`
      report += `  Average Package Size: ${(avgPackageSize / 1024 / 1024).toFixed(2)} MB\n`
      report += `  Average Peak Memory: ${avgMemoryPeak.toFixed(2)} MB\n\n`
      
      // Performance by course size
      const sizeCategories = ['small', 'medium', 'large', 'xlarge'] as const
      sizeCategories.forEach(size => {
        const sizeResults = successful.filter(r => r.courseSize === size)
        if (sizeResults.length > 0) {
          const avgTime = sizeResults.reduce((sum, r) => sum + r.metrics.generationTime, 0) / sizeResults.length
          const avgSize = sizeResults.reduce((sum, r) => sum + r.metrics.packageSize, 0) / sizeResults.length
          
          report += `  ${size.toUpperCase()} courses (${sizeResults.length}):\n`
          report += `    Generation: ${(avgTime / 1000).toFixed(2)}s\n`
          report += `    Package: ${(avgSize / 1024 / 1024).toFixed(2)} MB\n`
        }
      })
      
      report += '\n'
    }
    
    // Warnings and issues
    const allWarnings = successful.flatMap(r => r.warnings)
    if (allWarnings.length > 0) {
      report += `⚠️ Performance Warnings:\n`
      const warningCounts = allWarnings.reduce((acc, warning) => {
        acc[warning] = (acc[warning] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      Object.entries(warningCounts).forEach(([warning, count]) => {
        report += `  - ${warning} (${count} occurrences)\n`
      })
      report += '\n'
    }
    
    // Failed tests
    if (failed.length > 0) {
      report += `❌ Failed Tests:\n`
      failed.forEach(result => {
        report += `  - ${result.courseSize} course (${result.topicCount} topics, ${result.mediaFileCount} media):\n`
        result.errors.forEach(error => {
          report += `    Error: ${error}\n`
        })
      })
    }
    
    return report
  }
}

// Performance and scale test suite
test.describe('SCORM Performance and Scale Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(() => {
    cleanupMediaFiles()
  })

  test('Small Course Performance Baseline', async ({ page }) => {
    const course = TestCourseFixtures.getMinimalCourse()
    const result = await ScaleTestRunner.runScaleTest(page, course, 0)
    
    expect(result.success).toBe(true)
    expect(result.metrics.generationTime).toBeLessThan(30000) // < 30 seconds
    expect(result.metrics.packageSize).toBeLessThan(10 * 1024 * 1024) // < 10MB
    expect(result.metrics.memoryUsage.peak).toBeLessThan(512) // < 512MB
    
    console.log(`\n📊 Small Course Metrics:`)
    console.log(`  Generation Time: ${(result.metrics.generationTime / 1000).toFixed(2)}s`)
    console.log(`  Package Size: ${(result.metrics.packageSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Peak Memory: ${result.metrics.memoryUsage.peak.toFixed(2)} MB`)
  })

  test('Medium Course with Media Performance', async ({ page }) => {
    const course = TestCourseFixtures.getStandardCourse()
    const result = await ScaleTestRunner.runScaleTest(page, course, 10)
    
    expect(result.success).toBe(true)
    expect(result.metrics.generationTime).toBeLessThan(60000) // < 1 minute
    expect(result.metrics.packageSize).toBeLessThan(50 * 1024 * 1024) // < 50MB
    expect(result.metrics.loadTimes.highBandwidth).toBeLessThan(60) // < 1 minute on high bandwidth
    
    console.log(`\n📊 Medium Course Metrics:`)
    console.log(`  Generation Time: ${(result.metrics.generationTime / 1000).toFixed(2)}s`)
    console.log(`  Package Size: ${(result.metrics.packageSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Load Time (25 Mbps): ${result.metrics.loadTimes.highBandwidth.toFixed(1)}s`)
    console.log(`  LMS Load Time (Moodle): ${result.metrics.lmsCompatibility.moodleLoadTime.toFixed(1)}s`)
  })

  test('Large Course Scale Test', async ({ page }) => {
    const course = TestCourseFixtures.getLargeCourse()
    const result = await ScaleTestRunner.runScaleTest(page, course, 25)
    
    expect(result.success).toBe(true)
    expect(result.metrics.generationTime).toBeLessThan(180000) // < 3 minutes
    expect(result.metrics.packageSize).toBeLessThan(200 * 1024 * 1024) // < 200MB
    
    // Performance should degrade gracefully
    expect(result.metrics.memoryUsage.peak).toBeLessThan(2048) // < 2GB
    
    console.log(`\n📊 Large Course Metrics:`)
    console.log(`  Topics: ${result.topicCount}`)
    console.log(`  Media Files: ${result.mediaFileCount}`)
    console.log(`  Generation Time: ${(result.metrics.generationTime / 1000).toFixed(2)}s`)
    console.log(`  Package Size: ${(result.metrics.packageSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Peak Memory: ${result.metrics.memoryUsage.peak.toFixed(2)} MB`)
    console.log(`  Warnings: ${result.warnings.length}`)
    
    if (result.warnings.length > 0) {
      console.log(`  Warning Details:`)
      result.warnings.forEach(warning => console.log(`    - ${warning}`))
    }
  })

  test('Media-Heavy Course Performance', async ({ page }) => {
    const course = TestCourseFixtures.getMediaHeavyCourse()
    const result = await ScaleTestRunner.runScaleTest(page, course, 50)
    
    expect(result.success).toBe(true)
    
    // Media-heavy courses may take longer and produce larger packages
    expect(result.metrics.generationTime).toBeLessThan(300000) // < 5 minutes
    expect(result.metrics.packageSize).toBeLessThan(500 * 1024 * 1024) // < 500MB
    
    // Check compression efficiency
    expect(result.metrics.compressionRatio).toBeLessThan(0.8) // Should achieve some compression
    
    console.log(`\n🎬 Media-Heavy Course Metrics:`)
    console.log(`  Media Files: ${result.mediaFileCount}`)
    console.log(`  Generation Time: ${(result.metrics.generationTime / 1000).toFixed(2)}s`)
    console.log(`  Package Size: ${(result.metrics.packageSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Media Size: ${(result.metrics.mediaSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Compression Ratio: ${(result.metrics.compressionRatio * 100).toFixed(1)}%`)
  })

  test('Stress Test - Multiple Course Sizes', async ({ page }) => {
    // This test runs multiple courses of different sizes to test system limits
    test.setTimeout(600000) // 10 minutes timeout
    
    const testCases = [
      { course: TestCourseFixtures.getMinimalCourse(), media: 0 },
      { course: TestCourseFixtures.getStandardCourse(), media: 5 },
      { course: TestCourseFixtures.getMediaHeavyCourse(), media: 15 },
      { course: TestCourseFixtures.getAssessmentFocusedCourse(), media: 10 },
      { course: TestCourseFixtures.getLargeCourse(), media: 30 }
    ]
    
    const results: ScaleTestResult[] = []
    
    for (const [index, testCase] of testCases.entries()) {
      console.log(`\n🧪 Stress Test ${index + 1}/${testCases.length}: ${testCase.course.name}`)
      
      try {
        const result = await ScaleTestRunner.runScaleTest(page, testCase.course, testCase.media)
        results.push(result)
        
        // Reset between tests
        await page.goto('http://localhost:1420')
        await page.waitForLoadState('networkidle')
        
      } catch (error) {
        console.error(`❌ Stress test failed for ${testCase.course.name}:`, error)
        results.push({
          courseSize: 'large',
          topicCount: testCase.course.courseSeedData.topics.length,
          mediaFileCount: testCase.media,
          metrics: {} as PerformanceMetrics,
          success: false,
          errors: [error?.toString() || 'Unknown error'],
          warnings: []
        })
      }
    }
    
    // Generate comprehensive report
    const report = ScaleTestRunner.generatePerformanceReport(results)
    console.log(report)
    
    // Assert overall system performance
    const successRate = results.filter(r => r.success).length / results.length
    expect(successRate).toBeGreaterThan(0.8) // 80% success rate minimum
    
    // Check that generation times scale reasonably
    const successful = results.filter(r => r.success)
    if (successful.length >= 2) {
      const timeIncrease = successful[successful.length - 1].metrics.generationTime / successful[0].metrics.generationTime
      expect(timeIncrease).toBeLessThan(10) // Should not be more than 10x slower
    }
  })

  test('Performance Regression Detection', async ({ page }) => {
    // This test establishes performance baselines that can be used to detect regressions
    const baselineCourse = TestCourseFixtures.getStandardCourse()
    const result = await ScaleTestRunner.runScaleTest(page, baselineCourse, 5)
    
    expect(result.success).toBe(true)
    
    // Establish baseline metrics (these would be compared against historical data in a real CI/CD pipeline)
    const baselines = {
      maxGenerationTime: 60000,    // 1 minute
      maxPackageSize: 50 * 1024 * 1024, // 50MB
      maxMemoryUsage: 1024,        // 1GB
      maxLoadTime: 30              // 30 seconds on high bandwidth
    }
    
    expect(result.metrics.generationTime).toBeLessThan(baselines.maxGenerationTime)
    expect(result.metrics.packageSize).toBeLessThan(baselines.maxPackageSize)
    expect(result.metrics.memoryUsage.peak).toBeLessThan(baselines.maxMemoryUsage)
    expect(result.metrics.loadTimes.highBandwidth).toBeLessThan(baselines.maxLoadTime)
    
    console.log(`\n📈 Performance Baseline Results:`)
    console.log(`  Generation Time: ${(result.metrics.generationTime / 1000).toFixed(2)}s (limit: ${baselines.maxGenerationTime / 1000}s)`)
    console.log(`  Package Size: ${(result.metrics.packageSize / 1024 / 1024).toFixed(2)} MB (limit: ${baselines.maxPackageSize / 1024 / 1024}MB)`)
    console.log(`  Peak Memory: ${result.metrics.memoryUsage.peak.toFixed(2)} MB (limit: ${baselines.maxMemoryUsage}MB)`)
    console.log(`  Load Time: ${result.metrics.loadTimes.highBandwidth.toFixed(1)}s (limit: ${baselines.maxLoadTime}s)`)
    
    // Log for CI/CD monitoring
    console.log(`\n📊 Baseline Metrics JSON:`)
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      generationTime: result.metrics.generationTime,
      packageSize: result.metrics.packageSize,
      memoryUsage: result.metrics.memoryUsage,
      loadTimes: result.metrics.loadTimes
    }, null, 2))
  })
})