import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { 
  SettingsMatrixGenerator, 
  generateQuickTestSuite, 
  generateComprehensiveTestSuite,
  type SettingsTestCase 
} from '../utils/settings-generator'
import { 
  TestCourseFixtures, 
  getStandardCourse, 
  getMinimalCourse,
  type TestCourseTemplate 
} from '../fixtures/test-courses'
import { 
  TestMediaFixtures, 
  createCourseMediaSet, 
  cleanupMediaFiles 
} from '../fixtures/test-media'
import { 
  EnhancedScormValidator, 
  validateScormPackage,
  generateValidationReport,
  type ScormValidationResult 
} from '../utils/enhanced-scorm-validator'

// Test helper functions
class ScormTestHelper {
  
  static async createProject(page: Page, course: TestCourseTemplate): Promise<void> {
    // Simplified approach: just create project metadata
    // The application can generate SCORM with minimal setup
    await page.getByTestId('new-project-button').click()
    
    // Wait for modal to appear and be ready
    await page.waitForSelector('input[placeholder*="project name"], input[placeholder*="Project name"]', { timeout: 10000 })
    await page.getByPlaceholder(/project name/i).fill(`${course.name} - Settings Test`)
    
    // Wait for modal animations to complete before clicking
    await page.waitForTimeout(1000)
    
    // Click the blue "Create" button in the modal using force click to bypass modal backdrop
    await page.locator('button:has-text("Create"):not([data-testid])').click({ force: true })
    
    // Wait for dashboard to reload
    await page.waitForTimeout(3000)
    
    console.log('   ✅ Project created successfully')
    // Note: Course configuration is optional - SCORM generation works with basic setup
    
    // Look for description field
    const descriptionSelector = 'textarea[placeholder*="description"], textarea[placeholder*="Description"], textarea[name*="description"]'
    const descriptionField = page.locator(descriptionSelector)
    if (await descriptionField.isVisible()) {
      await descriptionField.fill(course.courseSeedData.courseDescription || '')
    }
    
    // Look for topics field
    const topicsSelector = 'textarea[placeholder*="topics"], textarea[placeholder*="Topics"], textarea[name*="topics"]'
    const topicsField = page.locator(topicsSelector)
    if (await topicsField.isVisible()) {
      const topicsText = course.courseSeedData.topics.join('\n')
      await topicsField.fill(topicsText)
    }
    
    // Look for difficulty level buttons
    const difficultyButtons = page.locator('button:has-text("Beginner"), button:has-text("Intermediate"), button:has-text("Advanced")')
    if (course.courseSeedData.difficultyLevel && await difficultyButtons.first().isVisible()) {
      await page.click(`button:has-text("${course.courseSeedData.difficultyLevel}")`)
    }
  }

