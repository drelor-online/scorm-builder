#!/usr/bin/env node

import puppeteer from 'puppeteer';

console.log('🔍 Quick Workflow Test\n');

async function runTest() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('1. Loading dashboard...');
    await page.goto('http://localhost:1420', { waitUntil: 'networkidle0' });
    
    // Check title visibility
    const titleVisible = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return { found: false };
      
      const style = window.getComputedStyle(h1);
      const color = style.color;
      const rgb = color.match(/\d+/g);
      const brightness = rgb ? (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3 : 0;
      
      return {
        found: true,
        text: h1.textContent,
        color: color,
        brightness: brightness,
        visible: brightness > 100
      };
    });
    
    console.log('   Title check:', titleVisible);
    if (!titleVisible.visible) {
      console.log('   ❌ Title text is too dark!');
    } else {
      console.log('   ✅ Title is visible');
    }
    
    // Create new project
    console.log('\n2. Creating new project...');
    // Try different selectors
    try {
      await page.click('button:has-text("Create New Project")', { timeout: 5000 });
    } catch {
      // Fallback to text content
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const button = buttons.find(b => b.textContent.includes('Create New Project'));
        if (button) button.click();
      });
    }
    await page.waitForSelector('[role="dialog"]');
    
    await page.type('input[placeholder="Enter project name"]', 'Quick Test Project');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(b => b.textContent === 'Create');
      if (button) button.click();
    });
    
    // Wait for course config
    await page.waitForFunction(() => {
      const h1 = document.querySelector('h1');
      return h1 && h1.textContent.includes('Course Configuration');
    });
    console.log('   ✅ Navigated to Course Configuration');
    
    // Check if title auto-populated
    const titleValue = await page.$eval('input[placeholder*="course title" i]', el => el.value);
    console.log(`   Course title value: "${titleValue}"`);
    
    // Fill some data
    console.log('\n3. Filling course data...');
    await page.evaluate(() => {
      const titleInput = document.querySelector('input[placeholder*="course title" i]');
      titleInput.value = 'Updated Test Course';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      const topicsTextarea = document.querySelector('textarea[placeholder*="topics" i]');
      topicsTextarea.value = 'Topic One\nTopic Two\nTopic Three';
      topicsTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    // Navigate forward
    console.log('\n4. Navigating to Media Enhancement...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(b => b.textContent.includes('Next'));
      if (button) button.click();
    });
    await page.waitForFunction(() => {
      const h1 = document.querySelector('h1');
      return h1 && h1.textContent.includes('Media Enhancement');
    });
    console.log('   ✅ Reached Media Enhancement');
    
    // Navigate back
    console.log('\n5. Navigating back to Course Configuration...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(b => b.textContent.includes('Back'));
      if (button) button.click();
    });
    await page.waitForFunction(() => {
      const h1 = document.querySelector('h1');
      return h1 && h1.textContent.includes('Course Configuration');
    });
    
    // Check if data persisted
    const dataCheck = await page.evaluate(() => {
      const titleInput = document.querySelector('input[placeholder*="course title" i]');
      const topicsTextarea = document.querySelector('textarea[placeholder*="topics" i]');
      
      return {
        title: titleInput?.value,
        topics: topicsTextarea?.value
      };
    });
    
    console.log('   Data persistence check:', dataCheck);
    if (dataCheck.title === 'Updated Test Course' && dataCheck.topics === 'Topic One\nTopic Two\nTopic Three') {
      console.log('   ✅ Data persisted correctly!');
    } else {
      console.log('   ❌ Data was lost!');
    }
    
    // Check progress indicator
    console.log('\n6. Checking progress indicator...');
    const progressCheck = await page.evaluate(() => {
      const steps = document.querySelectorAll('[data-testid^="progress-step-"]');
      const results = [];
      steps.forEach((step, index) => {
        results.push({
          step: index,
          visited: step.getAttribute('data-visited') === 'true',
          disabled: step.disabled
        });
      });
      return results;
    });
    
    console.log('   Progress indicator state:');
    progressCheck.forEach(step => {
      console.log(`     Step ${step.step}: visited=${step.visited}, disabled=${step.disabled}`);
    });
    
    console.log('\n✅ Quick test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await browser.close();
  }
}

// Run the test
runTest().catch(console.error);