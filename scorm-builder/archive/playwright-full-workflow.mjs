import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Valid course JSON data
const validCourseJSON = {
  "title": "Complete Web Development Course",
  "description": "Learn modern web development from scratch",
  "modules": [
    {
      "id": "module1",
      "title": "HTML & CSS Fundamentals",
      "description": "Learn the basics of web structure and styling",
      "topics": [
        {
          "id": "topic1",
          "title": "HTML5 Semantic Elements",
          "content": "Learn about header, nav, main, section, article, and footer elements."
        },
        {
          "id": "topic2",
          "title": "CSS Grid and Flexbox",
          "content": "Master modern CSS layout techniques for responsive design."
        }
      ]
    },
    {
      "id": "module2",
      "title": "JavaScript Programming",
      "description": "Master JavaScript from basics to advanced",
      "topics": [
        {
          "id": "topic3",
          "title": "Variables and Functions",
          "content": "Understanding let, const, arrow functions, and scope."
        },
        {
          "id": "topic4",
          "title": "Async Programming",
          "content": "Promises, async/await, and handling asynchronous operations."
        }
      ]
    },
    {
      "id": "module3",
      "title": "React Development",
      "description": "Build modern web applications with React",
      "topics": [
        {
          "id": "topic5",
          "title": "Components and Props",
          "content": "Creating reusable components and passing data with props."
        },
        {
          "id": "topic6",
          "title": "State and Hooks",
          "content": "Managing component state with useState and other React hooks."
        }
      ]
    }
  ]
};

