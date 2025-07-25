import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Complete mock data for all steps
const mockProjectData = {
  projectId: "test-" + Date.now(),
  currentStep: 7, // Set to last step to enable all navigation
  courseSeedData: {
    title: "Complete Web Development Masterclass",
    difficulty: 3,
    customTopics: "HTML5, CSS3, JavaScript, React, Node.js, MongoDB, REST APIs"
  },
  aiPromptData: {
    prompt: "Create a comprehensive web development course",
    generatedContent: {
      modules: [
        {
          id: "mod1",
          title: "HTML & CSS Fundamentals",
          description: "Learn the basics of web structure and styling",
          topics: ["HTML5 Elements", "CSS Grid", "Flexbox", "Responsive Design"]
        },
        {
          id: "mod2", 
          title: "JavaScript Programming",
          description: "Master modern JavaScript",
          topics: ["ES6+ Features", "DOM Manipulation", "Async Programming", "Error Handling"]
        },
        {
          id: "mod3",
          title: "React Development", 
          description: "Build modern web applications",
          topics: ["Components", "Hooks", "State Management", "Routing"]
        }
      ]
    }
  },
  activities: [
    {
      id: "act1",
      type: "multipleChoice",
      question: "What is the purpose of semantic HTML?",
      options: ["Better SEO", "Styling", "JavaScript", "Database"],
      correctAnswer: 0
    },
    {
      id: "act2", 
      type: "trueFalse",
      question: "React is a JavaScript library for building user interfaces",
      correctAnswer: true
    }
  ],
  mediaEnhancements: {
    welcomeVideo: { enabled: true, url: "sample-video.mp4" },
    moduleImages: { mod1: "html-css.jpg", mod2: "javascript.jpg", mod3: "react.jpg" }
  },
  audioNarration: {
    enabled: true,
    voice: "en-US-Standard-A",
    scripts: {
      welcome: "Welcome to the Complete Web Development Masterclass",
      mod1: "In this module, we'll learn HTML and CSS fundamentals"
    }
  },
  scormSettings: {
    scormVersion: "2004",
    completionCriteria: "80",
    passingScore: "70"
  }
};

