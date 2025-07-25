import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugNavigation() {
  const screenshotsDir = path.join(__dirname, 'screenshots-output');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // Log all navigation links and buttons
    console.log('\n=== NAVIGATION ELEMENTS ===');
    
    // Find all links
    const links = await page.$$eval('a', links => 
      links.map(link => ({ text: link.textContent?.trim(), href: link.href }))
    );
    console.log('\nLinks found:', links);

    // Find all buttons
    const buttons = await page.$$eval('button', buttons => 
      buttons.map(btn => ({ 
        text: btn.textContent?.trim(), 
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className 
      }))
    );
    console.log('\nButtons found:', buttons);

    // Find nav elements
    const navItems = await page.$$eval('nav a, nav button', items => 
      items.map(item => ({ text: item.textContent?.trim(), tag: item.tagName }))
    );
    console.log('\nNav items found:', navItems);

    // Take screenshot of current state
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'debug-01-initial-state.png'),
      fullPage: true 
    });

    // Try to generate course first
    console.log('\n=== GENERATING COURSE ===');
    await page.fill('input[placeholder*="course title" i]', 'Web Development Course');
    
    // Find and click difficulty button
    const mediumBtn = await page.$('button:has-text("Medium")');
    if (mediumBtn) await mediumBtn.click();
    
    await page.fill('textarea', 'HTML, CSS, JavaScript, React, Node.js');
    
    // Generate course
    const generateBtn = await page.$('button:has-text("Generate Course")');
    if (generateBtn) {
      console.log('Clicking Generate Course button...');
      await generateBtn.click();
      await page.waitForTimeout(3000);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'debug-02-after-generation.png'),
        fullPage: true 
      });

      // Check navigation again after generation
      const newLinks = await page.$$eval('a', links => 
        links.map(link => ({ text: link.textContent?.trim(), href: link.href }))
      );
      console.log('\nLinks after generation:', newLinks);

      // Look for tab navigation
      const tabs = await page.$$eval('[role="tab"], .tab, [class*="tab"]', tabs => 
        tabs.map(tab => ({ text: tab.textContent?.trim(), className: tab.className }))
      );
      console.log('\nTabs found:', tabs);
    }

    // Try different selectors for navigation
    console.log('\n=== TRYING DIFFERENT NAVIGATION PATTERNS ===');
    
    // Pattern 1: Look for any element with navigation-like text
    const navTexts = ['Activities', 'Media', 'Audio', 'SCORM', 'Package', 'Export'];
    for (const text of navTexts) {
      const element = await page.$(`*:has-text("${text}")`);
      if (element) {
        const tagName = await element.evaluate(el => el.tagName);
        console.log(`Found "${text}" in ${tagName}`);
      }
    }

    // Pattern 2: Check for specific class patterns
    const navClasses = await page.$$eval('[class*="nav"], [class*="tab"], [class*="menu"]', els => 
      els.map(el => ({ tag: el.tagName, className: el.className, text: el.textContent?.trim() }))
    );
    console.log('\nElements with nav/tab/menu classes:', navClasses);

  } catch (error) {
    console.error('Error during navigation debug:', error);
  } finally {
    console.log('\nDebug screenshots saved to:', screenshotsDir);
    await browser.close();
  }
}

debugNavigation().catch(console.error);