import { Page } from '@playwright/test';
import { UIIssue } from './ui-rules';

export interface AnnotationConfig {
  showIssueNumbers: boolean;
  showSeverityColors: boolean;
  showBounds: boolean;
  showTooltips: boolean;
  highlightInteractive: boolean;
}

export class ScreenshotAnnotator {
  private page: Page;
  private config: AnnotationConfig;

  constructor(page: Page, config: Partial<AnnotationConfig> = {}) {
    this.page = page;
    this.config = {
      showIssueNumbers: true,
      showSeverityColors: true,
      showBounds: false,
      showTooltips: false,
      highlightInteractive: false,
      ...config
    };
  }

  async annotateIssues(issues: UIIssue[]): Promise<void> {
    // Remove any existing annotations
    await this.clearAnnotations();

    // Add CSS for annotations
    await this.injectAnnotationStyles();

    // Add annotations for each issue
    await this.page.evaluate(
      ({ issues, config }) => {
        issues.forEach((issue, index) => {
          this.addIssueAnnotation(issue, index + 1, config);
        });
      },
      { issues, config: this.config }
    );
  }

  async highlightInteractiveElements(): Promise<void> {
    await this.page.evaluate(() => {
      const interactiveSelectors = [
        'button',
        'a[href]',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '[tabindex]:not([tabindex="-1"])',
        '[onclick]'
      ];

      interactiveSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((element, index) => {
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const highlight = document.createElement('div');
          highlight.className = 'ai-interactive-highlight';
          highlight.style.cssText = `
            position: absolute;
            left: ${rect.x - 2}px;
            top: ${rect.y - 2}px;
            width: ${rect.width + 4}px;
            height: ${rect.height + 4}px;
            border: 2px dashed #0066cc;
            background: rgba(0, 102, 204, 0.1);
            z-index: 9999;
            pointer-events: none;
            box-sizing: border-box;
          `;
          
          const label = document.createElement('div');
          label.style.cssText = `
            position: absolute;
            top: -20px;
            left: 0;
            background: #0066cc;
            color: white;
            padding: 2px 6px;
            font-size: 10px;
            font-family: monospace;
            border-radius: 2px;
            white-space: nowrap;
          `;
          label.textContent = `Interactive ${index + 1}`;
          highlight.appendChild(label);
          
          document.body.appendChild(highlight);
        });
      });
    });
  }

  async highlightAccessibilityTree(): Promise<void> {
    await this.page.evaluate(() => {
      const elementsWithRoles = document.querySelectorAll('[role], [aria-label], [aria-labelledby]');
      
      elementsWithRoles.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const highlight = document.createElement('div');
        highlight.className = 'ai-a11y-highlight';
        highlight.style.cssText = `
          position: absolute;
          left: ${rect.x}px;
          top: ${rect.y}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 1px solid #28a745;
          background: rgba(40, 167, 69, 0.1);
          z-index: 9998;
          pointer-events: none;
        `;
        
        const role = element.getAttribute('role') || 
                    (element.getAttribute('aria-label') ? 'labeled' : 'aria');
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute;
          top: -16px;
          left: 0;
          background: #28a745;
          color: white;
          padding: 1px 4px;
          font-size: 9px;
          font-family: monospace;
          border-radius: 1px;
        `;
        label.textContent = role;
        highlight.appendChild(label);
        
        document.body.appendChild(highlight);
      });
    });
  }

  async addDimensionLines(): Promise<void> {
    await this.page.evaluate(() => {
      const containers = document.querySelectorAll('.container, .grid, .flex, .form-group');
      
      containers.forEach(container => {
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Add width dimension line
        const widthLine = document.createElement('div');
        widthLine.className = 'ai-dimension-line';
        widthLine.style.cssText = `
          position: absolute;
          left: ${rect.x}px;
          top: ${rect.y - 25}px;
          width: ${rect.width}px;
          height: 1px;
          background: #ff6b6b;
          z-index: 10001;
          pointer-events: none;
        `;
        
        const widthLabel = document.createElement('div');
        widthLabel.style.cssText = `
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: #ff6b6b;
          color: white;
          padding: 1px 4px;
          font-size: 9px;
          font-family: monospace;
          border-radius: 1px;
        `;
        widthLabel.textContent = `${Math.round(rect.width)}px`;
        widthLine.appendChild(widthLabel);
        
        document.body.appendChild(widthLine);

        // Add height dimension line for larger containers
        if (rect.height > 100) {
          const heightLine = document.createElement('div');
          heightLine.className = 'ai-dimension-line';
          heightLine.style.cssText = `
            position: absolute;
            left: ${rect.x - 25}px;
            top: ${rect.y}px;
            width: 1px;
            height: ${rect.height}px;
            background: #ff6b6b;
            z-index: 10001;
            pointer-events: none;
          `;
          
          const heightLabel = document.createElement('div');
          heightLabel.style.cssText = `
            position: absolute;
            top: 50%;
            left: -20px;
            transform: translateY(-50%) rotate(-90deg);
            background: #ff6b6b;
            color: white;
            padding: 1px 4px;
            font-size: 9px;
            font-family: monospace;
            border-radius: 1px;
            white-space: nowrap;
          `;
          heightLabel.textContent = `${Math.round(rect.height)}px`;
          heightLine.appendChild(heightLabel);
          
          document.body.appendChild(heightLine);
        }
      });
    });
  }

  async addGridOverlay(): Promise<void> {
    await this.page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.className = 'ai-grid-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9997;
        background-image: 
          linear-gradient(rgba(255, 0, 0, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 0, 0, 0.1) 1px, transparent 1px);
        background-size: 20px 20px;
      `;
      document.body.appendChild(overlay);
    });
  }

  async clearAnnotations(): Promise<void> {
    await this.page.evaluate(() => {
      const annotations = document.querySelectorAll(`
        .ai-annotation,
        .ai-interactive-highlight,
        .ai-a11y-highlight,
        .ai-dimension-line,
        .ai-grid-overlay,
        .ai-annotation-styles
      `);
      annotations.forEach(el => el.remove());
    });
  }

  private async injectAnnotationStyles(): Promise<void> {
    await this.page.evaluate(() => {
      if (document.querySelector('.ai-annotation-styles')) return;

      const style = document.createElement('style');
      style.className = 'ai-annotation-styles';
      style.textContent = `
        .ai-annotation {
          position: absolute;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 10000;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }
        
        .ai-annotation.critical {
          background: #dc3545;
          width: 24px;
          height: 24px;
          font-size: 12px;
        }
        
        .ai-annotation.high {
          background: #fd7e14;
          width: 22px;
          height: 22px;
          font-size: 11px;
        }
        
        .ai-annotation.medium {
          background: #ffc107;
          color: #000;
          width: 20px;
          height: 20px;
          font-size: 10px;
        }
        
        .ai-annotation.low {
          background: #6c757d;
          width: 18px;
          height: 18px;
          font-size: 9px;
        }
        
        .ai-issue-bounds {
          position: absolute;
          border: 2px dashed;
          background: rgba(255, 255, 255, 0.1);
          pointer-events: none;
          z-index: 9999;
        }
        
        .ai-issue-bounds.critical {
          border-color: #dc3545;
          background: rgba(220, 53, 69, 0.1);
        }
        
        .ai-issue-bounds.high {
          border-color: #fd7e14;
          background: rgba(253, 126, 20, 0.1);
        }
        
        .ai-issue-bounds.medium {
          border-color: #ffc107;
          background: rgba(255, 193, 7, 0.1);
        }
        
        .ai-issue-bounds.low {
          border-color: #6c757d;
          background: rgba(108, 117, 125, 0.1);
        }
      `;
      document.head.appendChild(style);
    });
  }

  async captureWithAnnotations(
    issues: UIIssue[],
    filename: string,
    options: {
      fullPage?: boolean;
      showGrid?: boolean;
      showDimensions?: boolean;
      showInteractive?: boolean;
      showAccessibility?: boolean;
    } = {}
  ): Promise<void> {
    // Clear any existing annotations
    await this.clearAnnotations();

    // Add grid overlay if requested
    if (options.showGrid) {
      await this.addGridOverlay();
    }

    // Add dimension lines if requested
    if (options.showDimensions) {
      await this.addDimensionLines();
    }

    // Highlight interactive elements if requested
    if (options.showInteractive) {
      await this.highlightInteractiveElements();
    }

    // Highlight accessibility elements if requested
    if (options.showAccessibility) {
      await this.highlightAccessibilityTree();
    }

    // Add issue annotations
    await this.annotateIssues(issues);

    // Wait for annotations to render
    await this.page.waitForTimeout(200);

    // Take screenshot
    await this.page.screenshot({
      path: filename,
      fullPage: options.fullPage ?? true,
      animations: 'disabled'
    });

    // Clean up annotations
    await this.clearAnnotations();
  }

  async createComparisonScreenshot(
    issues: UIIssue[],
    beforePath: string,
    annotatedPath: string,
    comparisonPath: string
  ): Promise<void> {
    // Take before screenshot
    await this.page.screenshot({
      path: beforePath,
      fullPage: true,
      animations: 'disabled'
    });

    // Take annotated screenshot
    await this.captureWithAnnotations(issues, annotatedPath, {
      fullPage: true,
      showGrid: false,
      showDimensions: false
    });

    // Create side-by-side comparison using viewport manipulation
    const viewport = this.page.viewportSize()!;
    await this.page.setViewportSize({ width: viewport.width * 2, height: viewport.height });

    // This would require more complex image manipulation
    // For now, we'll just create the annotated version
    await this.page.setViewportSize(viewport);
  }
}

// Helper function to generate issue bounds overlay
export async function addIssueBounds(page: Page, issues: UIIssue[]): Promise<void> {
  await page.evaluate((issuesData) => {
    issuesData.forEach(issue => {
      if (!issue.location.width || !issue.location.height) return;

      const bounds = document.createElement('div');
      bounds.className = `ai-issue-bounds ${issue.severity}`;
      bounds.style.cssText = `
        position: absolute;
        left: ${issue.location.x}px;
        top: ${issue.location.y}px;
        width: ${issue.location.width}px;
        height: ${issue.location.height}px;
        z-index: 9999;
        pointer-events: none;
      `;
      document.body.appendChild(bounds);
    });
  }, issues);
}

// Helper function to wait for animations and stabilize page
export async function waitForPageStable(page: Page, timeout: number = 2000): Promise<void> {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  
  // Wait for any CSS animations to complete
  await page.waitForTimeout(500);
  
  // Check if page is still changing
  let previousHeight = await page.evaluate(() => document.body.scrollHeight);
  
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(300);
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    
    if (currentHeight === previousHeight) {
      break; // Page is stable
    }
    
    previousHeight = currentHeight;
  }
}