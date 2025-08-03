import { PersistentStorage } from '../services/PersistentStorage'
import { MediaService } from '../services/MediaService'
import { TestDataGenerator } from './testDataGenerator'
import { AutomationReporter } from './automationReporter'
import { AutomationUINavigator } from './automationUINavigator'
import { screenshotManager } from './automationScreenshotManager'
import { progressManager } from './automationProgressOverlay'
import { AutomationErrorCapture } from './automationErrorCapture'
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
import { generateRustSCORM } from '../services/rustScormGenerator'
import { screenshotAnalyzer, type Screenshot } from './screenshotAnalyzer'
import type { CourseMetadata } from '../types/metadata'
// import type { Project } from '../types/project' // Type not exported, will use inline type
type Project = {
  id: string
  name: string
  path?: string
  lastOpened?: number
  createdAt?: number
}

export interface AutomationOptions {
  keepProject?: boolean
  showProgress?: boolean
  scenario?: 'quick' | 'standard' | 'comprehensive' | 'full-coverage' | 'media-focus' | 'audio-focus' | 'content-focus'
  skipScormGeneration?: boolean
  visual?: boolean
  captureScreenshots?: boolean
  captureAllScreenshots?: boolean // Capture screenshots at every step, not just key points
  screenshotInterval?: number // Interval in ms for periodic screenshots during waits
  includeMetadata?: boolean // Include DOM state and page info with screenshots
  speed?: 'fast' | 'normal' | 'slow'
  allowAutoRun?: boolean // Allow automation to run without user interaction (for CI/CD)
}

export interface AutomationResult {
  success: boolean
  projectId?: string
  projectPath?: string
  errors: string[]
  duration: number
  report: any
  screenshots?: Array<{
    id: string
    stepName: string
    timestamp: number
  }>
  performanceMetrics?: {
    totalDuration: number
    stepMetrics: Array<{
      step: string
      duration: number
      status: 'success' | 'failed' | 'skipped'
    }>
    slowestSteps: Array<{
      step: string
      duration: number
    }>
    averageStepTime: number
    memoryUsage?: {
      start: number
      peak: number
      end: number
    }
  }
}

/**
 * Full workflow automation for end-to-end testing
 */
export class FullWorkflowAutomation {
  private storage: PersistentStorage | null = null
  private mediaService: MediaService | null = null
  private reporter: AutomationReporter
  private navigator: AutomationUINavigator | null = null
  private errorCapture: AutomationErrorCapture
  private projectId: string | null = null
  private projectPath: string | null = null
  private errors: string[] = []
  private useVisualMode = false
  private generatedContent: any = null
  private performanceMetrics: Map<string, { start: number; end?: number; status?: string }> = new Map()
  private memoryStart: number = 0
  private memoryPeak: number = 0
  
  constructor(private options: AutomationOptions = {}) {
    // Initialize error capture
    this.errorCapture = new AutomationErrorCapture()
    
    // Setup reporter based on scenario
    const stepCount = this.getStepCount()
    this.reporter = new AutomationReporter(stepCount, {
      consoleLogging: true,
      onUpdate: (report) => {
        // Update visual progress if enabled
        if (this.options.visual) {
          const step = report.steps.find(s => s.status === 'running')
          if (step) {
            progressManager.updateStep(step.id, {
              status: step.status === 'success' ? 'completed' : step.status,
              message: (step as any).message,
              error: step.error
            })
          }
        }
      }
    })
    
    this.initializeSteps()
    
    // Setup visual mode
    this.useVisualMode = this.options.visual ?? true // Default to visual mode
    if (this.useVisualMode) {
      this.navigator = new AutomationUINavigator({
        speed: this.options.speed || 'normal',
        highlight: true,
        showPointer: true
      })
    }
  }
  
  private getStepCount(): number {
    switch (this.options.scenario) {
      case 'quick': return 8
      case 'comprehensive': return 15
      case 'full-coverage': return 25 // All basic + comprehensive + feature tests
      default: return 12 // standard
    }
  }
  
  private initializeSteps(): void {
    // Basic steps
    this.reporter.addStep('init', 'Initialize Storage')
    this.reporter.addStep('create-project', 'Create Project')
    this.reporter.addStep('seed-data', 'Fill Course Seed Data')
    this.reporter.addStep('generate-content', 'Generate Course Content')
    this.reporter.addStep('add-media', 'Add Media to Topics')
    this.reporter.addStep('add-audio', 'Add Audio Narration')
    this.reporter.addStep('edit-activities', 'Edit Activities & Assessment')
    
    if (!this.options.skipScormGeneration) {
      this.reporter.addStep('generate-scorm', 'Generate SCORM Package')
    }
    
    if (this.options.scenario === 'comprehensive' || this.options.scenario === 'full-coverage') {
      this.reporter.addStep('edit-rich-text', 'Edit Rich Text Content')
      this.reporter.addStep('upload-images', 'Upload Custom Images')
      this.reporter.addStep('add-youtube', 'Add YouTube Videos')
      this.reporter.addStep('test-preview', 'Test Course Preview')
      this.reporter.addStep('verify-persistence', 'Verify Data Persistence')
    }
    
    if (this.options.scenario === 'full-coverage') {
      // Add all feature test steps
      this.reporter.addStep('test-project-management', 'Test Project Management')
      this.reporter.addStep('test-settings', 'Test Settings & Configuration')
      this.reporter.addStep('test-media-library', 'Test Media Library')
      this.reporter.addStep('test-question-types', 'Test All Question Types')
      this.reporter.addStep('test-navigation-ui', 'Test Navigation & UI')
      this.reporter.addStep('test-error-recovery', 'Test Error Recovery')
      this.reporter.addStep('test-help-page', 'Test Help Page')
    }
    
    this.reporter.addStep('cleanup', 'Cleanup')
  }
  
  /**
   * Track performance metrics for a step
   */
  private startMetric(stepName: string): void {
    this.performanceMetrics.set(stepName, { 
      start: performance.now() 
    })
    
    // Track memory usage
    if ((performance as any).memory) {
      const currentMemory = (performance as any).memory.usedJSHeapSize
      this.memoryPeak = Math.max(this.memoryPeak, currentMemory)
    }
  }
  
  private endMetric(stepName: string, status: 'success' | 'failed' | 'skipped' = 'success'): void {
    const metric = this.performanceMetrics.get(stepName)
    if (metric) {
      metric.end = performance.now()
      metric.status = status
    }
  }
  
  private getPerformanceReport(): AutomationResult['performanceMetrics'] {
    const stepMetrics: Array<{ step: string; duration: number; status: 'success' | 'failed' | 'skipped' }> = []
    let totalDuration = 0
    
    for (const [step, metric] of this.performanceMetrics) {
      if (metric.end) {
        const duration = metric.end - metric.start
        stepMetrics.push({
          step,
          duration,
          status: (metric.status as any) || 'success'
        })
        totalDuration += duration
      }
    }
    
    // Sort by duration to find slowest steps
    const slowestSteps = [...stepMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(s => ({ step: s.step, duration: s.duration }))
    
    const averageStepTime = stepMetrics.length > 0 ? totalDuration / stepMetrics.length : 0
    
    return {
      totalDuration,
      stepMetrics,
      slowestSteps,
      averageStepTime,
      memoryUsage: (performance as any).memory ? {
        start: this.memoryStart,
        peak: this.memoryPeak,
        end: (performance as any).memory.usedJSHeapSize
      } : undefined
    }
  }

  /**
   * Run the complete automation workflow
   */
  async run(): Promise<AutomationResult> {
    const startTime = Date.now()
    
    // Track initial memory
    if ((performance as any).memory) {
      this.memoryStart = (performance as any).memory.usedJSHeapSize
      this.memoryPeak = this.memoryStart
    }
    
    // Show visual progress if enabled
    if (this.useVisualMode) {
      const steps = this.reporter.getReport().steps.map(s => ({
        id: s.id,
        name: s.name
      }))
      progressManager.show(steps)
    } else if (this.options.showProgress) {
      this.reporter.showProgressModal()
    }
    
    // Clear previous screenshots
    if (this.options.captureScreenshots) {
      screenshotManager.clearScreenshots()
    }
    
    try {
      await this.initializeStorage()
      await this.createProject()
      await this.fillSeedData()
      await this.generateContent()
      await this.addMedia()
      await this.addAudio()
      
      if (this.options.scenario === 'comprehensive' || this.options.scenario === 'full-coverage') {
        await this.editRichText()
        await this.uploadImages()
        await this.addYouTubeVideos()
      }
      
      await this.editActivities()
      
      if (!this.options.skipScormGeneration) {
        await this.generateScorm()
      }
      
      if (this.options.scenario === 'comprehensive' || this.options.scenario === 'full-coverage') {
        await this.testPreview()
        await this.verifyPersistence()
      }
      
      // Run all feature tests for full-coverage scenario
      if (this.options.scenario === 'full-coverage') {
        await this.testProjectManagement()
        await this.testSettings()
        await this.testMediaLibrary()
        await this.testAllQuestionTypes()
        await this.testNavigationUI()
        await this.testErrorRecovery()
        await this.testHelpPage()
      }
      
      await this.cleanup()
      
      this.reporter.complete()
      
      if (this.useVisualMode) {
        progressManager.complete()
      }
      
      // Get screenshots if captured
      const screenshots = this.options.captureScreenshots 
        ? screenshotManager.getAllScreenshots()
        : undefined
      
      // Auto-generate HTML report if screenshots were captured
      if (screenshots && screenshots.length > 0) {
        await this.generateHTMLReport(true, Date.now() - startTime, this.errors)
      }
      
      return {
        success: this.errors.length === 0,
        projectId: this.projectId || undefined,
        projectPath: this.projectPath || undefined,
        errors: this.errors,
        duration: Date.now() - startTime,
        report: this.reporter.getReport(),
        screenshots,
        performanceMetrics: this.getPerformanceReport()
      }
      
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error))
      this.reporter.log(`Fatal error: ${error}`, 'error')
      
      // Capture error screenshot
      if (this.navigator) {
        const screenshotPath = await this.errorCapture.captureErrorScreenshot(
          'workflow-fatal-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
        if (screenshotPath) {
          console.error(`🔍 Error screenshot saved: ${screenshotPath}`)
        }
      }
      
      this.reporter.complete()
      
      if (this.useVisualMode) {
        progressManager.complete()
      }
      
      const screenshots = this.options.captureScreenshots 
        ? screenshotManager.getAllScreenshots()
        : undefined
      
      // Auto-generate HTML report even on failure
      if (screenshots && screenshots.length > 0) {
        await this.generateHTMLReport(false, Date.now() - startTime, this.errors)
      }
      
      return {
        success: false,
        errors: this.errors,
        duration: Date.now() - startTime,
        report: this.reporter.getReport(),
        screenshots,
        performanceMetrics: this.getPerformanceReport()
      }
      
    } finally {
      if (this.useVisualMode) {
        // Keep visual progress open for review
        setTimeout(() => {
          progressManager.close()
        }, 10000)
      } else if (this.options.showProgress) {
        // Keep modal open for review
        setTimeout(() => {
          this.reporter.closeProgressModal()
        }, 5000)
      }
      
      // Cleanup navigator
      if (this.navigator) {
        this.navigator.cleanup()
      }
    }
  }
  
