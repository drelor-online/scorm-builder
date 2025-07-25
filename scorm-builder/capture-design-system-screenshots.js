import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Capturing screenshots of refactored Course Seed Input...');
  
  // Navigate to app
  await page.goto('http://localhost:1420');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Capture initial state
  await page.screenshot({ 
    path: 'design-system-screenshots/course-seed-input-initial.png', 
    fullPage: true 
  });
  
  // Fill in some data to see form in action
  await page.fill('input[placeholder="Enter your course title"]', 'Design System Test Course');
  
  // Click on Hard difficulty
  await page.click('button:has-text("Hard")');
  
  // Select a template
  await page.selectOption('select.input', 'Technical');
  await page.waitForTimeout(500);
  
  // Add some topics
  await page.fill('textarea', `Introduction to Design Systems
Component Architecture
Consistent Styling Patterns
Testing Strategies
Implementation Best Practices`);
  
  // Capture filled state
  await page.screenshot({ 
    path: 'design-system-screenshots/course-seed-input-filled.png', 
    fullPage: true 
  });
  
  // Try to submit without title to see error state
  await page.fill('input[placeholder="Enter your course title"]', '');
  await page.click('button:has-text("Continue to AI Prompt")');
  await page.waitForTimeout(1000);
  
  // Capture error state
  await page.screenshot({ 
    path: 'design-system-screenshots/course-seed-input-error.png', 
    fullPage: true 
  });
  
  console.log('Screenshots saved to design-system-screenshots/');
  
  await browser.close();
})();