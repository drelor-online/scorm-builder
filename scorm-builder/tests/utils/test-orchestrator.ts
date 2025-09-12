import { test, expect, Page } from '@playwright/test'
import { 
  SettingsMatrixGenerator, 
  generateQuickTestSuite, 
  generateComprehensiveTestSuite,
  type SettingsTestCase 
} from './settings-generator'
import { 
  TestCourseFixtures, 
  getAllTestCourses,
  type TestCourseTemplate 
} from '../fixtures/test-courses'
import { 
  EnhancedScormValidator,
  validateScormPackage,
  generateValidationReport,
  type ScormValidationResult 
} from './enhanced-scorm-validator'

export interface TestSuiteConfig {
  name: string
  description: string
  testTypes: Array<'settings' | 'validation' | 'performance' | 'compatibility'>
  courses: TestCourseTemplate[]
  settings: SettingsTestCase[]
  maxDuration: number // minutes
  parallel: boolean
  priorities: Array<'high' | 'medium' | 'low'>
}

export interface TestExecutionResult {
  suiteConfig: TestSuiteConfig
  startTime: Date
  endTime: Date
  totalTests: number
  successfulTests: number
  failedTests: number
  skippedTests: number
  results: Array<{
    testName: string
    course: string
    settings: string
    success: boolean
    duration: number
    validationResult?: ScormValidationResult
    errors: string[]
    warnings: string[]
  }>
  summary: {
    settingsMatrixCoverage: number    // percentage
    courseCoverage: number            // percentage
    performanceBaseline: boolean      // within acceptable limits
    regressionDetected: boolean       // performance regression
  }
}

export class TestOrchestrator {
  
  static getPreDefinedSuites(): Record<string, TestSuiteConfig> {
    return {
      'quick-validation': {
        name: 'Quick Validation Suite',
        description: 'Fast validation of core functionality and high-priority settings',
        testTypes: ['settings', 'validation'],
        courses: [
          TestCourseFixtures.getMinimalCourse(),
          TestCourseFixtures.getStandardCourse()
        ],
        settings: generateQuickTestSuite(),
        maxDuration: 30, // 30 minutes
        parallel: true,
        priorities: ['high']
      },
      
      'comprehensive-testing': {
        name: 'Comprehensive Test Suite',
        description: 'Full matrix testing of all settings combinations and course types',
        testTypes: ['settings', 'validation', 'performance'],
        courses: getAllTestCourses(),
        settings: generateComprehensiveTestSuite().filter(s => s.testPriority !== 'low'),
        maxDuration: 180, // 3 hours
        parallel: false,
        priorities: ['high', 'medium']
      },
      
      'performance-focused': {
        name: 'Performance Testing Suite',
        description: 'Scale testing and performance validation for large courses',
        testTypes: ['performance', 'validation'],
        courses: [
          TestCourseFixtures.getLargeCourse(),
          TestCourseFixtures.getMediaHeavyCourse()
        ],
        settings: [SettingsMatrixGenerator.getTestCaseByName('Complex Integration Test')!],
        maxDuration: 120, // 2 hours
        parallel: false,
        priorities: ['high', 'medium']
      },
      
      'regression-detection': {
        name: 'Regression Detection Suite',
        description: 'Baseline performance and compatibility testing for CI/CD',
        testTypes: ['settings', 'validation', 'performance'],
        courses: [TestCourseFixtures.getStandardCourse()],
        settings: [
          SettingsMatrixGenerator.getTestCaseByName('Audio Completion + Linear Navigation')!,
          SettingsMatrixGenerator.getTestCaseByName('Free Navigation + High Pass Mark')!,
          SettingsMatrixGenerator.getTestCaseByName('Complex Integration Test')!
        ],
        maxDuration: 60, // 1 hour
        parallel: true,
        priorities: ['high']
      },
      
      'compatibility-matrix': {
        name: 'LMS Compatibility Suite',
        description: 'Testing SCORM packages for compatibility across different LMS platforms',
        testTypes: ['validation', 'compatibility'],
        courses: getAllTestCourses(),
        settings: [
          SettingsMatrixGenerator.getDefaultSettings(),
          SettingsMatrixGenerator.getTestCaseByName('Corporate Training Standard')!,
          SettingsMatrixGenerator.getTestCaseByName('Accessibility Focused')!
        ].map(s => typeof s === 'object' && 'name' in s ? s : {
          name: 'Default Settings',
          description: 'Default settings test',
          settings: s as any,
          expectedFeatures: [],
          testPriority: 'medium' as const
        }),
        maxDuration: 90, // 1.5 hours
        parallel: true,
        priorities: ['high', 'medium']
      }
    }
  }

  static generateCustomSuite(config: Partial<TestSuiteConfig>): TestSuiteConfig {
    const defaults: TestSuiteConfig = {
      name: 'Custom Test Suite',
      description: 'User-defined test configuration',
      testTypes: ['settings', 'validation'],
      courses: [TestCourseFixtures.getStandardCourse()],
      settings: generateQuickTestSuite(),
      maxDuration: 60,
      parallel: true,
      priorities: ['high', 'medium']
    }

    return { ...defaults, ...config }
  }

