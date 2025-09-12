import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import JSZip from 'jszip'
import { 
  getStandardCourse, 
  getMediaHeavyCourse, 
  getAssessmentFocusedCourse,
  TestCourseFixtures 
} from '../fixtures/test-courses'
import { 
  createCourseMediaSet, 
  getYouTubeFixtures, 
  cleanupMediaFiles, 
  TestMediaFixtures 
} from '../fixtures/test-media'
import { validateSCORMPackage, generateValidationReport } from '../../src/utils/scormPackageValidator'

interface ZipAnalysisResult {
  structure: {
    totalFiles: number
    directories: string[]
    requiredFiles: {
      manifest: boolean
      indexHtml: boolean
      scormApi: boolean
      mediaFolder: boolean
    }
    manifestAnalysis: ManifestAnalysis
    htmlAnalysis: HtmlAnalysis
  }
  media: {
    audioFiles: MediaFileInfo[]
    imageFiles: MediaFileInfo[]
    videoFiles: MediaFileInfo[]
    captionFiles: MediaFileInfo[]
    orphanedFiles: string[]
    totalMediaSize: number
  }
  content: {
    pageStructure: PageStructureInfo
    interactiveElements: InteractiveElementsInfo
    navigationImplementation: NavigationInfo
    assessmentImplementation: AssessmentInfo
  }
  compliance: {
    scormStandard: string
    lmsCompatibility: LmsCompatibilityInfo
    accessibilityFeatures: AccessibilityInfo
    securityChecks: SecurityCheckInfo
  }
}

interface ManifestAnalysis {
  version: string
  identifier: string
  organizations: number
  resources: number
  metadata: Record<string, any>
  schemaCompliance: boolean
  errors: string[]
}

interface HtmlAnalysis {
  structure: {
    doctype: string
    encoding: string
    htmlVersion: string
    hasHead: boolean
    hasBody: boolean
  }
  scripts: {
    external: string[]
    inline: number
    scormApiCalls: string[]
    navigationFunctions: string[]
  }
  styles: {
    external: string[]
    inline: number
    responsiveDesign: boolean
    accessibilityStyles: boolean
  }
  media: {
    images: number
    audio: number
    video: number
    iframes: number
  }
}

interface MediaFileInfo {
  filename: string
  size: number
  mimeType: string
  isReferenced: boolean
  optimized: boolean
}

interface PageStructureInfo {
  welcomePage: boolean
  objectivesPage: boolean
  topicPages: number
  assessmentPage: boolean
  navigationStructure: string
  progressTracking: boolean
}

interface InteractiveElementsInfo {
  knowledgeChecks: number
  assessmentQuestions: number
  mediaControls: number
  formElements: number
  clickableElements: number
}

interface NavigationInfo {
  mode: 'linear' | 'free' | 'mixed'
  previousButton: boolean
  nextButton: boolean
  menuNavigation: boolean
  breadcrumbs: boolean
  tableOfContents: boolean
}

interface AssessmentInfo {
  questionTypes: string[]
  scoringMechanism: string
  feedbackImplementation: boolean
  retakePolicy: string
  completionTracking: boolean
}

interface LmsCompatibilityInfo {
  scorm12: boolean
  scorm2004: boolean
  tinCanApi: boolean
  commonIssues: string[]
}

interface AccessibilityInfo {
  altTextPresent: boolean
  keyboardNavigation: boolean
  screenReaderSupport: boolean
  colorContrast: boolean
  fontScaling: boolean
}

interface SecurityCheckInfo {
  noScriptInjection: boolean
  safeExternalLinks: boolean
  inputValidation: boolean
  contentSecurityPolicy: boolean
}

class DeepZipValidator {
  
  static async analyzeZipStructure(zipBuffer: Uint8Array): Promise<ZipAnalysisResult> {
    const zip = await JSZip.loadAsync(zipBuffer)
    
    return {
      structure: await this.analyzeStructure(zip),
      media: await this.analyzeMedia(zip),
      content: await this.analyzeContent(zip),
      compliance: await this.analyzeCompliance(zip)
    }
  }