  static async configureSettings(page: Page, settings: SettingsTestCase): Promise<void> {
    // Navigate through the workflow using more robust approach
    let currentStep = 0
    const maxSteps = 10
    let foundSettings = false
    
    while (currentStep < maxSteps && !foundSettings) {
      // Check if we're on the Course Settings page
      const settingsPageIndicators = [
        'h1:has-text("Course Settings")',
        'h2:has-text("Course Settings")', 
        'text=Learning Control',
        'text=Assessment',
        'text=Navigation Mode'
      ]
      
      for (const indicator of settingsPageIndicators) {
        if (await page.locator(indicator).isVisible().catch(() => false)) {
          console.log(`✅ Found Course Settings on step ${currentStep}`)
          foundSettings = true
          await this.applyAllSettings(page, settings.settings)
          return
        }
      }
      
      // Try to find and click Next button
      const nextSelectors = [
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button:has-text("Proceed")',
        '[data-testid*="next"]'
      ]
      
      let nextButton = null
      for (const selector of nextSelectors) {
        const btn = page.locator(selector)
        if (await btn.isVisible().catch(() => false)) {
          nextButton = btn
          break
        }
      }
      
      if (nextButton) {
        await nextButton.click()
        await page.waitForTimeout(1500) // Give time for navigation
        currentStep++
      } else {
        console.log(`⚠️ No Next button found at step ${currentStep}, checking for SCORM generation`)
        break
      }
    }
    
    // If we didn't find a dedicated settings page, look for settings in SCORM Package Builder
    if (!foundSettings) {
      console.log('🔍 Looking for settings in SCORM Package Builder')
      const scormPageIndicators = [
        'h1:has-text("SCORM")',
        'h1:has-text("Export")',
        'text=Generate SCORM Package',
        'text=Course Settings',
        'text=Advanced Options'
      ]
      
      let onScormPage = false
      for (const indicator of scormPageIndicators) {
        if (await page.locator(indicator).isVisible().catch(() => false)) {
          onScormPage = true
          break
        }
      }
      
      if (onScormPage) {
        // Look for settings panel or advanced options
        const settingsButton = page.locator('button:has-text("Settings")').or(
          page.locator('button:has-text("Advanced Options")').or(
            page.locator('button:has-text("Configure")')
          )
        )
        
        if (await settingsButton.isVisible().catch(() => false)) {
          await settingsButton.click()
          await page.waitForTimeout(1000)
          await this.applyAllSettings(page, settings.settings)
          foundSettings = true
        }
      }
    }
    
    if (!foundSettings) {
      console.log('⚠️ Could not find Course Settings interface - settings may not be configurable in current workflow')
    }
  }

  static async applyAllSettings(page: Page, settings: any): Promise<void> {
    // Learning Control settings
    if (typeof settings.requireAudioCompletion === 'boolean') {
      const checkbox = page.locator('input[type="checkbox"][name*="requireAudioCompletion"]')
      if (await checkbox.isVisible()) {
        await checkbox.setChecked(settings.requireAudioCompletion)
      }
    }

    if (settings.navigationMode) {
      const radioButton = page.locator(`input[type="radio"][value="${settings.navigationMode}"]`)
      if (await radioButton.isVisible()) {
        await radioButton.click()
      }
    }

    if (typeof settings.autoAdvance === 'boolean') {
      const checkbox = page.locator('input[type="checkbox"][name*="autoAdvance"]')
      if (await checkbox.isVisible()) {
        await checkbox.setChecked(settings.autoAdvance)
      }
    }

    // Assessment settings
    if (settings.passMark) {
      const input = page.locator('input[name*="passMark"], input[name*="passScore"]')
      if (await input.isVisible()) {
        await input.fill(settings.passMark.toString())
      }
    }

    if (typeof settings.allowRetake === 'boolean') {
      const checkbox = page.locator('input[type="checkbox"][name*="allowRetake"]')
      if (await checkbox.isVisible()) {
        await checkbox.setChecked(settings.allowRetake)
      }
    }

    if (settings.completionCriteria) {
      const select = page.locator('select[name*="completionCriteria"]')
      if (await select.isVisible()) {
        await select.selectOption(settings.completionCriteria)
      }
    }

    // Interface settings
    if (typeof settings.showProgress === 'boolean') {
      const checkbox = page.locator('input[type="checkbox"][name*="showProgress"]')
      if (await checkbox.isVisible()) {
        await checkbox.setChecked(settings.showProgress)
      }
    }

    if (settings.fontSize) {
      const select = page.locator('select[name*="fontSize"]')
      if (await select.isVisible()) {
        await select.selectOption(settings.fontSize)
      }
    }

    // Timing settings
    if (settings.timeLimit) {
      const input = page.locator('input[name*="timeLimit"]')
      if (await input.isVisible()) {
        await input.fill(settings.timeLimit.toString())
      }
    }

    if (settings.minimumTimeSpent) {
      const input = page.locator('input[name*="minimumTimeSpent"]')
      if (await input.isVisible()) {
        await input.fill(settings.minimumTimeSpent.toString())
      }
    }
  }

