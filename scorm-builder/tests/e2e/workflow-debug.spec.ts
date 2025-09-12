import { test, expect } from '@playwright/test'

test.describe('Workflow Debugging', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('Debug complete application workflow step by step', async ({ page }) => {
    console.log('\n🔍 Starting workflow debugging...')
    
    // Step 1: Initial state
    console.log('📋 Step 1: Checking initial dashboard state')
    await page.screenshot({ path: 'debug-01-initial-dashboard.png' })
    
    // Check what's visible on the dashboard
    const visibleButtons = await page.locator('button').allTextContents()
    console.log('   Available buttons:', visibleButtons.slice(0, 10))
    
    // Step 2: Create project
    console.log('📋 Step 2: Creating project')
    await page.getByTestId('new-project-button').click()
    await page.waitForSelector('input[placeholder*="project name"]', { timeout: 10000 })
    await page.getByPlaceholder(/project name/i).fill('Debug Workflow Test')
    await page.waitForTimeout(1000)
    await page.locator('button:has-text("Create"):not([data-testid])').click({ force: true })
    await page.waitForTimeout(3000)
    
    await page.screenshot({ path: 'debug-02-after-project-creation.png' })
    console.log('   ✅ Project created, checking dashboard state')
    
    // Step 3: Analyze what's available after project creation
    const postCreationButtons = await page.locator('button').allTextContents()
    console.log('   Available buttons after project creation:', postCreationButtons.slice(0, 15))
    
    // Look for any navigation elements
    const navigationElements = await page.locator('nav, .nav, [role="navigation"], .sidebar, .menu').count()
    console.log(`   Navigation elements found: ${navigationElements}`)
    
    // Look for any links
    const links = await page.locator('a').allTextContents()
    console.log('   Available links:', links.slice(0, 10))
    
    // Step 4: Try different approaches to start course creation
    console.log('📋 Step 4: Attempting course creation approaches')
    
    // Approach 1: Look for "Create Your First Project" button
    const createFirstButton = page.locator('button:has-text("Create Your First Project")')
    if (await createFirstButton.isVisible()) {
      console.log('   → Found "Create Your First Project" button')
      await createFirstButton.click()
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'debug-03-after-create-first-project.png' })
      
      // Check what happened
      const afterFirstCreate = await page.locator('button').allTextContents()
      console.log('   Available buttons after "Create Your First Project":', afterFirstCreate.slice(0, 10))
    }
    
    // Approach 2: Look for existing projects or course management
    const projectCards = await page.locator('.project-card, .course-card, [data-testid*="project"], [data-testid*="course"]').count()
    console.log(`   Project/course cards found: ${projectCards}`)
    
    // Approach 3: Check for workflow steps or tabs
    const tabs = await page.locator('[role="tab"], .tab, .step, .workflow-step').allTextContents()
    if (tabs.length > 0) {
      console.log('   Workflow tabs/steps found:', tabs)
    }
    
    // Step 5: Try to find course configuration
    console.log('📋 Step 5: Searching for course configuration interface')
    
    // Look for various course-related inputs
    const courseInputs = await page.locator('input[placeholder*="course"], input[placeholder*="Course"], input[name*="course"], input[name*="title"]').count()
    console.log(`   Course-related inputs found: ${courseInputs}`)
    
    if (courseInputs > 0) {
      console.log('   ✅ Found course inputs - taking screenshot')
      await page.screenshot({ path: 'debug-04-course-inputs-found.png' })
      
      // Try to interact with the first course input
      const firstCourseInput = page.locator('input[placeholder*="course"], input[placeholder*="Course"], input[name*="course"], input[name*="title"]').first()
      if (await firstCourseInput.isVisible()) {
        await firstCourseInput.fill('Debug Test Course')
        console.log('   ✅ Successfully filled course input')
      }
    }
    
    // Step 6: Look for "Next" or workflow progression buttons
    console.log('📋 Step 6: Looking for workflow progression')
    
    const nextButtons = await page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Proceed"), button:has-text("Start")').count()
    console.log(`   Workflow progression buttons found: ${nextButtons}`)
    
    if (nextButtons > 0) {
      const nextButtonTexts = await page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Proceed"), button:has-text("Start")').allTextContents()
      console.log('   Progression button texts:', nextButtonTexts)
      
      // Try clicking the first progression button
      const firstNextButton = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Proceed"), button:has-text("Start")').first()
      if (await firstNextButton.isVisible()) {
        await firstNextButton.click()
        await page.waitForTimeout(2000)
        await page.screenshot({ path: 'debug-05-after-next-click.png' })
        console.log('   ✅ Clicked first progression button')
      }
    }
    
    // Step 7: Final analysis
    console.log('📋 Step 7: Final workflow analysis')
    
    // Check current page title/heading
    const headings = await page.locator('h1, h2, h3, .title, .heading, [data-testid*="title"]').allTextContents()
    console.log('   Current page headings:', headings.slice(0, 5))
    
    // Check for any error messages
    const errors = await page.locator('.error, .alert, [role="alert"], .warning').allTextContents()
    if (errors.length > 0) {
      console.log('   ⚠️ Error messages found:', errors)
    }
    
    // Final screenshot
    await page.screenshot({ path: 'debug-06-final-state.png' })
    
    console.log('\n🎯 Workflow debugging completed')
    console.log('📸 Screenshots saved:')
    console.log('   - debug-01-initial-dashboard.png')
    console.log('   - debug-02-after-project-creation.png') 
    console.log('   - debug-03-after-create-first-project.png')
    console.log('   - debug-04-course-inputs-found.png (if inputs found)')
    console.log('   - debug-05-after-next-click.png (if next button found)')
    console.log('   - debug-06-final-state.png')
  })
})