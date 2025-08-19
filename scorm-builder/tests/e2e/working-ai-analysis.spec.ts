import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

interface SimpleUIMetadata {
  stepNumber: number;
  componentName: string;
  state: string;
  timestamp: string;
  pageTitle: string;
  url: string;
  detectedIssues: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    element: string;
  }>;
}

class SimpleAIAnalyzer {
  private page: Page;
  private screenshotDir: string;
  private metadataDir: string;
  private stepCounter: number = 0;
  private metadata: SimpleUIMetadata[] = [];

  constructor(page: Page) {
    this.page = page;
    const resultsDir = path.join(process.cwd(), 'test-results', 'ai-analysis');
    this.screenshotDir = path.join(resultsDir, 'screenshots', 'working');
    this.metadataDir = path.join(resultsDir, 'metadata', 'working');
    
    // Ensure directories exist
    [this.screenshotDir, this.metadataDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async captureStep(componentName: string, state: string = 'default'): Promise<void> {
    this.stepCounter++;
    const stepNumber = this.stepCounter.toString().padStart(3, '0');
    const timestamp = new Date().toISOString();
    
    // Wait for page to stabilize
    await this.page.waitForTimeout(500);
    
    // Get page info
    const pageTitle = await this.page.title();
    const url = this.page.url();
    
    // Detect basic issues
    const detectedIssues = await this.detectBasicIssues();
    
    // Generate filename and take screenshot
    const filename = `${stepNumber}-${componentName}-${state}.png`;
    const screenshotPath = path.join(this.screenshotDir, filename);
    
    await this.page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      animations: 'disabled'
    });
    
    // Create metadata
    const metadata: SimpleUIMetadata = {
      stepNumber: this.stepCounter,
      componentName,
      state,
      timestamp,
      pageTitle,
      url,
      detectedIssues
    };
    
    this.metadata.push(metadata);
    
    // Save metadata
    const metadataPath = path.join(this.metadataDir, `${stepNumber}-${componentName}-${state}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Captured step ${stepNumber}: ${componentName} - ${state}`);
    console.log(`  Screenshot: ${screenshotPath}`);
    console.log(`  Issues detected: ${detectedIssues.length}`);
  }

  private async detectBasicIssues(): Promise<any[]> {
    return await this.page.evaluate(() => {
      const issues: any[] = [];
      
      // Check for buttons without labels
      const buttons = document.querySelectorAll('button');
      buttons.forEach(button => {
        const hasLabel = !!(
          button.getAttribute('aria-label') ||
          button.getAttribute('title') ||
          button.textContent?.trim()
        );
        
        if (!hasLabel) {
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            issues.push({
              type: 'missing_button_label',
              description: 'Button missing accessible label',
              severity: 'high',
              element: `button${button.className ? '.' + button.className : ''}`
            });
          }
        }
      });
      
      // Check for text overflow
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
      textElements.forEach(element => {
        if (element.scrollWidth > element.clientWidth) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            issues.push({
              type: 'text_overflow',
              description: 'Text content overflows container',
              severity: 'medium',
              element: element.tagName.toLowerCase() + (element.className ? '.' + element.className : '')
            });
          }
        }
      });
      
