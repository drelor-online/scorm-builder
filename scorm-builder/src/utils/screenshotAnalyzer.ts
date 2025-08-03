/**
 * Screenshot Analyzer for visual testing
 * Analyzes captured screenshots for visual issues and generates reports
 */

export interface Screenshot {
  id: string
  stepName: string
  timestamp: number
  blob?: Blob
  dataUrl?: string
  metadata?: {
    url?: string
    pageTitle?: string
    domState?: {
      bodyScrollHeight: number
      bodyScrollWidth: number
      visibleElements: number
      forms: number
      buttons: number
      inputs: number
      images: number
      modals: number
    }
    consoleLogs?: any[]
  }
}

export interface VisualIssue {
  type: 'alignment' | 'overlap' | 'missing' | 'loading' | 'contrast' | 'spacing' | 'truncation'
  severity: 'low' | 'medium' | 'high'
  description: string
  element?: string
  screenshot: string
  coordinates?: { x: number; y: number; width: number; height: number }
}

export interface AnalysisReport {
  totalScreenshots: number
  analyzedScreenshots: number
  issues: VisualIssue[]
  summary: {
    criticalIssues: number
    warnings: number
    suggestions: number
  }
  timeline: Array<{
    timestamp: number
    stepName: string
    issueCount: number
  }>
}

export class ScreenshotAnalyzer {
  private issues: VisualIssue[] = []
  
  /**
   * Analyze all screenshots for visual issues
   */
  async analyzeScreenshots(screenshots: Screenshot[]): Promise<AnalysisReport> {
    console.log(`🔍 Analyzing ${screenshots.length} screenshots...`)
    this.issues = []
    
    const timeline: AnalysisReport['timeline'] = []
    
    for (const screenshot of screenshots) {
      const stepIssues = await this.detectVisualIssues(screenshot)
      this.issues.push(...stepIssues)
      
      timeline.push({
        timestamp: screenshot.timestamp,
        stepName: screenshot.stepName,
        issueCount: stepIssues.length
      })
    }
    
    const report: AnalysisReport = {
      totalScreenshots: screenshots.length,
      analyzedScreenshots: screenshots.length,
      issues: this.issues,
      summary: {
        criticalIssues: this.issues.filter(i => i.severity === 'high').length,
        warnings: this.issues.filter(i => i.severity === 'medium').length,
        suggestions: this.issues.filter(i => i.severity === 'low').length
      },
      timeline
    }
    
    console.log(`✅ Analysis complete: Found ${this.issues.length} issues`)
    console.log(`   🔴 Critical: ${report.summary.criticalIssues}`)
    console.log(`   🟡 Warnings: ${report.summary.warnings}`)
    console.log(`   🔵 Suggestions: ${report.summary.suggestions}`)
    
    return report
  }
  
  /**
   * Detect visual issues in a single screenshot
   */
  async detectVisualIssues(screenshot: Screenshot): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = []
    
    // Check DOM state if metadata is available
    if (screenshot.metadata?.domState) {
      const domState = screenshot.metadata.domState
      
      // Check for potential loading states
      if (screenshot.stepName.includes('after') || screenshot.stepName.includes('complete')) {
        if (domState.visibleElements < 10) {
          issues.push({
            type: 'loading',
            severity: 'high',
            description: 'Page appears to be empty or still loading',
            screenshot: screenshot.id
          })
        }
      }
      
      // Check for modal overlays that shouldn't be there
      // Only flag as issue if modal is detected in unexpected places
      const expectedModalSteps = ['modal', 'dialog', 'recording', 'upload', 'confirm', 'settings', 'help']
      const hasExpectedModal = expectedModalSteps.some(keyword => 
        screenshot.stepName.toLowerCase().includes(keyword)
      )
      
      if (domState.modals > 0 && !hasExpectedModal) {
        // Additional check: Some pages naturally have modal-like elements
        const acceptableModalPages = ['project-dashboard', 'media-enhancement', 'audio-narration']
        const isAcceptablePage = acceptableModalPages.some(page => 
          screenshot.stepName.toLowerCase().includes(page)
        )
        
        if (!isAcceptablePage) {
          issues.push({
            type: 'overlap',
            severity: 'medium',
            description: `Unexpected modal detected (${domState.modals} modal(s) found)`,
            screenshot: screenshot.id
          })
        }
      }
      
      // Check for missing form elements in form pages
      if (screenshot.stepName.includes('form') || screenshot.stepName.includes('input')) {
        if (domState.inputs === 0) {
          issues.push({
            type: 'missing',
            severity: 'high',
            description: 'Expected form inputs not found on page',
            screenshot: screenshot.id
          })
        }
      }
      
      // Check for potential layout issues
      if (domState.bodyScrollWidth > window.innerWidth) {
        issues.push({
          type: 'alignment',
          severity: 'medium',
          description: 'Horizontal scrollbar detected - possible layout overflow',
          screenshot: screenshot.id
        })
      }
    }
    