async function fullWorkflowScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots-complete-workflow');
  if (fs.existsSync(screenshotsDir)) {
    fs.rmSync(screenshotsDir, { recursive: true });
  }
  fs.mkdirSync(screenshotsDir, { recursive: true });

  console.log(`📁 Screenshots will be saved to:\n${screenshotsDir}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 // Slow enough to see what's happening
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  let screenshotNum = 0;
  const takeScreenshot = async (name) => {
    screenshotNum++;
    const filename = `${String(screenshotNum).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ 
      path: path.join(screenshotsDir, filename),
      fullPage: true 
    });
    console.log(`📸 ${filename}`);
  };

  try {
    // Navigate to app
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // Step 1: Course Seed Input
    console.log('\n1️⃣ STEP 1: Course Seed Input\n');
    await takeScreenshot('course-seed-empty');

    // Fill in the course seed form
    await page.fill('input[placeholder*="course title" i]', 'Complete Web Development Course');
    await page.click('button:has-text("Medium")');
    await page.fill('textarea', 'HTML5, CSS3, JavaScript ES6+, React, Node.js, Express, MongoDB, REST APIs, Authentication, Deployment');
    
    await takeScreenshot('course-seed-filled');

    // Click Continue to AI Prompt
    await page.click('button:has-text("Continue to AI Prompt")');
    await page.waitForTimeout(1500);

    // Step 2: AI Prompt Generator  
    console.log('\n2️⃣ STEP 2: AI Prompt Generator\n');
    await takeScreenshot('ai-prompt-page');

    // Look for JSON input field and fill it
    const jsonTextarea = await page.$('textarea[placeholder*="json" i], textarea[placeholder*="JSON" i], textarea[placeholder*="course structure" i], textarea');
    if (jsonTextarea) {
      console.log('Found JSON textarea, filling with valid course data...');
      await jsonTextarea.fill(JSON.stringify(validCourseJSON, null, 2));
      await page.waitForTimeout(500);
      await takeScreenshot('ai-prompt-json-filled');
    }

    // Click Generate/Continue/Next
    const generateBtn = await page.$('button:has-text("Generate")') || 
                       await page.$('button:has-text("Continue")') || 
                       await page.$('button:has-text("Next")');
    if (generateBtn) {
      await generateBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot('ai-prompt-generated');
    }

    // Step 3: Activities Editor
    console.log('\n3️⃣ STEP 3: Activities Editor\n');
    
    // Try clicking step 3 button or Activities link
    const step3 = await page.$('button:has-text("3"):not([disabled])') || 
                  await page.$('a:has-text("Activities")') ||
                  await page.$('button:has-text("Activities")');
    if (step3) {
      await step3.click();
      await page.waitForTimeout(1500);
      await takeScreenshot('activities-editor');

      // Try to add an activity
      const addBtn = await page.$('button:has-text("Add Activity")') || 
                     await page.$('button:has-text("New Activity")') ||
                     await page.$('button:has-text("Create Activity")');
      if (addBtn) {
        await addBtn.click();
        await page.waitForTimeout(1000);
        await takeScreenshot('add-activity-modal');
        await page.keyboard.press('Escape');
      }
    }

    // Step 4: JSON Import/Export
    console.log('\n4️⃣ STEP 4: JSON Import/Export\n');
    const step4 = await page.$('button:has-text("4"):not([disabled])') || 
                  await page.$('button:has-text("JSON")') ||
                  await page.$('button:has-text("Import/Export")');
    if (step4) {
      await step4.click();
      await page.waitForTimeout(1500);
      await takeScreenshot('json-import-export');
    }

    // Step 5: Media Enhancement
    console.log('\n5️⃣ STEP 5: Media Enhancement\n');
    const step5 = await page.$('button:has-text("5"):not([disabled])') || 
                  await page.$('button:has-text("Media")');
    if (step5) {
      await step5.click();
      await page.waitForTimeout(1500);
      await takeScreenshot('media-enhancement');

      // Try media options
      const mediaOption = await page.$('input[type="checkbox"]');
      if (mediaOption) {
        await mediaOption.click();
        await page.waitForTimeout(500);
        await takeScreenshot('media-options-selected');
      }
    }

    // Step 6: Audio Narration
    console.log('\n6️⃣ STEP 6: Audio Narration\n');
    const step6 = await page.$('button:has-text("6"):not([disabled])') || 
                  await page.$('button:has-text("Audio")');
    if (step6) {
      await step6.click();
      await page.waitForTimeout(1500);
      await takeScreenshot('audio-narration');

      // Try to select a voice
      const voiceSelect = await page.$('select');
      if (voiceSelect) {
        await voiceSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await takeScreenshot('audio-voice-selected');
      }
    }

    // Step 7: SCORM Package Builder
    console.log('\n7️⃣ STEP 7: SCORM Package Builder\n');
    const step7 = await page.$('button:has-text("7"):not([disabled])') || 
                  await page.$('button:has-text("SCORM")') ||
                  await page.$('button:has-text("Export")');
    if (step7) {
      await step7.click();
      await page.waitForTimeout(1500);
      await takeScreenshot('scorm-package-builder');

      // Fill SCORM settings
      const versionSelect = await page.$('select[name*="version" i]');
      if (versionSelect) {
        await versionSelect.selectOption('2004');
      }
      
      const scoreInput = await page.$('input[name*="score" i], input[placeholder*="score" i]');
      if (scoreInput) {
        await scoreInput.fill('80');
      }
      
      await page.waitForTimeout(500);
      await takeScreenshot('scorm-settings-filled');

      // Try to build package
      const buildBtn = await page.$('button:has-text("Build")') || 
                       await page.$('button:has-text("Generate")') ||
                       await page.$('button:has-text("Export")');
      if (buildBtn) {
        await buildBtn.click();
        await page.waitForTimeout(2000);
        await takeScreenshot('scorm-package-built');
      }
    }

    // Navigate back to home for modals
    console.log('\n🏠 Navigating back to capture modals...\n');
    const homeStep = await page.$('button:has-text("1")');
    if (homeStep) {
      await homeStep.click();
      await page.waitForTimeout(1000);
    }

    // Capture all modals
    console.log('📸 Capturing modals...\n');

    // Settings
    await page.click('button[aria-label*="Settings" i]');
    await page.waitForTimeout(800);
    await takeScreenshot('settings-modal-enhanced');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Help
    const helpBtn = await page.$('button[aria-label*="Help" i]');
    if (helpBtn) {
      await helpBtn.click();
      await page.waitForTimeout(800);
      await takeScreenshot('help-modal-enhanced');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Open Project
    const openBtn = await page.$('button[aria-label*="Open" i]');
    if (openBtn) {
      await openBtn.click();
      await page.waitForTimeout(800);
      await takeScreenshot('open-project-dialog');
      
      // Check if there are any saved projects
      const projectItem = await page.$('.project-item, [data-project-id]');
      if (projectItem) {
        await projectItem.hover();
        await page.waitForTimeout(300);
        await takeScreenshot('open-project-hover');
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Save Project
    const saveBtn = await page.$('button[aria-label*="Save" i]');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(800);
      await takeScreenshot('save-project-dialog');
      
      // Fill save form
      const nameInput = await page.$('input[placeholder*="name" i]');
      if (nameInput) {
        await nameInput.fill('My Web Development Course v1.0');
        await page.waitForTimeout(300);
        await takeScreenshot('save-project-filled');
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Preview Course
    const previewBtn = await page.$('button:has-text("Preview")');
    if (previewBtn) {
      await previewBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot('course-preview-modal');
      
      // Try to navigate in preview
      const nextBtn = await page.$('button:has-text("Next")');
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(800);
        await takeScreenshot('course-preview-slide2');
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Template Manager
    const templateBtn = await page.$('button:has-text("Template")');
    if (templateBtn) {
      await templateBtn.click();
      await page.waitForTimeout(800);
      await takeScreenshot('template-manager');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // UI Components showcase
    console.log('\n🎨 Capturing UI enhancements...\n');

    // Step progress indicator
    const stepProgress = await page.$('.step-progress');
    if (stepProgress) {
      await takeScreenshot('step-progress-full');
    }

    // Button states
    const buttons = await page.$$('.btn');
    if (buttons.length > 0) {
      await buttons[0].hover();
      await page.waitForTimeout(300);
      await takeScreenshot('button-hover-effect');
    }

    // Card hover
    const cards = await page.$$('.card');
    if (cards.length > 0) {
      await cards[0].hover();
      await page.waitForTimeout(300);
      await takeScreenshot('card-hover-effect');
    }

    // Input focus
    const inputs = await page.$$('input, textarea');
    if (inputs.length > 0) {
      await inputs[0].focus();
      await page.waitForTimeout(300);
      await takeScreenshot('input-focus-ring');
    }

    console.log(`\n✅ Successfully captured ${screenshotNum} screenshots!\n`);
    console.log(`📁 Location: ${screenshotsDir}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await takeScreenshot('error-state');
  } finally {
    await browser.close();
    
    // List all screenshots
    const files = fs.readdirSync(screenshotsDir);
    console.log('📸 Screenshots captured:');
    files.filter(f => f.endsWith('.png')).sort().forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   ${file} (${size} KB)`);
    });
  }
}

fullWorkflowScreenshots().catch(console.error);