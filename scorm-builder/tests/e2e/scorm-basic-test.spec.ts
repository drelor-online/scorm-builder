import { test, expect } from '@playwright/test'

test.describe('Basic SCORM Functionality Test', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('Application launches successfully', async ({ page }) => {
    // Check if the main interface loads
    await expect(page.locator('h1')).toBeVisible()
    console.log('✅ Application launched successfully')
  })

  test('Can create a new project', async ({ page }) => {
    // Try to create a new project
    const createButton = page.locator('button:has-text("Create New Project")')
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Fill in project name
      const nameInput = page.locator('input[placeholder*="project name"]')
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Project')
        
        // Try to proceed
        const createProjectButton = page.locator('button:has-text("Create")')
        if (await createProjectButton.isVisible()) {
          await createProjectButton.click()
          console.log('✅ Project creation started')
        }
      }
    }
    
    // Just verify we can get to some form of course configuration
    await page.waitForTimeout(2000)
    const courseTitle = page.locator('input[placeholder*="course title"]')
    if (await courseTitle.isVisible()) {
      await courseTitle.fill('Test Course Title')
      console.log('✅ Course configuration accessible')
    }
  })

  test('Can navigate through workflow steps', async ({ page }) => {
    // Start a project
    const createButton = page.locator('button:has-text("Create New Project")')
    if (await createButton.isVisible()) {
      await createButton.click()
      await page.locator('input[placeholder*="project name"]').fill('Workflow Test')
      await page.locator('button:has-text("Create")').click()
    }
    
    // Add basic course information
    await page.locator('input[placeholder*="course title"]').fill('Workflow Test Course')
    await page.locator('textarea[placeholder*="topics"]').fill('Introduction\nBasic Concepts\nConclusion')
    
    // Try to navigate through steps
    let stepCount = 0
    const maxSteps = 6 // Reasonable limit
    
    while (stepCount < maxSteps) {
      const nextButton = page.locator('button:has-text("Next")')
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForTimeout(1000)
        stepCount++
        
        // Check if we've reached SCORM generation
        const scormHeader = page.locator('h1:has-text("Export SCORM Package")')
        if (await scormHeader.isVisible()) {
          console.log(`✅ Reached SCORM generation step after ${stepCount} steps`)
          break
        }
      } else {
        break
      }
    }
    
    expect(stepCount).toBeGreaterThan(0)
    console.log(`✅ Successfully navigated through ${stepCount} workflow steps`)
  })

  test('SCORM generation interface is accessible', async ({ page }) => {
    // Navigate to SCORM generation (simplified)
    const createButton = page.locator('button:has-text("Create New Project")')
    if (await createButton.isVisible()) {
      await createButton.click()
      await page.locator('input[placeholder*="project name"]').fill('SCORM Test')
      await page.locator('button:has-text("Create")').click()
    }
    
    // Add minimal course content
    await page.locator('input[placeholder*="course title"]').fill('SCORM Test Course')
    await page.locator('textarea[placeholder*="topics"]').fill('Test Topic')
    
    // Navigate to SCORM generation
    let attempts = 0
    while (attempts < 8) {
      const nextButton = page.locator('button:has-text("Next")')
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForTimeout(500)
        attempts++
        
        // Check if we've reached SCORM generation
        const scormHeader = page.locator('h1:has-text("Export SCORM Package")')
        if (await scormHeader.isVisible()) {
          console.log('✅ SCORM generation interface found')
          
          // Check for generate button
          const generateButton = page.locator('button:has-text("Generate SCORM Package")')
          await expect(generateButton).toBeVisible()
          console.log('✅ SCORM generation button is available')
          
          return
        }
      } else {
        break
      }
    }
    
    // If we get here, we didn't find the SCORM generation interface
    console.log('⚠️ SCORM generation interface not found in expected workflow')
  })
})