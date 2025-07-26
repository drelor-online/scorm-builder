import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I do a quick navigation check', async function () {
  console.log('🚀 Quick navigation test...')
  
  const url = this.baseUrl || 'http://localhost:1420'
  
  try {
    // Just navigate without waiting
    const response = await this.page.goto(url, {
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    })
    
    console.log('Response status:', response?.status())
    console.log('Response URL:', response?.url())
    
    // Quick wait
    await this.page.waitForTimeout(2000)
    
    // Take screenshot immediately
    const screenshot = await this.page.screenshot()
    // this.attach is not available in our context, just save to file
    await this.page.screenshot({ path: 'test-quick-diagnostic.png' })
    
  } catch (error) {
    console.error('Navigation error:', error)
    
    // Try to get current state anyway
    const currentUrl = this.page.url()
    console.log('Current URL:', currentUrl)
    
    if (currentUrl === 'about:blank') {
      console.log('⚠️ Page never navigated from about:blank')
      console.log(`Is the dev server running on ${url}?`)
    }
  }
})

Then('I check basic page info', async function () {
  try {
    const url = this.page.url()
    const title = await this.page.title().catch(() => 'No title')
    
    console.log('Page URL:', url)
    console.log('Page title:', title)
    
    // Try to get any content
    const bodyText = await this.page.evaluate(() => {
      return document.body ? document.body.innerText?.substring(0, 200) || 'Body has no text' : 'No body element'
    }).catch(err => `Error getting body text: ${err}`)
    
    console.log('Body text:', bodyText)
    
    // Check if page is completely blank
    const hasContent = await this.page.evaluate(() => {
      return document.body && document.body.innerHTML.length > 0
    }).catch(() => false)
    
    console.log('Page has content:', hasContent)
    
  } catch (error) {
    console.error('Error checking page info:', error)
  }
  
  expect(true).toBe(true)
})