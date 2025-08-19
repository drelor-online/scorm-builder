import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

interface UIMetadata {
  stepNumber: number;
  componentName: string;
  state: string;
  timestamp: string;
  viewport: { width: number; height: number };
  domStructure: any;
  computedStyles: Record<string, any>;
  accessibilityTree: any;
  interactiveElements: Array<{
    selector: string;
    bounds: { x: number; y: number; width: number; height: number };
    role: string;
    accessible: boolean;
  }>;
  textContent: Array<{
    element: string;
    text: string;
    overflow: boolean;
    contrast: number;
  }>;
  detectedIssues: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    location: { x: number; y: number };
    element: string;
  }>;
  performanceMetrics: {
    loadTime: number;
    interactionTime: number;
    memoryUsage: number;
    networkRequests: number;
  };
}

class AIUIAnalyzer {
  private page: Page;
  private screenshotDir: string;
  private metadataDir: string;
  private stepCounter: number = 0;

  constructor(page: Page) {
    this.page = page;
    this.screenshotDir = path.join(process.cwd(), 'test-results', 'ai-analysis', 'screenshots');
    this.metadataDir = path.join(process.cwd(), 'test-results', 'ai-analysis', 'metadata');
    
    // Ensure directories exist
    [this.screenshotDir, this.metadataDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create subdirectories for organization
    ['full-context', 'components', 'interactions', 'issues'].forEach(subdir => {
      const fullPath = path.join(this.screenshotDir, subdir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  async captureStep(componentName: string, state: string = 'default', options: {
    fullPage?: boolean;
    selector?: string;
    annotation?: boolean;
  } = {}): Promise<UIMetadata> {
    this.stepCounter++;
    const stepNumber = this.stepCounter.toString().padStart(3, '0');
    const timestamp = new Date().toISOString();
    
    // Wait for any animations to complete
    await this.page.waitForTimeout(500);
    
    // Capture viewport info
    const viewport = this.page.viewportSize()!;
    
    // Generate filename
    const filename = `${stepNumber}-${componentName}-${state}-${viewport.width}x${viewport.height}.png`;
    const screenshotPath = path.join(
      this.screenshotDir, 
      options.selector ? 'components' : 'full-context', 
      filename
    );
    
    // Take screenshot
    if (options.selector) {
      const element = this.page.locator(options.selector);
      await element.screenshot({ path: screenshotPath });
    } else {
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: options.fullPage ?? true,
        animations: 'disabled'
      });
    }
    
    // Collect metadata
    const metadata = await this.collectMetadata(stepNumber, componentName, state, timestamp, viewport);
    
    // Save metadata
    const metadataPath = path.join(this.metadataDir, `${stepNumber}-${componentName}-${state}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // If issues detected, capture annotated screenshot
    if (metadata.detectedIssues.length > 0 && options.annotation !== false) {
      await this.captureAnnotatedScreenshot(metadata, stepNumber, componentName, state);
    }
    
    return metadata;
  }

  private async collectMetadata(
    stepNumber: number, 
    componentName: string, 
    state: string, 
    timestamp: string,
    viewport: { width: number; height: number }
  ): Promise<UIMetadata> {
    
    // Collect DOM structure
    const domStructure = await this.page.evaluate(() => {
      const getElementInfo = (element: Element, depth: number = 0): any => {
        if (depth > 3) return null; // Limit depth for readability
        
        return {
          tagName: element.tagName.toLowerCase(),
          className: element.className,
          id: element.id,
          textContent: element.textContent?.slice(0, 100),
          children: Array.from(element.children).slice(0, 5).map(child => 
            getElementInfo(child, depth + 1)
          ).filter(Boolean)
        };
      };
      return getElementInfo(document.body);
    });

    // Collect interactive elements
    const interactiveElements = await this.page.evaluate(() => {
      const selectors = ['button', 'input', 'select', 'textarea', 'a[href]', '[role="button"]', '[tabindex]'];
      const elements: any[] = [];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          
          elements.push({
            selector: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '') + 
                     (element.className ? `.${element.className.split(' ').join('.')}` : ''),
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            role: element.getAttribute('role') || element.tagName.toLowerCase(),
            accessible: !!(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || 
                          element.textContent?.trim()),
            visible: computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
            focusable: element.tabIndex >= 0
          });
        });
      });
      
      return elements.filter(el => el.visible);
    });

    // Detect text overflow issues
    const textOverflowIssues = await this.page.evaluate(() => {
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, label');
      const issues: any[] = [];
      
      textElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) {
          issues.push({
            type: 'text_overflow',
            description: 'Text content overflows container bounds',
            severity: 'medium',
            location: { x: Math.round(rect.x), y: Math.round(rect.y) },
            element: element.tagName.toLowerCase() + (element.className ? `.${element.className}` : ''),
            details: {
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
              text: element.textContent?.slice(0, 50) + '...'
            }
          });
        }
      });
      
      return issues;
    });

    // Check for accessibility issues
    const accessibilityIssues = await this.page.evaluate(() => {
      const issues: any[] = [];
      
      // Check for buttons without labels
      document.querySelectorAll('button').forEach(button => {
        const hasLabel = !!(button.getAttribute('aria-label') || 
                           button.getAttribute('aria-labelledby') || 
                           button.textContent?.trim());
        
        if (!hasLabel) {
          const rect = button.getBoundingClientRect();
          issues.push({
            type: 'missing_button_label',
            description: 'Button missing accessible label',
            severity: 'high',
            location: { x: Math.round(rect.x), y: Math.round(rect.y) },
            element: 'button' + (button.className ? `.${button.className}` : '')
          });
        }
      });

      // Check for poor color contrast (simplified check)
      document.querySelectorAll('*').forEach(element => {
        const style = window.getComputedStyle(element);
        const color = style.color;
        const background = style.backgroundColor;
        
        // Simple contrast check - in real implementation, use proper contrast calculation
        if (color === 'rgb(128, 128, 128)' && background === 'rgb(255, 255, 255)') {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            issues.push({
              type: 'poor_contrast',
              description: 'Low color contrast detected',
              severity: 'medium',
              location: { x: Math.round(rect.x), y: Math.round(rect.y) },
              element: element.tagName.toLowerCase() + (element.className ? `.${element.className}` : '')
            });
          }
        }
      });

      return issues;
    });

    // Collect performance metrics
    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const memory = (performance as any).memory;
      
      return {
        loadTime: Math.round(navigation?.loadEventEnd - navigation?.navigationStart) || 0,
        interactionTime: Math.round(navigation?.domInteractive - navigation?.navigationStart) || 0,
        memoryUsage: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0, // MB
        networkRequests: performance.getEntriesByType('resource').length
      };
    });

    // Collect computed styles for key elements
    const computedStyles = await this.page.evaluate(() => {
      const styles: Record<string, any> = {};
      const keySelectors = ['body', 'main', '.modal', '.form-group', '.button', '.error-message'];
      
      keySelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          const computed = window.getComputedStyle(element);
          styles[selector] = {
            position: computed.position,
            display: computed.display,
            zIndex: computed.zIndex,
            overflow: computed.overflow,
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            fontSize: computed.fontSize,
            fontFamily: computed.fontFamily
          };
        }
      });
      
      return styles;
    });

    return {
      stepNumber: parseInt(stepNumber),
      componentName,
      state,
      timestamp,
      viewport,
      domStructure,
      computedStyles,
      accessibilityTree: {}, // Would implement full a11y tree in real scenario
      interactiveElements,
      textContent: [], // Would implement text extraction in real scenario
      detectedIssues: [...textOverflowIssues, ...accessibilityIssues],
      performanceMetrics
    };
  }

  private async captureAnnotatedScreenshot(
    metadata: UIMetadata, 
    stepNumber: string, 
    componentName: string, 
    state: string
  ): Promise<void> {
    // Add visual annotations for detected issues
    await this.page.evaluate((issues) => {
      // Remove any existing annotations
      document.querySelectorAll('.ai-annotation').forEach(el => el.remove());
      
      issues.forEach((issue, index) => {
        const annotation = document.createElement('div');
        annotation.className = 'ai-annotation';
        annotation.style.cssText = `
          position: absolute;
          left: ${issue.location.x}px;
          top: ${issue.location.y}px;
          width: 20px;
          height: 20px;
          background: ${issue.severity === 'critical' ? 'red' : issue.severity === 'high' ? 'orange' : 'yellow'};
          border: 2px solid white;
          border-radius: 50%;
          z-index: 10000;
          font-size: 12px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          pointer-events: none;
        `;
        annotation.textContent = (index + 1).toString();
        document.body.appendChild(annotation);
      });
    }, metadata.detectedIssues);

    // Capture annotated screenshot
    const annotatedFilename = `${stepNumber}-${componentName}-${state}-annotated.png`;
    const annotatedPath = path.join(this.screenshotDir, 'issues', annotatedFilename);
    await this.page.screenshot({ path: annotatedPath, fullPage: true });

    // Remove annotations
    await this.page.evaluate(() => {
      document.querySelectorAll('.ai-annotation').forEach(el => el.remove());
    });
  }

  async analyzeElement(selector: string, elementName: string): Promise<UIMetadata> {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    
    return await this.captureStep(elementName, 'focused', { 
      selector, 
      fullPage: false,
      annotation: true 
    });
  }
}

test.describe('AI UI Analysis - Complete Workflow', () => {
  let analyzer: AIUIAnalyzer;

  test.beforeEach(async ({ page }) => {
    analyzer = new AIUIAnalyzer(page);
    
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the app to be fully loaded
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Course Configuration');
  });

  test('Complete workflow with AI analysis', async ({ page }) => {
    // Step 1: Initial landing page
    await analyzer.captureStep('landing-page', 'initial');
    
    // Step 2: Course Seed Input - empty state
    await analyzer.captureStep('course-seed-input', 'empty');
    
    // Step 3: Test drag-and-drop functionality
    const dragDropToggle = page.locator('button:has-text("Use drag & drop")');
    if (await dragDropToggle.isVisible()) {
      await dragDropToggle.click();
      await analyzer.captureStep('course-seed-input', 'drag-drop-mode');
    }
    
    // Step 4: Fill form progressively
    await page.fill('#course-title', 'AI Analysis Test Course');
    await analyzer.captureStep('course-seed-input', 'title-filled');
    
    await page.click('button:has-text("Hard")');
    await analyzer.captureStep('course-seed-input', 'difficulty-selected');
    
    await page.selectOption('#template', 'Safety');
    await analyzer.captureStep('course-seed-input', 'template-selected');
    
    await page.fill('#custom-topics', 'Topic 1: Introduction\nTopic 2: Advanced concepts\nTopic 3: Best practices');
    await analyzer.captureStep('course-seed-input', 'topics-filled');
    
    // Step 5: Test autosave indicator
    await page.waitForTimeout(2000); // Wait for autosave
    await analyzer.captureStep('course-seed-input', 'autosaved');
    
    // Step 6: Test Settings modal
    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(500);
    await analyzer.captureStep('settings-modal', 'opened');
    
    // Close modal and continue
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Step 7: Move to AI Prompt Generator
    await page.click('button:has-text("Continue to AI Prompt")');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('AI Prompt Generator');
    await analyzer.captureStep('ai-prompt-generator', 'initial');
    
    // Step 8: Test prompt editing
    const promptTextarea = page.locator('textarea').first();
    if (await promptTextarea.isVisible()) {
      await promptTextarea.click();
      await analyzer.captureStep('ai-prompt-generator', 'focused');
    }
    
    // Step 9: Move to JSON Import
    await page.click('button:has-text("Continue to JSON Import")');
    await page.waitForLoadState('networkidle');
    await analyzer.captureStep('json-import-validator', 'initial');
    
    // Step 10: Test JSON tree view toggle
    const treeToggle = page.locator('button:has-text("Tree View")');
    if (await treeToggle.isVisible()) {
      await treeToggle.click();
      await analyzer.captureStep('json-import-validator', 'tree-view');
      
      // Test Ctrl+T shortcut
      await page.keyboard.press('Control+t');
      await analyzer.captureStep('json-import-validator', 'keyboard-toggle');
    }
    
    // Step 11: Add sample JSON and validate
    const sampleJSON = {
      topics: [{
        id: '1',
        title: 'Test Topic',
        content: 'Test content for analysis',
        bulletPoints: ['Point 1', 'Point 2'],
        narration: [{ id: '1', text: 'Test narration', blockNumber: '001' }],
        imageKeywords: ['test'],
        imagePrompts: ['Test prompt'],
        videoSearchTerms: ['test video'],
        duration: 10
      }],
      activities: [],
      quiz: { questions: [], passMark: 80 }
    };
    
    await page.fill('textarea', JSON.stringify(sampleJSON, null, 2));
    await page.click('button:has-text("Validate JSON")');
    await page.waitForTimeout(1000);
    await analyzer.captureStep('json-import-validator', 'validated');
    
    // Step 12: Move to Media Enhancement
    await page.click('button:has-text("Next")');
    await page.waitForLoadState('networkidle');
    await analyzer.captureStep('media-enhancement', 'images-tab');
    
    // Step 13: Test Videos tab
    const videosTab = page.locator('button:has-text("📹 Videos")');
    if (await videosTab.isVisible()) {
      await videosTab.click();
      await analyzer.captureStep('media-enhancement', 'videos-tab');
    }
    
    // Step 14: Move to Audio Narration
    await page.click('button:has-text("Next")');
    await page.waitForLoadState('networkidle');
    await analyzer.captureStep('audio-narration', 'initial');
    
    // Step 15: Test audio upload sections
    await analyzer.analyzeElement('.audio-upload-section', 'audio-upload-area');
    await analyzer.analyzeElement('.caption-upload-section', 'caption-upload-area');
    
    // Step 16: Move to Activities Editor
    await page.click('button:has-text("Next")');
    await page.waitForLoadState('networkidle');
    await analyzer.captureStep('activities-editor', 'initial');
    
    // Step 17: Move to SCORM Package Builder
    await page.click('button:has-text("Next")');
    await page.waitForLoadState('networkidle');
    await analyzer.captureStep('scorm-package-builder', 'initial');
    
    // Step 18: Test StatusPanel (if visible)
    const statusPanel = page.locator('[data-testid="status-panel"]');
    if (await statusPanel.isVisible()) {
      await analyzer.analyzeElement('[data-testid="status-panel"]', 'status-panel');
    }
    
    // Step 19: Test responsive behavior
    await page.setViewportSize({ width: 768, height: 1024 });
    await analyzer.captureStep('responsive-test', 'tablet');
    
    await page.setViewportSize({ width: 390, height: 844 });
    await analyzer.captureStep('responsive-test', 'mobile');
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Final step: Generate issue summary
    console.log('AI UI Analysis completed. Check test-results/ai-analysis/ for screenshots and metadata.');
  });

  test('Error states and validation', async ({ page }) => {
    // Test validation errors
    await page.click('button:has-text("Continue to AI Prompt")');
    await analyzer.captureStep('validation-error', 'empty-form');
    
    // Test various error states
    await page.fill('#course-title', 'a'); // Too short
    await analyzer.captureStep('validation-error', 'title-too-short');
    
    await page.fill('#course-title', ''); // Empty again
    await page.fill('#custom-topics', ''); // Empty topics
    await page.click('button:has-text("Continue to AI Prompt")');
    await analyzer.captureStep('validation-error', 'multiple-errors');
  });

  test('Accessibility and keyboard navigation', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await analyzer.captureStep('accessibility', 'first-tab');
    
    // Test multiple tab presses
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }
    await analyzer.captureStep('accessibility', 'tab-navigation');
    
    // Test keyboard shortcuts
    await page.keyboard.press('Control+s'); // Save
    await analyzer.captureStep('accessibility', 'save-shortcut');
    
    await page.keyboard.press('Control+comma'); // Settings
    await analyzer.captureStep('accessibility', 'settings-shortcut');
    
    if (await page.locator('[role="dialog"]').isVisible()) {
      await page.keyboard.press('Escape'); // Close modal
      await analyzer.captureStep('accessibility', 'escape-shortcut');
    }
    
    await page.keyboard.press('F1'); // Help
    await analyzer.captureStep('accessibility', 'help-shortcut');
  });
});