  private static async analyzeStructure(zip: JSZip): Promise<ZipAnalysisResult['structure']> {
    const files = Object.keys(zip.files)
    const directories = files.filter(f => zip.files[f].dir).map(f => f.replace(/\/$/, ''))
    
    const manifestFile = zip.file('imsmanifest.xml')
    const indexFile = zip.file('index.html')
    const scormApiFile = zip.file('scripts/scorm-api.js') || zip.file('scorm_api.js')
    
    return {
      totalFiles: files.length,
      directories,
      requiredFiles: {
        manifest: !!manifestFile,
        indexHtml: !!indexFile,
        scormApi: !!scormApiFile,
        mediaFolder: directories.includes('media')
      },
      manifestAnalysis: manifestFile ? await this.analyzeManifest(manifestFile) : {} as ManifestAnalysis,
      htmlAnalysis: indexFile ? await this.analyzeHtml(indexFile) : {} as HtmlAnalysis
    }
  }

  private static async analyzeManifest(manifestFile: JSZip.JSZipObject): Promise<ManifestAnalysis> {
    const content = await manifestFile.async('string')
    const errors: string[] = []
    
    // Parse XML content
    let metadata: Record<string, any> = {}
    let version = 'unknown'
    let identifier = 'unknown'
    
    try {
      // Extract key information using regex (simplified XML parsing)
      const versionMatch = content.match(/version="([^"]*)"/)
      if (versionMatch) version = versionMatch[1]
      
      const identifierMatch = content.match(/identifier="([^"]*)"/)
      if (identifierMatch) identifier = identifierMatch[1]
      
      // Count organizations and resources
      const orgCount = (content.match(/<organization/g) || []).length
      const resourceCount = (content.match(/<resource/g) || []).length
      
