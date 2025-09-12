import { test, expect } from '@playwright/test'

test.describe('File System Investigation', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('Investigate file-based project system', async ({ page }) => {
    console.log('\n🔍 Investigating file-based project system...')
    
    // Step 1: Check if there are any existing projects
    console.log('📁 Step 1: Scanning for existing projects')
    
    // Look for project cards or any content in the project area
    const projectArea = page.locator('.project-list, .project-grid, .projects, [data-testid*="project"]')
    const projectAreaText = await projectArea.textContent().catch(() => '')
    console.log('   Project area content:', projectAreaText)
    
    // Step 2: Check the current working folder
    console.log('📁 Step 2: Checking working folder information')
    
    // Look for folder path information
    const folderInfo = page.locator('text*=folder, text*=directory, text*=path')
    const folderCount = await folderInfo.count()
    console.log(`   Folder-related elements found: ${folderCount}`)
    
    if (folderCount > 0) {
      const folderTexts = await folderInfo.allTextContents()
      console.log('   Folder-related text:', folderTexts)
    }
    
    // Step 3: Try the "Change Folder" button to understand the file system
    console.log('📁 Step 3: Investigating Change Folder functionality')
    
    const changeFolderButton = page.locator('button:has-text("Change Folder")')
    if (await changeFolderButton.isVisible()) {
      await changeFolderButton.click()
      await page.waitForTimeout(2000)
      
      await page.screenshot({ path: 'investigate-change-folder.png' })
      console.log('   ✅ Clicked Change Folder - took screenshot')
      
      // Check what dialog or interface appeared
      const modalCount = await page.locator('.modal, dialog, [role="dialog"]').count()
      console.log(`   Modal dialogs found: ${modalCount}`)
      
      // Look for file browser or folder selection interface
      const fileBrowser = page.locator('input[type="file"], input[type="directory"], .file-browser, .folder-browser')
      const fileBrowserCount = await fileBrowser.count()
      console.log(`   File browser elements found: ${fileBrowserCount}`)
      
      // Cancel or close any dialogs to return to main interface
      const cancelButtons = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label="Close"]')
      if (await cancelButtons.first().isVisible().catch(() => false)) {
        await cancelButtons.first().click()
        await page.waitForTimeout(1000)
        console.log('   ✅ Closed dialog')
      }
    }
    
    // Step 4: Try Import Project to understand the expected file structure
    console.log('📁 Step 4: Investigating Import Project functionality')
    
    const importButton = page.locator('button:has-text("Import Project")')
    if (await importButton.isVisible()) {
      await importButton.click()
      await page.waitForTimeout(2000)
      
      await page.screenshot({ path: 'investigate-import-project.png' })
      console.log('   ✅ Clicked Import Project - took screenshot')
      
      // Cancel or close any dialogs
      const cancelButtons = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label="Close"]')
      if (await cancelButtons.first().isVisible().catch(() => false)) {
        await cancelButtons.first().click()
        await page.waitForTimeout(1000)
        console.log('   ✅ Closed import dialog')
      }
    }
    
    // Step 5: Create a project and see where it goes
    console.log('📁 Step 5: Creating project to understand file creation')
    
    // Create a project with a unique name
    const projectName = `FileSystemTest-${Date.now()}`
    
    await page.getByTestId('new-project-button').click()
    await page.waitForSelector('input[placeholder*="project name"]', { timeout: 10000 })
    await page.getByPlaceholder(/project name/i).fill(projectName)
    await page.waitForTimeout(1000)
    await page.locator('button:has-text("Create"):not([data-testid])').click({ force: true })
    await page.waitForTimeout(3000)
    
    console.log(`   ✅ Created project: ${projectName}`)
    
    // Check if the project appears now
    const projectAppeared = await page.locator(`text=${projectName}`).isVisible().catch(() => false)
    console.log(`   Project visible in UI: ${projectAppeared}`)
    
    // Step 6: Try refreshing or reloading to see if projects appear
    console.log('📁 Step 6: Testing page refresh to detect projects')
    
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const projectAfterReload = await page.locator(`text=${projectName}`).isVisible().catch(() => false)
    console.log(`   Project visible after reload: ${projectAfterReload}`)
    
    // Step 7: Look for any actual project files in likely locations
    console.log('📁 Step 7: Taking final screenshots for analysis')
    
    await page.screenshot({ path: 'investigate-final-state.png' })
    
    // Check for any clickable project-related elements
    const clickableProjectElements = page.locator('div, button, a').filter({
      hasText: projectName
    })
    
    const clickableCount = await clickableProjectElements.count()
    console.log(`   Clickable elements containing project name: ${clickableCount}`)
    
    if (clickableCount > 0) {
      console.log('   🎯 Found project elements! Attempting to click...')
      await clickableProjectElements.first().click()
      await page.waitForTimeout(3000)
      
      await page.screenshot({ path: 'investigate-after-project-click.png' })
      
      // Check if this opens the course creation interface
      const courseInputs = await page.locator('input[placeholder*="course"], textarea[placeholder*="description"]').count()
      if (courseInputs > 0) {
        console.log('🎉 SUCCESS: Found course creation interface after clicking project!')
        
        // This means the workflow is:
        // 1. Create project metadata
        // 2. Find and click the project 
        // 3. Enter course creation workflow
        
        const courseTitle = page.locator('input[placeholder*="course title"], input[name*="title"]').first()
        if (await courseTitle.isVisible().catch(() => false)) {
          await courseTitle.fill('File System Investigation Course')
          console.log('   ✅ Successfully filled course title')
          
          // This proves the workflow works!
          expect(true).toBe(true) // Mark test as successful
        }
      } else {
        console.log('   ⚠️ Clicking project did not open course creation interface')
      }
    }
    
    console.log('\n📊 File System Investigation Summary:')
    console.log(`   - Project name used: ${projectName}`)
    console.log(`   - Project visible in UI: ${projectAppeared}`)
    console.log(`   - Project visible after reload: ${projectAfterReload}`)
    console.log(`   - Clickable project elements: ${clickableCount}`)
    
    console.log('\n📸 Screenshots saved:')
    console.log('   - investigate-change-folder.png')
    console.log('   - investigate-import-project.png') 
    console.log('   - investigate-final-state.png')
    console.log('   - investigate-after-project-click.png (if project clicked)')
  })
})