import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test.describe('Tauri SCORM Generation Test', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('Generate SCORM package using Tauri backend', async ({ page }) => {
    console.log('\n🚀 Testing SCORM generation with Tauri backend...')
    
    console.log('📋 Step 1: Create basic project')
    
    // Create project
    await page.getByTestId('new-project-button').click()
    await page.waitForSelector('input[placeholder*="project name"]', { timeout: 10000 })
    await page.getByPlaceholder(/project name/i).fill('Tauri SCORM Test')
    await page.waitForTimeout(1000)
    await page.locator('button:has-text("Create"):not([data-testid])').click({ force: true })
    await page.waitForTimeout(3000)
    
    console.log('📋 Step 2: Find SCORM export functionality')
    
    // Look for Export SCORM functionality
    const scormSelectors = [
      'text=Export SCORM',
      'button:has-text("Export SCORM")',
      'button:has-text("Generate SCORM")',
      'button:has-text("Export")',
      '[data-testid*="export"]'
    ]
    
    let scormElement = null
    let foundSelector = null
    
    for (const selector of scormSelectors) {
      const element = page.locator(selector)
      if (await element.isVisible().catch(() => false)) {
        scormElement = element
        foundSelector = selector
        console.log(`   ✅ Found SCORM element: ${selector}`)
        break
      }
    }
    
    if (!scormElement) {
      throw new Error('Could not find SCORM export functionality')
    }
    
    console.log('📋 Step 3: Monitor file system for SCORM package creation')
    
    // Get potential output directories
    const possibleOutputDirs = [
      'C:\\Users\\sierr\\Desktop\\SCORM-Builder',
      'C:\\Users\\sierr\\Desktop\\SCORM-Builder\\scorm-builder',
      'C:\\Users\\sierr\\Documents',
      'C:\\Users\\sierr\\Downloads',
      process.cwd()
    ]
    
    // Get initial file list from all directories
    const initialFiles = new Map()
    for (const dir of possibleOutputDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.zip'))
          initialFiles.set(dir, files)
          console.log(`   📁 Initial files in ${dir}: ${files.length} ZIP files`)
        } catch (error) {
          console.log(`   ⚠️ Could not read directory ${dir}`)
        }
      }
    }
    
    // Click export and wait for processing
    console.log(`🚀 Clicking ${foundSelector} and monitoring file system...`)
    await scormElement.click()
    
    // Monitor for new ZIP files
    let foundPackage = null
    const maxWaitTime = 90000 // 90 seconds
    const checkInterval = 2000 // 2 seconds
    let elapsed = 0
    
    while (elapsed < maxWaitTime && !foundPackage) {
      await page.waitForTimeout(checkInterval)
      elapsed += checkInterval
      
      console.log(`   ⏳ Checking for new files... (${elapsed/1000}s elapsed)`)
      
      for (const dir of possibleOutputDirs) {
        if (fs.existsSync(dir)) {
          try {
            const currentFiles = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.zip'))
            const initialDirFiles = initialFiles.get(dir) || []
            
            // Look for new files
            const newFiles = currentFiles.filter(f => !initialDirFiles.includes(f))
            
            if (newFiles.length > 0) {
              for (const newFile of newFiles) {
                const filePath = path.join(dir, newFile)
                const stats = fs.statSync(filePath)
                
                // Check if file is likely a SCORM package (reasonable size and not empty)
                if (stats.size > 1000) {
                  console.log(`   🎉 Found new ZIP file: ${filePath} (${stats.size} bytes)`)
                  foundPackage = filePath
                  break
                }
              }
            }
          } catch (error) {
            // Directory access error, skip
          }
        }
        
        if (foundPackage) break
      }
    }
    
    if (!foundPackage) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'tauri-no-package-generated.png' })
      
      // Check if there's any UI feedback about generation
      const statusSelectors = [
        'text*=Generating',
        'text*=Creating',
        'text*=Processing',
        'text*=Export',
        'text*=Download',
        'text*=Complete',
        'text*=Success'
      ]
      
      for (const selector of statusSelectors) {
        if (await page.locator(selector).isVisible().catch(() => false)) {
          const text = await page.locator(selector).textContent()
          console.log(`   💬 UI Status: ${text}`)
        }
      }
      
      throw new Error('No SCORM package was generated within 90 seconds')
    }
    
    console.log('📋 Step 4: Validate the generated SCORM package')
    
    // Basic ZIP file validation
    const buffer = fs.readFileSync(foundPackage)
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B // ZIP signature
    
    if (!isZip) {
      throw new Error(`Generated file ${foundPackage} is not a valid ZIP file`)
    }
    
    // Size validation
    expect(buffer.length).toBeGreaterThan(1000) // Should be reasonably sized
    
    console.log('📋 Step 5: Basic SCORM content validation')
    
    // Extract and validate basic SCORM structure using JSZip
    const JSZip = require('jszip')
    const zip = new JSZip()
    const contents = await zip.loadAsync(buffer)
    
    // Check for required SCORM files
    const requiredFiles = [
      'imsmanifest.xml',
      'index.html'
    ]
    
    let hasRequiredFiles = true
    for (const requiredFile of requiredFiles) {
      if (!contents.files[requiredFile]) {
        console.log(`   ❌ Missing required file: ${requiredFile}`)
        hasRequiredFiles = false
      } else {
        console.log(`   ✅ Found required file: ${requiredFile}`)
      }
    }
    
    expect(hasRequiredFiles).toBe(true)
    
    // Validate manifest content
    const manifestContent = await contents.files['imsmanifest.xml'].async('string')
    expect(manifestContent).toContain('<?xml version="1.0"')
    expect(manifestContent).toContain('<manifest')
    expect(manifestContent).toContain('xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"')
    
    console.log('🎉 SCORM package validation successful!')
    console.log(`   📦 Package location: ${foundPackage}`)
    console.log(`   📊 Package size: ${buffer.length} bytes`)
    console.log(`   ✅ Contains required SCORM structure`)
    
    // Cleanup
    fs.unlinkSync(foundPackage)
    console.log('   🧹 Cleaned up test file')
  })
})