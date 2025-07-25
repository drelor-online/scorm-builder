import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Capturing screenshots of refactored JSON Import page...');
  
  // Navigate to app
  await page.goto('http://localhost:1420');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Fill form to proceed to JSON Import
  await page.fill('input[placeholder="Enter your course title"]', 'Test Course');
  await page.fill('textarea', 'Topic 1\nTopic 2\nTopic 3');
  
  // Click Next to go to AI Prompt page
  await page.click('button:has-text("Continue to AI Prompt")');
  await page.waitForTimeout(1000);
  
  // Skip AI Prompt and go to JSON Import
  await page.click('button:has-text("Skip AI")');
  await page.waitForTimeout(2000);
  
  // Capture initial state
  await page.screenshot({ 
    path: 'design-system-screenshots/json-import-initial.png', 
    fullPage: true 
  });
  
  // Test paste functionality with invalid JSON
  const invalidJSON = '{ invalid json }';
  await page.fill('textarea.textarea', invalidJSON);
  await page.click('button:has-text("Validate JSON")');
  await page.waitForTimeout(1000);
  
  // Capture error state
  await page.screenshot({ 
    path: 'design-system-screenshots/json-import-error.png', 
    fullPage: true 
  });
  
  // Add valid JSON
  const validJSON = JSON.stringify({
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to the Course',
      content: '<h1>Welcome!</h1><p>This course covers design systems.</p>',
      narration: 'Welcome to our comprehensive course on design systems.'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Understand design systems</li><li>Implement components</li><li>Ensure consistency</li></ul>',
      narration: 'By the end of this course, you will master design systems.'
    },
    topics: [
      {
        id: 'topic1',
        title: 'Introduction to Design Systems',
        content: '<h2>What are Design Systems?</h2><p>Design systems provide consistency.</p>',
        narration: 'Design systems are collections of reusable components.'
      },
      {
        id: 'topic2',
        title: 'Component Architecture',
        content: '<h2>Building Components</h2><p>Components should be reusable and flexible.</p>',
        narration: 'Well-architected components form the foundation.'
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'What is the main benefit of design systems?',
          options: ['Consistency', 'Speed', 'Complexity', 'Cost'],
          correctAnswer: 0
        }
      ]
    }
  }, null, 2);
  
  await page.fill('textarea.textarea', validJSON);
  await page.click('button:has-text("Validate JSON")');
  await page.waitForTimeout(1000);
  
  // Capture success state
  await page.screenshot({ 
    path: 'design-system-screenshots/json-import-success.png', 
    fullPage: true 
  });
  
  console.log('Screenshots saved to design-system-screenshots/');
  
  await browser.close();
})();