  static estimateExecutionTime(config: TestSuiteConfig): {
    estimatedMinutes: number
    testCount: number
    breakdown: {
      settingsTests: number
      validationTests: number
      performanceTests: number
      compatibilityTests: number
    }
  } {
    const breakdown = {
      settingsTests: 0,
      validationTests: 0,
      performanceTests: 0,
      compatibilityTests: 0
    }

    let totalTests = 0
    let baseTime = 0

    // Calculate test counts
    config.testTypes.forEach(type => {
      switch (type) {
        case 'settings':
          breakdown.settingsTests = config.settings.length * config.courses.length
          totalTests += breakdown.settingsTests
          baseTime += breakdown.settingsTests * 2 // 2 minutes per settings test
          break
        case 'validation':
          breakdown.validationTests = config.courses.length
          totalTests += breakdown.validationTests
          baseTime += breakdown.validationTests * 3 // 3 minutes per validation test
          break
        case 'performance':
          breakdown.performanceTests = config.courses.length
          totalTests += breakdown.performanceTests
          baseTime += breakdown.performanceTests * 10 // 10 minutes per performance test
          break
        case 'compatibility':
          breakdown.compatibilityTests = config.settings.length * config.courses.length
          totalTests += breakdown.compatibilityTests
          baseTime += breakdown.compatibilityTests * 1.5 // 1.5 minutes per compatibility test
          break
      }
    })

    // Adjust for parallelization
    const parallelFactor = config.parallel ? 0.6 : 1.0 // 40% time reduction if parallel
    const estimatedMinutes = Math.ceil(baseTime * parallelFactor)

    return {
      estimatedMinutes,
      testCount: totalTests,
      breakdown
    }
  }

