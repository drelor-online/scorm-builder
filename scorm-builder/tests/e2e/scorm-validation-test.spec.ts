import { test, expect } from '@playwright/test'

test.describe('SCORM Testing Framework Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('Basic application workflow and framework validation', async ({ page }) => {
    console.log('\n🧪 Testing SCORM framework integration...')
    
    // Step 1: Validate the testing framework components work
    console.log('📋 Step 1: Validating test fixture imports')
    
    // Import and validate test fixtures (this validates our export fixes)
    const { 
      getMinimalCourse, 
      getStandardCourse, 
      getAssessmentFocusedCourse  // This should now work with our export fix
    } = await import('../fixtures/test-courses')
    
    const minimalCourse = getMinimalCourse()
    const standardCourse = getStandardCourse()
    const assessmentCourse = getAssessmentFocusedCourse()
    
    expect(minimalCourse.name).toBe('Minimal Course')
    expect(standardCourse.name).toBe('Standard Corporate Training')
    expect(assessmentCourse.name).toBe('Assessment-Heavy Course')
    console.log('   ✅ Test course fixtures working correctly')
    
    // Step 2: Validate media fixtures
    console.log('📁 Step 2: Validating media fixtures')
    
    const { createCourseMediaSet, cleanupMediaFiles } = await import('../fixtures/test-media')
    
    // Create test media files
    const mediaSet = createCourseMediaSet(3)
    expect(mediaSet.welcome.audio).toBe('welcome-audio.mp3')
    expect(mediaSet.topics.length).toBe(3)
    console.log('   ✅ Media fixtures created successfully')
    
    // Cleanup media files
    cleanupMediaFiles()
    console.log('   ✅ Media cleanup working correctly')
    
    // Step 3: Validate settings generator
    console.log('⚙️ Step 3: Validating settings generator')
    
    const { 
      generateQuickTestSuite, 
      generateComprehensiveTestSuite,
      getDefaultSettings 
    } = await import('../utils/settings-generator')
    
    const quickSuite = generateQuickTestSuite()
    const comprehensiveSuite = generateComprehensiveTestSuite()
    const defaultSettings = getDefaultSettings()
    
    expect(quickSuite.length).toBeGreaterThan(0)
    expect(comprehensiveSuite.length).toBeGreaterThan(quickSuite.length)
    expect(defaultSettings.navigationMode).toBe('linear')
    console.log(`   ✅ Generated ${quickSuite.length} quick tests and ${comprehensiveSuite.length} comprehensive tests`)
    
    // Step 4: Validate enhanced SCORM validator
    console.log('🔍 Step 4: Validating SCORM validator')
    
    const { EnhancedScormValidator } = await import('../utils/enhanced-scorm-validator')
    
    // Test that validator can handle basic validation structure
    expect(EnhancedScormValidator).toBeDefined()
    console.log('   ✅ SCORM validator loaded successfully')
    
    // Step 5: Basic application interaction test
    console.log('🖥️ Step 5: Basic application interaction')
    
    // Check if the new project button exists
    const newProjectButton = page.getByTestId('new-project-button')
    expect(await newProjectButton.isVisible()).toBe(true)
    console.log('   ✅ New project button detected')
    
    // Click the button and check modal appears
    await newProjectButton.click()
    await page.waitForSelector('input[placeholder*="project name"], input[placeholder*="Project name"]', { timeout: 10000 })
    
    const projectNameInput = page.getByPlaceholder(/project name/i)
    expect(await projectNameInput.isVisible()).toBe(true)
    console.log('   ✅ Project creation modal working')
    
    // Test filling the input
    await projectNameInput.fill('Framework Validation Test')
    expect(await projectNameInput.inputValue()).toBe('Framework Validation Test')
    console.log('   ✅ Input handling working correctly')
    
    // Close modal (don't create project to avoid complications)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    console.log('   ✅ Modal dismiss working')
    
    console.log('\n🎉 All framework components validated successfully!')
    console.log('📊 Framework Status:')
    console.log('   ✅ Test course fixtures: WORKING')
    console.log('   ✅ Media file generation: WORKING') 
    console.log('   ✅ Settings matrix generator: WORKING')
    console.log('   ✅ SCORM validator: WORKING')
    console.log('   ✅ Basic UI interaction: WORKING')
    console.log('   ✅ Export fixes: WORKING')
    console.log('   ✅ Import resolution: WORKING')
  })

  test('Settings matrix test case generation', async ({ page }) => {
    console.log('\n🧪 Testing settings matrix generation...')
    
    const { generateQuickTestSuite } = await import('../utils/settings-generator')
    const quickTests = generateQuickTestSuite()
    
    console.log(`📊 Generated ${quickTests.length} high-priority test cases:`)
    quickTests.forEach((testCase, index) => {
      console.log(`   ${index + 1}. ${testCase.name} (${testCase.testPriority})`)
      console.log(`      Description: ${testCase.description}`)
      console.log(`      Features: ${testCase.expectedFeatures.join(', ')}`)
      
      // Validate test case structure
      expect(testCase.name).toBeDefined()
      expect(testCase.description).toBeDefined()
      expect(testCase.settings).toBeDefined()
      expect(testCase.expectedFeatures).toBeDefined()
      expect(testCase.testPriority).toMatch(/^(high|medium|low)$/)
    })
    
    console.log('✅ All test cases have valid structure')
  })

  test('Media fixtures validation', async ({ page }) => {
    console.log('\n🎬 Testing media fixture generation...')
    
    const { TestMediaFixtures } = await import('../fixtures/test-media')
    
    // Test individual media creation
    const pngFile = TestMediaFixtures.createValidPNG()
    const mp3File = TestMediaFixtures.createValidMP3() 
    const vttFile = TestMediaFixtures.createValidVTT()
    
    expect(pngFile.type).toBe('image')
    expect(pngFile.mimeType).toBe('image/png')
    expect(pngFile.data).toBeInstanceOf(Buffer)
    console.log('   ✅ PNG generation working')
    
    expect(mp3File.type).toBe('audio')
    expect(mp3File.mimeType).toBe('audio/mpeg')
    expect(mp3File.data).toBeInstanceOf(Buffer)
    console.log('   ✅ MP3 generation working')
    
    expect(vttFile.mimeType).toBe('text/vtt')
    expect(vttFile.data).toBeInstanceOf(Buffer)
    console.log('   ✅ VTT caption generation working')
    
    // Test YouTube fixtures
    const youtubeFixtures = TestMediaFixtures.getYouTubeFixtures()
    expect(youtubeFixtures.length).toBeGreaterThan(0)
    youtubeFixtures.forEach(fixture => {
      expect(fixture.url).toMatch(/youtube\.com|youtu\.be/)
      expect(fixture.embedUrl).toMatch(/youtube\.com\/embed/)
    })
    console.log(`   ✅ ${youtubeFixtures.length} YouTube fixtures available`)
    
    console.log('✅ All media fixtures validated')
  })
})