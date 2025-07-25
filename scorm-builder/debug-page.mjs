#!/usr/bin/env node

import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  await page.goto('http://localhost:1420');
  
  // Wait a bit for page to load
  await page.waitForTimeout(2000);
  
  // Debug what's on the page
  const debug = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const h1s = Array.from(document.querySelectorAll('h1'));
    const body = document.body.innerHTML.substring(0, 500);
    
    return {
      buttonCount: buttons.length,
      buttons: buttons.map(b => ({
        text: b.textContent.trim(),
        visible: b.offsetParent !== null,
        class: b.className
      })),
      h1s: h1s.map(h => h.textContent),
      bodySnippet: body
    };
  });
  
  console.log('Page Debug Info:', JSON.stringify(debug, null, 2));
  
  // Keep browser open
  console.log('\nBrowser will stay open. Press Ctrl+C to close.');
}

debug().catch(console.error);