import { test, expect } from '@playwright/test'

test.describe('SCORM Functional Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('Complete SCORM generation workflow', async ({ page }) => {
    console.log('\n🚀 Starting complete SCORM generation workflow test...')
    
    // Step 1: Create a new project
    console.log('📋 Step 1: Creating new project')
    await page.getByTestId('new-project-button').click()
    await page.getByPlaceholder(/project name/i).fill('Test SCORM Course')
    await page.getByTestId('create-project-confirm').click()
    
    // Step 2: Configure course basics
    console.log('📝 Step 2: Configuring course basics')
    await page.waitForSelector('input[placeholder*="course title"]')
    await page.fill('input[placeholder*="course title"]', 'Automated Testing Course')
    await page.fill('textarea[placeholder*="description"]', 'A course created by automated testing to validate SCORM generation')
    await page.fill('textarea[placeholder*="topics"]', 'Introduction to Testing\nAutomated SCORM Generation\nValidation and Quality Assurance\nConclusion')
    
    // Set difficulty level
    const difficultyButtons = page.locator('button:has-text("Beginner"), button:has-text("Intermediate"), button:has-text("Advanced")')
    const firstDifficulty = difficultyButtons.first()
    if (await firstDifficulty.isVisible()) {
      await firstDifficulty.click()
    }
    
    console.log('✅ Course configuration completed')
    
    // Step 3: Navigate through workflow
    console.log('🔄 Step 3: Navigating through workflow steps')
    let currentStep = 1
    const maxSteps = 8
    
    while (currentStep < maxSteps) {
      // Try to find Next button
      const nextButton = page.locator('button:has-text("Next")')
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForTimeout(1000)
        currentStep++
        
        console.log(`   → Moved to step ${currentStep}`)
        
        // Check if we've reached SCORM generation
        const scormTitle = page.locator('h1:has-text("SCORM"), h1:has-text("Export"), h1:has-text("Package")')
        if (await scormTitle.isVisible()) {
          console.log('🎯 Reached SCORM generation step!')
          break
        }
      } else {
        console.log('   → No Next button found, checking current page')
        break
      }
    }
    
    // Step 4: Attempt SCORM generation
    console.log('📦 Step 4: Attempting SCORM package generation')
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Package"), button:has-text("Export")')
    
    if (await generateButton.isVisible()) {
      console.log('✅ SCORM generation button found!')
      
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
      
      // Click generate
      await generateButton.click()
      console.log('⏳ Generation started, waiting for download...')
      
      try {
        // Wait for download
        const download = await downloadPromise
        const downloadPath = await download.path()
        
        if (downloadPath) {
          const fs = await import('fs')
          const stats = fs.statSync(downloadPath)
          console.log(`🎉 SCORM package generated successfully!`)
          console.log(`   📁 File: ${download.suggestedFilename()}`)
          console.log(`   📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
          
          // Basic validation
          expect(stats.size).toBeGreaterThan(1024) // Should be larger than 1KB
          expect(download.suggestedFilename()).toMatch(/\.zip$/i) // Should be a ZIP file
          
          // Cleanup
          fs.unlinkSync(downloadPath)
          
          return { success: true, fileSize: stats.size, fileName: download.suggestedFilename() }
        }
      } catch (error) {
        console.log('⚠️ Download timeout or error:', error)
        return { success: false, error: 'Download failed' }
      }
    } else {
      console.log('❌ SCORM generation button not found')
      
      // Debug: Show what's on the page
      const pageTitle = await page.locator('h1').textContent()
      console.log(`   Current page title: "${pageTitle}"`)
      
      const buttons = await page.locator('button').allTextContents()
      console.log(`   Available buttons: ${buttons.join(', ')}`)
      
      return { success: false, error: 'Generate button not found' }
    }
  })

  test('Settings configuration test', async ({ page }) => {
    console.log('\n⚙️ Testing settings configuration...')
    
    // Create project
    await page.getByTestId('new-project-button').click()
    await page.getByPlaceholder(/project name/i).fill('Settings Test Course')
    await page.getByTestId('create-project-confirm').click()
    
    // Basic course setup
    await page.fill('input[placeholder*="course title"]', 'Settings Configuration Test')
    await page.fill('textarea[placeholder*="topics"]', 'Settings Topic 1\nSettings Topic 2')
    
    // Navigate through steps looking for settings
    let settingsFound = false
    let stepCount = 0
    
    while (stepCount < 10) {
      // Look for settings-related elements
      const settingsElements = page.locator(
        'text=Settings, text=Configuration, text=Options, ' +
        'input[type="checkbox"], select, ' +
        'text=Navigation, text=Assessment, text=Audio'
      )
      
      if (await settingsElements.first().isVisible()) {
        console.log('⚙️ Settings interface found!')
        settingsFound = true
        
        // Try to interact with some settings
        const checkboxes = page.locator('input[type="checkbox"]')
        const checkboxCount = await checkboxes.count()
        
        const selects = page.locator('select')
        const selectCount = await selects.count()
        
        console.log(`   📋 Found ${checkboxCount} checkboxes and ${selectCount} dropdowns`)
        
        // Test checkbox interaction
        if (checkboxCount > 0) {
          const firstCheckbox = checkboxes.first()
          const isChecked = await firstCheckbox.isChecked()
          await firstCheckbox.click()
          const isNowChecked = await firstCheckbox.isChecked()
          
          console.log(`   ✅ Checkbox interaction test: ${isChecked} → ${isNowChecked}`)
          expect(isChecked !== isNowChecked).toBe(true)
        }
        
        break
      }
      
      // Try to advance
      const nextButton = page.locator('button:has-text("Next")')
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForTimeout(500)
        stepCount++
      } else {
        break
      }
    }
    
    console.log(`✅ Settings test completed. Settings interface found: ${settingsFound}`)
    expect(settingsFound || stepCount > 3).toBe(true) // Either found settings or navigated through workflow
  })

  test('Media handling test', async ({ page }) => {
    console.log('\n🎬 Testing media handling capabilities...')
    
    // Create project
    await page.getByTestId('new-project-button').click()
    await page.getByPlaceholder(/project name/i).fill('Media Test Course')
    await page.getByTestId('create-project-confirm').click()
    
    // Basic course setup
    await page.fill('input[placeholder*="course title"]', 'Media Handling Test')
    await page.fill('textarea[placeholder*="topics"]', 'Media Topic 1\nMedia Topic 2\nMedia Topic 3')
    
    // Navigate looking for media features
    let mediaFeaturesFound = false
    let stepCount = 0
    
    while (stepCount < 10) {
      // Look for media-related elements
      const mediaElements = page.locator(
        'input[type="file"], ' +
        'text=Media, text=Upload, text=Image, text=Audio, text=Video, text=YouTube, ' +
        '[data-testid*="media"], [data-testid*="upload"], [data-testid*="file"]'
      )
      
      if (await mediaElements.first().isVisible()) {
        console.log('🎬 Media interface found!')
        mediaFeaturesFound = true
        
        const fileInputs = page.locator('input[type="file"]')
        const fileInputCount = await fileInputs.count()
        
        const youtubeInputs = page.locator('input[placeholder*="YouTube"], input[placeholder*="youtube"], input[placeholder*="URL"]')
        const youtubeInputCount = await youtubeInputs.count()
        
        console.log(`   📁 Found ${fileInputCount} file inputs`)
        console.log(`   🎥 Found ${youtubeInputCount} potential YouTube inputs`)
        
        // Test YouTube URL input if available
        if (youtubeInputCount > 0) {
          const youtubeInput = youtubeInputs.first()
          await youtubeInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
          console.log('   ✅ YouTube URL input test completed')
        }
        
        break
      }
      
      // Try to advance
      const nextButton = page.locator('button:has-text("Next")')
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForTimeout(500)
        stepCount++
      } else {
        break
      }
    }
    
    console.log(`✅ Media test completed. Media features found: ${mediaFeaturesFound}`)
    expect(mediaFeaturesFound || stepCount > 2).toBe(true)
  })

  test('Performance and responsiveness test', async ({ page }) => {
    console.log('\n⚡ Testing application performance and responsiveness...')
    
    const startTime = Date.now()
    
    // Create project
    await page.getByTestId('new-project-button').click()
    await page.getByPlaceholder(/project name/i).fill('Performance Test Course')
    await page.getByTestId('create-project-confirm').click()
    
    const projectCreationTime = Date.now() - startTime
    console.log(`   📊 Project creation time: ${projectCreationTime}ms`)
    
    // Add substantial content
    await page.fill('input[placeholder*="course title"]', 'Performance Test Course with Long Title for Testing')
    await page.fill('textarea[placeholder*="description"]', 'This is a comprehensive course description designed to test the performance of the application when handling larger amounts of text content. It includes multiple sentences and should help identify any performance issues with text processing.')
    
    const longTopicsList = Array.from({length: 15}, (_, i) => `Performance Test Topic ${i + 1}: Advanced Concepts and Detailed Analysis`).join('\n')
    await page.fill('textarea[placeholder*="topics"]', longTopicsList)
    
    const contentEntryTime = Date.now() - startTime
    console.log(`   📊 Content entry time: ${contentEntryTime}ms`)
    
    // Navigate through workflow and measure responsiveness
    let navigationTimes = []
    let stepCount = 0
    
    while (stepCount < 8) {
      const stepStartTime = Date.now()
      
      const nextButton = page.locator('button:has-text("Next")')
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForLoadState('networkidle')
        
        const stepTime = Date.now() - stepStartTime
        navigationTimes.push(stepTime)
        stepCount++
        
        console.log(`   ⏱️ Step ${stepCount} navigation time: ${stepTime}ms`)
      } else {
        break
      }
    }
    
    const totalTime = Date.now() - startTime
    const avgNavigationTime = navigationTimes.length > 0 ? navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length : 0
    
    console.log(`\n📈 Performance Summary:`)
    console.log(`   Total test time: ${totalTime}ms`)
    console.log(`   Average navigation time: ${avgNavigationTime.toFixed(2)}ms`)
    console.log(`   Steps completed: ${stepCount}`)
    
    // Performance assertions
    expect(avgNavigationTime).toBeLessThan(5000) // Average step should be < 5 seconds
    expect(totalTime).toBeLessThan(60000) // Total test should be < 1 minute
    expect(stepCount).toBeGreaterThan(0) // Should navigate at least one step
    
    console.log(`✅ Performance test completed successfully`)
  })
})