    // Check console logs for errors
    if (screenshot.metadata?.consoleLogs) {
      const errors = screenshot.metadata.consoleLogs.filter((log: any) => 
        log.level === 'error' || log.level === 'warning'
      )
      
      if (errors.length > 0) {
        issues.push({
          type: 'missing',
          severity: 'medium',
          description: `${errors.length} console errors/warnings detected`,
          screenshot: screenshot.id
        })
      }
    }
    
    return issues
  }
  
  /**
   * Compare two screenshots to detect changes
   */
  compareScreenshots(before: Screenshot, after: Screenshot): {
    changed: boolean
    description: string
  } {
    // Compare DOM states if available
    if (before.metadata?.domState && after.metadata?.domState) {
      const beforeState = before.metadata.domState
      const afterState = after.metadata.domState
      
      const changes = []
      
      if (beforeState.visibleElements !== afterState.visibleElements) {
        changes.push(`Element count changed: ${beforeState.visibleElements} → ${afterState.visibleElements}`)
      }
      
      if (beforeState.buttons !== afterState.buttons) {
        changes.push(`Button count changed: ${beforeState.buttons} → ${afterState.buttons}`)
      }
      
      if (beforeState.modals !== afterState.modals) {
        changes.push(`Modal state changed: ${beforeState.modals} → ${afterState.modals}`)
      }
      
      return {
        changed: changes.length > 0,
        description: changes.join(', ')
      }
    }
    
    return {
      changed: false,
      description: 'Unable to compare - no metadata available'
    }
  }
  
  /**
   * Generate HTML report with all screenshots and analysis
   */
  generateHTMLReport(screenshots: Screenshot[], analysis: AnalysisReport): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screenshot Analysis Report - ${new Date().toISOString()}</title>
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
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .summary-card {
      background: #3a3a3a;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card .number {
      font-size: 2em;
      font-weight: bold;
      margin: 10px 0;
    }
    .critical { color: #ef4444; }
    .warning { color: #f59e0b; }
    .suggestion { color: #3b82f6; }
    .success { color: #10b981; }
    
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
    
    .timeline {
      margin: 30px 0;
      padding: 20px;
      background: #2a2a2a;
      border-radius: 8px;
    }
    .timeline h2 {
      color: #fbbf24;
      margin-top: 0;
    }
    .timeline-item {
      padding: 10px;
      margin: 5px 0;
      background: #3a3a3a;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .timeline-item.has-issues {
      border-left: 3px solid #f59e0b;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📸 Screenshot Analysis Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <div class="summary-card">
      <div class="label">Total Screenshots</div>
      <div class="number">${analysis.totalScreenshots}</div>
    </div>
    <div class="summary-card">
      <div class="label">Critical Issues</div>
      <div class="number critical">${analysis.summary.criticalIssues}</div>
    </div>
    <div class="summary-card">
      <div class="label">Warnings</div>
      <div class="number warning">${analysis.summary.warnings}</div>
    </div>
    <div class="summary-card">
      <div class="label">Suggestions</div>
      <div class="number suggestion">${analysis.summary.suggestions}</div>
    </div>
  </div>
  
  <div class="timeline">
    <h2>Execution Timeline</h2>
    ${analysis.timeline.map(item => `
      <div class="timeline-item ${item.issueCount > 0 ? 'has-issues' : ''}">
        <div>
          <strong>${item.stepName}</strong>
          <span style="margin-left: 15px; color: #999;">
            ${new Date(item.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div>
          ${item.issueCount > 0 ? `⚠️ ${item.issueCount} issues` : '✅ Clean'}
        </div>
      </div>
    `).join('')}
  </div>
  
  <div class="screenshots">
    ${screenshots.map(screenshot => {
      const screenshotIssues = analysis.issues.filter(i => i.screenshot === screenshot.id)
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
          ` : ''}
          ${screenshotIssues.length > 0 ? `
            <div class="issues-list">
              <strong>Issues Found:</strong>
              ${screenshotIssues.map(issue => `
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
    
    return html
  }
  
  /**
   * Export analysis report as JSON
   */
  exportJSON(analysis: AnalysisReport): string {
    return JSON.stringify(analysis, null, 2)
  }
}

// Export singleton instance
export const screenshotAnalyzer = new ScreenshotAnalyzer()

// Make available globally for console
if (typeof window !== 'undefined') {
  (window as any).screenshotAnalyzer = screenshotAnalyzer
}