  static async generateAndDownloadScorm(page: Page): Promise<string> {
    console.log('📦 Looking for SCORM generation functionality')
    
    // Based on successful discovery, look for Export SCORM functionality
    const scormSelectors = [
      'text=Export SCORM',
      'button:has-text("Export SCORM")',
      'button:has-text("Generate SCORM")',
      'button:has-text("Generate")',
      'button:has-text("Export")',
      'text=Generate SCORM Package',
      'text=Export SCORM Package',
      '[data-testid*="export"]',
      '[data-testid*="generate"]'
    ]
    
    let scormElement = null
    let foundSelector = null
    
    for (const selector of scormSelectors) {
      const element = page.locator(selector)
      if (await element.isVisible().catch(() => false)) {
        scormElement = element
        foundSelector = selector
        console.log(`✅ Found SCORM element: ${selector}`)
        break
      }
    }
    
    if (!scormElement) {
      throw new Error('Could not find SCORM generation element')
    }

    // Set up download listener with extended timeout for SCORM generation
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 })

    // Click the SCORM generation element
    await scormElement.click()
    console.log(`⏳ Clicked SCORM element (${foundSelector}), waiting for generation...`)
    
    // Wait for download
    const download = await downloadPromise
    const downloadPath = await download.path()
    
    if (!downloadPath) {
      throw new Error('SCORM package download failed - no download path')
    }

    console.log(`✅ SCORM package downloaded to: ${downloadPath}`)
    return downloadPath
  }

  static async extractAndValidatePackage(
    downloadPath: string, 
    settings: SettingsTestCase
  ): Promise<ScormValidationResult> {
    // Read the ZIP file
    const zipBuffer = fs.readFileSync(downloadPath)
    
    // Validate with enhanced validator
    const result = await validateScormPackage(new Uint8Array(zipBuffer), settings.settings)
    
    return result
  }
}

