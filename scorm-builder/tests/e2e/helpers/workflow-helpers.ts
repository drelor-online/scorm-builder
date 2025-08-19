import { Page, expect } from '@playwright/test';

/**
 * Helper functions for SCORM Builder workflow automation
 * Based on actual data-testid selectors from the application
 */

export class WorkflowHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to dashboard and wait for it to load
   */
  async goToDashboard() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.locator('[data-testid="new-project-button"]')).toBeVisible({ timeout: 30000 });
  }

  /**
   * Create a new project with the given name
   */
  async createProject(projectName: string) {
    await this.page.click('[data-testid="new-project-button"]');
    await this.page.fill('[data-testid="project-name-input"]', projectName);
    await this.page.click('[data-testid="create-project-confirm"]');
    
    // Wait for project creation to complete and navigate to course seed input
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.locator('h1, h2, .main-title')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Fill course seed input form
   */
  async fillCourseSeedInput(options: {
    title: string;
    template?: 'How-to Guide' | 'Corporate' | 'Technical' | 'Safety';
    topics?: string[];
    objectives?: string[];
  }) {
    // Fill course title
    const titleInput = this.page.locator('input[placeholder*="course title"], input[aria-label*="title"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill(options.title);
    }

    // Select template if provided
    if (options.template) {
      await this.page.selectOption('[data-testid="template-select"]', options.template);
    }

    // Add template topics if template is selected
    if (options.template) {
      const addTopicsButton = this.page.locator('[data-testid="add-template-topics"]');
      if (await addTopicsButton.isVisible()) {
        await addTopicsButton.click();
      }
    }

    // Fill custom topics
    if (options.topics && options.topics.length > 0) {
      const topicsTextarea = this.page.locator('textarea[placeholder*="topics"]').first();
      if (await topicsTextarea.isVisible()) {
        await topicsTextarea.fill(options.topics.join('\n'));
      }
    }

    // Fill learning objectives
    if (options.objectives && options.objectives.length > 0) {
      const objectivesTextarea = this.page.locator('textarea[placeholder*="objective"]').first();
      if (await objectivesTextarea.isVisible()) {
        await objectivesTextarea.fill(options.objectives.join('\n'));
      }
    }

    // Wait for auto-save
    await this.waitForAutoSave();
  }

  /**
   * Navigate to the next step
   */
  async clickNext() {
    await this.page.click('[data-testid="next-button"]');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to the previous step
   */
  async clickBack() {
    await this.page.click('[data-testid="back-button"]');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for auto-save indicator
   */
  async waitForAutoSave() {
    try {
      await expect(this.page.locator('text=Saved, text=Auto-saved')).toBeVisible({ timeout: 5000 });
    } catch {
      // Auto-save might not be visible, continue
      console.log('Auto-save indicator not found, continuing...');
    }
  }

  /**
   * Handle AI Prompt Generator step
   */
  async handleAIPromptGenerator() {
    // Wait for AI prompt to be generated
    await expect(this.page.locator('[data-testid="copy-prompt-button"]')).toBeVisible({ timeout: 15000 });
    
    // Optionally copy the prompt
    await this.page.click('[data-testid="copy-prompt-button"]');
  }

  /**
   * Handle JSON Import step
   */
  async handleJSONImport(jsonContent?: string) {
    if (jsonContent) {
      await this.page.fill('[data-testid="json-textarea"]', jsonContent);
    } else {
      // Try to paste from clipboard
      const pasteButton = this.page.locator('[data-testid="paste-clipboard-button"]');
      if (await pasteButton.isVisible()) {
        await pasteButton.click();
      }
    }
  }

  /**
   * Handle Media Enhancement step
   */
  async handleMediaEnhancement(options: {
    searchTerms?: string[];
    skipMediaSelection?: boolean;
  } = {}) {
    if (options.skipMediaSelection) {
      return;
    }

    // Select media for content sections
    const contentSections = await this.page.locator('[data-testid^="content-preview-"]').all();
    
    for (let i = 0; i < Math.min(contentSections.length, 2); i++) {
      await contentSections[i].click();
      
      // Use search term or default
      const searchTerm = options.searchTerms?.[i] || 'generic image';
      
      // Search for images
      const searchButton = this.page.locator(`button:has-text("${searchTerm}")`).first();
      if (await searchButton.isVisible()) {
        await searchButton.click();
      }
      
      // Select first result
      const firstImage = this.page.locator('.MediaEnhancementWizard-module__resultImage__fZM7R').first();
      if (await firstImage.isVisible()) {
        await firstImage.click();
        await this.page.click('[data-testid="set-media-button"]');
      }
    }
  }

  /**
   * Handle Audio Narration step
   */
  async handleAudioNarration(options: {
    skipAudio?: boolean;
    recordNew?: boolean;
  } = {}) {
    if (options.skipAudio) {
      return;
    }

    if (options.recordNew) {
      // Record new audio
      await this.page.click('[data-testid="start-recording-button"]');
      await this.page.waitForTimeout(2000); // Record for 2 seconds
      await this.page.click('[data-testid="stop-recording-button"]');
      await this.page.click('[data-testid="save-recording-button"]');
    }
  }

  /**
   * Handle Activities step
   */
  async handleActivities(options: {
    addQuestions?: number;
    skipActivities?: boolean;
  } = {}) {
    if (options.skipActivities) {
      return;
    }

    // Add knowledge check questions
    if (options.addQuestions && options.addQuestions > 0) {
      for (let i = 0; i < options.addQuestions; i++) {
        await this.page.click('[data-testid="add-knowledge-check-question"]');
        // Fill question details would go here
        await this.page.click('button:has-text("Save")');
      }
    }
  }

  /**
   * Generate SCORM package
   */
  async generateSCORMPackage() {
    await this.page.click('[data-testid="generate-scorm-button"]');
    
    // Wait for generation to complete
    await expect(this.page.locator('text=Package generated successfully, text=Generation complete')).toBeVisible({ 
      timeout: 60000 
    });
  }

  /**
   * Complete full workflow from project creation to SCORM generation
   */
  async completeFullWorkflow(options: {
    projectName: string;
    courseTitle: string;
    template?: 'How-to Guide' | 'Corporate' | 'Technical' | 'Safety';
    topics?: string[];
    objectives?: string[];
    skipMedia?: boolean;
    skipAudio?: boolean;
    skipActivities?: boolean;
  }) {
    // Step 1: Dashboard - Create Project
    await this.goToDashboard();
    await this.createProject(options.projectName);

    // Step 2: Course Seed Input
    await this.fillCourseSeedInput({
      title: options.courseTitle,
      template: options.template,
      topics: options.topics,
      objectives: options.objectives
    });
    await this.clickNext();

    // Step 3: AI Prompt Generator
    await this.handleAIPromptGenerator();
    await this.clickNext();

    // Step 4: JSON Import
    await this.handleJSONImport();
    await this.clickNext();

    // Step 5: Media Enhancement
    await this.handleMediaEnhancement({
      skipMediaSelection: options.skipMedia
    });
    await this.clickNext();

    // Step 6: Audio Narration
    await this.handleAudioNarration({
      skipAudio: options.skipAudio
    });
    await this.clickNext();

    // Step 7: Activities
    await this.handleActivities({
      skipActivities: options.skipActivities
    });
    await this.clickNext();

    // Step 8: SCORM Generation
    await this.generateSCORMPackage();
  }

  /**
   * Verify current step by checking for step-specific elements
   */
  async verifyCurrentStep(expectedStep: string) {
    const stepSelectors = {
      'dashboard': '[data-testid="new-project-button"]',
      'course-seed': '[data-testid="template-select"]',
      'ai-prompt': '[data-testid="copy-prompt-button"]',
      'json-import': '[data-testid="json-textarea"]',
      'media-enhancement': '[data-testid="set-media-button"]',
      'audio-narration': '[data-testid="start-recording-button"]',
      'activities': '[data-testid="add-knowledge-check-question"]',
      'scorm-generation': '[data-testid="generate-scorm-button"]'
    };

    const selector = stepSelectors[expectedStep as keyof typeof stepSelectors];
    if (selector) {
      await expect(this.page.locator(selector)).toBeVisible({ timeout: 10000 });
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async takeDebugScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/debug-${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Wait for any loading states to complete
   */
  async waitForLoading() {
    await this.page.waitForLoadState('networkidle');
    
    // Wait for any loading spinners to disappear
    const loadingSpinners = this.page.locator('.loading, .spinner, [data-testid*="loading"]');
    if (await loadingSpinners.first().isVisible()) {
      await expect(loadingSpinners.first()).toHaveCount(0, { timeout: 30000 });
    }
  }
}