  static generateTestPlan(config: TestSuiteConfig): string {
    const estimate = this.estimateExecutionTime(config)
    
    let plan = `\n=== SCORM Test Execution Plan ===\n\n`
    plan += `📋 Suite: ${config.name}\n`
    plan += `📝 Description: ${config.description}\n\n`
    
    plan += `⏱️ Execution Estimate:\n`
    plan += `  Total Tests: ${estimate.testCount}\n`
    plan += `  Estimated Duration: ${estimate.estimatedMinutes} minutes\n`
    plan += `  Parallel Execution: ${config.parallel ? 'Yes' : 'No'}\n`
    plan += `  Max Duration: ${config.maxDuration} minutes\n\n`
    
    plan += `🧪 Test Breakdown:\n`
    plan += `  Settings Matrix Tests: ${estimate.breakdown.settingsTests}\n`
    plan += `  Deep Validation Tests: ${estimate.breakdown.validationTests}\n`
    plan += `  Performance Tests: ${estimate.breakdown.performanceTests}\n`
    plan += `  Compatibility Tests: ${estimate.breakdown.compatibilityTests}\n\n`
    
    plan += `📚 Test Coverage:\n`
    plan += `  Course Types: ${config.courses.length}\n`
    config.courses.forEach(course => {
      plan += `    - ${course.name} (${course.courseSeedData.topics.length} topics)\n`
    })
    
    plan += `  Settings Combinations: ${config.settings.length}\n`
    const priorityCounts = config.settings.reduce((acc, s) => {
      acc[s.testPriority] = (acc[s.testPriority] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(priorityCounts).forEach(([priority, count]) => {
      plan += `    - ${priority} priority: ${count}\n`
    })
    
    plan += `\n🎯 Test Types:\n`
    config.testTypes.forEach(type => {
      plan += `  - ${type.charAt(0).toUpperCase() + type.slice(1)} Testing\n`
    })
    
    if (estimate.estimatedMinutes > config.maxDuration) {
      plan += `\n⚠️ WARNING: Estimated duration (${estimate.estimatedMinutes} min) exceeds maximum (${config.maxDuration} min)\n`
      plan += `Consider reducing test scope or increasing time limit.\n`
    }
    
    return plan
  }

  static validateTestSuite(config: TestSuiteConfig): {
    valid: boolean
    issues: string[]
    warnings: string[]
  } {
    const issues: string[] = []
    const warnings: string[] = []

    // Basic validation
    if (config.courses.length === 0) {
      issues.push('No courses specified')
    }

    if (config.settings.length === 0) {
      issues.push('No settings configurations specified')
    }

    if (config.testTypes.length === 0) {
      issues.push('No test types specified')
    }

    if (config.maxDuration <= 0) {
      issues.push('Invalid maximum duration')
    }

    // Performance warnings
    const estimate = this.estimateExecutionTime(config)
    
    if (estimate.estimatedMinutes > config.maxDuration) {
      warnings.push(`Estimated duration (${estimate.estimatedMinutes} min) exceeds limit (${config.maxDuration} min)`)
    }

    if (estimate.testCount > 1000) {
      warnings.push(`Large number of tests (${estimate.testCount}) may impact performance`)
    }

    // Compatibility warnings
    if (config.testTypes.includes('performance') && config.parallel) {
      warnings.push('Performance tests may be unreliable when run in parallel')
    }

    if (config.courses.some(c => c.name.includes('Large')) && !config.testTypes.includes('performance')) {
      warnings.push('Large courses detected but performance testing not enabled')
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    }
  }

  static generatePlaywrightTestFile(config: TestSuiteConfig): string {
    const validation = this.validateTestSuite(config)
    if (!validation.valid) {
      throw new Error(`Invalid test suite configuration: ${validation.issues.join(', ')}`)
    }

    let testCode = `// Auto-generated SCORM test suite: ${config.name}\n`
    testCode += `// Generated on: ${new Date().toISOString()}\n\n`
    
    testCode += `import { test, expect } from '@playwright/test'\n`
    testCode += `import { cleanupMediaFiles } from '../fixtures/test-media'\n\n`
    
    testCode += `test.describe('${config.name}', () => {\n`
    testCode += `  test.beforeEach(async ({ page }) => {\n`
    testCode += `    await page.goto('http://localhost:1420')\n`
    testCode += `    await page.waitForLoadState('networkidle')\n`
    testCode += `  })\n\n`
    
    testCode += `  test.afterEach(() => {\n`
    testCode += `    cleanupMediaFiles()\n`
    testCode += `  })\n\n`

    // Generate test cases based on configuration
    config.courses.forEach((course, courseIndex) => {
      config.settings.forEach((settingsCase, settingsIndex) => {
        const testName = `${course.name} - ${settingsCase.name}`
        const testId = `course${courseIndex}_settings${settingsIndex}`
        
        testCode += `  test('${testName}', async ({ page }) => {\n`
        testCode += `    // Test implementation would go here\n`
        testCode += `    // This is a generated test template\n`
        testCode += `    console.log('Running: ${testName}')\n`
        testCode += `    expect(true).toBe(true) // Placeholder assertion\n`
        testCode += `  })\n\n`
      })
    })
    
    testCode += `})\n`
    
    return testCode
  }
}

// Export convenience functions for common test scenarios
export const getQuickValidationSuite = () => TestOrchestrator.getPreDefinedSuites()['quick-validation']
export const getComprehensiveSuite = () => TestOrchestrator.getPreDefinedSuites()['comprehensive-testing']
export const getPerformanceSuite = () => TestOrchestrator.getPreDefinedSuites()['performance-focused']
export const getRegressionSuite = () => TestOrchestrator.getPreDefinedSuites()['regression-detection']

// CLI helper for generating test reports
export function generateSuiteExecutionReport(results: TestExecutionResult): string {
  let report = `\n=== SCORM Test Suite Execution Report ===\n\n`
  
  report += `📋 Suite: ${results.suiteConfig.name}\n`
  report += `⏱️ Duration: ${((results.endTime.getTime() - results.startTime.getTime()) / 1000 / 60).toFixed(2)} minutes\n`
  report += `📊 Results: ${results.successfulTests}/${results.totalTests} passed (${((results.successfulTests / results.totalTests) * 100).toFixed(1)}%)\n\n`
  
  report += `✅ Successful Tests: ${results.successfulTests}\n`
  report += `❌ Failed Tests: ${results.failedTests}\n`
  report += `⏸️ Skipped Tests: ${results.skippedTests}\n\n`
  
  report += `📈 Coverage Analysis:\n`
  report += `  Settings Matrix: ${results.summary.settingsMatrixCoverage.toFixed(1)}%\n`
  report += `  Course Types: ${results.summary.courseCoverage.toFixed(1)}%\n`
  report += `  Performance Baseline: ${results.summary.performanceBaseline ? '✅ Met' : '❌ Failed'}\n`
  report += `  Regression Detected: ${results.summary.regressionDetected ? '⚠️ Yes' : '✅ None'}\n\n`
  
  if (results.failedTests > 0) {
    report += `❌ Failed Test Details:\n`
    results.results.filter(r => !r.success).forEach(result => {
      report += `  - ${result.testName}\n`
      report += `    Course: ${result.course}\n`
      report += `    Settings: ${result.settings}\n`
      report += `    Duration: ${(result.duration / 1000).toFixed(2)}s\n`
      result.errors.forEach(error => {
        report += `    Error: ${error}\n`
      })
    })
    report += '\n'
  }
  
  const warnings = results.results.flatMap(r => r.warnings)
  if (warnings.length > 0) {
    report += `⚠️ Warnings (${warnings.length}):\n`
    warnings.slice(0, 10).forEach(warning => { // Limit to first 10 warnings
      report += `  - ${warning}\n`
    })
    if (warnings.length > 10) {
      report += `  ... and ${warnings.length - 10} more warnings\n`
    }
  }
  
  return report
}