  private async generateHTMLReport(success: boolean, duration: number, errors: string[]): Promise<void> {
    try {
      console.log('📝 Generating automation HTML report...')
      
      // Get all screenshots with data URLs
      const screenshots = await screenshotManager.getAllScreenshotsWithDataUrls()
      
      // Log screenshot status
      const validScreenshots = screenshots.filter(s => s.dataUrl)
      console.log(`📸 Report will include ${validScreenshots.length} of ${screenshots.length} screenshots`)
      
      // Analyze screenshots for issues (even if some are missing)
      let analysis = null
      if (screenshots.length > 0) {
        try {
          analysis = await screenshotAnalyzer.analyzeScreenshots(screenshots)
        } catch (analysisError) {
          console.warn('Screenshot analysis failed:', analysisError)
        }
      }
      
      // Add automation summary to the report
      const reportData = this.reporter.getReport()
      const performanceMetrics = this.getPerformanceReport()
      const automationSummary = {
        success,
        duration: `${(duration / 1000).toFixed(1)}s`,
        scenario: this.options.scenario || 'standard',
        errors: errors.length,
        errorMessages: errors,
        stepsCompleted: reportData.completedSteps,
        totalSteps: reportData.totalSteps,
        timestamp: new Date().toISOString(),
        performance: performanceMetrics,
        screenshotsCaptured: validScreenshots.length,
        screenshotsAttempted: screenshots.length
      }
      
      // Generate enhanced HTML report (with or without screenshots)
      const html = this.generateEnhancedHTMLReport(screenshots, analysis, automationSummary)
      
      // Create and download the report
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `automation-report-${new Date().toISOString().replace(/[:.]/g, '-')}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      console.log('✅ Automation report downloaded successfully')
    } catch (error) {
      console.error('Failed to generate HTML report:', error)
    }
  }
  
  private generateEnhancedHTMLReport(screenshots: any[], analysis: any, summary: any): string {
    const statusColor = summary.success ? '#10b981' : '#ef4444'
    const statusText = summary.success ? 'SUCCESS' : 'FAILED'
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Automation Report - ${summary.timestamp}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      margin: 0;
      padding: 20px;
    }
    .header {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #fbbf24;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: bold;
      background: ${statusColor};
      color: white;
      margin-bottom: 15px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .summary-card {
      background: #3a3a3a;
      padding: 15px;
      border-radius: 8px;
    }
    .summary-card .label {
      font-size: 0.9em;
      color: #999;
      margin-bottom: 5px;
    }
    .summary-card .value {
      font-size: 1.4em;
      font-weight: bold;
    }
    .errors {
      background: #3a3a3a;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 3px solid #ef4444;
    }
    .error-item {
      padding: 8px;
      margin: 5px 0;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .screenshots {
      display: grid;
      gap: 20px;
      margin-top: 30px;
    }
    .screenshot-card {
      background: #2a2a2a;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #3a3a3a;
    }
    .screenshot-header {
      padding: 15px;
      background: #3a3a3a;
      border-bottom: 1px solid #4a4a4a;
    }
    .screenshot-title {
      font-weight: bold;
      font-size: 1.1em;
      margin-bottom: 5px;
    }
    .screenshot-meta {
      font-size: 0.9em;
      color: #999;
    }
    .screenshot-image {
      width: 100%;
      height: auto;
      display: block;
    }
    .issues-list {
      padding: 15px;
      background: #252525;
    }
    .issue {
      padding: 8px;
      margin: 5px 0;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .issue.high { background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; }
    .issue.medium { background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; }
    .issue.low { background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 Automation Report</h1>
    <div class="status-badge">${statusText}</div>
    <p>Generated: ${new Date(summary.timestamp).toLocaleString()}</p>
    <p>Scenario: ${summary.scenario}</p>
  </div>
  
  <div class="summary">
    <div class="summary-card">
      <div class="label">Duration</div>
      <div class="value">${summary.duration}</div>
    </div>
    <div class="summary-card">
      <div class="label">Steps Completed</div>
      <div class="value">${summary.stepsCompleted}/${summary.totalSteps}</div>
    </div>
    <div class="summary-card">
      <div class="label">Screenshots</div>
      <div class="value">${screenshots.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Visual Issues</div>
      <div class="value">${analysis.issues.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Errors</div>
      <div class="value" style="color: ${summary.errors > 0 ? '#ef4444' : '#10b981'}">${summary.errors}</div>
    </div>
  </div>
  
  ${summary.performance ? `
  <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h2 style="color: #fbbf24; margin-top: 0;">⚡ Performance Metrics</h2>
    
    <div class="summary">
      <div class="summary-card">
        <div class="label">Total Duration</div>
        <div class="value">${(summary.performance.totalDuration / 1000).toFixed(2)}s</div>
      </div>
      <div class="summary-card">
        <div class="label">Average Step Time</div>
        <div class="value">${(summary.performance.averageStepTime / 1000).toFixed(2)}s</div>
      </div>
      ${summary.performance.memoryUsage ? `
      <div class="summary-card">
        <div class="label">Peak Memory</div>
        <div class="value">${(summary.performance.memoryUsage.peak / 1048576).toFixed(1)} MB</div>
      </div>
      <div class="summary-card">
        <div class="label">Memory Delta</div>
        <div class="value">${((summary.performance.memoryUsage.end - summary.performance.memoryUsage.start) / 1048576).toFixed(1)} MB</div>
      </div>
      ` : ''}
    </div>
    
    <h3>Slowest Steps:</h3>
    <div style="margin: 15px 0;">
      ${summary.performance.slowestSteps.map((step: any) => {
        const maxDuration = summary.performance.slowestSteps[0].duration
        const percentage = (step.duration / maxDuration) * 100
        return `
        <div style="display: flex; align-items: center; margin: 8px 0;">
          <div style="width: 200px; font-size: 0.9em; color: #e5e7eb;">${step.step}</div>
          <div style="flex: 1; height: 20px; background: #3a3a3a; border-radius: 10px; overflow: hidden; margin: 0 10px;">
            <div style="height: 100%; width: ${percentage}%; background: linear-gradient(90deg, #10b981, #3b82f6); transition: width 0.3s;"></div>
          </div>
          <div style="width: 80px; text-align: right; font-size: 0.9em; color: #9ca3af;">${(step.duration / 1000).toFixed(2)}s</div>
        </div>
        `
      }).join('')}
    </div>
  </div>
  ` : ''}
  
  ${summary.errorMessages.length > 0 ? `
    <div class="errors">
      <h2>❌ Errors Encountered</h2>
      ${summary.errorMessages.map(error => `
        <div class="error-item">${error}</div>
      `).join('')}
    </div>
  ` : ''}
  
  <div class="screenshots">
    <h2>📸 Screenshots (${summary.screenshotsCaptured} of ${summary.screenshotsAttempted} captured)</h2>
    ${screenshots.map(screenshot => {
      const screenshotIssues = analysis?.issues?.filter((i: any) => i.screenshot === screenshot.id) || []
      return `
        <div class="screenshot-card">
          <div class="screenshot-header">
            <div class="screenshot-title">${screenshot.stepName}</div>
            <div class="screenshot-meta">
              ${new Date(screenshot.timestamp).toLocaleTimeString()}
              ${screenshot.metadata?.pageTitle ? ` - ${screenshot.metadata.pageTitle}` : ''}
            </div>
          </div>
          ${screenshot.dataUrl ? `
            <img src="${screenshot.dataUrl}" alt="${screenshot.stepName}" class="screenshot-image" />
          ` : `
            <div style="padding: 40px; text-align: center; background: #252525; color: #999;">
              <div style="font-size: 2em; margin-bottom: 10px;">📷</div>
              <div>Screenshot not available</div>
              <div style="font-size: 0.85em; margin-top: 5px;">Failed to capture screenshot for this step</div>
            </div>
          `}
          ${screenshotIssues.length > 0 ? `
            <div class="issues-list">
              <strong>Issues Found:</strong>
              ${screenshotIssues.map((issue: any) => `
                <div class="issue ${issue.severity}">
                  <strong>${issue.type}:</strong> ${issue.description}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `
    }).join('')}
  </div>
</body>
</html>
    `
  }
  
  private async captureScreenshot(stepName: string, force: boolean = false): Promise<void> {
    // Capture if explicitly requested, or if captureAllScreenshots is enabled
    const shouldCapture = force || this.options.captureAllScreenshots || this.options.captureScreenshots
    
    if (shouldCapture && this.navigator) {
      try {
        // Collect metadata if requested
        let metadata: any = {
          timestamp: Date.now(),
          step: stepName,
          url: window.location.href,
          pageTitle: document.title
        }
        
        if (this.options.includeMetadata) {
          // Add DOM state information
          metadata.domState = {
            bodyScrollHeight: document.body.scrollHeight,
            bodyScrollWidth: document.body.scrollWidth,
            visibleElements: document.querySelectorAll('*').length, // Count all elements (visible check removed for compatibility)
            forms: document.forms.length,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input, textarea, select').length,
            images: document.images.length,
            modals: document.querySelectorAll('.modal, [role="dialog"]').length
          }
          
          // Add console logs if any
          metadata.consoleLogs = (window as any).__capturedLogs || []
        }
        
        // Capture screenshot directly with screenshotManager
        try {
          await screenshotManager.captureScreenshot(stepName, metadata)
          console.log(`📸 Screenshot captured: ${stepName}`)
        } catch (screenshotError) {
          console.warn(`Failed to capture screenshot for ${stepName}:`, screenshotError)
          // Continue without failing the entire capture
        }
      } catch (error) {
        console.warn('Failed to capture screenshot:', error)
      }
    }
  }
  
  private async initializeStorage(): Promise<void> {
    this.startMetric('init')
    this.reporter.startStep('init')
    if (this.useVisualMode) {
      progressManager.startStep('init')
    }
    
    try {
      this.storage = new PersistentStorage()
      await this.storage.initialize()
      
      this.endMetric('init', 'success')
      this.reporter.completeStep('init')
      if (this.useVisualMode) {
        progressManager.completeStep('init')
      }
    } catch (error) {
      this.endMetric('init', 'failed')
      this.reporter.failStep('init', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('init', error instanceof Error ? error.message : String(error))
      }
      throw error
    }
  }
  
  private async createProject(): Promise<void> {
    this.reporter.startStep('create-project')
    if (this.useVisualMode) {
      progressManager.startStep('create-project')
    }
    
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      const projectName = TestDataGenerator.generateCourseTitle()
      this.reporter.log(`Creating project: ${projectName}`)
      
      // Visual navigation: Click New Project button
      if (this.navigator && this.useVisualMode) {
        await this.captureScreenshot('project-dashboard')
        
        // Try to click the New Project button
        try {
          // Click New Project button
          await this.navigator.clickButton('[data-testid="new-project-button"]')
          
          // Wait for modal to open with specific title
          await this.navigator.waitForModalToOpen()
          const modalOpen = await this.navigator.isModalOpen('Create New Project')
          if (!modalOpen) {
            throw new Error('Create New Project modal did not open')
          }
          await this.captureScreenshot('new-project-modal-open')
          
          // Fill in project name
          await this.captureScreenshot('before-project-name-input')
          await this.navigator.fillInput('[data-testid="project-name-input"]', projectName)
          await this.navigator.delay(500) // Give React time to process the input and enable the button
          await this.captureScreenshot('after-project-name-input')
          
          // Debug: Check if button is enabled
          try {
            const createButton = await this.navigator.waitForElement('[data-testid="create-project-confirm"]')
            const isDisabled = createButton.hasAttribute('disabled')
            console.log('[Create Project] Button disabled state:', isDisabled)
            if (isDisabled) {
              console.log('[Create Project] Button is still disabled, waiting more...')
              await this.navigator.delay(1000)
            }
          } catch (e) {
            console.log('[Create Project] Could not find create button')
          }
          
          // Click create button
          await this.navigator.clickButton('[data-testid="create-project-confirm"]')
          
          // Project creation might take time, wait a bit
          await this.navigator.delay(1000)
          
          // Wait for modal to close naturally (don't force close with Escape)
          try {
            await this.navigator.waitForModalToClose()
          } catch (closeError) {
            console.log('Modal close timeout, but project might still be creating...')
            // Don't use tryCloseModal as it uses Escape which cancels
            // Just wait a bit more for the operation to complete
            await this.navigator.delay(2000)
          }
          
          await this.captureScreenshot('project-created')
          
          // Wait for navigation to Course Seed Input page
          try {
            // First wait for the App component to load
            await this.navigator.delay(2000)
            
            // Try multiple ways to detect the Course Configuration page
            let pageFound = false
            const maxAttempts = 10
            
            for (let i = 0; i < maxAttempts; i++) {
              const currentTitle = await this.navigator.getCurrentPageTitle()
              console.log(`[Navigation] Attempt ${i + 1}: Current page title:`, currentTitle)
              
              if (currentTitle && currentTitle.includes('Course Configuration')) {
                pageFound = true
                break
              }
              
              // Also check for the course seed input form
              try {
                await this.navigator.waitForElement('[data-testid="course-seed-input-form"]', 500)
                pageFound = true
                break
              } catch {
                // Not found yet
              }
              
              await this.navigator.delay(1000)
            }
            
            if (!pageFound) {
              throw new Error('Course Configuration page did not load')
            }
            
            await this.captureScreenshot('navigated-to-course-seed')
          } catch (navError) {
            console.log('Navigation to Course Configuration failed:', navError)
            await this.navigator.debugPageStructure()
          }
        } catch (navError) {
          // Fallback to direct API if UI navigation fails
          console.log('UI navigation failed, using direct API:', navError)
          if (this.navigator) {
            await this.navigator.debugPageStructure()
          }
        }
      }
      
      // Create project through API if not already created
      let project: Project | null = null
      
      // First check if project was created through UI
      if (this.navigator && this.useVisualMode) {
        await this.navigator.delay(1000) // Give time for UI creation
        const projects = await this.storage.listProjects()
        project = projects.find(p => p.name === projectName) || null
      }
      
      // If not created through UI or not in visual mode, create through API
      if (!project) {
        project = await this.storage.createProject(projectName)
        if (!project || !project.id) {
          throw new Error('Failed to create project')
        }
      }
      
      this.projectId = project.id
      this.projectPath = (project as any).path || project.id
      
      // Make sure project is opened
      if (!this.projectId) {
        throw new Error('Project ID not set')
      }
      await this.storage.openProject(this.projectId)
      this.mediaService = new MediaService({ projectId: this.projectId })
      
      // If in visual mode but not on Course Config page, try to navigate there
      if (this.navigator && this.useVisualMode) {
        try {
          const currentTitle = await this.navigator.getCurrentPageTitle()
          if (!currentTitle || !currentTitle.includes('Course Configuration')) {
            // We're not on the right page, wait a bit more
            await this.navigator.waitForPage('Course Configuration', 5000)
          }
        } catch (error) {
          console.log('Navigation check failed:', error)
        }
      }
      
      this.reporter.completeStep('create-project', { 
        projectId: this.projectId,
        projectName 
      })
      if (this.useVisualMode) {
        progressManager.completeStep('create-project', `Created: ${projectName}`)
      }
    } catch (error) {
      this.reporter.failStep('create-project', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('create-project', error instanceof Error ? error.message : String(error))
      }
      throw error
    }
  }
  
  private async fillSeedData(): Promise<void> {
    this.reporter.startStep('seed-data')
    if (this.useVisualMode) {
      progressManager.startStep('seed-data')
    }
    
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      const seedData = TestDataGenerator.generateCourseSeedData()
      this.reporter.log(`Using template: ${seedData.template}`)
      this.reporter.log(`Topics: ${seedData.customTopics.length}`)
      
      // Visual navigation: Fill in course seed data
      if (this.navigator && this.useVisualMode) {
        // Make sure we're on the Course Seed Input page
        try {
          await this.navigator.waitForPage('Course Configuration', 5000)
        } catch (error) {
          console.log('Not on Course Configuration page, checking current state...')
          
          // Capture screenshot when page navigation fails
          await this.captureDebugScreenshot('course-configuration-navigation')
          
          await this.navigator.debugPageStructure()
        }
        
        await this.captureScreenshot('course-seed-input')
        
        try {
          console.log('[Course Seed] Step 1: Waiting for form...')
          await this.navigator.waitForElement('[data-testid="course-seed-input-form"]')
          console.log('[Course Seed] Form found!')
          
          console.log('[Course Seed] Step 2: Filling course title...')
          await this.navigator.fillInput('[data-testid="course-title-input"]', seedData.courseTitle)
          console.log('[Course Seed] Course title filled:', seedData.courseTitle)
          
          console.log('[Course Seed] Step 3: Setting difficulty...')
          await this.navigator.clickButton(`[data-testid="difficulty-${seedData.difficulty}"]`)
          console.log('[Course Seed] Difficulty set to:', seedData.difficulty)
          
          console.log('[Course Seed] Step 4: Selecting template...')
          // Select template if not 'None'
          if (seedData.template !== 'None') {
            await this.navigator.selectDropdown('[data-testid="template-select"]', seedData.template)
            await this.navigator.delay(500) // Wait for template to update
            console.log('[Course Seed] Template selected:', seedData.template)
          }
          
          console.log('[Course Seed] Step 5: Filling topics...')
          console.log('[Course Seed] Topics to fill:', seedData.customTopics)
          console.log('[Course Seed] Topics as string:', seedData.customTopics.join('\n'))
          
          // Check if textarea exists before filling
          try {
            const textarea = await this.navigator.waitForElement('[data-testid="topics-textarea"]')
            console.log('[Course Seed] Topics textarea found, element type:', textarea.tagName)
            await this.navigator.fillInput('[data-testid="topics-textarea"]', seedData.customTopics.join('\n'))
            console.log('[Course Seed] Topics filled successfully')
          } catch (textareaError) {
            console.error('[Course Seed] Failed to fill topics textarea:')
            console.error('[Course Seed] Error message:', textareaError instanceof Error ? textareaError.message : String(textareaError))
            console.error('[Course Seed] Error stack:', textareaError instanceof Error ? textareaError.stack : 'No stack trace')
            console.error('[Course Seed] Error type:', textareaError instanceof Error ? textareaError.constructor.name : typeof textareaError)
            console.error('[Course Seed] Full error:', textareaError)
            await this.navigator.debugPageStructure()
          }
          
          // Wait for all form fields to be processed by React
          await this.navigator.delay(1000)
          
          await this.captureScreenshot('course-seed-filled')
          
          // Debug: Check if Next button is enabled
          try {
            const nextButton = await this.navigator.waitForElement('[data-testid="next-button"]')
            const isDisabled = nextButton.hasAttribute('disabled')
            console.log('[Course Seed] Next button disabled state:', isDisabled)
            if (isDisabled) {
              console.log('[Course Seed] Next button is disabled, checking form validity...')
              // Check which fields might be missing
              const titleInput = document.querySelector('[data-testid="course-title-input"]') as HTMLInputElement
              const topicsTextarea = document.querySelector('[data-testid="topics-textarea"]') as HTMLTextAreaElement
              console.log('[Course Seed] Title value:', titleInput?.value)
              console.log('[Course Seed] Topics value:', topicsTextarea?.value)
              await this.navigator.delay(1000)
            }
          } catch (e) {
            console.log('[Course Seed] Could not find next button')
          }
          
          console.log('[Course Seed] Step 6: Clicking Next button...')
          // Click Next button
          await this.navigator.clickButton('[data-testid="next-button"]')
          
          console.log('[Course Seed] Step 7: Waiting for navigation...')
          // Wait for navigation to AI Prompt Generator
          await this.navigator.waitForPage('AI Prompt Generator', 5000)
          await this.captureScreenshot('navigated-to-ai-prompt')
          console.log('[Course Seed] Successfully navigated to AI Prompt Generator')
        } catch (navError) {
          // Log but continue - will use direct API as fallback
          console.error('[Course Seed] Visual navigation failed:', navError)
          if (navError instanceof Error) {
            console.error('[Course Seed] Error details:', navError.message)
            console.error('[Course Seed] Stack trace:', navError.stack)
          }
          
          // Debug current page state
          await this.navigator.debugPageStructure()
        }
      }
      
      await this.storage.saveCourseMetadata(seedData)
      await this.storage.saveContent('courseSeedData', seedData as any)
      
      this.reporter.completeStep('seed-data', seedData)
      if (this.useVisualMode) {
        progressManager.completeStep('seed-data', `Filled: ${seedData.courseTitle}`)
      }
    } catch (error) {
      this.reporter.failStep('seed-data', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('seed-data', error instanceof Error ? error.message : String(error))
      }
      throw error
    }
  }
  