async function forceNavigationScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots-all-pages');
  if (fs.existsSync(screenshotsDir)) {
    fs.rmSync(screenshotsDir, { recursive: true });
  }
  fs.mkdirSync(screenshotsDir, { recursive: true });

  console.log(`📁 Screenshots directory: ${screenshotsDir}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  let screenshotCount = 0;

  try {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // Inject the mock data and force enable all steps
    console.log('🔧 Injecting mock data to enable all navigation...');
    await page.evaluate((data) => {
      // Store in localStorage
      localStorage.setItem('scorm-builder-project', JSON.stringify(data));
      
      // Try to update React state if possible
      const event = new Event('storage');
      window.dispatchEvent(event);
      
      // Force enable all step buttons
      document.querySelectorAll('button[disabled]').forEach(btn => {
        btn.removeAttribute('disabled');
        btn.classList.remove('disabled', 'btn-disabled');
      });
    }, mockProjectData);

    await page.waitForTimeout(1000);

    // Take screenshots of each step
    console.log('📸 Capturing all pages...\n');

    // 1. Course Seed Input
    console.log('1️⃣ Course Seed Input');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-course-seed-input.png'),
      fullPage: true 
    });
    screenshotCount++;

    // Try clicking step 2 or continue button
    console.log('2️⃣ AI Prompt Generator');
    let moved = false;
    
    // Try multiple selectors
    const step2Selectors = [
      'button:has-text("2")',
      'button:has-text("Continue to AI Prompt")',
      'button:has-text("AI Prompt")',
      '[data-step="2"]'
    ];
    
    for (const selector of step2Selectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          moved = true;
          break;
        }
      } catch (e) {
        // Continue trying
      }
    }

    if (!moved) {
      // Force navigation by URL if available
      await page.goto('http://localhost:1420/?step=2');
    }
    
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-ai-prompt-generator.png'),
      fullPage: true 
    });
    screenshotCount++;

    // 3. Activities Editor
    console.log('3️⃣ Activities Editor');
    await clickStepOrNavigate(page, 3, 'Activities');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-activities-editor.png'),
      fullPage: true 
    });
    screenshotCount++;

    // 4. JSON Import/Export
    console.log('4️⃣ JSON Import/Export');
    await clickStepOrNavigate(page, 4, 'JSON');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-json-import-export.png'),
      fullPage: true 
    });
    screenshotCount++;

    // 5. Media Enhancement
    console.log('5️⃣ Media Enhancement');
    await clickStepOrNavigate(page, 5, 'Media');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '05-media-enhancement.png'),
      fullPage: true 
    });
    screenshotCount++;

    // 6. Audio Narration
    console.log('6️⃣ Audio Narration');
    await clickStepOrNavigate(page, 6, 'Audio');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '06-audio-narration.png'),
      fullPage: true 
    });
    screenshotCount++;

    // 7. SCORM Package Builder
    console.log('7️⃣ SCORM Package Builder');
    await clickStepOrNavigate(page, 7, 'SCORM');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '07-scorm-package.png'),
      fullPage: true 
    });
    screenshotCount++;

    // Navigate back to step 1 for modals
    await clickStepOrNavigate(page, 1, 'Course Seed');
    await page.waitForTimeout(1000);

    // Capture all modals
    console.log('\n📸 Capturing modals...\n');

    // Settings
    console.log('⚙️ Settings Modal');
    await page.click('button[aria-label*="Settings" i]');
    await page.waitForTimeout(800);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '08-settings-modal.png'),
      fullPage: true 
    });
    screenshotCount++;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Help
    console.log('❓ Help Modal');
    const helpBtn = await page.$('button[aria-label*="Help" i]');
    if (helpBtn) {
      await helpBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '09-help-modal.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Open Project
    console.log('📂 Open Project Dialog');
    const openBtn = await page.$('button[aria-label*="Open" i]');
    if (openBtn) {
      await openBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '10-open-project.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Save Project
    console.log('💾 Save Project Dialog');
    const saveBtn = await page.$('button[aria-label*="Save" i]');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '11-save-project.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Preview
    console.log('👁️ Course Preview');
    const previewBtn = await page.$('button:has-text("Preview")');
    if (previewBtn) {
      await previewBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '12-course-preview.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Template Manager
    console.log('📋 Template Manager');
    const templateBtn = await page.$('button:has-text("Template")');
    if (templateBtn) {
      await templateBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '13-template-manager.png'),
        fullPage: true 
      });
      screenshotCount++;
    }

    // UI Components
    console.log('\n📸 UI Components...\n');

    // Step Progress
    const stepProgress = await page.$('.step-progress');
    if (stepProgress) {
      await page.screenshot({ 
        path: path.join(screenshotsDir, '14-step-progress.png'),
        clip: await stepProgress.boundingBox()
      });
      screenshotCount++;
    }

    // Enhanced buttons/cards
    const card = await page.$('.card');
    if (card) {
      await card.hover();
      await page.waitForTimeout(300);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '15-card-hover.png'),
        clip: await card.boundingBox()
      });
      screenshotCount++;
    }

    console.log(`\n✅ Successfully captured ${screenshotCount} screenshots!\n`);
    console.log(`📁 Location: ${screenshotsDir}\n`);
    
    const files = fs.readdirSync(screenshotsDir);
    console.log('📸 Screenshots saved:');
    files.filter(f => f.endsWith('.png')).sort().forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   - ${file} (${size} KB)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'error-state.png'),
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

async function clickStepOrNavigate(page, stepNumber, stepName) {
  try {
    // Try clicking the step button
    const stepBtn = await page.$(`button:has-text("${stepNumber}")`);
    if (stepBtn) {
      // Force enable if disabled
      await page.evaluate(el => {
        el.removeAttribute('disabled');
        el.classList.remove('disabled', 'btn-disabled');
      }, stepBtn);
      
      await stepBtn.click();
      return;
    }
    
    // Try other navigation methods
    const navBtn = await page.$(`button:has-text("${stepName}")`) || 
                   await page.$(`a:has-text("${stepName}")`);
    if (navBtn) {
      await navBtn.click();
      return;
    }
    
    // Try URL navigation
    await page.goto(`http://localhost:1420/?step=${stepNumber}`);
  } catch (e) {
    console.log(`Could not navigate to step ${stepNumber}`);
  }
}

forceNavigationScreenshots().catch(console.error);