      return issues;
    });
  }

  generateSimpleReport(): void {
    const reportPath = path.join(this.metadataDir, '..', 'working-analysis-report.md');
    
    const totalIssues = this.metadata.reduce((sum, step) => sum + step.detectedIssues.length, 0);
    const criticalIssues = this.metadata.reduce((sum, step) => 
      sum + step.detectedIssues.filter(issue => issue.severity === 'critical').length, 0
    );
    const highIssues = this.metadata.reduce((sum, step) => 
      sum + step.detectedIssues.filter(issue => issue.severity === 'high').length, 0
    );

    let report = `# Working AI UI Analysis Report
*Generated: ${new Date().toLocaleString()}*

## Summary
- **Total Steps Captured**: ${this.metadata.length}
- **Total Issues Found**: ${totalIssues}
- **Critical Issues**: ${criticalIssues}
- **High Priority Issues**: ${highIssues}

## Steps Captured

`;

    this.metadata.forEach(step => {
      report += `### Step ${step.stepNumber}: ${step.componentName} - ${step.state}
**Page Title**: ${step.pageTitle}
**URL**: ${step.url}
**Issues Found**: ${step.detectedIssues.length}

**Screenshot**: \`screenshots/working/${step.stepNumber.toString().padStart(3, '0')}-${step.componentName}-${step.state}.png\`

`;

      if (step.detectedIssues.length > 0) {
        report += `**Issues Detected**:\n`;
        step.detectedIssues.forEach((issue, index) => {
          report += `${index + 1}. **${issue.type}** (${issue.severity}): ${issue.description} - \`${issue.element}\`\n`;
        });
        report += '\n';
      }
    });

    report += `## All Issues by Type

`;

    // Group issues by type
    const issuesByType: { [key: string]: any[] } = {};
    this.metadata.forEach(step => {
      step.detectedIssues.forEach(issue => {
        if (!issuesByType[issue.type]) {
          issuesByType[issue.type] = [];
        }
        issuesByType[issue.type].push({
          ...issue,
          stepNumber: step.stepNumber,
          componentName: step.componentName
        });
      });
    });

    Object.entries(issuesByType).forEach(([type, issues]) => {
      report += `### ${type.replace(/_/g, ' ').toUpperCase()} (${issues.length} occurrences)

`;
      issues.forEach(issue => {
        report += `- Step ${issue.stepNumber} (${issue.componentName}): ${issue.element}\n`;
      });
      report += '\n';
    });

    fs.writeFileSync(reportPath, report);
    console.log(`Report generated: ${reportPath}`);
  }
}

test.describe('Working AI UI Analysis', () => {
  let analyzer: SimpleAIAnalyzer;

  test.beforeEach(async ({ page }) => {
    analyzer = new SimpleAIAnalyzer(page);
  });

  test('Complete workflow analysis', async ({ page }) => {
    // Step 1: Dashboard/Landing page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await analyzer.captureStep('dashboard', 'initial');
    
    // Step 2: Click "Create Your First Project" to start course creation
    const createButton = page.locator('button:has-text("Create Your First Project")');
    if (await createButton.isVisible()) {
      await createButton.click();
    } else {
      // Try alternative button
      await page.click('button:has-text("Create New Project")');
    }
    
    await page.waitForLoadState('networkidle');
    await analyzer.captureStep('course-seed-input', 'initial');
    
    // Step 3: Fill course title
    const titleInput = page.locator('#course-title, input[placeholder*="course title"], input[type="text"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('AI Analysis Test Course');
      await analyzer.captureStep('course-seed-input', 'title-filled');
    }
    
    // Step 4: Try to select difficulty
    const hardButton = page.locator('button:has-text("Hard")');
    if (await hardButton.isVisible()) {
      await hardButton.click();
      await analyzer.captureStep('course-seed-input', 'difficulty-selected');
    }
    
    // Step 5: Fill topics
    const topicsTextarea = page.locator('#custom-topics, textarea').first();
    if (await topicsTextarea.isVisible()) {
      await topicsTextarea.fill('Introduction to AI\nAdvanced concepts\nBest practices');
      await analyzer.captureStep('course-seed-input', 'topics-filled');
    }
    
    // Step 6: Try to open settings modal
    const settingsButton = page.locator('button:has-text("Settings")');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      await analyzer.captureStep('settings-modal', 'opened');
      
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Step 7: Try to continue to next step
    const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForLoadState('networkidle');
      await analyzer.captureStep('ai-prompt-generator', 'initial');
    }
    
    // Generate report
    analyzer.generateSimpleReport();
    
    console.log('Working AI analysis completed successfully!');
  });

  test('Error states analysis', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to course creation
    const createButton = page.locator('button:has-text("Create Your First Project"), button:has-text("Create New Project")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Try to continue without filling required fields
    await analyzer.captureStep('validation-errors', 'empty-form');
    
    const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForTimeout(1000);
      await analyzer.captureStep('validation-errors', 'after-submit-attempt');
    }
    
    analyzer.generateSimpleReport();
  });
});