      return {
        version,
        identifier,
        organizations: orgCount,
        resources: resourceCount,
        metadata,
        schemaCompliance: content.includes('xmlns') && content.includes('xsi:schemaLocation'),
        errors
      }
    } catch (error) {
      errors.push(`Manifest parsing error: ${error}`)
      return {
        version: 'unknown',
        identifier: 'unknown',
        organizations: 0,
        resources: 0,
        metadata: {},
        schemaCompliance: false,
        errors
      }
    }
  }

  private static async analyzeHtml(indexFile: JSZip.JSZipObject): Promise<HtmlAnalysis> {
    const content = await indexFile.async('string')
    
    return {
      structure: {
        doctype: content.includes('<!DOCTYPE') ? 'HTML5' : 'Unknown',
        encoding: content.includes('utf-8') ? 'UTF-8' : 'Unknown',
        htmlVersion: content.includes('html5') ? 'HTML5' : 'HTML4',
        hasHead: content.includes('<head>'),
        hasBody: content.includes('<body>')
      },
      scripts: {
        external: (content.match(/<script[^>]+src="([^"]+)"/g) || [])
          .map(match => match.match(/src="([^"]+)"/)?.[1] || ''),
        inline: (content.match(/<script[^>]*>[\s\S]*?<\/script>/g) || []).length,
        scormApiCalls: this.extractScormApiCalls(content),
        navigationFunctions: this.extractNavigationFunctions(content)
      },
      styles: {
        external: (content.match(/<link[^>]+href="([^"]+\.css)"/g) || [])
          .map(match => match.match(/href="([^"]+)"/)?.[1] || ''),
        inline: (content.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).length,
        responsiveDesign: content.includes('@media') || content.includes('viewport'),
        accessibilityStyles: content.includes('screen-reader') || content.includes('high-contrast')
      },
      media: {
        images: (content.match(/<img[^>]+src="/g) || []).length,
        audio: (content.match(/<audio[^>]*>/g) || []).length,
        video: (content.match(/<video[^>]*>/g) || []).length,
        iframes: (content.match(/<iframe[^>]*>/g) || []).length
      }
    }
  }

  private static extractScormApiCalls(content: string): string[] {
    const scormCalls = [
      'LMSInitialize',
      'LMSCommit',
      'LMSFinish',
      'LMSGetValue',
      'LMSSetValue',
      'LMSGetLastError'
    ]
    
    return scormCalls.filter(call => content.includes(call))
  }

  private static extractNavigationFunctions(content: string): string[] {
    const navFunctions = [
      'nextPage',
      'previousPage',
      'goToPage',
      'showMenu',
      'updateProgress'
    ]
    
    return navFunctions.filter(func => content.includes(func))
  }

  private static async analyzeMedia(zip: JSZip): Promise<ZipAnalysisResult['media']> {
    const mediaFiles = Object.keys(zip.files).filter(filename => 
      !zip.files[filename].dir && 
      filename.match(/\.(mp3|wav|ogg|jpg|jpeg|png|gif|svg|mp4|webm|vtt)$/i)
    )
    
    const audioFiles: MediaFileInfo[] = []
    const imageFiles: MediaFileInfo[] = []
    const videoFiles: MediaFileInfo[] = []
    const captionFiles: MediaFileInfo[] = []
    let totalSize = 0
    
    for (const filename of mediaFiles) {
      const file = zip.files[filename]
      const data = await file.async('uint8array')
      const size = data.length
      totalSize += size
      
      const mediaInfo: MediaFileInfo = {
        filename,
        size,
        mimeType: this.getMimeType(filename),
        isReferenced: await this.isFileReferenced(zip, filename),
        optimized: size < 5 * 1024 * 1024 // Simplified optimization check
      }
      
      if (filename.match(/\.(mp3|wav|ogg)$/i)) {
        audioFiles.push(mediaInfo)
      } else if (filename.match(/\.(jpg|jpeg|png|gif|svg)$/i)) {
        imageFiles.push(mediaInfo)
      } else if (filename.match(/\.(mp4|webm)$/i)) {
        videoFiles.push(mediaInfo)
      } else if (filename.match(/\.vtt$/i)) {
        captionFiles.push(mediaInfo)
      }
    }
    
    // Find orphaned files (files not referenced in HTML)
    const orphanedFiles = mediaFiles.filter(async filename => 
      !(await this.isFileReferenced(zip, filename))
    )
    
    return {
      audioFiles,
      imageFiles,
      videoFiles,
      captionFiles,
      orphanedFiles,
      totalMediaSize: totalSize
    }
  }

  private static getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'vtt': 'text/vtt'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  private static async isFileReferenced(zip: JSZip, filename: string): Promise<boolean> {
    const indexFile = zip.file('index.html')
    if (!indexFile) return false
    
    const content = await indexFile.async('string')
    const shortFilename = filename.split('/').pop() || filename
    
    return content.includes(filename) || content.includes(shortFilename)
  }

  private static async analyzeContent(zip: JSZip): Promise<ZipAnalysisResult['content']> {
    const indexFile = zip.file('index.html')
    if (!indexFile) {
      return {
        pageStructure: {} as PageStructureInfo,
        interactiveElements: {} as InteractiveElementsInfo,
        navigationImplementation: {} as NavigationInfo,
        assessmentImplementation: {} as AssessmentInfo
      }
    }
    
    const content = await indexFile.async('string')
    
    return {
      pageStructure: this.analyzePageStructure(content),
      interactiveElements: this.analyzeInteractiveElements(content),
      navigationImplementation: this.analyzeNavigation(content),
      assessmentImplementation: this.analyzeAssessment(content)
    }
  }

  private static analyzePageStructure(content: string): PageStructureInfo {
    return {
      welcomePage: content.includes('welcome') || content.includes('introduction'),
      objectivesPage: content.includes('objectives') || content.includes('goals'),
      topicPages: (content.match(/topic-\d+/g) || []).length,
      assessmentPage: content.includes('assessment') || content.includes('quiz'),
      navigationStructure: content.includes('linear') ? 'linear' : 'free',
      progressTracking: content.includes('progress') || content.includes('completion')
    }
  }

  private static analyzeInteractiveElements(content: string): InteractiveElementsInfo {
    return {
      knowledgeChecks: (content.match(/knowledge-check/g) || []).length,
      assessmentQuestions: (content.match(/question-\d+/g) || []).length,
      mediaControls: (content.match(/controls|play|pause/g) || []).length,
      formElements: (content.match(/<input|<select|<textarea/g) || []).length,
      clickableElements: (content.match(/onclick|addEventListener|click/g) || []).length
    }
  }

  private static analyzeNavigation(content: string): NavigationInfo {
    return {
      mode: content.includes('linear-navigation') ? 'linear' : 'free',
      previousButton: content.includes('previous') || content.includes('back'),
      nextButton: content.includes('next') || content.includes('forward'),
      menuNavigation: content.includes('menu') || content.includes('navigation'),
      breadcrumbs: content.includes('breadcrumb') || content.includes('trail'),
      tableOfContents: content.includes('toc') || content.includes('contents')
    }
  }

  private static analyzeAssessment(content: string): AssessmentInfo {
    const questionTypes = []
    if (content.includes('multiple-choice')) questionTypes.push('multiple-choice')
    if (content.includes('true-false')) questionTypes.push('true-false')
    if (content.includes('fill-in')) questionTypes.push('fill-in-blank')
    if (content.includes('essay')) questionTypes.push('essay')
    
    return {
      questionTypes,
      scoringMechanism: content.includes('weighted') ? 'weighted' : 'equal',
      feedbackImplementation: content.includes('feedback') || content.includes('explanation'),
      retakePolicy: content.includes('retake') ? 'allowed' : 'not-allowed',
      completionTracking: content.includes('completion') || content.includes('finished')
    }
  }

  private static async analyzeCompliance(zip: JSZip): Promise<ZipAnalysisResult['compliance']> {
    const indexFile = zip.file('index.html')
    const manifestFile = zip.file('imsmanifest.xml')
    
    const htmlContent = indexFile ? await indexFile.async('string') : ''
    const manifestContent = manifestFile ? await manifestFile.async('string') : ''
    
    return {
      scormStandard: manifestContent.includes('1.2') ? 'SCORM 1.2' : 'SCORM 2004',
      lmsCompatibility: {
        scorm12: manifestContent.includes('1.2'),
        scorm2004: manifestContent.includes('2004'),
        tinCanApi: htmlContent.includes('xAPI') || htmlContent.includes('TinCan'),
        commonIssues: this.detectCommonIssues(htmlContent)
      },
      accessibilityFeatures: {
        altTextPresent: htmlContent.includes('alt='),
        keyboardNavigation: htmlContent.includes('tabindex') || htmlContent.includes('accesskey'),
        screenReaderSupport: htmlContent.includes('aria-') || htmlContent.includes('role='),
        colorContrast: htmlContent.includes('high-contrast') || htmlContent.includes('color-blind'),
        fontScaling: htmlContent.includes('font-size') || htmlContent.includes('zoom')
      },
      securityChecks: {
        noScriptInjection: !htmlContent.includes('eval(') && !htmlContent.includes('innerHTML'),
        safeExternalLinks: !htmlContent.includes('javascript:'),
        inputValidation: htmlContent.includes('validate') || htmlContent.includes('sanitize'),
        contentSecurityPolicy: htmlContent.includes('Content-Security-Policy')
      }
    }
  }

  private static detectCommonIssues(content: string): string[] {
    const issues = []
    
    if (content.includes('asset.localhost')) {
      issues.push('Development URLs detected in production package')
    }
    
    if (content.includes('localhost:')) {
      issues.push('Localhost references found')
    }
    
    if (!content.includes('LMSInitialize')) {
      issues.push('SCORM API initialization missing')
    }
    
    if (content.includes('console.log')) {
      issues.push('Debug console statements present')
    }
    
    return issues
  }
}

// Test helper for SCORM generation and validation
class ScormTestRunner {
  
  static async createAndValidateScorm(
    page: Page, 
    course: any, 
    mediaConfig?: any
  ): Promise<{
    downloadPath: string
    basicValidation: any
    deepValidation: ZipAnalysisResult
  }> {
    // Create project
    await page.click('text=Create New Project')
    await page.fill('input[placeholder="Enter project name"]', course.name)
    await page.click('button:has-text("Create")')

    // Configure course
    await page.fill('input[placeholder*="course title"]', course.courseSeedData.courseTitle)
    await page.fill('textarea[placeholder*="List your course topics"]', course.courseSeedData.topics.join('\n'))

    // Add media if configured
    if (mediaConfig) {
      await page.click('button:has-text("Next")') // Media Enhancement
      // Add media files here based on mediaConfig
    }

    // Navigate to SCORM generation
    while (true) {
      try {
        const isOnScormPage = await page.locator('h1:has-text("Export SCORM Package")').isVisible()
        if (isOnScormPage) break
        await page.click('button:has-text("Next")')
        await page.waitForTimeout(500)
      } catch {
        break
      }
    }

    // Generate SCORM
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Generate SCORM Package")')
    const download = await downloadPromise
    const downloadPath = await download.path()!

    // Validate
    const zipBuffer = fs.readFileSync(downloadPath)
    const basicValidation = await validateSCORMPackage(new Uint8Array(zipBuffer))
    const deepValidation = await DeepZipValidator.analyzeZipStructure(new Uint8Array(zipBuffer))

    return {
      downloadPath,
      basicValidation,
      deepValidation
    }
  }
}

// Deep validation test suite
test.describe('SCORM Deep Package Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
    createCourseMediaSet(3)
  })

  test.afterEach(() => {
    cleanupMediaFiles()
  })

  test('Standard Course - Complete Structure Validation', async ({ page }) => {
    const course = getStandardCourse()
    const result = await ScormTestRunner.createAndValidateScorm(page, course)
    
    // Basic validation
    expect(result.basicValidation.isValid).toBe(true)
    expect(result.basicValidation.errors.length).toBe(0)
    
    // Deep structure validation
    expect(result.deepValidation.structure.requiredFiles.manifest).toBe(true)
    expect(result.deepValidation.structure.requiredFiles.indexHtml).toBe(true)
    expect(result.deepValidation.structure.requiredFiles.scormApi).toBe(true)
    expect(result.deepValidation.structure.requiredFiles.mediaFolder).toBe(true)
    
    // Manifest analysis
    expect(result.deepValidation.structure.manifestAnalysis.schemaCompliance).toBe(true)
    expect(result.deepValidation.structure.manifestAnalysis.organizations).toBeGreaterThan(0)
    expect(result.deepValidation.structure.manifestAnalysis.resources).toBeGreaterThan(0)
    
    // HTML analysis
    expect(result.deepValidation.structure.htmlAnalysis.structure.hasHead).toBe(true)
    expect(result.deepValidation.structure.htmlAnalysis.structure.hasBody).toBe(true)
    expect(result.deepValidation.structure.htmlAnalysis.scripts.scormApiCalls.length).toBeGreaterThan(0)
    
    // Content structure
    expect(result.deepValidation.content.pageStructure.welcomePage).toBe(true)
    expect(result.deepValidation.content.pageStructure.objectivesPage).toBe(true)
    expect(result.deepValidation.content.pageStructure.topicPages).toBeGreaterThan(0)
    
    // Compliance checks
    expect(result.deepValidation.compliance.lmsCompatibility.scorm12).toBe(true)
    expect(result.deepValidation.compliance.securityChecks.noScriptInjection).toBe(true)
    
    console.log('\n📊 Deep Validation Report:')
    console.log(`Files: ${result.deepValidation.structure.totalFiles}`)
    console.log(`Media Size: ${(result.deepValidation.media.totalMediaSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Audio Files: ${result.deepValidation.media.audioFiles.length}`)
    console.log(`Image Files: ${result.deepValidation.media.imageFiles.length}`)
    console.log(`Topic Pages: ${result.deepValidation.content.pageStructure.topicPages}`)
    
    fs.unlinkSync(result.downloadPath)
  })

  test('Media-Heavy Course - Media Optimization Validation', async ({ page }) => {
    const course = getMediaHeavyCourse()
    const result = await ScormTestRunner.createAndValidateScorm(page, course)
    
    // Media validation
    expect(result.deepValidation.media.totalMediaSize).toBeGreaterThan(0)
    expect(result.deepValidation.media.orphanedFiles.length).toBe(0) // No unused media files
    
    // Check media optimization
    const largeFiles = [
      ...result.deepValidation.media.audioFiles,
      ...result.deepValidation.media.imageFiles,
      ...result.deepValidation.media.videoFiles
    ].filter(file => file.size > 10 * 1024 * 1024) // > 10MB
    
    expect(largeFiles.length).toBeLessThan(3) // Should not have many large files
    
    // Verify all media files are referenced
    const unreferencedFiles = [
      ...result.deepValidation.media.audioFiles,
      ...result.deepValidation.media.imageFiles
    ].filter(file => !file.isReferenced)
    
    expect(unreferencedFiles.length).toBe(0)
    
    console.log('\n🎬 Media Analysis:')
    console.log(`Total Media: ${result.deepValidation.media.audioFiles.length + result.deepValidation.media.imageFiles.length + result.deepValidation.media.videoFiles.length}`)
    console.log(`Total Size: ${(result.deepValidation.media.totalMediaSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Large Files: ${largeFiles.length}`)
    
    fs.unlinkSync(result.downloadPath)
  })

  test('Assessment-Focused Course - Interactive Elements Validation', async ({ page }) => {
    const course = getAssessmentFocusedCourse()
    const result = await ScormTestRunner.createAndValidateScorm(page, course)
    
    // Interactive elements validation
    expect(result.deepValidation.content.interactiveElements.knowledgeChecks).toBeGreaterThan(0)
    expect(result.deepValidation.content.interactiveElements.assessmentQuestions).toBeGreaterThan(0)
    expect(result.deepValidation.content.interactiveElements.formElements).toBeGreaterThan(0)
    
    // Assessment implementation
    expect(result.deepValidation.content.assessmentImplementation.questionTypes.length).toBeGreaterThan(0)
    expect(result.deepValidation.content.assessmentImplementation.feedbackImplementation).toBe(true)
    expect(result.deepValidation.content.assessmentImplementation.completionTracking).toBe(true)
    
    // Navigation for assessments
    expect(result.deepValidation.content.navigationImplementation.nextButton).toBe(true)
    expect(result.deepValidation.content.navigationImplementation.previousButton).toBe(true)
    
    console.log('\n📝 Assessment Analysis:')
    console.log(`Knowledge Checks: ${result.deepValidation.content.interactiveElements.knowledgeChecks}`)
    console.log(`Assessment Questions: ${result.deepValidation.content.interactiveElements.assessmentQuestions}`)
    console.log(`Question Types: ${result.deepValidation.content.assessmentImplementation.questionTypes.join(', ')}`)
    
    fs.unlinkSync(result.downloadPath)
  })

  test('Accessibility Compliance Validation', async ({ page }) => {
    const course = getStandardCourse()
    const result = await ScormTestRunner.createAndValidateScorm(page, course)
    
    // Accessibility features
    expect(result.deepValidation.compliance.accessibilityFeatures.altTextPresent).toBe(true)
    expect(result.deepValidation.compliance.accessibilityFeatures.keyboardNavigation).toBe(true)
    expect(result.deepValidation.compliance.accessibilityFeatures.screenReaderSupport).toBe(true)
    
    // HTML structure for accessibility
    expect(result.deepValidation.structure.htmlAnalysis.structure.doctype).toBe('HTML5')
    expect(result.deepValidation.structure.htmlAnalysis.structure.encoding).toBe('UTF-8')
    
    console.log('\n♿ Accessibility Report:')
    console.log(`Alt Text: ${result.deepValidation.compliance.accessibilityFeatures.altTextPresent ? '✅' : '❌'}`)
    console.log(`Keyboard Nav: ${result.deepValidation.compliance.accessibilityFeatures.keyboardNavigation ? '✅' : '❌'}`)
    console.log(`Screen Reader: ${result.deepValidation.compliance.accessibilityFeatures.screenReaderSupport ? '✅' : '❌'}`)
    console.log(`Font Scaling: ${result.deepValidation.compliance.accessibilityFeatures.fontScaling ? '✅' : '❌'}`)
    
    fs.unlinkSync(result.downloadPath)
  })

  test('Security and Compliance Validation', async ({ page }) => {
    const course = getStandardCourse()
    const result = await ScormTestRunner.createAndValidateScorm(page, course)
    
    // Security checks
    expect(result.deepValidation.compliance.securityChecks.noScriptInjection).toBe(true)
    expect(result.deepValidation.compliance.securityChecks.safeExternalLinks).toBe(true)
    
    // LMS compatibility
    expect(result.deepValidation.compliance.lmsCompatibility.scorm12).toBe(true)
    expect(result.deepValidation.compliance.lmsCompatibility.commonIssues.length).toBe(0)
    
    // SCORM API implementation
    expect(result.deepValidation.structure.htmlAnalysis.scripts.scormApiCalls).toContain('LMSInitialize')
    expect(result.deepValidation.structure.htmlAnalysis.scripts.scormApiCalls).toContain('LMSCommit')
    expect(result.deepValidation.structure.htmlAnalysis.scripts.scormApiCalls).toContain('LMSFinish')
    
    console.log('\n🔒 Security & Compliance:')
    console.log(`Script Injection Safe: ${result.deepValidation.compliance.securityChecks.noScriptInjection ? '✅' : '❌'}`)
    console.log(`External Links Safe: ${result.deepValidation.compliance.securityChecks.safeExternalLinks ? '✅' : '❌'}`)
    console.log(`SCORM Standard: ${result.deepValidation.compliance.scormStandard}`)
    console.log(`Common Issues: ${result.deepValidation.compliance.lmsCompatibility.commonIssues.length}`)
    
    if (result.deepValidation.compliance.lmsCompatibility.commonIssues.length > 0) {
      console.log('Issues found:')
      result.deepValidation.compliance.lmsCompatibility.commonIssues.forEach(issue => {
        console.log(`  - ${issue}`)
      })
    }
    
    fs.unlinkSync(result.downloadPath)
  })

  test('Package Optimization Analysis', async ({ page }) => {
    const course = getMediaHeavyCourse()
    const result = await ScormTestRunner.createAndValidateScorm(page, course)
    
    const totalSize = result.deepValidation.media.totalMediaSize
    const packageSize = fs.statSync(result.downloadPath).size
    const compressionRatio = packageSize / totalSize
    
    // Performance expectations
    expect(compressionRatio).toBeLessThan(0.9) // Should achieve some compression
    expect(packageSize).toBeLessThan(100 * 1024 * 1024) // < 100MB for reasonable download
    
    // Media optimization
    const oversizedFiles = [
      ...result.deepValidation.media.audioFiles,
      ...result.deepValidation.media.imageFiles
    ].filter(file => file.size > 20 * 1024 * 1024) // > 20MB
    
    expect(oversizedFiles.length).toBe(0) // No extremely large files
    
    console.log('\n⚡ Performance Analysis:')
    console.log(`Package Size: ${(packageSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Media Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Compression: ${(compressionRatio * 100).toFixed(1)}%`)
    console.log(`Files: ${result.deepValidation.structure.totalFiles}`)
    console.log(`Directories: ${result.deepValidation.structure.directories.length}`)
    
    fs.unlinkSync(result.downloadPath)
  })
})