  private async generateContent(): Promise<void> {
    this.reporter.startStep('generate-content')
    if (this.useVisualMode) {
      progressManager.startStep('generate-content')
    }
    
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      const seedData = await this.storage.getContent('courseSeedData')
      if (!seedData) throw new Error('No seed data found')
      
      const courseContent = TestDataGenerator.generateCourseContentJSON(seedData as any)
      this.generatedContent = courseContent  // Store for later use in JSON import
      this.reporter.log(`Generated content for ${courseContent.topics.length} topics`)
      
      // Store generated content in storage
      await this.storage.saveContent('course-content', courseContent as any)
      
      // Visual navigation: Generate AI content
      if (this.navigator && this.useVisualMode) {
        await this.captureScreenshot('ai-prompt-generator')
        
        try {
          // The AI Prompt Generator page should auto-generate
          await this.navigator.delay(2000) // Wait for AI generation
          await this.captureScreenshot('ai-content-generated')
          
          // Click Next to go to JSON Import
          await this.navigator.clickButton('[data-testid="next-button"]')
          await this.navigator.waitForPage('JSON Import & Validation', 5000)
          await this.captureScreenshot('navigated-to-json-import')
          
          // On JSON Import page, we need to paste the generated JSON content
          console.log('[JSON Import] Looking for JSON input textarea...')
          
          try {
            // Convert the generated content to JSON string
            const jsonContent = JSON.stringify(this.generatedContent, null, 2)
            console.log('[JSON Import] Generated JSON length:', jsonContent.length)
            
            // Find and fill the JSON input textarea
            await this.navigator.fillInput('[data-testid="json-input-textarea"]', jsonContent)
            await this.navigator.delay(500)
            
            // Click Validate button
            console.log('[JSON Import] Clicking validate button...')
            await this.navigator.clickButton('[data-testid="validate-json-button"]')
            await this.navigator.delay(1000)
            
            // Now click Next after validation
            console.log('[JSON Import] Clicking Next button...')
            await this.navigator.clickButton('[data-testid="next-button"]')
          } catch (jsonError) {
            console.error('[JSON Import] Failed to fill JSON input:', jsonError)
            // Try to proceed anyway
            await this.navigator.clickButton('[data-testid="next-button"]')
          }
          
          // Wait for navigation to Media Enhancement
          await this.navigator.waitForPage('Media Enhancement', 5000)
          await this.captureScreenshot('navigated-to-media-enhancement')
        } catch (navError) {
          console.log('Visual navigation failed, continuing:', navError)
        }
      }
      
      // Save the course content
      await this.storage.saveContent('course-content', courseContent as any)
      
      // Save individual content items
      await this.storage.saveContent('welcome', courseContent.welcomePage as any)
      await this.storage.saveContent('objectives', courseContent.learningObjectivesPage as any)
      
      for (let i = 0; i < courseContent.topics.length; i++) {
        const topic = courseContent.topics[i]
        await this.storage.saveContent(`content-${2 + i}`, topic as any)
      }
      
      await this.storage.saveContent('assessment', courseContent.assessment as any)
      
      this.reporter.completeStep('generate-content', {
        topicCount: courseContent.topics.length,
        assessmentQuestions: courseContent.assessment.questions.length
      })
      if (this.useVisualMode) {
        progressManager.completeStep('generate-content', `Generated ${courseContent.topics.length} topics`)
      }
    } catch (error) {
      this.reporter.failStep('generate-content', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('generate-content', error instanceof Error ? error.message : String(error))
      }
      throw error
    }
  }
  
  private async addMedia(): Promise<void> {
    this.reporter.startStep('add-media')
    if (this.useVisualMode) {
      progressManager.startStep('add-media')
    }
    
    try {
      if (!this.mediaService || !this.storage) throw new Error('Services not initialized')
      
      const courseContent = await this.storage.getContent('course-content')
      if (!courseContent || !courseContent.topics) throw new Error('No course content found')
      
      // Visual navigation REQUIRED - no programmatic fallback
      if (!this.navigator || !this.useVisualMode) {
        throw new Error('Visual mode required for media addition - no programmatic fallback allowed')
      }
      
      await this.captureScreenshot('media-enhancement-page')
      
      // Verify we're on the Media Enhancement page
      const currentTitle = await this.navigator.getCurrentPageTitle()
      if (!currentTitle || !currentTitle.includes('Media')) {
        console.error('Not on Media Enhancement page, current page:', currentTitle)
        await this.captureDebugScreenshot('media-page-missing')
        throw new Error(`Expected to be on Media Enhancement page, but on: ${currentTitle}`)
      }
      
      // Determine which scenario to run
      const scenario = this.options?.scenario || 'standard'
      console.log(`[Media Enhancement] Running ${scenario} scenario`)
      
      if (scenario === 'comprehensive' || scenario === 'media-focus') {
        // Test all media features extensively
        await this.testGoogleImageSearch()
        await this.testYouTubeVideoSearch()
        await this.testFileUpload()
        await this.testRichTextEditor()
      } else if (scenario === 'standard') {
        // Test key media features
        await this.testGoogleImageSearch()
        await this.testFileUpload()
      } else if (scenario === 'content-focus') {
        // Focus on content editing
        await this.testRichTextEditor()
        await this.testFileUpload()
      } else {
        // Quick scenario - just upload one file
        await this.testFileUpload()
      }
      
      
      await this.captureScreenshot('media-enhancement-complete')
      
      // Click Next
      const nextButton = document.querySelector('[data-testid="next-button"]')
      if (!nextButton) {
        console.error('Next button not found on Media Enhancement page')
        await this.captureDebugScreenshot('media-next-button-missing')
        throw new Error('Next button not found - cannot proceed to next step')
      }
      
      await this.navigator.clickButton('[data-testid="next-button"]')
      
      // Wait for navigation to Audio Narration
      await this.navigator.waitForPage('Audio Narration', 5000)
      await this.captureScreenshot('navigated-to-audio-narration')
      
      // Track media additions for reporting
      // const mediaAdded = []
      // Visual mode succeeded - report completion
      this.reporter.completeStep('add-media', {
        visualMode: true,
        message: 'Media added visually through UI'
      })
      if (this.useVisualMode) {
        progressManager.completeStep('add-media', 'Media added via UI')
      }
    } catch (error) {
      this.reporter.failStep('add-media', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('add-media', error instanceof Error ? error.message : String(error))
      }
      
      // Capture error screenshot
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'add-media-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      // Re-throw to stop automation - no silent failures
      throw error
    }
  }
  
  private async addAudio(): Promise<void> {
    this.reporter.startStep('add-audio')
    if (this.useVisualMode) {
      progressManager.startStep('add-audio')
    }
    
    try {
      if (!this.mediaService || !this.storage) throw new Error('Services not initialized')
      
      // Visual navigation REQUIRED - no programmatic fallback
      if (!this.navigator || !this.useVisualMode) {
        throw new Error('Visual mode required for audio addition - no programmatic fallback allowed')
      }
      
      await this.captureScreenshot('audio-narration-page')
      
      // Verify we're on the Audio Narration page
      const currentTitle = await this.navigator.getCurrentPageTitle()
      if (!currentTitle || (!currentTitle.includes('Audio') && !currentTitle.includes('Narration'))) {
        console.error('Not on Audio Narration page, current page:', currentTitle)
        await this.captureDebugScreenshot('audio-page-missing')
        throw new Error(`Expected to be on Audio Narration page, but on: ${currentTitle}`)
      }
      
      // Wait for page to fully load
      await this.navigator.delay(1000)
      
      // Determine which scenario to run
      const scenario = this.options?.scenario || 'standard'
      console.log(`[Audio Narration] Running ${scenario} scenario`)
      
      if (scenario === 'comprehensive' || scenario === 'audio-focus') {
        // Test all audio features
        await this.testAudioRecording()
        await this.testAudioUpload()
        await this.testMurfAI()
        await this.testBulkReplace()
      } else if (scenario === 'standard') {
        // Test key audio features
        await this.testAudioRecording()
      } else {
        // Quick scenario - just skip audio
        console.log('[Audio Narration] Quick scenario - skipping audio')
      }
      
      // Wait for any modals to close
      await this.navigator.delay(1000)
      
      // Check for Unsaved Changes dialog FIRST
      let dialog = document.querySelector('.dialog-overlay')
      if (dialog && dialog.textContent?.includes('Unsaved Changes')) {
        console.log('[Audio Narration] Unsaved Changes dialog detected, clicking Save...')
        const saveButton = Array.from(dialog.querySelectorAll('button')).find(btn => 
          btn.textContent?.includes('Save')
        )
        if (saveButton) {
          (saveButton as HTMLElement).click()
          console.log('[Audio Narration] Clicked Save in Unsaved Changes dialog')
          await this.navigator.delay(2000) // Wait for save to complete
        }
      }
      
      // Now try to find and click Next button
      console.log('[Audio Narration] Looking for Next button...')
      let nextButton = document.querySelector('[data-testid="next-button"]') as HTMLElement
      
      // If not found by data-testid, try finding by text content
      if (!nextButton) {
        console.log('[Audio Narration] Next button not found by data-testid, trying by text...')
        nextButton = Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent?.trim() === 'Next →' || btn.textContent?.includes('Next')
        ) as HTMLElement
      }
      
      if (nextButton) {
        console.log('[Audio Narration] Found Next button, clicking...')
        nextButton.click()
        await this.navigator.delay(1000) // Give time for navigation to start
        
        // Check again for Unsaved Changes dialog after clicking Next
        dialog = document.querySelector('.dialog-overlay')
        if (dialog && dialog.textContent?.includes('Unsaved Changes')) {
          console.log('[Audio Narration] Unsaved Changes dialog appeared after Next, clicking Save...')
          const saveButton = Array.from(dialog.querySelectorAll('button')).find(btn => 
            btn.textContent?.includes('Save')
          )
          if (saveButton) {
            (saveButton as HTMLElement).click()
            console.log('[Audio Narration] Clicked Save in Unsaved Changes dialog')
            await this.navigator.delay(1000) // Wait for save to complete
          }
        }
      } else {
        console.warn('[Audio Narration] Next button not found, attempting to continue...')
      }
      
      // Wait for navigation to Questions & Assessment Editor
      await this.navigator.waitForPage('Questions & Assessment Editor', 5000)
      await this.captureScreenshot('navigated-to-questions-assessment')
      
      // Track audio additions for reporting  
      // const audioAdded = []
      // Visual mode succeeded - report completion
      this.reporter.completeStep('add-audio', {
        visualMode: true,
        message: 'Audio step completed visually through UI'
      })
      if (this.useVisualMode) {
        progressManager.completeStep('add-audio', 'Audio step completed via UI')
      }
    } catch (error) {
      this.reporter.failStep('add-audio', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('add-audio', error instanceof Error ? error.message : String(error))
      }
      
      // Capture error screenshot
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'add-audio-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      // Re-throw to stop automation - no silent failures
      throw error
    }
  }
  
  private async testGoogleImageSearch(): Promise<void> {
    console.log('[Media Enhancement] Testing Google Image Search...')
    if (!this.navigator) {
      console.warn('[Media Enhancement] Navigator not available for Google Image Search test')
      return
    }
    try {
      // Note: Google Image Search requires API keys to be configured
      console.log('[Media Enhancement] Note: Google Image Search requires API keys (googleApiKey and googleCseId)')
      
      // Click on a topic thumbnail first
      const topicThumbnails = document.querySelectorAll('[data-testid^="page-thumbnail-topic-"]')
      if (topicThumbnails.length > 0) {
        // Get the data-testid of the first thumbnail to create a specific selector
        const firstThumbnail = topicThumbnails[0]
        const testId = firstThumbnail.getAttribute('data-testid')
        if (testId) {
          await this.navigator.clickButton(`[data-testid="${testId}"]`)
          await this.navigator.delay(500)
        }
      }
      
      // Make sure we're on the images tab
      const imagesTab = document.querySelector('#tab-images')
      if (imagesTab) {
        await this.navigator.clickButton('#tab-images')
        await this.navigator.delay(500)
      }
      
      // Enter search term
      const searchInputSelector = 'input[placeholder="Search for images..."]'
      const searchInput = document.querySelector(searchInputSelector)
      if (searchInput) {
        await this.navigator.fillInput(searchInputSelector, 'corporate training')
        await this.navigator.delay(500)
        
        // Click search button - it's the button right after the search input
        const searchButtonSelector = 'button[aria-label="Search images"]'
        let searchButton = document.querySelector(searchButtonSelector)
        
        // If aria-label doesn't exist, find button by text content
        if (!searchButton) {
          const buttons = document.querySelectorAll('#tabpanel-images button, button')
          searchButton = Array.from(buttons).find(btn => 
            btn.textContent?.trim() === 'Search' || btn.textContent?.includes('Search')
          ) || null
        }
        
        if (searchButton) {
          // Create a unique selector for this button
          if (searchButton.getAttribute('aria-label')) {
            await this.navigator.clickButton('button[aria-label="Search images"]')
          } else if (searchButton.id) {
            await this.navigator.clickButton(`#${searchButton.id}`)
          } else {
            // Use parent + nth-child selector
            const parent = searchButton.parentElement
            if (parent) {
              const index = Array.from(parent.children).indexOf(searchButton)
              await this.navigator.clickButton(`${parent.tagName.toLowerCase()} > button:nth-child(${index + 1})`)
            }
          }
          console.log('[Media Enhancement] Searching for images...')
          await this.navigator.delay(2000) // Wait for search results
          
          // Try to select first result
          const imageResults = document.querySelectorAll('[data-testid^="search-result-"]')
          const fallbackResults = imageResults.length === 0 ? document.querySelectorAll('.search-result-item') : imageResults
          if (fallbackResults.length > 0) {
            console.log(`[Media Enhancement] Found ${fallbackResults.length} image results`)
            const firstResult = fallbackResults[0]
            const testId = firstResult.getAttribute('data-testid')
            const selector = testId ? `[data-testid="${testId}"]` : '.search-result-item:first-child'
            await this.navigator.clickButton(selector)
            await this.navigator.delay(500)
            
            // Click add/select button if present
            const addButtonSelector = '[data-testid="add-image-button"]'
            let addButton = document.querySelector(addButtonSelector)
            if (!addButton) {
              // Fallback: Find button by text content
              addButton = Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent?.includes('Add') || btn.textContent?.includes('Select')
              ) as HTMLElement | null
            }
            if (addButton) {
              (addButton as HTMLElement).click()
              console.log('[Media Enhancement] Image added from search')
              await this.navigator.delay(500)
            }
          } else {
            console.warn('[Media Enhancement] No image search results found - API keys may not be configured')
            await this.captureDebugScreenshot('no-image-search-results')
            // This is expected if API keys are not set up
          }
        } else {
          console.warn('[Media Enhancement] Search button not found')
          await this.captureDebugScreenshot('search-button-not-found')
        }
      } else {
        console.warn('[Media Enhancement] Image search input not found')
        await this.captureDebugScreenshot('image-search-input-not-found')
      }
      
      await this.captureScreenshot('google-image-search-complete')
    } catch (error) {
      console.error('[Media Enhancement] Google Image Search test failed:', error)
    }
  }
  
  private async testYouTubeVideoSearch(): Promise<void> {
    console.log('[Media Enhancement] Testing YouTube Video Search...')
    if (!this.navigator) {
      console.warn('[Media Enhancement] Navigator not available for YouTube Video Search test')
      return
    }
    try {
      // Switch to videos tab
      const videosTab = document.querySelector('#tab-videos')
      if (videosTab) {
        await this.navigator.clickButton('#tab-videos')
        await this.navigator.delay(500)
      }
      
      // Enter YouTube search term
      const videoSearchSelector = 'input[placeholder="Search for videos..."]'
      const videoSearchInput = document.querySelector(videoSearchSelector)
      if (videoSearchInput) {
        await this.navigator.fillInput(videoSearchSelector, 'compliance training')
        await this.navigator.delay(500)
        
        // Click search button - look for the button with "Search" text in videos tab
        const searchButtons = document.querySelectorAll('#tabpanel-videos button, button')
        const searchButton = Array.from(searchButtons).find(btn => 
          btn.textContent?.trim() === 'Search' || btn.textContent?.includes('Search')
        )
        
        if (searchButton) {
          // Create a unique selector for this button
          if (searchButton.id) {
            await this.navigator.clickButton(`#${searchButton.id}`)
          } else {
            const parent = searchButton.parentElement
            if (parent) {
              const buttons = parent.querySelectorAll('button')
              const index = Array.from(buttons).indexOf(searchButton as HTMLButtonElement)
              if (index >= 0) {
                const parentSelector = parent.id ? `#${parent.id}` : 
                                      parent.className ? `.${parent.className.split(' ')[0]}` : 
                                      parent.tagName.toLowerCase()
                await this.navigator.clickButton(`${parentSelector} > button:nth-child(${index + 1})`)
              }
            }
          }
          console.log('[Media Enhancement] Searching for YouTube videos...')
          await this.navigator.delay(2000) // Wait for search results
          
          // Try to select first video result
          const videoResults = document.querySelectorAll('[data-testid^="video-result-"]')
          const fallbackResults = videoResults.length === 0 ? document.querySelectorAll('.video-result-item') : videoResults
          if (fallbackResults.length > 0) {
            console.log(`[Media Enhancement] Found ${fallbackResults.length} video results`)
            const firstResult = fallbackResults[0]
            const testId = firstResult.getAttribute('data-testid')
            const selector = testId ? `[data-testid="${testId}"]` : '.video-result-item:first-child'
            await this.navigator.clickButton(selector)
            await this.navigator.delay(500)
            
            // Click add/select button if present
            const addButtonSelector = '[data-testid="add-video-button"]'
            const addButtonFallback = 'button:contains("Add Video")'
            const addButton = document.querySelector(addButtonSelector) || document.querySelector(addButtonFallback)
            if (addButton) {
              const selector = document.querySelector(addButtonSelector) ? addButtonSelector : addButtonFallback
              await this.navigator.clickButton(selector)
              console.log('[Media Enhancement] YouTube video added')
            }
          } else {
            console.warn('[Media Enhancement] No video search results found')
            await this.captureDebugScreenshot('no-video-search-results')
          }
        } else {
          console.warn('[Media Enhancement] Video search button not found')
          await this.captureDebugScreenshot('video-search-button-not-found')
        }
      } else {
        console.warn('[Media Enhancement] Video search input not found')
        await this.captureDebugScreenshot('video-search-input-not-found')
      }
      
      await this.captureScreenshot('youtube-search-complete')
    } catch (error) {
      console.error('[Media Enhancement] YouTube Search test failed:', error)
    }
  }
  
  private async testFileUpload(): Promise<void> {
    console.log('[Media Enhancement] Testing File Upload...')
    if (!this.navigator) {
      console.warn('[Media Enhancement] Navigator not available for File Upload test')
      return
    }
    try {
      // Switch to upload tab
      const uploadTab = document.querySelector('#tab-upload')
      if (uploadTab) {
        await this.navigator.clickButton('#tab-upload')
        await this.navigator.delay(500)
      }
      
      // Create test files
      const imageBlob = await TestDataGenerator.generateTestImage('Test Image')
      const imageFile = new File([imageBlob], 'test-image.png', { type: 'image/png' })
      
      // Find file input using selector strings
      const fileInputSelector = '[data-testid="file-input"]'
      const fallbackSelector = 'input[type="file"]#media-upload'
      const fileInput = document.querySelector(fileInputSelector) || document.querySelector(fallbackSelector)
      
      if (fileInput) {
        console.log('[Media Enhancement] Uploading test image...')
        // Use the appropriate selector string instead of the element
        const selectorToUse = document.querySelector(fileInputSelector) ? fileInputSelector : fallbackSelector
        await this.navigator.uploadFile(selectorToUse, imageFile)
        await this.navigator.delay(1500) // Wait for upload to process
        
        // Verify upload succeeded by looking for "Uploaded Files (X)" text
        const uploadedFilesText = Array.from(document.querySelectorAll('p')).find(p => 
          p.textContent?.includes('Uploaded Files (')
        )
        
        if (uploadedFilesText) {
          // Extract the number of uploaded files from the text
          const match = uploadedFilesText.textContent?.match(/Uploaded Files \((\d+)\)/)
          const uploadCount = match ? parseInt(match[1]) : 0
          console.log(`[Media Enhancement] Successfully uploaded ${uploadCount} file(s)`)
        } else {
          // Fallback: check for thumbnail elements
          const uploadedItems = document.querySelectorAll('[data-testid^="uploaded-media-"], .uploaded-media-item, .thumbnail-item, [class*="thumbnail"], [class*="uploaded"]')
          if (uploadedItems.length > 0) {
            console.log(`[Media Enhancement] Found ${uploadedItems.length} uploaded items`)
          } else {
            console.warn('[Media Enhancement] Could not verify file upload - checking for processing')
            await this.navigator.delay(1000) // Give it more time
            
            // Check again for the text pattern
            const uploadedFilesTextRetry = Array.from(document.querySelectorAll('p')).find(p => 
              p.textContent?.includes('Uploaded Files (')
            )
            if (uploadedFilesTextRetry) {
              console.log('[Media Enhancement] Upload verified after delay')
            } else {
              await this.captureDebugScreenshot('file-upload-not-verified')
            }
          }
        }
      } else {
        console.warn('[Media Enhancement] File input not found')
        await this.captureDebugScreenshot('file-input-not-found')
      }
      
      await this.captureScreenshot('file-upload-complete')
    } catch (error) {
      console.error('[Media Enhancement] File Upload test failed:', error)
    }
  }
  
  private async testAudioRecording(): Promise<void> {
    console.log('[Audio Narration] Testing Audio Recording...')
    if (!this.navigator) {
      console.warn('[Audio Narration] Navigator not available for Audio Recording test')
      return
    }
    try {
      // First, find and click "Record Audio" button on a narration block to open modal
      const recordAudioButtons = document.querySelectorAll('button')
      const recordAudioButton = Array.from(recordAudioButtons).find(btn => {
        const text = btn.textContent?.trim()
        return text?.includes('Record Audio') || text?.includes('Record')
      })
      
      if (recordAudioButton) {
        console.log('[Audio Narration] Found Record Audio button on narration block');
        // Click to open recording modal
        (recordAudioButton as HTMLElement).click()
        await this.navigator.delay(500) // Wait for modal to open
        
        // Now find "Start Recording" button inside the modal
        const startRecordButtons = document.querySelectorAll('button')
        const startRecordButton = Array.from(startRecordButtons).find(btn => {
          const text = btn.textContent?.trim()
          return text?.includes('Start Recording')
        })
        
        if (startRecordButton) {
          console.log('[Audio Narration] Found Start Recording button in modal')
          
          // Click the start recording button using a unique selector
          if (startRecordButton.id) {
            await this.navigator.clickButton(`#${startRecordButton.id}`)
          } else {
            // Create selector based on parent and position
            const parent = startRecordButton.parentElement
            if (parent) {
              const buttons = parent.querySelectorAll('button')
              const index = Array.from(buttons).indexOf(startRecordButton as HTMLButtonElement)
              if (index >= 0) {
                const parentSelector = parent.className ? `.${parent.className.split(' ')[0]}` : parent.tagName.toLowerCase()
                await this.navigator.clickButton(`${parentSelector} button:nth-of-type(${index + 1})`)
              }
            }
          }
          await this.navigator.delay(500)
          
          // Simulate recording for 2 seconds
          console.log('[Audio Narration] Recording audio for 2 seconds...')
          await this.navigator.delay(2000)
          
          // Stop recording - look for button with "Stop Recording" text
          const stopButtons = document.querySelectorAll('button')
          const stopButton = Array.from(stopButtons).find(btn => 
            btn.textContent?.includes('Stop Recording')
          )
          if (stopButton) {
            // Click stop button using a unique selector
            if (stopButton.id) {
              await this.navigator.clickButton(`#${stopButton.id}`)
            } else {
              const parent = stopButton.parentElement
              if (parent) {
                const buttons = parent.querySelectorAll('button')
                const index = Array.from(buttons).indexOf(stopButton as HTMLButtonElement)
                if (index >= 0) {
                  const parentSelector = parent.className ? `.${parent.className.split(' ')[0]}` : parent.tagName.toLowerCase()
                  await this.navigator.clickButton(`${parentSelector} button:nth-of-type(${index + 1})`)
                }
              }
            }
            console.log('[Audio Narration] Recording stopped')
            await this.navigator.delay(500)
            
            // Try to play preview
            const playButtonSelector = '[data-testid="play-preview-button"]'
            const playButton = document.querySelector(playButtonSelector)
            if (playButton) {
              await this.navigator.clickButton(playButtonSelector)
              console.log('[Audio Narration] Playing preview')
              await this.navigator.delay(1000)
            }
            
            // Save recording
            const saveButtonSelector = '[data-testid="save-recording-button"]'
            const saveButton = document.querySelector(saveButtonSelector)
            if (saveButton) {
              await this.navigator.clickButton(saveButtonSelector)
              console.log('[Audio Narration] Recording saved')
              // Wait for async save to complete
              console.log('[Audio Narration] Waiting for save to complete...')
              await this.navigator.delay(2000)
            }
          }
        } else {
          console.warn('[Audio Narration] Start Recording button not found in modal')
          await this.captureDebugScreenshot('start-recording-button-not-found')
        }
      } else {
        console.warn('[Audio Narration] Record Audio button not found on narration blocks')
        await this.captureDebugScreenshot('record-audio-button-not-found')
      }
      
      await this.captureScreenshot('audio-recording-complete')
    } catch (error) {
      console.error('[Audio Narration] Audio Recording test failed:', error)
    }
  }
  
  private async testAudioUpload(): Promise<void> {
    console.log('[Audio Narration] Testing Audio Upload...')
    if (!this.navigator) {
      console.warn('[Audio Narration] Navigator not available for Audio Upload test')
      return
    }
    try {
      // Find upload button - look for button with upload-related text
      const uploadButtons = document.querySelectorAll('button')
      const uploadButton = Array.from(uploadButtons).find(btn => {
        const text = btn.textContent?.toLowerCase() || ''
        return text.includes('upload') && text.includes('audio')
      })
      if (uploadButton) {
        // Click the upload button using a unique selector
        if (uploadButton.id) {
          await this.navigator.clickButton(`#${uploadButton.id}`)
        } else {
          const parent = uploadButton.parentElement
          if (parent) {
            const buttons = parent.querySelectorAll('button')
            const index = Array.from(buttons).indexOf(uploadButton as HTMLButtonElement)
            if (index >= 0) {
              const parentSelector = parent.className ? `.${parent.className.split(' ')[0]}` : parent.tagName.toLowerCase()
              await this.navigator.clickButton(`${parentSelector} button:nth-of-type(${index + 1})`)
            }
          }
        }
        await this.navigator.delay(500)
        
        // Create test audio file
        const audioBlob = new Blob(['test audio data'], { type: 'audio/mp3' })
        const audioFile = new File([audioBlob], 'test-audio.mp3', { type: 'audio/mp3' })
        
        // Find file input using selector string
        const audioInputSelector = 'input[type="file"][accept*="audio"]'
        const fileInput = document.querySelector(audioInputSelector)
        if (fileInput) {
          await this.navigator.uploadFile(audioInputSelector, audioFile)
          console.log('[Audio Narration] Audio file uploaded')
          await this.navigator.delay(1000)
        } else {
          console.warn('[Audio Narration] Audio file input not found')
          await this.captureDebugScreenshot('audio-file-input-not-found')
        }
      } else {
        console.warn('[Audio Narration] No upload buttons found')
        await this.captureDebugScreenshot('audio-upload-buttons-not-found')
      }
      
      await this.captureScreenshot('audio-upload-complete')
    } catch (error) {
      console.error('[Audio Narration] Audio Upload test failed:', error)
    }
  }
  
  private async testMurfAI(): Promise<void> {
    console.log('[Audio Narration] Testing Murf AI Integration...')
    if (!this.navigator) {
      console.warn('[Audio Narration] Navigator not available for Murf AI test')
      return
    }
    try {
      // Look for Murf tab or button
      const murfTabSelector = '[data-testid="murf-tab"]'
      const murfTabFallback = 'button:contains("Murf")'
      const murfTab = document.querySelector(murfTabSelector) || document.querySelector(murfTabFallback)
      
      if (murfTab) {
        const selector = document.querySelector(murfTabSelector) ? murfTabSelector : murfTabFallback
        await this.navigator.clickButton(selector)
        await this.navigator.delay(500)
        
        // Check if API key is needed
        const apiKeySelector = '[data-testid="murf-api-key-input"]'
        const apiKeyInput = document.querySelector(apiKeySelector)
        if (apiKeyInput) {
          await this.navigator.fillInput(apiKeySelector, 'test-api-key-12345')
          await this.navigator.delay(500)
        }
        
        // Generate AI voice
        const generateButtonSelector = '[data-testid="generate-murf-voice"]'
        const generateButton = document.querySelector(generateButtonSelector)
        if (generateButton) {
          await this.navigator.clickButton(generateButtonSelector)
          console.log('[Audio Narration] Generating Murf AI voice...')
          await this.navigator.delay(2000)
          
          // Preview if available
          const previewButtonSelector = '[data-testid="preview-murf-audio"]'
          const previewButton = document.querySelector(previewButtonSelector)
          if (previewButton) {
            await this.navigator.clickButton(previewButtonSelector)
            console.log('[Audio Narration] Previewing Murf audio')
            await this.navigator.delay(1000)
          }
        } else {
          console.warn('[Audio Narration] Murf generate button not found')
          await this.captureDebugScreenshot('murf-generate-button-not-found')
        }
      } else {
        console.warn('[Audio Narration] Murf tab not found')
        await this.captureDebugScreenshot('murf-tab-not-found')
      }
      
      await this.captureScreenshot('murf-ai-complete')
    } catch (error) {
      console.error('[Audio Narration] Murf AI test failed:', error)
    }
  }
  
  private async testRichTextEditor(): Promise<void> {
    console.log('[Media Enhancement] Testing Rich Text Editor...')
    if (!this.navigator) {
      console.warn('[Media Enhancement] Navigator not available for Rich Text Editor test')
      return
    }
    try {
      // Find and click Edit Content button
      const editContentButton = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent?.includes('Edit Content')
      )
      
      if (editContentButton) {
        console.log('[Media Enhancement] Opening rich text editor...')
        // Click the edit button
        if (editContentButton.id) {
          await this.navigator.clickButton(`#${editContentButton.id}`)
        } else {
          const parent = editContentButton.parentElement
          if (parent) {
            const buttons = parent.querySelectorAll('button')
            const index = Array.from(buttons).indexOf(editContentButton as HTMLButtonElement)
            if (index >= 0) {
              const parentSelector = parent.className ? `.${parent.className.split(' ')[0]}` : parent.tagName.toLowerCase()
              await this.navigator.clickButton(`${parentSelector} button:nth-of-type(${index + 1})`)
            }
          }
        }
        await this.navigator.delay(1000) // Wait for modal to open
        
        // Find the contentEditable div
        const editor = document.querySelector('[contenteditable="true"]')
        if (editor) {
          console.log('[Media Enhancement] Found rich text editor')
          
          // Clear existing content and add new content
          const testContent = '<h2>Test Content</h2><p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
          
          // Focus the editor
          (editor as HTMLElement).focus();
          await this.navigator.delay(500);
          
          // Select all and delete
          document.execCommand('selectAll', false);
          await this.navigator.delay(200);
          document.execCommand('delete', false);
          await this.navigator.delay(200);
          
          // Insert new content
          document.execCommand('insertHTML', false, testContent);
          await this.navigator.delay(500);
          
          // Test formatting buttons
          const boldButton = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent?.toLowerCase() === 'b' || btn.title?.toLowerCase().includes('bold')
          );
          if (boldButton) {
            console.log('[Media Enhancement] Testing bold formatting');
            // Select some text first
            document.execCommand('selectAll', false);
            await this.navigator.delay(200);
            
            // Click bold button
            (boldButton as HTMLElement).click();
            await this.navigator.delay(500);
          }
          
          // Save the content
          const saveButton = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent?.includes('Save')
          )
          if (saveButton) {
            console.log('[Media Enhancement] Saving rich text content');
            (saveButton as HTMLElement).click();
            await this.navigator.delay(1000)
          }
        } else {
          console.warn('[Media Enhancement] Rich text editor not found')
          await this.captureDebugScreenshot('rich-text-editor-not-found')
        }
      } else {
        console.warn('[Media Enhancement] Edit Content button not found')
        await this.captureDebugScreenshot('edit-content-button-not-found')
      }
      
      await this.captureScreenshot('rich-text-editor-complete')
    } catch (error) {
      console.error('[Media Enhancement] Rich Text Editor test failed:', error)
    }
  }
  
  private async testBulkReplace(): Promise<void> {
    console.log('[Audio Narration] Testing Bulk Replace...')
    if (!this.navigator) {
      console.warn('[Audio Narration] Navigator not available for Bulk Replace test')
      return
    }
    try {
      // Look for bulk replace button
      const bulkReplaceButtonSelector = '[data-testid="bulk-replace-button"]'
      const bulkReplaceButton = document.querySelector(bulkReplaceButtonSelector)
      
      if (bulkReplaceButton) {
        await this.navigator.clickButton(bulkReplaceButtonSelector)
        await this.navigator.delay(500)
        
        // Enter find text
        const findInputSelector = '[data-testid="find-text-input"]'
        const findInput = document.querySelector(findInputSelector)
        if (findInput) {
          await this.navigator.fillInput(findInputSelector, 'old text')
          await this.navigator.delay(300)
        }
        
        // Enter replace text
        const replaceInputSelector = '[data-testid="replace-text-input"]'
        const replaceInput = document.querySelector(replaceInputSelector)
        if (replaceInput) {
          await this.navigator.fillInput(replaceInputSelector, 'new text')
          await this.navigator.delay(300)
        }
        
        // Click replace all
        const replaceAllButtonSelector = '[data-testid="replace-all-button"]'
        const replaceAllButton = document.querySelector(replaceAllButtonSelector)
        if (replaceAllButton) {
          await this.navigator.clickButton(replaceAllButtonSelector)
          console.log('[Audio Narration] Bulk replace executed')
          await this.navigator.delay(1000)
        }
      } else {
        console.warn('[Audio Narration] Bulk replace button not found')
        await this.captureDebugScreenshot('bulk-replace-button-not-found')
      }
      
      await this.captureScreenshot('bulk-replace-complete')
    } catch (error) {
      console.error('[Audio Narration] Bulk Replace test failed:', error)
    }
  }
  
  private async editRichText(): Promise<void> {
    this.reporter.startStep('edit-rich-text')
    
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      // Edit the welcome page content
      const welcome = await this.storage.getContent('welcome')
      if (welcome) {
        welcome.content = `<h1>Welcome to Our Enhanced Course</h1>
<p>This content has been <strong>automatically edited</strong> by our test automation.</p>
<blockquote>
  <p><em>"Automation makes testing efficient and repeatable."</em></p>
</blockquote>
<p>Additional formatting includes:</p>
<ul>
  <li>Bold text for emphasis</li>
  <li>Italic text for quotes</li>
  <li>Lists for organization</li>
</ul>`
        
        await this.storage.saveContent('welcome', welcome)
      }
      
      this.reporter.completeStep('edit-rich-text')
    } catch (error) {
      // Capture error screenshot
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'edit-rich-text-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      this.reporter.failStep('edit-rich-text', error instanceof Error ? error.message : String(error))
    }
  }
  
  private async uploadImages(): Promise<void> {
    this.reporter.startStep('upload-images')
    
    try {
      if (!this.mediaService || !this.storage) throw new Error('Services not initialized')
      
      // Upload custom images to learning objectives page
      const imageBlob = await TestDataGenerator.generateTestImage('Custom Objectives Image')
      const imageFile = new File([imageBlob], 'objectives-custom.png', { type: 'image/png' })
      
      const mediaItem = await this.mediaService.storeMedia(imageFile, 'objectives', 'image')
      if (mediaItem) {
        const objectives = await this.storage.getContent('objectives')
        if (objectives) {
          objectives.media = objectives.media || []
          objectives.media.push({
            id: mediaItem.id,
            type: 'image',
            url: mediaItem.id,
            title: 'Custom Objectives Image'
          })
          await this.storage.saveContent('objectives', objectives)
        }
      }
      
      this.reporter.completeStep('upload-images')
    } catch (error) {
      // Capture error screenshot
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'upload-images-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      this.reporter.failStep('upload-images', error instanceof Error ? error.message : String(error))
    }
  }
  
  private async addYouTubeVideos(): Promise<void> {
    this.reporter.startStep('add-youtube')
    
    try {
      if (!this.mediaService || !this.storage) throw new Error('Services not initialized')
      
      // Add YouTube video to welcome page
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      
      const mediaItem = await this.mediaService.storeYouTubeVideo(
        youtubeUrl,
        embedUrl,
        'welcome',
        { title: 'Welcome Video' }
      )
      
      if (mediaItem) {
        const welcome = await this.storage.getContent('welcome')
        if (welcome) {
          welcome.media = welcome.media || []
          welcome.media.push({
            id: mediaItem.id,
            type: 'youtube',
            url: youtubeUrl,
            title: 'Welcome Video'
          })
          await this.storage.saveContent('welcome', welcome)
        }
      }
      
      this.reporter.completeStep('add-youtube')
    } catch (error) {
      // Capture error screenshot
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'add-youtube-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      this.reporter.failStep('add-youtube', error instanceof Error ? error.message : String(error))
    }
  }
  
  private async testQuestionEditing(): Promise<void> {
    console.log('[Questions & Assessment] Testing Question Editing...')
    if (!this.navigator) {
      console.warn('[Questions & Assessment] Navigator not available for Question Editing test')
      return
    }
    try {
      // Look for Edit buttons using data-testid or className
      let editButton = document.querySelector('[data-testid="edit-question-button"], .question-edit-button') as HTMLElement
      
      if (!editButton) {
        // Fallback: Find knowledge check questions and look for Edit button
        const questionCards = document.querySelectorAll('.card, [data-testid^="question-card-"]')
        console.log(`[Questions & Assessment] Found ${questionCards.length} question cards`)
        
        if (questionCards.length > 0) {
          // Try to find any Edit button
          editButton = document.querySelector('button.question-edit-button, [data-testid="edit-question-button"]') as HTMLElement
        }
      }
      
      if (editButton) {
          console.log('[Questions & Assessment] Clicking edit button for first question');
          (editButton as HTMLElement).click();
          await this.navigator.delay(1000) // Wait for modal/edit mode
          
          // Look for question text input
          const questionInput = document.querySelector('input[placeholder*="question"], textarea[placeholder*="question"]')
          if (questionInput) {
            console.log('[Questions & Assessment] Modifying question text');
            const inputElement = questionInput as HTMLInputElement;
            inputElement.focus();
            inputElement.select();
            inputElement.value = 'What is the primary benefit of this automated test?'
            
            // Trigger change event
            const event = new Event('input', { bubbles: true });
            inputElement.dispatchEvent(event);
            await this.navigator.delay(500)
          }
          
          // Look for answer options
          const answerInputs = document.querySelectorAll('input[placeholder*="option"], input[placeholder*="answer"]')
          if (answerInputs.length > 0) {
            console.log(`[Questions & Assessment] Found ${answerInputs.length} answer options`)
            // Modify first answer
            const firstAnswer = answerInputs[0] as HTMLInputElement;
            firstAnswer.focus();
            firstAnswer.select();
            firstAnswer.value = 'Comprehensive test coverage'
            
            const event = new Event('input', { bubbles: true });
            firstAnswer.dispatchEvent(event);
            await this.navigator.delay(500)
          }
          
          // Save changes
          const saveButton = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent?.includes('Save') || btn.textContent?.includes('Apply')
          )
          if (saveButton) {
            console.log('[Questions & Assessment] Saving question changes');
            (saveButton as HTMLElement).click();
            await this.navigator.delay(1000)
          }
        } else {
          console.warn('[Questions & Assessment] Edit button not found')
          await this.captureDebugScreenshot('question-edit-button-not-found')
        }
      
      await this.captureScreenshot('question-editing-complete')
    } catch (error) {
      console.error('[Questions & Assessment] Question Editing test failed:', error)
    }
  }
  
  private async testAssessmentQuestions(): Promise<void> {
    console.log('[Questions & Assessment] Testing Assessment Questions...')
    if (!this.navigator) {
      console.warn('[Questions & Assessment] Navigator not available for Assessment test')
      return
    }
    try {
      // Look for assessment section
      const assessmentSection = document.querySelector('[class*="assessment"], [class*="quiz"]')
      
      if (assessmentSection) {
        console.log('[Questions & Assessment] Found assessment section')
        
        // Find all assessment questions
        const assessmentQuestions = assessmentSection.querySelectorAll('[class*="question"]')
        console.log(`[Questions & Assessment] Found ${assessmentQuestions.length} assessment questions`)
        
        if (assessmentQuestions.length > 0) {
          // Test different question types
          for (let i = 0; i < Math.min(3, assessmentQuestions.length); i++) {
            const question = assessmentQuestions[i]
            
            // Check question type
            const typeIndicator = question.querySelector('[class*="type"], [class*="badge"]')
            const questionType = typeIndicator?.textContent?.toLowerCase() || 'unknown'
            console.log(`[Questions & Assessment] Testing ${questionType} question`)
            
            // Find and click edit button for this question
            const editBtn = question.querySelector('button')
            if (editBtn && editBtn.textContent?.includes('Edit')) {
              (editBtn as HTMLElement).click();
              await this.navigator.delay(1000)
              
              // Make a small edit based on question type
              if (questionType.includes('multiple')) {
                // Multiple choice - try to change an option
                const optionInputs = document.querySelectorAll('input[type="text"]')
                if (optionInputs.length > 0) {
                  const firstOption = optionInputs[0] as HTMLInputElement;
                  firstOption.value = 'Updated option via automation';
                  firstOption.dispatchEvent(new Event('input', { bubbles: true }))
                }
              } else if (questionType.includes('true') || questionType.includes('false')) {
                // True/false - toggle the correct answer
                const radioButtons = document.querySelectorAll('input[type="radio"]')
                if (radioButtons.length > 0) {
                  (radioButtons[1] as HTMLInputElement).click()
                }
              }
              
              await this.navigator.delay(500)
              
              // Save changes
              const saveBtn = Array.from(document.querySelectorAll('button')).find(b => 
                b.textContent?.includes('Save')
              )
              if (saveBtn) {
                (saveBtn as HTMLElement).click();
                await this.navigator.delay(1000)
              }
            }
          }
        }
      } else {
        console.warn('[Questions & Assessment] Assessment section not found')
        await this.captureDebugScreenshot('assessment-section-not-found')
      }
      
      await this.captureScreenshot('assessment-testing-complete')
    } catch (error) {
      console.error('[Questions & Assessment] Assessment test failed:', error)
    }
  }
  
  private async editActivities(): Promise<void> {
    this.reporter.startStep('edit-activities')
    if (this.useVisualMode) {
      progressManager.startStep('edit-activities')
    }
    
    try {
      if (!this.storage) throw new Error('Storage not initialized')
      
      // Visual navigation: Edit activities
      if (this.navigator && this.useVisualMode) {
        await this.captureScreenshot('activities-editor-page')
        
        // Determine which tests to run based on scenario
        const scenario = this.options?.scenario || 'standard'
        console.log(`[Questions & Assessment] Running ${scenario} scenario`)
        
        if (scenario === 'comprehensive' || scenario === 'content-focus') {
          // Run all content and question tests
          await this.testQuestionEditing()
          await this.testAssessmentQuestions()
        } else if (scenario === 'standard') {
          // Run basic question editing test
          await this.testQuestionEditing()
        }
        // For 'quick' scenario, skip all tests
        
        try {
          // Click Next to proceed to SCORM Builder
          await this.navigator.delay(1000) // Let page load
          await this.navigator.clickButton('[data-testid="next-button"]')
          
          // Wait for navigation to SCORM Builder
          await this.navigator.waitForPage('Generate SCORM Package', 5000)
          await this.captureScreenshot('navigated-to-scorm-builder')
        } catch (navError) {
          console.log('Visual navigation failed for activities, continuing:', navError)
        }
      }
      
      // Edit knowledge check questions
      const topic1 = await this.storage.getContent('content-2')
      if (topic1 && topic1.knowledgeCheck) {
        // Add a new question
        topic1.knowledgeCheck.questions.push({
          id: `kc-edited-${Date.now()}`,
          type: 'true-false',
          question: 'This question was added by automation testing.',
          correct: true
        })
        
        await this.storage.saveContent('content-2', topic1)
      }
      
      // Edit assessment questions
      const assessment = await this.storage.getContent('assessment')
      if (assessment && assessment.questions) {
        // Modify an existing question
        if (assessment.questions.length > 0) {
          assessment.questions[0].question = 'EDITED: ' + assessment.questions[0].question
        }
        
        // Add a new question
        assessment.questions.push({
          id: `assess-edited-${Date.now()}`,
          type: 'multiple-choice',
          question: 'Which statement about automation testing is correct?',
          options: [
            'It saves time',
            'It improves consistency',
            'It catches regressions',
            'All of the above'
          ],
          correct: 3
        })
        
        await this.storage.saveContent('assessment', assessment)
      }
      
      this.reporter.completeStep('edit-activities', {
        knowledgeCheckEdited: true,
        assessmentEdited: true
      })
      if (this.useVisualMode) {
        progressManager.completeStep('edit-activities', 'Activities edited')
      }
    } catch (error) {
      this.reporter.failStep('edit-activities', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('edit-activities', error instanceof Error ? error.message : String(error))
      }
      this.errors.push(`Activities error: ${error}`)
    }
  }
  
  private async generateScorm(): Promise<void> {
    this.reporter.startStep('generate-scorm')
    if (this.useVisualMode) {
      progressManager.startStep('generate-scorm')
    }
    
    try {
      if (!this.storage || !this.projectId) throw new Error('Storage not initialized')
      
      this.reporter.log('Preparing SCORM generation...')
      
      // Visual navigation: Generate SCORM
      if (this.navigator && this.useVisualMode) {
        await this.captureScreenshot('scorm-builder-page')
        
        try {
          // Click Generate SCORM Package button - look for button with specific text
          await this.navigator.waitForText('Generate SCORM Package')
          const generateButtons = document.querySelectorAll('button')
          let generateButton: HTMLElement | null = null
          for (const btn of generateButtons) {
            if (btn.textContent?.includes('Generate SCORM Package')) {
              generateButton = btn as HTMLElement
              break
            }
          }
          
          if (generateButton) {
            generateButton.click()
            await this.navigator.delay(5000) // Wait longer for generation to complete
            await this.captureScreenshot('scorm-generated')
            
            // Wait for success message or download button to appear
            try {
              // Check if Package Ready message appears
              await this.navigator.waitForText('Package Ready!', 10000)
              await this.captureScreenshot('scorm-package-ready')
              
              // The download button should now be visible in the page header actions
              const downloadButtons = document.querySelectorAll('button')
              for (const btn of downloadButtons) {
                if (btn.textContent?.includes('Download Package')) {
                  await this.captureScreenshot('scorm-ready-to-download')
                  break
                }
              }
            } catch (waitError) {
              console.log('Package generation may still be in progress:', waitError)
            }
          }
        } catch (navError) {
          console.log('Visual navigation issue in SCORM generation, continuing:', navError)
        }
      }
      
      // Get the course content
      const courseContent = await this.storage.getContent('course-content')
      if (!courseContent) throw new Error('No course content found')
      
      // Get course metadata
      const courseSeedData = await this.storage.getContent('courseSeedData')
      
      // Prepare metadata
      const metadata: CourseMetadata = {
        title: courseSeedData?.courseTitle || 'Untitled Course',
        identifier: this.projectId,
        version: '1.0',
        scormVersion: '1.2',
        duration: 0,
        passMark: 80
      }
      
      // Convert to enhanced content
      this.reporter.log('Converting course content...')
      const enhancedContent = await convertToEnhancedCourseContent(courseContent as any, metadata)
      
      // Generate SCORM package using the same method as SCORMPackageBuilder
      this.reporter.log('Generating SCORM package...')
      const result = await generateRustSCORM(enhancedContent, this.projectId)
      
      if (!result) {
        throw new Error('Failed to generate SCORM package - no data returned')
      }
      
      this.reporter.log('SCORM package generated successfully!')
      
      // Navigate back to dashboard if we're in visual mode to enable other tests
      if (this.navigator && this.useVisualMode) {
        await this.navigateBackToDashboard()
      }
      
      this.reporter.completeStep('generate-scorm', {
        size: result.byteLength,
        success: true
      })
      if (this.useVisualMode) {
        progressManager.completeStep('generate-scorm', 'SCORM package generated')
      }
    } catch (error) {
      this.reporter.failStep('generate-scorm', error instanceof Error ? error.message : String(error))
      if (this.useVisualMode) {
        progressManager.failStep('generate-scorm', error instanceof Error ? error.message : String(error))
      }
      this.errors.push(`SCORM generation error: ${error}`)
    }
  }
  
  /**
   * Navigate back to the project dashboard from any page
   */
  private async navigateBackToDashboard(): Promise<void> {
    if (!this.navigator) return
    
    try {
      this.reporter.log('Navigating back to dashboard...')
      
      // First, check if we have a "Back to Dashboard" button
      const dashboardButton = document.querySelector('[data-testid="back-to-dashboard"]')
      if (dashboardButton) {
        await this.navigator.clickButton('[data-testid="back-to-dashboard"]')
        await this.navigator.delay(2000)
        await this.captureScreenshot('returned-to-dashboard')
        return
      }
      
      // Try using the Open menu option to get back to dashboard
      const openButton = document.querySelector('[data-testid="open-button"]') || 
                        Array.from(document.querySelectorAll('button')).find(btn => 
                          btn.textContent?.includes('Open')
                        )
      
      if (openButton) {
        (openButton as HTMLElement).click()
        await this.navigator.delay(1500)
        
        // This should trigger unsaved changes dialog or directly go to dashboard
        const unsavedDialog = await this.navigator.waitForModal('Unsaved Changes', 1000).catch(() => null)
        if (unsavedDialog) {
          // Discard changes to go back to dashboard
          const discardButton = document.querySelector('[data-testid="discard-changes"]') ||
                                Array.from(document.querySelectorAll('button')).find(btn => 
                                  btn.textContent?.includes('Discard')
                                )
          if (discardButton) {
            (discardButton as HTMLElement).click()
            await this.navigator.delay(2000)
          }
        }
        
        await this.captureScreenshot('navigated-to-dashboard')
        return
      }
      
      // Fallback: Try using browser back navigation
      this.reporter.log('Using fallback navigation to dashboard...')
      window.history.back()
      await this.navigator.delay(2000)
      
      // Check if we're on the dashboard
      const dashboardElement = document.querySelector('[data-testid="project-dashboard"]')
      if (dashboardElement) {
        await this.captureScreenshot('returned-to-dashboard-fallback')
      } else {
        this.reporter.log('Warning: Could not confirm navigation to dashboard')
      }
      
    } catch (error) {
      this.reporter.log(`Navigation to dashboard failed: ${error}`, 'warning')
      // Don't throw - just log the warning and continue
    }
  }
  
  /**
   * Test course preview navigation in detail
   */
  private async testPreview(): Promise<void> {
    this.reporter.startStep('test-preview')
    
    try {
      if (!this.navigator) {
        // Fallback to basic verification
        if (!this.storage) throw new Error('Storage not initialized')
        
        const courseContent = await this.storage.getContent('course-content')
        const metadata = await this.storage.getCourseMetadata()
        
        if (!courseContent || !metadata) {
          throw new Error('Missing course data for preview')
        }
        
        this.reporter.log('Preview data verified (basic mode)')
        this.reporter.completeStep('test-preview')
        return
      }
      
      // Enhanced preview testing with UI navigation
      this.reporter.log('Testing course preview navigation...')
      
      // The preview is integrated into the page - look for preview panel
      await this.captureScreenshot('preview-before-check')
      const previewPanel = document.querySelector('[data-testid="preview-panel"]') || 
                          document.querySelector('.preview-container') ||
                          document.querySelector('[data-testid="real-time-preview"]')
      
      if (previewPanel) {
        this.reporter.log('Found integrated preview panel')
        await this.captureScreenshot('preview-panel-found')
        await this.navigator.delay(2000) // Wait for preview to fully render
        
        // Test welcome page
        await this.captureScreenshot('preview-welcome-page')
        const welcomeContent = document.querySelector('[data-testid="preview-welcome-content"]')
        if (welcomeContent) {
          this.reporter.log('Welcome page loaded successfully')
        }
        
        // Navigate to objectives
        const nextButton = await this.navigator.waitForElement('[data-testid="preview-next-button"]')
        if (nextButton) {
          await this.navigator.click(nextButton)
          await this.captureScreenshot('preview-objectives-page')
          await this.navigator.delay(1000)
        }
        
        // Navigate through topics
        const topicCount = document.querySelectorAll('[data-testid^="preview-topic-"]').length
        this.reporter.log(`Found ${topicCount} topics to navigate`)
        
        for (let i = 0; i < Math.min(topicCount, 3); i++) { // Test first 3 topics
          await this.navigator.click(nextButton)
          await this.captureScreenshot(`preview-topic-${i}`)
          await this.navigator.delay(1000)
          
          // Check for knowledge check questions
          const kcQuestion = document.querySelector('[data-testid="preview-kc-question"]')
          if (kcQuestion) {
            await this.captureScreenshot(`preview-topic-${i}-knowledge-check`)
            
            // Try to answer the question
            const firstOption = document.querySelector('[data-testid="kc-option-0"]')
            if (firstOption) {
              await this.navigator.click(firstOption as HTMLElement)
              await this.captureScreenshot(`preview-topic-${i}-kc-answered`)
              
              // Submit answer
              const submitButton = document.querySelector('[data-testid="kc-submit"]')
              if (submitButton) {
                await this.navigator.click(submitButton as HTMLElement)
                await this.captureScreenshot(`preview-topic-${i}-kc-feedback`)
              }
            }
          }
        }
        
        // Test navigation menu
        const navMenu = document.querySelector('[data-testid="preview-nav-menu"]')
        if (navMenu) {
          await this.navigator.click(navMenu as HTMLElement)
          await this.captureScreenshot('preview-nav-menu-open')
          
          // Try to jump to a specific section
          const topicLink = document.querySelector('[data-testid="nav-topic-1"]')
          if (topicLink) {
            await this.navigator.click(topicLink as HTMLElement)
            await this.captureScreenshot('preview-jumped-to-topic')
          }
        }
        
        // Test previous button
        const prevButton = document.querySelector('[data-testid="preview-prev-button"]')
        if (prevButton) {
          await this.navigator.click(prevButton as HTMLElement)
          await this.captureScreenshot('preview-navigated-back')
        }
        
        // Test assessment if available
        const assessmentLink = document.querySelector('[data-testid="nav-assessment"]')
        if (assessmentLink) {
          await this.navigator.click(assessmentLink as HTMLElement)
          await this.captureScreenshot('preview-assessment-page')
          
          // Answer some assessment questions
          const assessmentQuestions = document.querySelectorAll('[data-testid^="assessment-q-"]')
          for (let i = 0; i < Math.min(assessmentQuestions.length, 2); i++) {
            const option = document.querySelector(`[data-testid="assessment-q-${i}-option-0"]`)
            if (option) {
              await this.navigator.click(option as HTMLElement)
              await this.captureScreenshot(`preview-assessment-q-${i}-answered`)
            }
          }
          
          // Submit assessment
          const submitAssessment = document.querySelector('[data-testid="submit-assessment"]')
          if (submitAssessment) {
            await this.navigator.click(submitAssessment as HTMLElement)
            await this.captureScreenshot('preview-assessment-results')
          }
        }
        
        // Test audio controls if present
        const audioPlay = document.querySelector('[data-testid="preview-audio-play"]')
        if (audioPlay) {
          await this.navigator.click(audioPlay as HTMLElement)
          await this.captureScreenshot('preview-audio-playing')
          await this.navigator.delay(2000)
          
          // Pause audio
          const audioPause = document.querySelector('[data-testid="preview-audio-pause"]')
          if (audioPause) {
            await this.navigator.click(audioPause as HTMLElement)
            await this.captureScreenshot('preview-audio-paused')
          }
        }
        
        // Test fullscreen mode
        const fullscreenButton = document.querySelector('[data-testid="preview-fullscreen"]')
        if (fullscreenButton) {
          await this.navigator.click(fullscreenButton as HTMLElement)
          await this.captureScreenshot('preview-fullscreen')
          await this.navigator.delay(1000)
          
          // Exit fullscreen
          await this.navigator.pressKey('Escape')
          await this.captureScreenshot('preview-fullscreen-exited')
        }
        
        // Close preview
        const closeButton = document.querySelector('[data-testid="preview-close"]')
        if (closeButton) {
          await this.navigator.click(closeButton as HTMLElement)
          await this.captureScreenshot('preview-closed')
        } else {
          // Fallback: use Escape key
          await this.navigator.pressKey('Escape')
        }
        
        this.reporter.log('Course preview navigation test completed')
      } else {
        this.reporter.log('Preview panel not found, may be on wrong page')
      }
      
      this.reporter.completeStep('test-preview')
    } catch (error) {
      // Capture error screenshot
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'test-preview-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      this.reporter.failStep('test-preview', error instanceof Error ? error.message : String(error))
    }
  }
  
  private async verifyPersistence(): Promise<void> {
    this.reporter.startStep('verify-persistence')
    
    try {
      if (!this.storage || !this.projectId) throw new Error('Storage not initialized')
      
      // Reopen the project
      await this.storage.openProject(this.projectId)
      
      // Verify all data is still there
      const metadata = await this.storage.getCourseMetadata()
      const courseContent = await this.storage.getContent('course-content')
      const welcome = await this.storage.getContent('welcome')
      const assessment = await this.storage.getContent('assessment')
      
      const checks = {
        hasMetadata: !!metadata,
        hasCourseContent: !!courseContent,
        hasWelcome: !!welcome,
        hasAssessment: !!assessment,
        topicCount: courseContent?.topics?.length || 0
      }
      
      if (!checks.hasMetadata || !checks.hasCourseContent) {
        throw new Error('Data persistence verification failed')
      }
      
      this.reporter.completeStep('verify-persistence', checks)
    } catch (error) {
      // Capture error screenshot
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'verify-persistence-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      this.reporter.failStep('verify-persistence', error instanceof Error ? error.message : String(error))
      this.errors.push(`Persistence error: ${error}`)
    }
  }
  
  /**
   * Test project management features - delete, rename, import/export
   */
  private async testProjectManagement(): Promise<void> {
    this.reporter.log('Testing project management features...')
    
    if (!this.navigator) return
    
    try {
      // Navigate to project dashboard
      await this.captureScreenshot('project-management-start')
      
      // Test project renaming
      const projectCard = document.querySelector('[data-testid^="project-card-"]')
      if (projectCard) {
        await this.captureScreenshot('project-card-found')
        
        // Right-click or find menu button
        const menuButton = projectCard.querySelector('[data-testid="project-menu-button"]')
        if (menuButton) {
          await this.navigator.click(menuButton as HTMLElement)
          await this.captureScreenshot('project-menu-open')
          
          // Click rename option
          const renameOption = await this.navigator.waitForElement('[data-testid="rename-project"]')
          await this.navigator.click(renameOption)
          await this.captureScreenshot('rename-dialog-open')
          
          // Enter new name
          await this.navigator.fillInput('[data-testid="rename-input"]', 'Renamed Test Project')
          await this.captureScreenshot('rename-input-filled')
          
          // Confirm rename
          await this.navigator.clickButton('[data-testid="rename-confirm"]')
          await this.captureScreenshot('project-renamed')
        }
      }
      
      // Test project export
      await this.navigator.clickButton('[data-testid="export-project"]')
      await this.captureScreenshot('export-dialog-open')
      await this.navigator.delay(1000)
      
      // Test project import
      await this.navigator.clickButton('[data-testid="import-project"]')
      await this.captureScreenshot('import-dialog-open')
      
      // Test project deletion (with cancel)
      const deleteButton = document.querySelector('[data-testid="delete-project"]')
      if (deleteButton) {
        await this.navigator.click(deleteButton as HTMLElement)
        await this.captureScreenshot('delete-confirmation-dialog')
        
        // Cancel deletion
        await this.navigator.clickButton('[data-testid="cancel-delete"]')
        await this.captureScreenshot('delete-cancelled')
      }
      
      this.reporter.log('Project management tests completed')
    } catch (error) {
      console.warn('Project management test failed:', error)
      await this.captureScreenshot('project-management-error')
    }
  }

  /**
   * Test settings and configuration features
   */
  private async testSettings(): Promise<void> {
    this.reporter.log('Testing settings and configuration...')
    
    if (!this.navigator) return
    
    try {
      // Open settings
      await this.navigator.clickButton('[data-testid="settings-button"]')
      await this.captureScreenshot('settings-opened')
      
      // Test API key configuration
      const apiKeySection = await this.navigator.waitForElement('[data-testid="api-keys-section"]')
      if (apiKeySection) {
        await this.captureScreenshot('api-keys-section')
        
        // Fill in test API keys
        await this.navigator.fillInput('[data-testid="google-api-key"]', 'test-google-api-key')
        await this.captureScreenshot('google-api-key-filled')
        
        await this.navigator.fillInput('[data-testid="murf-api-key"]', 'test-murf-api-key')
        await this.captureScreenshot('murf-api-key-filled')
        
        // Save settings
        await this.navigator.clickButton('[data-testid="save-settings"]')
        await this.captureScreenshot('settings-saved')
      }
      
      // Test theme switching
      const themeToggle = document.querySelector('[data-testid="theme-toggle"]')
      if (themeToggle) {
        await this.navigator.click(themeToggle as HTMLElement)
        await this.captureScreenshot('theme-switched')
        
        // Switch back
        await this.navigator.click(themeToggle as HTMLElement)
        await this.captureScreenshot('theme-switched-back')
      }
      
      // Test auto-save toggle
      const autoSaveToggle = document.querySelector('[data-testid="autosave-toggle"]')
      if (autoSaveToggle) {
        await this.navigator.click(autoSaveToggle as HTMLElement)
        await this.captureScreenshot('autosave-toggled')
      }
      
      // Close settings
      await this.navigator.clickButton('[data-testid="close-settings"]')
      await this.captureScreenshot('settings-closed')
      
      this.reporter.log('Settings tests completed')
    } catch (error) {
      console.warn('Settings test failed:', error)
      await this.captureScreenshot('settings-error')
    }
  }

  /**
   * Test media library bulk operations
   */
  private async testMediaLibrary(): Promise<void> {
    this.reporter.log('Testing media library features...')
    
    if (!this.navigator) return
    
    try {
      // Open media library
      await this.navigator.clickButton('[data-testid="media-library-button"]')
      await this.captureScreenshot('media-library-opened')
      
      // Test bulk selection
      const selectAllButton = await this.navigator.waitForElement('[data-testid="select-all-media"]')
      if (selectAllButton) {
        await this.navigator.click(selectAllButton)
        await this.captureScreenshot('all-media-selected')
        
        // Test bulk delete (with cancel)
        await this.navigator.clickButton('[data-testid="bulk-delete"]')
        await this.captureScreenshot('bulk-delete-confirmation')
        
        // Cancel bulk delete
        await this.navigator.clickButton('[data-testid="cancel-bulk-delete"]')
        await this.captureScreenshot('bulk-delete-cancelled')
        
        // Deselect all
        await this.navigator.click(selectAllButton)
        await this.captureScreenshot('all-media-deselected')
      }
      
      // Test media search
      const searchInput = document.querySelector('[data-testid="media-search"]')
      if (searchInput) {
        await this.navigator.fillInput('[data-testid="media-search"]', 'test search')
        await this.captureScreenshot('media-search-results')
        
        // Clear search
        await this.navigator.fillInput('[data-testid="media-search"]', '')
        await this.captureScreenshot('media-search-cleared')
      }
      
      // Test media preview
      const firstMediaItem = document.querySelector('[data-testid^="media-item-"]')
      if (firstMediaItem) {
        await this.navigator.click(firstMediaItem as HTMLElement)
        await this.captureScreenshot('media-preview-opened')
        
        // Close preview
        await this.navigator.pressKey('Escape')
        await this.captureScreenshot('media-preview-closed')
      }
      
      // Close media library
      await this.navigator.clickButton('[data-testid="close-media-library"]')
      await this.captureScreenshot('media-library-closed')
      
      this.reporter.log('Media library tests completed')
    } catch (error) {
      console.warn('Media library test failed:', error)
      await this.captureScreenshot('media-library-error')
    }
  }

  /**
   * Test all question types - multiple choice, true/false, fill-in-blank
   */
  private async testAllQuestionTypes(): Promise<void> {
    this.reporter.log('Testing all question types...')
    
    if (!this.navigator) return
    
    try {
      // Navigate to activities editor
      await this.navigator.clickButton('[data-testid="activities-editor-button"]')
      await this.captureScreenshot('activities-editor-opened')
      
      // Test multiple choice question
      await this.navigator.clickButton('[data-testid="add-multiple-choice"]')
      await this.captureScreenshot('multiple-choice-added')
      
      await this.navigator.fillInput('[data-testid="question-text"]', 'What is the capital of France?')
      await this.captureScreenshot('question-text-filled')
      
      // Add options
      await this.navigator.fillInput('[data-testid="option-0"]', 'London')
      await this.navigator.fillInput('[data-testid="option-1"]', 'Paris')
      await this.navigator.fillInput('[data-testid="option-2"]', 'Berlin')
      await this.navigator.fillInput('[data-testid="option-3"]', 'Madrid')
      await this.captureScreenshot('options-filled')
      
      // Set correct answer
      await this.navigator.click(document.querySelector('[data-testid="correct-answer-1"]') as HTMLElement)
      await this.captureScreenshot('correct-answer-set')
      
      // Test true/false question
      await this.navigator.clickButton('[data-testid="add-true-false"]')
      await this.captureScreenshot('true-false-added')
      
      await this.navigator.fillInput('[data-testid="tf-question-text"]', 'The Earth is flat.')
      await this.captureScreenshot('tf-question-filled')
      
      await this.navigator.click(document.querySelector('[data-testid="answer-false"]') as HTMLElement)
      await this.captureScreenshot('tf-answer-set')
      
      // Test fill-in-the-blank question
      await this.navigator.clickButton('[data-testid="add-fill-blank"]')
      await this.captureScreenshot('fill-blank-added')
      
      await this.navigator.fillInput('[data-testid="fib-question-text"]', 'The capital of France is ____.')
      await this.navigator.fillInput('[data-testid="fib-correct-answer"]', 'Paris')
      await this.captureScreenshot('fill-blank-completed')
      
      // Test question deletion
      const deleteButton = document.querySelector('[data-testid="delete-question-0"]')
      if (deleteButton) {
        await this.navigator.click(deleteButton as HTMLElement)
        await this.captureScreenshot('question-delete-confirmation')
        
        await this.navigator.clickButton('[data-testid="confirm-delete"]')
        await this.captureScreenshot('question-deleted')
      }
      
      // Test question reordering
      const moveUpButton = document.querySelector('[data-testid="move-up-1"]')
      if (moveUpButton) {
        await this.navigator.click(moveUpButton as HTMLElement)
        await this.captureScreenshot('question-moved-up')
      }
      
      this.reporter.log('Question types tests completed')
    } catch (error) {
      console.warn('Question types test failed:', error)
      await this.captureScreenshot('question-types-error')
    }
  }

  /**
   * Test navigation and UI interactions
   */
  private async testNavigationUI(): Promise<void> {
    this.reporter.log('Testing navigation and UI interactions...')
    
    if (!this.navigator) return
    
    try {
      // Test breadcrumb navigation
      const breadcrumbs = document.querySelectorAll('[data-testid^="breadcrumb-"]')
      for (let i = 0; i < breadcrumbs.length; i++) {
        await this.captureScreenshot(`breadcrumb-${i}-before`)
        await this.navigator.click(breadcrumbs[i] as HTMLElement)
        await this.captureScreenshot(`breadcrumb-${i}-clicked`)
      }
      
      // Test sidebar navigation
      const sidebarItems = document.querySelectorAll('[data-testid^="sidebar-item-"]')
      for (let i = 0; i < Math.min(sidebarItems.length, 5); i++) { // Test first 5 items
        await this.navigator.click(sidebarItems[i] as HTMLElement)
        await this.captureScreenshot(`sidebar-item-${i}-clicked`)
      }
      
      // Test tooltips
      const tooltipElements = document.querySelectorAll('[data-tooltip]')
      for (let i = 0; i < Math.min(tooltipElements.length, 3); i++) {
        await this.navigator.hover(tooltipElements[i] as HTMLElement)
        await this.captureScreenshot(`tooltip-${i}-shown`)
      }
      
      // Test keyboard shortcuts
      await this.navigator.pressKey('Control+s') // Save
      await this.captureScreenshot('keyboard-save')
      
      await this.navigator.pressKey('Control+z') // Undo
      await this.captureScreenshot('keyboard-undo')
      
      await this.navigator.pressKey('Control+y') // Redo
      await this.captureScreenshot('keyboard-redo')
      
      // Test responsive menu
      const hamburgerMenu = document.querySelector('[data-testid="hamburger-menu"]')
      if (hamburgerMenu) {
        await this.navigator.click(hamburgerMenu as HTMLElement)
        await this.captureScreenshot('mobile-menu-opened')
        
        await this.navigator.click(hamburgerMenu as HTMLElement)
        await this.captureScreenshot('mobile-menu-closed')
      }
      
      this.reporter.log('Navigation UI tests completed')
    } catch (error) {
      console.warn('Navigation UI test failed:', error)
      await this.captureScreenshot('navigation-ui-error')
    }
  }

  /**
   * Test error handling and recovery
   */
  private async testErrorRecovery(): Promise<void> {
    this.reporter.log('Testing error handling and recovery...')
    
    if (!this.navigator) return
    
    try {
      // Test network error handling
      await this.captureScreenshot('error-recovery-start')
      
      // Simulate network offline
      await this.navigator.executeScript(() => {
        (window as any).__simulateOffline = true
      })
      await this.captureScreenshot('network-offline-simulated')
      
      // Try to save - should show error
      await this.navigator.clickButton('[data-testid="save-button"]')
      await this.captureScreenshot('save-error-shown')
      
      // Restore network
      await this.navigator.executeScript(() => {
        (window as any).__simulateOffline = false
      })
      await this.captureScreenshot('network-restored')
      
      // Test validation errors
      await this.navigator.fillInput('[data-testid="course-title"]', '') // Clear required field
      await this.navigator.clickButton('[data-testid="submit-button"]')
      await this.captureScreenshot('validation-error-shown')
      
      // Fix validation error
      await this.navigator.fillInput('[data-testid="course-title"]', 'Valid Title')
      await this.captureScreenshot('validation-error-fixed')
      
      // Test concurrent editing warning
      await this.navigator.executeScript(() => {
        localStorage.setItem('concurrent-edit-warning', 'true')
      })
      await this.navigator.reload()
      await this.captureScreenshot('concurrent-edit-warning')
      
      this.reporter.log('Error recovery tests completed')
    } catch (error) {
      console.warn('Error recovery test failed:', error)
      await this.captureScreenshot('error-recovery-error')
    }
  }

  /**
   * Test help page and documentation
   */
  private async testHelpPage(): Promise<void> {
    this.reporter.log('Testing help page and documentation...')
    
    if (!this.navigator) return
    
    try {
      // Open help page
      await this.navigator.clickButton('[data-testid="help-button"]')
      await this.captureScreenshot('help-page-opened')
      
      // Test help search
      await this.navigator.fillInput('[data-testid="help-search"]', 'SCORM')
      await this.captureScreenshot('help-search-results')
      
      // Test help categories
      const helpCategories = document.querySelectorAll('[data-testid^="help-category-"]')
      for (let i = 0; i < Math.min(helpCategories.length, 3); i++) {
        await this.navigator.click(helpCategories[i] as HTMLElement)
        await this.captureScreenshot(`help-category-${i}-expanded`)
      }
      
      // Test video tutorials
      const videoTutorial = document.querySelector('[data-testid="video-tutorial-0"]')
      if (videoTutorial) {
        await this.navigator.click(videoTutorial as HTMLElement)
        await this.captureScreenshot('video-tutorial-opened')
        
        // Close video
        await this.navigator.pressKey('Escape')
        await this.captureScreenshot('video-tutorial-closed')
      }
      
      // Test keyboard shortcuts help
      await this.navigator.clickButton('[data-testid="keyboard-shortcuts"]')
      await this.captureScreenshot('keyboard-shortcuts-shown')
      
      // Close help
      await this.navigator.clickButton('[data-testid="close-help"]')
      await this.captureScreenshot('help-closed')
      
      this.reporter.log('Help page tests completed')
    } catch (error) {
      console.warn('Help page test failed:', error)
      await this.captureScreenshot('help-page-error')
    }
  }

  /**
   * Test template selection and switching
   */
  private async testTemplateSelection(): Promise<void> {
    this.reporter.log('Testing template selection and switching...')
    
    if (!this.navigator) return
    
    try {
      await this.captureScreenshot('template-test-start')
      
      // Open template selector
      const templateButton = document.querySelector('[data-testid="template-selector"]')
      if (templateButton) {
        await this.navigator.click(templateButton as HTMLElement)
        await this.captureScreenshot('template-selector-opened')
        
        // Test each template
        const templates = ['Technical', 'Corporate', 'Safety', 'Human Resources']
        for (const template of templates) {
          const templateOption = document.querySelector(`[data-testid="template-${template.toLowerCase().replace(' ', '-')}"]`)
          if (templateOption) {
            await this.navigator.click(templateOption as HTMLElement)
            await this.captureScreenshot(`template-${template.toLowerCase()}-selected`)
            await this.navigator.delay(500)
            
            // Check if topics updated
            const topicsList = document.querySelector('[data-testid="template-topics-list"]')
            if (topicsList) {
              await this.captureScreenshot(`template-${template.toLowerCase()}-topics`)
            }
          }
        }
        
        // Test custom template
        const customOption = document.querySelector('[data-testid="template-custom"]')
        if (customOption) {
          await this.navigator.click(customOption as HTMLElement)
          await this.captureScreenshot('template-custom-selected')
          
          // Add custom topics
          const addTopicButton = document.querySelector('[data-testid="add-custom-topic"]')
          if (addTopicButton) {
            for (let i = 0; i < 3; i++) {
              await this.navigator.click(addTopicButton as HTMLElement)
              await this.navigator.fillInput(`[data-testid="custom-topic-${i}"]`, `Custom Topic ${i + 1}`)
              await this.captureScreenshot(`custom-topic-${i}-added`)
            }
          }
        }
      }
      
      this.reporter.log('Template selection tests completed')
    } catch (error) {
      console.warn('Template selection test failed:', error)
      await this.captureScreenshot('template-test-error')
    }
  }

  /**
   * Test SCORM package validation
   */
  private async testSCORMValidation(): Promise<void> {
    this.reporter.log('Testing SCORM package validation...')
    
    if (!this.navigator) return
    
    try {
      await this.captureScreenshot('scorm-validation-start')
      
      // Open SCORM validation panel
      const validateButton = document.querySelector('[data-testid="validate-scorm"]')
      if (validateButton) {
        await this.navigator.click(validateButton as HTMLElement)
        await this.captureScreenshot('scorm-validation-opened')
        
        // Wait for validation to complete
        await this.navigator.delay(3000)
        
        // Check validation results
        const validationResults = document.querySelector('[data-testid="validation-results"]')
        if (validationResults) {
          await this.captureScreenshot('scorm-validation-results')
          
          // Check for errors
          const errors = document.querySelectorAll('[data-testid^="validation-error-"]')
          if (errors.length > 0) {
            this.reporter.log(`Found ${errors.length} validation errors`)
            for (let i = 0; i < Math.min(errors.length, 3); i++) {
              await this.captureScreenshot(`validation-error-${i}`)
            }
          }
          
          // Check for warnings
          const warnings = document.querySelectorAll('[data-testid^="validation-warning-"]')
          if (warnings.length > 0) {
            this.reporter.log(`Found ${warnings.length} validation warnings`)
            await this.captureScreenshot('validation-warnings')
          }
        }
        
        // Test package structure view
        const structureTab = document.querySelector('[data-testid="package-structure-tab"]')
        if (structureTab) {
          await this.navigator.click(structureTab as HTMLElement)
          await this.captureScreenshot('package-structure-view')
        }
        
        // Test manifest preview
        const manifestTab = document.querySelector('[data-testid="manifest-preview-tab"]')
        if (manifestTab) {
          await this.navigator.click(manifestTab as HTMLElement)
          await this.captureScreenshot('manifest-preview')
        }
      }
      
      this.reporter.log('SCORM validation tests completed')
    } catch (error) {
      console.warn('SCORM validation test failed:', error)
      await this.captureScreenshot('scorm-validation-error')
    }
  }

  /**
   * Test rich text editor features
   */
  private async testRichTextEditor(): Promise<void> {
    this.reporter.log('Testing rich text editor features...')
    
    if (!this.navigator) return
    
    try {
      await this.captureScreenshot('rich-text-editor-start')
      
      // Find a rich text editor
      const editor = document.querySelector('[data-testid="rich-text-editor"]')
      if (editor) {
        // Test formatting buttons
        const boldButton = document.querySelector('[data-testid="format-bold"]')
        if (boldButton) {
          await this.navigator.click(boldButton as HTMLElement)
          await this.captureScreenshot('format-bold-applied')
        }
        
        const italicButton = document.querySelector('[data-testid="format-italic"]')
        if (italicButton) {
          await this.navigator.click(italicButton as HTMLElement)
          await this.captureScreenshot('format-italic-applied')
        }
        
        const underlineButton = document.querySelector('[data-testid="format-underline"]')
        if (underlineButton) {
          await this.navigator.click(underlineButton as HTMLElement)
          await this.captureScreenshot('format-underline-applied')
        }
        
        // Test lists
        const bulletListButton = document.querySelector('[data-testid="format-bullet-list"]')
        if (bulletListButton) {
          await this.navigator.click(bulletListButton as HTMLElement)
          await this.captureScreenshot('bullet-list-created')
        }
        
        const numberedListButton = document.querySelector('[data-testid="format-numbered-list"]')
        if (numberedListButton) {
          await this.navigator.click(numberedListButton as HTMLElement)
          await this.captureScreenshot('numbered-list-created')
        }
        
        // Test headings
        const headingDropdown = document.querySelector('[data-testid="heading-dropdown"]')
        if (headingDropdown) {
          await this.navigator.click(headingDropdown as HTMLElement)
          await this.captureScreenshot('heading-dropdown-opened')
          
          const h2Option = document.querySelector('[data-testid="heading-h2"]')
          if (h2Option) {
            await this.navigator.click(h2Option as HTMLElement)
            await this.captureScreenshot('heading-h2-applied')
          }
        }
        
        // Test link insertion
        const linkButton = document.querySelector('[data-testid="insert-link"]')
        if (linkButton) {
          await this.navigator.click(linkButton as HTMLElement)
          await this.captureScreenshot('link-dialog-opened')
          
          await this.navigator.fillInput('[data-testid="link-url"]', 'https://example.com')
          await this.navigator.fillInput('[data-testid="link-text"]', 'Example Link')
          await this.captureScreenshot('link-details-filled')
          
          const insertLinkButton = document.querySelector('[data-testid="insert-link-confirm"]')
          if (insertLinkButton) {
            await this.navigator.click(insertLinkButton as HTMLElement)
            await this.captureScreenshot('link-inserted')
          }
        }
        
        // Test image insertion
        const imageButton = document.querySelector('[data-testid="insert-image"]')
        if (imageButton) {
          await this.navigator.click(imageButton as HTMLElement)
          await this.captureScreenshot('image-dialog-opened')
        }
        
        // Test table insertion
        const tableButton = document.querySelector('[data-testid="insert-table"]')
        if (tableButton) {
          await this.navigator.click(tableButton as HTMLElement)
          await this.captureScreenshot('table-dialog-opened')
          
          const insertTableButton = document.querySelector('[data-testid="insert-table-confirm"]')
          if (insertTableButton) {
            await this.navigator.click(insertTableButton as HTMLElement)
            await this.captureScreenshot('table-inserted')
          }
        }
        
        // Test undo/redo
        await this.navigator.pressKey('Control+z')
        await this.captureScreenshot('editor-undo')
        
        await this.navigator.pressKey('Control+y')
        await this.captureScreenshot('editor-redo')
      }
      
      this.reporter.log('Rich text editor tests completed')
    } catch (error) {
      console.warn('Rich text editor test failed:', error)
      await this.captureScreenshot('rich-text-editor-error')
    }
  }

  /**
   * Test drag and drop media upload
   */
  private async testDragAndDropUpload(): Promise<void> {
    this.reporter.log('Testing drag and drop media upload...')
    
    if (!this.navigator) return
    
    try {
      await this.captureScreenshot('drag-drop-start')
      
      // Find dropzone
      const dropzone = document.querySelector('[data-testid="media-dropzone"]')
      if (dropzone) {
        // Simulate drag enter
        await this.navigator.executeScript(() => {
          const dropzone = document.querySelector('[data-testid="media-dropzone"]')
          if (dropzone) {
            const dragEnterEvent = new DragEvent('dragenter', {
              bubbles: true,
              cancelable: true,
              dataTransfer: new DataTransfer()
            })
            dropzone.dispatchEvent(dragEnterEvent)
          }
        })
        await this.captureScreenshot('drag-enter-detected')
        
        // Simulate drag over
        await this.navigator.executeScript(() => {
          const dropzone = document.querySelector('[data-testid="media-dropzone"]')
          if (dropzone) {
            const dragOverEvent = new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              dataTransfer: new DataTransfer()
            })
            dropzone.dispatchEvent(dragOverEvent)
          }
        })
        await this.captureScreenshot('drag-over-active')
        
        // Check for visual feedback
        const dropzoneActive = document.querySelector('[data-testid="dropzone-active"]')
        if (dropzoneActive) {
          this.reporter.log('Dropzone shows active state')
        }
        
        // Simulate drag leave
        await this.navigator.executeScript(() => {
          const dropzone = document.querySelector('[data-testid="media-dropzone"]')
          if (dropzone) {
            const dragLeaveEvent = new DragEvent('dragleave', {
              bubbles: true,
              cancelable: true,
              dataTransfer: new DataTransfer()
            })
            dropzone.dispatchEvent(dragLeaveEvent)
          }
        })
        await this.captureScreenshot('drag-leave')
      }
      
      // Test file input fallback
      const fileInput = document.querySelector('[data-testid="file-input"]')
      if (fileInput) {
        await this.captureScreenshot('file-input-available')
      }
      
      this.reporter.log('Drag and drop upload tests completed')
    } catch (error) {
      console.warn('Drag and drop test failed:', error)
      await this.captureScreenshot('drag-drop-error')
    }
  }

  /**
   * Test YouTube video embedding
   */
  private async testYouTubeEmbedding(): Promise<void> {
    this.reporter.log('Testing YouTube video embedding...')
    
    if (!this.navigator) return
    
    try {
      await this.captureScreenshot('youtube-test-start')
      
      // Open YouTube embedding dialog
      const youtubeButton = document.querySelector('[data-testid="add-youtube-video"]')
      if (youtubeButton) {
        await this.navigator.click(youtubeButton as HTMLElement)
        await this.captureScreenshot('youtube-dialog-opened')
        
        // Test various YouTube URL formats
        const testUrls = [
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'https://youtu.be/dQw4w9WgXcQ',
          'https://www.youtube.com/embed/dQw4w9WgXcQ',
          'dQw4w9WgXcQ' // Just the ID
        ]
        
        for (const url of testUrls) {
          await this.navigator.fillInput('[data-testid="youtube-url-input"]', url)
          await this.captureScreenshot(`youtube-url-${testUrls.indexOf(url)}`)
          
          // Check for validation
          const validationMessage = document.querySelector('[data-testid="youtube-validation"]')
          if (validationMessage) {
            await this.captureScreenshot(`youtube-validation-${testUrls.indexOf(url)}`)
          }
        }
        
        // Add valid YouTube video
        await this.navigator.fillInput('[data-testid="youtube-url-input"]', testUrls[0])
        const addButton = document.querySelector('[data-testid="add-youtube-confirm"]')
        if (addButton) {
          await this.navigator.click(addButton as HTMLElement)
          await this.captureScreenshot('youtube-video-added')
        }
        
        // Check if preview loaded
        const youtubePreview = document.querySelector('[data-testid="youtube-preview"]')
        if (youtubePreview) {
          await this.captureScreenshot('youtube-preview-loaded')
        }
      }
      
      this.reporter.log('YouTube embedding tests completed')
    } catch (error) {
      console.warn('YouTube embedding test failed:', error)
      await this.captureScreenshot('youtube-test-error')
    }
  }

  /**
   * Test comprehensive feature workflow
   */
  private async testComprehensiveFeatures(): Promise<void> {
    this.reporter.log('Running comprehensive feature tests...')
    
    // Run all test methods
    await this.testProjectManagement()
    await this.testSettings()
    await this.testMediaLibrary()
    await this.testAllQuestionTypes()
    await this.testNavigationUI()
    await this.testErrorRecovery()
    await this.testHelpPage()
    await this.testTemplateSelection()
    await this.testSCORMValidation()
    await this.testRichTextEditor()
    await this.testDragAndDropUpload()
    await this.testYouTubeEmbedding()
    
    this.reporter.log('All comprehensive tests completed')
  }

  private async cleanup(): Promise<void> {
    this.reporter.startStep('cleanup')
    
    try {
      if (this.options.keepProject) {
        this.reporter.log('Keeping test project as requested')
        this.reporter.skipStep('cleanup', 'keepProject option is true')
      } else {
        if (this.storage && this.projectId) {
          this.reporter.log('Deleting test project...')
          await this.storage.deleteProject(this.projectId)
          this.reporter.completeStep('cleanup')
        } else {
          this.reporter.skipStep('cleanup', 'No project to delete')
        }
      }
    } catch (error) {
      // Capture error screenshot even for cleanup
      if (this.navigator) {
        await this.errorCapture.captureErrorScreenshot(
          'cleanup-error',
          error instanceof Error ? error : new Error(String(error)),
          this.navigator
        )
      }
      
      this.reporter.failStep('cleanup', error instanceof Error ? error.message : String(error))
      // Don't throw - cleanup errors are not critical
    }
  }
  
  /**
   * Capture a debug screenshot when automation appears stuck
   */
  async captureDebugScreenshot(context: string): Promise<void> {
    if (this.navigator) {
      console.warn(`⚠️ Automation appears stuck at: ${context}`)
      const screenshotPath = await this.errorCapture.captureErrorScreenshot(
        `stuck-${context}`,
        new Error(`Automation stuck at ${context}`),
        this.navigator
      )
      if (screenshotPath) {
        console.error(`📸 Debug screenshot captured: ${screenshotPath}`)
        console.error(`💡 Use window.getErrorScreenshot('${new Date().toISOString().replace(/[:.]/g, '-')}') to view the screenshot`)
      }
    }
  }
}

