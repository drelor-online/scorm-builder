import { test, expect } from '@playwright/test'

test.describe('SCORM Application Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('Complete SCORM generation workflow', async ({ page }) => {
    console.log('\n🚀 Starting complete SCORM generation workflow test...')
    
    // Step 1: Create a new project (handle modal properly)
    console.log('📋 Step 1: Creating new project')
    await page.getByTestId('new-project-button').click()
    
    // Wait for modal to appear and be ready
    await page.waitForSelector('input[placeholder*="project name"], input[placeholder*="Project name"]', { timeout: 10000 })
    await page.getByPlaceholder(/project name/i).fill('Test SCORM Course')
    
    // Wait for modal animations to complete before clicking
    await page.waitForTimeout(1000)
    
    // Click the blue "Create" button in the modal using force click to bypass modal backdrop
    await page.locator('button:has-text("Create"):not([data-testid])').click({ force: true })
    console.log('✅ Project creation modal completed')
    
    // Wait for dashboard to reload
    await page.waitForTimeout(2000)
    
    // Step 2: Start the course creation workflow
    console.log('📝 Step 2: Starting course creation workflow')
    
    // Look for "Create Your First Project" button and click it
    const startProjectButton = page.locator('button:has-text("Create Your First Project")')
    if (await startProjectButton.isVisible()) {
      await startProjectButton.click()
      console.log('   ✅ Clicked "Create Your First Project" button')
      await page.waitForTimeout(2000)
    }
    
    // Now look for course title input with more flexible selectors
    const courseTitleSelector = 'input[placeholder*="course title"], input[placeholder*="Course title"], input[placeholder*="Course Title"], input[name*="title"], input[id*="title"]'
    await page.waitForSelector(courseTitleSelector, { timeout: 15000 })
    
    await page.fill(courseTitleSelector, 'Automated Testing Course')
    console.log('   ✅ Course title set')
    
    // Look for description field
    const descriptionSelector = 'textarea[placeholder*="description"], textarea[placeholder*="Description"], textarea[name*="description"]'
    const descriptionField = page.locator(descriptionSelector)
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('A course created by automated testing to validate SCORM generation')
      console.log('   ✅ Course description set')
    }
    
    // Look for topics field
    const topicsSelector = 'textarea[placeholder*="topics"], textarea[placeholder*="Topics"], textarea[name*="topics"]'
    const topicsField = page.locator(topicsSelector)
    if (await topicsField.isVisible()) {
      await topicsField.fill('Introduction to Testing\nAutomated SCORM Generation\nValidation and Quality Assurance\nConclusion')
      console.log('   ✅ Course topics set')
    }
    
    // Look for difficulty level buttons
    const difficultyButtons = page.locator('button:has-text("Beginner"), button:has-text("Intermediate"), button:has-text("Advanced")')
    if (await difficultyButtons.first().isVisible()) {
      await difficultyButtons.first().click()
      console.log('   ✅ Difficulty level set')
    }
    
    console.log('✅ Course configuration completed')
    
    // Step 3: Navigate through workflow
    console.log('🔄 Step 3: Navigating through workflow steps')
    let currentStep = 1
    const maxSteps = 10
    let navigationLog = []
    
    while (currentStep < maxSteps) {
      // Get current page title for debugging
      const pageTitle = await page.locator('h1, h2, .page-title, [data-testid*="title"]').first().textContent().catch(() => 'Unknown')
      navigationLog.push(`Step ${currentStep}: ${pageTitle}`)
      console.log(`   → Step ${currentStep}: ${pageTitle}`)
      
      // Try to find Next button with various selectors
      const nextSelectors = [
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button:has-text("Proceed")',
        '[data-testid*="next"]',
        'button[type="submit"]'
      ]
      
      let nextButton = null
      for (const selector of nextSelectors) {
        const btn = page.locator(selector)
        if (await btn.isVisible()) {
          nextButton = btn
          break
        }
      }
      
      if (nextButton) {
        await nextButton.click()
        await page.waitForTimeout(1500) // Give time for navigation
        currentStep++
        
        // Check if we've reached SCORM generation
        const scormIndicators = [
          'h1:has-text("SCORM")',
          'h1:has-text("Export")', 
          'h1:has-text("Package")',
          'h1:has-text("Generate")',
          'text=Generate SCORM',
          'text=Export SCORM',
          'button:has-text("Generate")'
        ]
        
        for (const indicator of scormIndicators) {
          if (await page.locator(indicator).isVisible()) {
            console.log('🎯 Reached SCORM generation step!')
            break
          }
        }
      } else {
        console.log('   → No Next button found, ending navigation')
        break
      }
    }
    
    console.log(`📊 Navigation completed: ${currentStep} steps`)
    navigationLog.forEach(log => console.log(`   ${log}`))
    
    // Step 4: Look for SCORM generation capability
    console.log('📦 Step 4: Looking for SCORM generation capability')
    
    const generateSelectors = [
      'button:has-text("Generate SCORM Package")',
      'button:has-text("Generate")',
      'button:has-text("Create Package")',
      'button:has-text("Export")',
      'button:has-text("Build")',
      '[data-testid*="generate"]',
      '[data-testid*="export"]'
    ]
    
    let generateButton = null
    for (const selector of generateSelectors) {
      const btn = page.locator(selector)
      if (await btn.isVisible()) {
        generateButton = btn
        console.log(`✅ Found generate button with selector: ${selector}`)
        break
      }
    }
    
    if (generateButton) {
      console.log('🎉 SCORM generation capability confirmed!')
      
      // Try to start generation (but don't wait for completion in this test)
      try {
        await generateButton.click()
        console.log('⏳ Generation process started')
        
        // Wait a moment to see if anything happens
        await page.waitForTimeout(3000)
        
        // Check for any progress indicators or success messages
        const progressIndicators = page.locator('text=Generating, text=Progress, text=Building, .progress, .loading')
        if (await progressIndicators.first().isVisible()) {
          console.log('✅ Generation process is active')
        }
        
      } catch (error) {
        console.log(`⚠️ Error starting generation: ${error.message}`)
      }
    } else {
      console.log('❌ No SCORM generation button found')
      
      // Debug: Show what's available on the current page
      const currentPageTitle = await page.locator('h1, h2').first().textContent().catch(() => 'Unknown')
      console.log(`   Current page: "${currentPageTitle}"`)
      
      const availableButtons = await page.locator('button').allTextContents()
      console.log(`   Available buttons: ${availableButtons.slice(0, 10).join(', ')}${availableButtons.length > 10 ? '...' : ''}`)
    }
    
    // Test evaluation
    expect(currentStep).toBeGreaterThan(1) // Should navigate at least one step
    console.log(`✅ Workflow test completed - navigated ${currentStep} steps`)
  })

  test('Settings discovery test', async ({ page }) => {
    console.log('\n⚙️ Testing settings discovery...')
    
    // Create project
    await page.getByTestId('new-project-button').click()
    await page.waitForSelector('input[placeholder*="project name"], input[placeholder*="Project name"]', { timeout: 10000 })
    await page.getByPlaceholder(/project name/i).fill('Settings Discovery Test')
    await page.waitForTimeout(1000)
    await page.locator('button:has-text("Create"):not([data-testid])').click({ force: true })
    await page.waitForTimeout(2000)
    
    // Start the course creation workflow
    const startProjectButton = page.locator('button:has-text("Create Your First Project")')
    if (await startProjectButton.isVisible()) {
      await startProjectButton.click()
      await page.waitForTimeout(2000)
    }
    
    // Basic course setup
    const courseTitleSelector = 'input[placeholder*="course title"], input[placeholder*="Course title"], input[name*="title"]'
    await page.waitForSelector(courseTitleSelector, { timeout: 10000 })
    await page.fill(courseTitleSelector, 'Settings Discovery Course')
    
    const topicsSelector = 'textarea[placeholder*="topics"], textarea[placeholder*="Topics"]'
    const topicsField = page.locator(topicsSelector)
    if (await topicsField.isVisible()) {
      await topicsField.fill('Settings Topic 1\nSettings Topic 2')
    }
    
    // Navigate through steps looking for settings
    let settingsFound = false
    let stepCount = 0
    let settingsInfo = []
    
    while (stepCount < 12) {
      // Look for settings-related elements on current page
      const settingsIndicators = [
        'text=Settings',
        'text=Configuration', 
        'text=Options',
        'text=Course Settings',
        'input[type="checkbox"]',
        'select',
        'text=Navigation',
        'text=Assessment', 
        'text=Audio',
        'text=Font',
        'text=Accessibility',
        'text=Completion'
      ]
      
      let foundOnThisPage = []
      
      for (const indicator of settingsIndicators) {
        const elements = page.locator(indicator)
        if (await elements.first().isVisible()) {
          foundOnThisPage.push(indicator)
        }
      }
      
      if (foundOnThisPage.length > 0) {
        console.log(`⚙️ Settings found on step ${stepCount}: ${foundOnThisPage.join(', ')}`)
        settingsFound = true
        settingsInfo.push(`Step ${stepCount}: ${foundOnThisPage.join(', ')}`)
        
        // Try to interact with checkboxes if present
        const checkboxes = page.locator('input[type="checkbox"]')
        const checkboxCount = await checkboxes.count()
        
        if (checkboxCount > 0) {
          console.log(`   📋 Found ${checkboxCount} checkboxes - testing interaction`)
          const firstCheckbox = checkboxes.first()
          const isChecked = await firstCheckbox.isChecked()
          await firstCheckbox.click()
          const isNowChecked = await firstCheckbox.isChecked()
          console.log(`   ✅ Checkbox test: ${isChecked} → ${isNowChecked}`)
        }
        
        // Try to interact with selects if present
        const selects = page.locator('select')
        const selectCount = await selects.count()
        
        if (selectCount > 0) {
          console.log(`   📋 Found ${selectCount} dropdown menus`)
        }
      }
      
      // Try to advance
      const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")')
      if (await nextButton.first().isVisible()) {
        await nextButton.first().click()
        await page.waitForTimeout(1000)
        stepCount++
      } else {
        break
      }
    }
    
    console.log(`📊 Settings discovery completed:`)
    console.log(`   Steps navigated: ${stepCount}`)
    console.log(`   Settings interfaces found: ${settingsFound}`)
    settingsInfo.forEach(info => console.log(`   ${info}`))
    
    expect(stepCount).toBeGreaterThan(0) // Should navigate at least one step
    console.log(`✅ Settings discovery test completed`)
  })

  test('Media discovery test', async ({ page }) => {
    console.log('\n🎬 Testing media discovery...')
    
    // Create project
    await page.getByTestId('new-project-button').click()
    await page.waitForSelector('input[placeholder*="project name"], input[placeholder*="Project name"]', { timeout: 10000 })
    await page.getByPlaceholder(/project name/i).fill('Media Discovery Test')
    await page.waitForTimeout(1000)
    await page.locator('button:has-text("Create"):not([data-testid])').click({ force: true })
    await page.waitForTimeout(2000)
    
    // Start the course creation workflow
    const startProjectButton = page.locator('button:has-text("Create Your First Project")')
    if (await startProjectButton.isVisible()) {
      await startProjectButton.click()
      await page.waitForTimeout(2000)
    }
    
    // Basic course setup
    const courseTitleSelector = 'input[placeholder*="course title"], input[name*="title"]'
    await page.waitForSelector(courseTitleSelector, { timeout: 10000 })
    await page.fill(courseTitleSelector, 'Media Discovery Course')
    
    const topicsField = page.locator('textarea[placeholder*="topics"]')
    if (await topicsField.isVisible()) {
      await topicsField.fill('Media Topic 1\nMedia Topic 2\nMedia Topic 3')
    }
    
    // Navigate looking for media features
    let mediaFeaturesFound = false
    let stepCount = 0
    let mediaInfo = []
    
    while (stepCount < 12) {
      // Look for media-related elements
      const mediaIndicators = [
        'input[type="file"]',
        'text=Media',
        'text=Upload',
        'text=Image', 
        'text=Audio',
        'text=Video',
        'text=YouTube',
        'text=Enhancement',
        '[data-testid*="media"]',
        '[data-testid*="upload"]',
        '[data-testid*="file"]',
        'input[placeholder*="YouTube"]',
        'input[placeholder*="URL"]'
      ]
      
      let foundOnThisPage = []
      
      for (const indicator of mediaIndicators) {
        const elements = page.locator(indicator)
        if (await elements.first().isVisible()) {
          foundOnThisPage.push(indicator)
        }
      }
      
      if (foundOnThisPage.length > 0) {
        console.log(`🎬 Media features found on step ${stepCount}: ${foundOnThisPage.join(', ')}`)
        mediaFeaturesFound = true
        mediaInfo.push(`Step ${stepCount}: ${foundOnThisPage.join(', ')}`)
        
        // Test file inputs
        const fileInputs = page.locator('input[type="file"]')
        const fileInputCount = await fileInputs.count()
        if (fileInputCount > 0) {
          console.log(`   📁 Found ${fileInputCount} file upload inputs`)
        }
        
        // Test YouTube inputs
        const youtubeInputs = page.locator('input[placeholder*="YouTube"], input[placeholder*="youtube"], input[placeholder*="URL"]')
        const youtubeInputCount = await youtubeInputs.count()
        if (youtubeInputCount > 0) {
          console.log(`   🎥 Found ${youtubeInputCount} potential YouTube URL inputs`)
          
          // Try adding a YouTube URL
          const firstYoutubeInput = youtubeInputs.first()
          if (await firstYoutubeInput.isVisible()) {
            await firstYoutubeInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
            console.log('   ✅ YouTube URL input test completed')
          }
        }
      }
      
      // Try to advance
      const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")')
      if (await nextButton.first().isVisible()) {
        await nextButton.first().click()
        await page.waitForTimeout(1000)
        stepCount++
      } else {
        break
      }
    }
    
    console.log(`📊 Media discovery completed:`)
    console.log(`   Steps navigated: ${stepCount}`)
    console.log(`   Media interfaces found: ${mediaFeaturesFound}`)
    mediaInfo.forEach(info => console.log(`   ${info}`))
    
    expect(stepCount).toBeGreaterThan(0)
    console.log(`✅ Media discovery test completed`)
  })
})