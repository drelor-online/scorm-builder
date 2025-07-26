import { Page } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

export interface VisualRegressionOptions {
  threshold?: number // Pixel difference threshold (0-1)
  fullPage?: boolean
  clip?: { x: number; y: number; width: number; height: number }
  mask?: Array<{ selector: string }>
}

export class VisualRegressionHelper {
  private baselineDir: string
  private actualDir: string
  private diffDir: string
  private reportDir: string

  constructor() {
    const testResultsDir = path.join(process.cwd(), 'test-results', 'visual-regression')
    this.baselineDir = path.join(testResultsDir, 'baseline')
    this.actualDir = path.join(testResultsDir, 'actual')
    this.diffDir = path.join(testResultsDir, 'diff')
    this.reportDir = path.join(testResultsDir, 'report')
  }

  async ensureDirectories() {
    await fs.mkdir(this.baselineDir, { recursive: true })
    await fs.mkdir(this.actualDir, { recursive: true })
    await fs.mkdir(this.diffDir, { recursive: true })
    await fs.mkdir(this.reportDir, { recursive: true })
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 100)
  }

  async captureScreenshot(
    page: Page,
    name: string,
    options: VisualRegressionOptions = {}
  ): Promise<string> {
    await this.ensureDirectories()
    
    const filename = `${this.sanitizeFilename(name)}.png`
    const actualPath = path.join(this.actualDir, filename)
    
    // Take screenshot with options
    await page.screenshot({
      path: actualPath,
      fullPage: options.fullPage ?? true,
      clip: options.clip,
      mask: options.mask?.map(m => page.locator(m.selector))
    })
    
    return actualPath
  }

  async compareWithBaseline(
    name: string,
    options: VisualRegressionOptions = {}
  ): Promise<{
    matched: boolean
    diffPath?: string
    message: string
  }> {
    const filename = `${this.sanitizeFilename(name)}.png`
    const baselinePath = path.join(this.baselineDir, filename)
    const actualPath = path.join(this.actualDir, filename)
    const diffPath = path.join(this.diffDir, filename)
    
    // Check if baseline exists
    try {
      await fs.access(baselinePath)
    } catch {
      // No baseline, copy actual as new baseline
      await fs.copyFile(actualPath, baselinePath)
      return {
        matched: true,
        message: `Created new baseline for "${name}"`
      }
    }
    
    // For now, we'll use Playwright's built-in screenshot comparison
    // In a real implementation, you'd use pixelmatch here
    const baselineBuffer = await fs.readFile(baselinePath)
    const actualBuffer = await fs.readFile(actualPath)
    
    // Simple byte comparison for exact match
    const matched = baselineBuffer.equals(actualBuffer)
    
    if (!matched) {
      // In production, generate a diff image here
      return {
        matched: false,
        diffPath,
        message: `Visual difference detected for "${name}"`
      }
    }
    
    return {
      matched: true,
      message: `Visual regression passed for "${name}"`
    }
  }

  async updateBaseline(name: string): Promise<void> {
    const filename = `${this.sanitizeFilename(name)}.png`
    const actualPath = path.join(this.actualDir, filename)
    const baselinePath = path.join(this.baselineDir, filename)
    
    await fs.copyFile(actualPath, baselinePath)
  }

  async generateReport(results: Array<{
    name: string
    matched: boolean
    message: string
  }>): Promise<void> {
    const timestamp = new Date().toISOString()
    const report = {
      timestamp,
      totalTests: results.length,
      passed: results.filter(r => r.matched).length,
      failed: results.filter(r => !r.matched).length,
      results
    }
    
    const reportPath = path.join(this.reportDir, `report-${timestamp.replace(/[:.]/g, '-')}.json`)
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    // Also create an HTML report
    const htmlReport = this.generateHtmlReport(report)
    const htmlPath = path.join(this.reportDir, 'index.html')
    await fs.writeFile(htmlPath, htmlReport)
  }

  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #333; color: white; padding: 20px; border-radius: 5px; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: white; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
    .stat.passed { border-left: 5px solid #4CAF50; }
    .stat.failed { border-left: 5px solid #f44336; }
    .results { background: white; padding: 20px; border-radius: 5px; }
    .result { padding: 10px; margin: 5px 0; border-radius: 3px; }
    .result.passed { background: #e8f5e9; }
    .result.failed { background: #ffebee; }
    .screenshots { display: flex; gap: 10px; margin: 10px 0; }
    .screenshot { flex: 1; }
    .screenshot img { max-width: 100%; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Visual Regression Report</h1>
    <p>Generated: ${report.timestamp}</p>
  </div>
  
  <div class="summary">
    <div class="stat">
      <h2>${report.totalTests}</h2>
      <p>Total Tests</p>
    </div>
    <div class="stat passed">
      <h2>${report.passed}</h2>
      <p>Passed</p>
    </div>
    <div class="stat failed">
      <h2>${report.failed}</h2>
      <p>Failed</p>
    </div>
  </div>
  
  <div class="results">
    <h2>Test Results</h2>
    ${report.results.map(r => `
      <div class="result ${r.matched ? 'passed' : 'failed'}">
        <h3>${r.name}</h3>
        <p>${r.message}</p>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `
  }
}

// Export singleton instance
export const visualRegression = new VisualRegressionHelper()