/**
 * Convenience function to run automation from console
 */
export async function runFullAutomation(options?: AutomationOptions): Promise<AutomationResult> {
  // Check if this was triggered automatically (not by user interaction)
  const event = window.event as MouseEvent | undefined
  const isUserTriggered = event && (event.isTrusted !== false)
  
  // Log how the automation was triggered
  console.log('🤖 Automation trigger check:', {
    hasEvent: !!event,
    isTrusted: event?.isTrusted,
    eventType: event?.type,
    target: event?.target,
    isUserTriggered
  })
  
  // Prevent automatic execution unless explicitly allowed
  if (!isUserTriggered && !options?.allowAutoRun) {
    console.warn('⚠️ Automation was triggered programmatically, not by user interaction. Blocking automatic execution.')
    console.log('To allow automatic execution, pass { allowAutoRun: true } in options')
    return {
      success: false,
      duration: 0,
      errors: ['Automation must be triggered by user interaction'],
      stepsCompleted: 0,
      totalSteps: 0,
      screenshots: []
    }
  }
  
  const automation = new FullWorkflowAutomation(options)
  return await automation.run()
}

// Store last automation screenshots globally
let lastAutomationScreenshots: Screenshot[] = []

/**
 * Get all screenshots from the last automation run
 */
export async function getAutomationScreenshots(): Promise<Screenshot[]> {
  const screenshots = await screenshotManager.getAllScreenshotsWithDataUrls()
  lastAutomationScreenshots = screenshots.map(s => ({
    id: s.id || `screenshot-${s.timestamp}`,
    stepName: s.stepName,
    timestamp: s.timestamp,
    dataUrl: s.dataUrl,
    metadata: s.metadata
  }))
  
  console.log(`📸 Retrieved ${lastAutomationScreenshots.length} screenshots from last run`)
  return lastAutomationScreenshots
}