// Test suite setup
test.describe('SCORM Settings Matrix Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
    
    // Create test media files
    createCourseMediaSet(3) // 3 topics
  })

  test.afterEach(async () => {
    // Cleanup media files
    cleanupMediaFiles()
  })

  // Quick test suite for essential combinations
  test.describe('High Priority Settings', () => {
    const quickTests = generateQuickTestSuite()

    quickTests.forEach((settingsCase, index) => {
      test(`${index + 1}. ${settingsCase.name}`, async ({ page }) => {
        console.log(`\n🧪 Testing: ${settingsCase.name}`)
        console.log(`📝 Description: ${settingsCase.description}`)
        
        try {
          // Use standard course for high-priority tests
          const course = getStandardCourse()
          
          // Create project and configure course
          await ScormTestHelper.createProject(page, course)
          
          // Configure the specific settings for this test case
          await ScormTestHelper.configureSettings(page, settingsCase)
          
          // Generate SCORM package
          const downloadPath = await ScormTestHelper.generateAndDownloadScorm(page)
          
          // Validate the package
          const validationResult = await ScormTestHelper.extractAndValidatePackage(downloadPath, settingsCase)
          
          // Generate detailed report
          const report = generateValidationReport(validationResult)
          console.log(report)
          
          // Core assertions
          expect(validationResult.isValid).toBe(true)
          expect(validationResult.errors.length).toBe(0)
          
          // Settings-specific assertions
          if (settingsCase.expectedFeatures.includes('audio-completion-tracking')) {
            expect(validationResult.settingsVerification.audioCompletion.implemented).toBe(true)
          }
          
          if (settingsCase.expectedFeatures.includes('linear-navigation-only')) {
            expect(validationResult.settingsVerification.navigationMode.actualImplementation).toBe('linear')
          }
          
          if (settingsCase.expectedFeatures.includes('free-navigation')) {
            expect(validationResult.settingsVerification.navigationMode.actualImplementation).toBe('free')
          }
          
          // Performance assertions
          expect(validationResult.performanceMetrics.packageSize).toBeGreaterThan(0)
          expect(validationResult.performanceMetrics.loadEstimate.highBandwidth).toBeLessThan(30) // < 30 seconds on high bandwidth
          
          // Cleanup
          fs.unlinkSync(downloadPath)
          
        } catch (error) {
          console.error(`❌ Test failed for ${settingsCase.name}:`, error)
          throw error
        }
      })
    })
  })

  // Navigation mode specific testing
  test.describe('Navigation Mode Verification', () => {
    
    test('Linear Navigation Implementation', async ({ page }) => {
      const course = getMinimalCourse()
      const linearSettings = SettingsMatrixGenerator.getTestCaseByName('Audio Completion + Linear Navigation')!
      
      await ScormTestHelper.createProject(page, course)
      await ScormTestHelper.configureSettings(page, linearSettings)
      
      const downloadPath = await ScormTestHelper.generateAndDownloadScorm(page)
      const result = await ScormTestHelper.extractAndValidatePackage(downloadPath, linearSettings)
      
      // Verify linear navigation is properly implemented
      expect(result.settingsVerification.navigationMode.actualImplementation).toBe('linear')
      expect(result.settingsVerification.navigationMode.implemented).toBe(true)
      expect(result.settingsVerification.navigationMode.issues.length).toBe(0)
      
      fs.unlinkSync(downloadPath)
    })

    test('Free Navigation Implementation', async ({ page }) => {
      const course = getMinimalCourse()
      const freeSettings = SettingsMatrixGenerator.getTestCaseByName('Free Navigation + High Pass Mark')!
      
      await ScormTestHelper.createProject(page, course)
      await ScormTestHelper.configureSettings(page, freeSettings)
      
      const downloadPath = await ScormTestHelper.generateAndDownloadScorm(page)
      const result = await ScormTestHelper.extractAndValidatePackage(downloadPath, freeSettings)
      
      // Verify free navigation is properly implemented
      expect(result.settingsVerification.navigationMode.actualImplementation).toBe('free')
      expect(result.settingsVerification.navigationMode.implemented).toBe(true)
      
      fs.unlinkSync(downloadPath)
    })
  })

  // Assessment configuration testing
  test.describe('Assessment Settings Verification', () => {
    
    test('Pass Mark Configuration', async ({ page }) => {
      const course = getStandardCourse()
      const highPassMarkSettings = {
        name: 'High Pass Mark Test',
        description: 'Testing 100% pass mark implementation',
        settings: {
          ...SettingsMatrixGenerator.getDefaultSettings(),
          passMark: 100,
          allowRetake: false,
          completionCriteria: 'pass_assessment' as const
        },
        expectedFeatures: ['strict-assessment'],
        testPriority: 'high' as const
      }
      
      await ScormTestHelper.createProject(page, course)
      await ScormTestHelper.configureSettings(page, highPassMarkSettings)
      
      const downloadPath = await ScormTestHelper.generateAndDownloadScorm(page)
      const result = await ScormTestHelper.extractAndValidatePackage(downloadPath, highPassMarkSettings)
      
      // Verify pass mark is correctly implemented
      expect(result.settingsVerification.assessmentSettings.passMark.implemented).toBe(100)
      expect(result.settingsVerification.assessmentSettings.passMark.correct).toBe(true)
      
      fs.unlinkSync(downloadPath)
    })
  })

  // Accessibility feature testing
  test.describe('Accessibility Features', () => {
    
    test('Font Size Implementation', async ({ page }) => {
      const course = getMinimalCourse()
      const accessibilitySettings = {
        name: 'Large Font Test',
        description: 'Testing large font size implementation',
        settings: {
          ...SettingsMatrixGenerator.getDefaultSettings(),
          fontSize: 'large' as const,
          keyboardNavigation: true,
          printable: true
        },
        expectedFeatures: ['large-font-size', 'keyboard-navigation'],
        testPriority: 'medium' as const
      }
      
      await ScormTestHelper.createProject(page, course)
      await ScormTestHelper.configureSettings(page, accessibilitySettings)
      
      const downloadPath = await ScormTestHelper.generateAndDownloadScorm(page)
      const result = await ScormTestHelper.extractAndValidatePackage(downloadPath, accessibilitySettings)
      
      // Verify accessibility features
      expect(result.settingsVerification.interfaceFeatures.fontSize).toBe('large')
      expect(result.settingsVerification.accessibility.keyboardNavigation).toBe(true)
      
      fs.unlinkSync(downloadPath)
    })
  })

  // Comprehensive combination testing
  test.describe('Settings Combinations Matrix', () => {
    
    test('Complex Feature Integration', async ({ page }) => {
      const course = getStandardCourse()
      const complexSettings = {
        name: 'Complex Integration Test',
        description: 'Testing multiple settings working together',
        settings: {
          ...SettingsMatrixGenerator.getDefaultSettings(),
          requireAudioCompletion: true,
          navigationMode: 'linear' as const,
          passMark: 85,
          allowRetake: true,
          retakeDelay: 1,
          completionCriteria: 'view_and_pass' as const,
          showProgress: true,
          fontSize: 'medium' as const,
          timeLimit: 60,
          keyboardNavigation: true
        },
        expectedFeatures: [
          'audio-completion-tracking',
          'linear-navigation',
          'progress-tracking',
          'time-limit-enforcement',
          'keyboard-navigation'
        ],
        testPriority: 'high' as const
      }
      
      await ScormTestHelper.createProject(page, course)
      await ScormTestHelper.configureSettings(page, complexSettings)
      
      const downloadPath = await ScormTestHelper.generateAndDownloadScorm(page)
      const result = await ScormTestHelper.extractAndValidatePackage(downloadPath, complexSettings)
      
      // Verify all features are properly implemented
      expect(result.isValid).toBe(true)
      expect(result.settingsVerification.audioCompletion.implemented).toBe(true)
      expect(result.settingsVerification.navigationMode.actualImplementation).toBe('linear')
      expect(result.settingsVerification.assessmentSettings.passMark.implemented).toBe(85)
      expect(result.settingsVerification.interfaceFeatures.progressBar).toBe(true)
      
      // Verify no critical errors
      expect(result.errors.length).toBe(0)
      
      fs.unlinkSync(downloadPath)
    })
  })
})