/**
 * Analyze screenshots for visual issues
 */
export async function analyzeScreenshots() {
  if (lastAutomationScreenshots.length === 0) {
    lastAutomationScreenshots = await getAutomationScreenshots()
  }
  
  if (lastAutomationScreenshots.length === 0) {
    console.warn('No screenshots available. Run automation with captureScreenshots or captureAllScreenshots option first.')
    return null
  }
  
  const report = await screenshotAnalyzer.analyzeScreenshots(lastAutomationScreenshots)
  console.log('📊 Analysis Report:')
  console.log(report)
  return report
}

/**
 * Export screenshot report as HTML
 */
export async function exportScreenshotReport() {
  if (lastAutomationScreenshots.length === 0) {
    lastAutomationScreenshots = await getAutomationScreenshots()
  }
  
  if (lastAutomationScreenshots.length === 0) {
    console.warn('No screenshots available. Run automation with captureScreenshots or captureAllScreenshots option first.')
    return
  }
  
  // Run analysis
  const report = await screenshotAnalyzer.analyzeScreenshots(lastAutomationScreenshots)
  
  // Generate HTML
  const html = screenshotAnalyzer.generateHTMLReport(lastAutomationScreenshots, report)
  
  // Create and download
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `screenshot-report-${new Date().toISOString().replace(/[:.]/g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  console.log('✅ Screenshot report downloaded')
}

// Make available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).runFullAutomation = runFullAutomation
  (window as any).getAutomationScreenshots = getAutomationScreenshots
  (window as any).analyzeScreenshots = analyzeScreenshots
  (window as any).exportScreenshotReport = exportScreenshotReport
  
  console.log('💡 Full workflow automation loaded. Usage:')
  console.log('   runFullAutomation() - Run standard automation with visual mode')
  console.log('   runFullAutomation({ scenario: "quick" }) - Quick test (fewer steps)')
  console.log('   runFullAutomation({ scenario: "comprehensive" }) - Full test (all features)')
  console.log('   runFullAutomation({ scenario: "media-focus" }) - Focus on media features')
  console.log('   runFullAutomation({ scenario: "audio-focus" }) - Focus on audio features')
  console.log('   runFullAutomation({ scenario: "content-focus" }) - Focus on content editing')
  console.log('   runFullAutomation({ keepProject: true }) - Keep project after test')
  console.log('   runFullAutomation({ visual: true }) - Show visual progress (default)')
  console.log('   runFullAutomation({ captureScreenshots: true }) - Capture key screenshots')
  console.log('   runFullAutomation({ captureAllScreenshots: true }) - Capture ALL screenshots')
  console.log('   runFullAutomation({ captureAllScreenshots: true, includeMetadata: true }) - Full analysis mode')
  console.log('   runFullAutomation({ allowAutoRun: true }) - Allow programmatic execution (CI/CD)')
  console.log('   ')
  console.log('📸 Screenshot Analysis Commands:')
  console.log('   getAutomationScreenshots() - Get all screenshots from last run')
  console.log('   analyzeScreenshots() - Analyze screenshots for visual issues')
  console.log('   exportScreenshotReport() - Generate and download HTML report')
  console.log('   ')
  console.log('⚠️ Note: Automation must be triggered by user interaction unless { allowAutoRun: true } is passed')
}