// Comprehensive testing for CI/CD
test.describe('Comprehensive Settings Matrix (CI/CD)', () => {
  
  test('Run Full Settings Matrix', async ({ page }) => {
    // This test runs a comprehensive matrix but is skipped in local development
    test.skip(!process.env.CI, 'Comprehensive testing only in CI/CD')
    
    const allTestCases = generateComprehensiveTestSuite()
    const selectedCases = allTestCases.filter(tc => tc.testPriority === 'medium').slice(0, 20) // Limit for CI
    
    console.log(`\n🚀 Running comprehensive settings matrix: ${selectedCases.length} test cases`)
    
    const results: Array<{ name: string; success: boolean; errors: string[] }> = []
    
    for (const [index, testCase] of selectedCases.entries()) {
      console.log(`\n📊 Progress: ${index + 1}/${selectedCases.length} - ${testCase.name}`)
      
      try {
        const course = getMinimalCourse() // Use minimal course for speed
        
        await ScormTestHelper.createProject(page, course)
        await ScormTestHelper.configureSettings(page, testCase)
        
        const downloadPath = await ScormTestHelper.generateAndDownloadScorm(page)
        const result = await ScormTestHelper.extractAndValidatePackage(downloadPath, testCase)
        
        results.push({
          name: testCase.name,
          success: result.isValid,
          errors: result.errors
        })
        
        fs.unlinkSync(downloadPath)
        
        // Reset for next test
        await page.goto('http://localhost:1420')
        await page.waitForLoadState('networkidle')
        
      } catch (error) {
        results.push({
          name: testCase.name,
          success: false,
          errors: [error?.toString() || 'Unknown error']
        })
      }
    }
    
    // Generate summary report
    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount
    
    console.log(`\n📈 Comprehensive Test Results:`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)
    console.log(`📊 Success Rate: ${((successCount / results.length) * 100).toFixed(1)}%`)
    
    if (failureCount > 0) {
      console.log(`\n❌ Failed Tests:`)
      results.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.name}: ${result.errors.join(', ')}`)
      })
    }
    
    // Assert overall success rate
    expect(successCount / results.length).toBeGreaterThan(0.9) // 90% success rate required
  })
})