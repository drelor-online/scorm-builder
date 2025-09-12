import JSZip from 'jszip'
import type { CourseSettings } from '../../src/components/CourseSettingsWizard'

export interface ScormValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  settingsVerification: SettingsVerificationResult
  structuralChecks: StructuralCheckResult
  contentChecks: ContentCheckResult
  performanceMetrics: PerformanceMetrics
}

export interface SettingsVerificationResult {
  navigationMode: {
    implemented: boolean
    expectedMode: 'linear' | 'free'
    actualImplementation: string
    issues: string[]
  }
  audioCompletion: {
    implemented: boolean
    expectedRequired: boolean
    trackingCode: boolean
    issues: string[]
  }
  assessmentSettings: {
    passMark: {
      expected: number
      implemented: number | null
      correct: boolean
    }
    retakePolicy: {
      expected: boolean
      implemented: boolean
      delayImplemented: boolean
    }
    completionCriteria: {
      expected: string
      implemented: string[]
      correct: boolean
    }
  }
  interfaceFeatures: {
    progressBar: boolean
    outline: boolean
    exitConfirmation: boolean
    fontSize: string
  }
  accessibility: {
    keyboardNavigation: boolean
    printableSupport: boolean
    screenReaderCompatible: boolean
  }
}

export interface StructuralCheckResult {
  requiredFiles: {
    manifest: boolean
    indexHtml: boolean
    scormApi: boolean
    mediaFolder: boolean
  }
  fileIntegrity: {
    manifestValid: boolean
    htmlWellFormed: boolean
    cssValid: boolean
    jsValid: boolean
  }
  mediaIntegrity: {
    allReferencedFilesExist: boolean
    noOrphanedFiles: boolean
    correctMimeTypes: boolean
  }
}

export interface ContentCheckResult {
  courseStructure: {
    welcomePage: boolean
    objectivesPage: boolean
    topicCount: number
    assessmentPresent: boolean
  }
  mediaImplementation: {
    audioFilesLinked: number
    imageFilesLinked: number
    youtubeVideosEmbedded: number
    captionFilesLinked: number
  }
  interactivity: {
    knowledgeChecks: number
    assessmentQuestions: number
    navigationButtons: boolean
    progressTracking: boolean
  }
}

export interface PerformanceMetrics {
  packageSize: number
  compressionRatio: number
  loadEstimate: {
    lowBandwidth: number  // seconds
    mediumBandwidth: number
    highBandwidth: number
  }
  mediaOptimization: {
    uncompressedAudioSize: number
    compressedAudioSize: number
    imageOptimizationScore: number
  }
}

export class EnhancedScormValidator {
  
  static async validatePackage(
    zipBuffer: Uint8Array, 
    expectedSettings: CourseSettings
  ): Promise<ScormValidationResult> {
    const result: ScormValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      settingsVerification: {} as SettingsVerificationResult,
      structuralChecks: {} as StructuralCheckResult,
      contentChecks: {} as ContentCheckResult,
      performanceMetrics: {} as PerformanceMetrics
    }

    try {
      const zip = await JSZip.loadAsync(zipBuffer)
      
      // Perform all validation checks
      result.structuralChecks = await this.performStructuralChecks(zip)
      result.contentChecks = await this.performContentChecks(zip)
      result.settingsVerification = await this.verifySettings(zip, expectedSettings)
      result.performanceMetrics = await this.analyzePerformance(zip, zipBuffer)

      // Aggregate results
      this.aggregateResults(result)

    } catch (error) {
      result.errors.push(`Failed to validate SCORM package: ${error}`)
      result.isValid = false
    }

    return result
  }

  private static async performStructuralChecks(zip: JSZip): Promise<StructuralCheckResult> {
    const result: StructuralCheckResult = {
      requiredFiles: {
        manifest: !!zip.file('imsmanifest.xml'),
        indexHtml: !!zip.file('index.html'),
        scormApi: !!zip.file('scripts/scorm-api.js') || !!zip.file('scorm_api.js'),
        mediaFolder: !!zip.folder('media')
      },
      fileIntegrity: {
        manifestValid: false,
        htmlWellFormed: false,
        cssValid: false,
        jsValid: false
      },
      mediaIntegrity: {
        allReferencedFilesExist: false,
        noOrphanedFiles: false,
        correctMimeTypes: false
      }
    }

    // Validate manifest XML
    const manifestFile = zip.file('imsmanifest.xml')
    if (manifestFile) {
      const manifestContent = await manifestFile.async('string')
      result.fileIntegrity.manifestValid = this.isValidXML(manifestContent)
    }

    // Validate HTML structure
    const indexFile = zip.file('index.html')
    if (indexFile) {
      const htmlContent = await indexFile.async('string')
      result.fileIntegrity.htmlWellFormed = this.isValidHTML(htmlContent)
    }

    // Check media references
    if (indexFile) {
      const htmlContent = await indexFile.async('string')
      result.mediaIntegrity = await this.validateMediaReferences(zip, htmlContent)
    }

    return result
  }

  private static async performContentChecks(zip: JSZip): Promise<ContentCheckResult> {
    const result: ContentCheckResult = {
      courseStructure: {
        welcomePage: false,
        objectivesPage: false,
        topicCount: 0,
        assessmentPresent: false
      },
      mediaImplementation: {
        audioFilesLinked: 0,
        imageFilesLinked: 0,
        youtubeVideosEmbedded: 0,
        captionFilesLinked: 0
      },
      interactivity: {
        knowledgeChecks: 0,
        assessmentQuestions: 0,
        navigationButtons: false,
        progressTracking: false
      }
    }

    const indexFile = zip.file('index.html')
    if (indexFile) {
      const htmlContent = await indexFile.async('string')
      
      // Analyze course structure
      result.courseStructure.welcomePage = htmlContent.includes('page-welcome') || htmlContent.includes('welcome-page')
      result.courseStructure.objectivesPage = htmlContent.includes('page-objectives') || htmlContent.includes('objectives-page')
      result.courseStructure.topicCount = (htmlContent.match(/page-topic-\d+/g) || []).length
      result.courseStructure.assessmentPresent = htmlContent.includes('assessment') || htmlContent.includes('quiz')

      // Count media implementations
      result.mediaImplementation.audioFilesLinked = (htmlContent.match(/\.(mp3|wav|ogg)/g) || []).length
      result.mediaImplementation.imageFilesLinked = (htmlContent.match(/\.(jpg|jpeg|png|gif|svg)/g) || []).length
      result.mediaImplementation.youtubeVideosEmbedded = (htmlContent.match(/youtube\.com\/embed/g) || []).length
      result.mediaImplementation.captionFilesLinked = (htmlContent.match(/\.vtt/g) || []).length

      // Check interactivity features
      result.interactivity.knowledgeChecks = (htmlContent.match(/knowledge-check/g) || []).length
      result.interactivity.assessmentQuestions = (htmlContent.match(/question-\d+/g) || []).length
      result.interactivity.navigationButtons = htmlContent.includes('next-button') || htmlContent.includes('previous-button')
      result.interactivity.progressTracking = htmlContent.includes('progress') || htmlContent.includes('completion')
    }

    return result
  }

  private static async verifySettings(zip: JSZip, expectedSettings: CourseSettings): Promise<SettingsVerificationResult> {
    const result: SettingsVerificationResult = {
      navigationMode: {
        implemented: false,
        expectedMode: expectedSettings.navigationMode,
        actualImplementation: 'unknown',
        issues: []
      },
      audioCompletion: {
        implemented: false,
        expectedRequired: expectedSettings.requireAudioCompletion,
        trackingCode: false,
        issues: []
      },
      assessmentSettings: {
        passMark: {
          expected: expectedSettings.passMark,
          implemented: null,
          correct: false
        },
        retakePolicy: {
          expected: expectedSettings.allowRetake,
          implemented: false,
          delayImplemented: false
        },
        completionCriteria: {
          expected: expectedSettings.completionCriteria,
          implemented: [],
          correct: false
        }
      },
      interfaceFeatures: {
        progressBar: false,
        outline: false,
        exitConfirmation: false,
        fontSize: 'unknown'
      },
      accessibility: {
        keyboardNavigation: false,
        printableSupport: false,
        screenReaderCompatible: false
      }
    }

    const indexFile = zip.file('index.html')
    const scriptFiles = zip.file(/.*\.js$/)
    
    if (indexFile) {
      const htmlContent = await indexFile.async('string')
      
      // Check navigation mode implementation
      if (expectedSettings.navigationMode === 'linear') {
        const hasLinearRestrictions = htmlContent.includes('linear-navigation') || 
                                    htmlContent.includes('disable-previous') ||
                                    htmlContent.includes('sequential-only')
        result.navigationMode.implemented = hasLinearRestrictions
        result.navigationMode.actualImplementation = hasLinearRestrictions ? 'linear' : 'free'
        
        if (!hasLinearRestrictions) {
          result.navigationMode.issues.push('Linear navigation not properly implemented')
        }
      } else {
        const hasFreeNavigation = htmlContent.includes('free-navigation') ||
                                htmlContent.includes('allow-jumping') ||
                                !htmlContent.includes('disable-previous')
        result.navigationMode.implemented = hasFreeNavigation
        result.navigationMode.actualImplementation = hasFreeNavigation ? 'free' : 'linear'
      }

      // Check audio completion requirements
      if (expectedSettings.requireAudioCompletion) {
        const hasAudioTracking = htmlContent.includes('audio-completion') ||
                               htmlContent.includes('require-audio') ||
                               htmlContent.includes('audio-ended')
        result.audioCompletion.implemented = hasAudioTracking
        result.audioCompletion.trackingCode = hasAudioTracking
        
        if (!hasAudioTracking) {
          result.audioCompletion.issues.push('Audio completion tracking not implemented')
        }
      }

      // Check pass mark implementation
      const passMarkMatch = htmlContent.match(/passMark[:\s]*(\d+)/) || 
                          htmlContent.match(/passing[_-]?score[:\s]*(\d+)/)
      if (passMarkMatch) {
        result.assessmentSettings.passMark.implemented = parseInt(passMarkMatch[1])
        result.assessmentSettings.passMark.correct = 
          result.assessmentSettings.passMark.implemented === expectedSettings.passMark
      }

      // Check interface features
      result.interfaceFeatures.progressBar = htmlContent.includes('progress-bar') || 
                                           htmlContent.includes('course-progress')
      result.interfaceFeatures.outline = htmlContent.includes('course-outline') || 
                                        htmlContent.includes('table-of-contents')
      result.interfaceFeatures.exitConfirmation = htmlContent.includes('confirm-exit') ||
                                                 htmlContent.includes('beforeunload')

      // Check font size implementation
      const fontSizeMatch = htmlContent.match(/font-size[:\s]*(small|medium|large)/) ||
                          htmlContent.match(/text-size[:\s]*(small|medium|large)/)
      if (fontSizeMatch) {
        result.interfaceFeatures.fontSize = fontSizeMatch[1]
      }

      // Check accessibility features
      result.accessibility.keyboardNavigation = htmlContent.includes('tabindex') ||
                                               htmlContent.includes('keydown') ||
                                               htmlContent.includes('keyboard-nav')
      result.accessibility.printableSupport = htmlContent.includes('print') ||
                                             htmlContent.includes('@media print')
      result.accessibility.screenReaderCompatible = htmlContent.includes('aria-') ||
                                                   htmlContent.includes('role=') ||
                                                   htmlContent.includes('alt=')
    }

    return result
  }

  private static async analyzePerformance(zip: JSZip, zipBuffer: Uint8Array): Promise<PerformanceMetrics> {
    const result: PerformanceMetrics = {
      packageSize: zipBuffer.length,
      compressionRatio: 0,
      loadEstimate: {
        lowBandwidth: 0,    // 1 Mbps
        mediumBandwidth: 0, // 5 Mbps  
        highBandwidth: 0    // 25 Mbps
      },
      mediaOptimization: {
        uncompressedAudioSize: 0,
        compressedAudioSize: 0,
        imageOptimizationScore: 0
      }
    }

    // Calculate uncompressed size
    let uncompressedSize = 0
    let audioSize = 0
    let imageCount = 0

    await Promise.all(
      Object.keys(zip.files).map(async filename => {
        const file = zip.files[filename]
        if (!file.dir) {
          const data = await file.async('uint8array')
          uncompressedSize += data.length

          if (filename.match(/\.(mp3|wav|ogg)$/)) {
            audioSize += data.length
          } else if (filename.match(/\.(jpg|jpeg|png|gif)$/)) {
            imageCount++
          }
        }
      })
    )

    result.compressionRatio = uncompressedSize > 0 ? zipBuffer.length / uncompressedSize : 0
    result.mediaOptimization.uncompressedAudioSize = audioSize
    result.mediaOptimization.compressedAudioSize = audioSize * result.compressionRatio
    result.mediaOptimization.imageOptimizationScore = Math.min(100, (1 - result.compressionRatio) * 100)

    // Estimate load times (in seconds)
    const sizeMB = zipBuffer.length / (1024 * 1024)
    result.loadEstimate.lowBandwidth = sizeMB * 8 / 1      // 1 Mbps
    result.loadEstimate.mediumBandwidth = sizeMB * 8 / 5   // 5 Mbps
    result.loadEstimate.highBandwidth = sizeMB * 8 / 25    // 25 Mbps

    return result
  }

  private static aggregateResults(result: ScormValidationResult): void {
    const { structuralChecks, contentChecks, settingsVerification } = result

    // Check for critical structural issues
    if (!structuralChecks.requiredFiles.manifest) {
      result.errors.push('Missing required imsmanifest.xml file')
    }
    if (!structuralChecks.requiredFiles.indexHtml) {
      result.errors.push('Missing required index.html file')
    }
    if (!structuralChecks.requiredFiles.scormApi) {
      result.errors.push('Missing SCORM API JavaScript file')
    }

    // Check settings implementation
    if (!settingsVerification.navigationMode.implemented) {
      result.warnings.push(`Navigation mode '${settingsVerification.navigationMode.expectedMode}' not properly implemented`)
    }
    if (settingsVerification.audioCompletion.expectedRequired && !settingsVerification.audioCompletion.implemented) {
      result.errors.push('Audio completion requirement not implemented')
    }
    if (!settingsVerification.assessmentSettings.passMark.correct) {
      result.warnings.push(`Pass mark mismatch: expected ${settingsVerification.assessmentSettings.passMark.expected}, found ${settingsVerification.assessmentSettings.passMark.implemented}`)
    }

    // Set overall validity
    result.isValid = result.errors.length === 0
  }

  private static isValidXML(content: string): boolean {
    try {
      // Basic XML validation - check for matching tags and basic structure
      return content.includes('<?xml') && 
             content.includes('<manifest') && 
             content.includes('</manifest>') &&
             content.includes('<organizations') &&
             content.includes('<resources')
    } catch {
      return false
    }
  }

  private static isValidHTML(content: string): boolean {
    // Basic HTML validation
    return content.includes('<!DOCTYPE') || content.includes('<html') &&
           content.includes('<head>') &&
           content.includes('<body>')
  }

  private static async validateMediaReferences(zip: JSZip, htmlContent: string): Promise<{
    allReferencedFilesExist: boolean
    noOrphanedFiles: boolean
    correctMimeTypes: boolean
  }> {
    // Extract media references from HTML
    const mediaReferences = [
      ...(htmlContent.match(/src=["']([^"']*\.(mp3|wav|jpg|jpeg|png|gif|svg))["']/g) || []),
      ...(htmlContent.match(/href=["']([^"']*\.(css|js))["']/g) || [])
    ].map(match => {
      const urlMatch = match.match(/["']([^"']*)["']/)
      return urlMatch ? urlMatch[1] : ''
    }).filter(Boolean)

    // Check if all referenced files exist
    const allExist = mediaReferences.every(ref => {
      // Handle relative paths
      const filePath = ref.startsWith('./') ? ref.slice(2) : ref
      return !!zip.file(filePath)
    })

    return {
      allReferencedFilesExist: allExist,
      noOrphanedFiles: true, // Simplified check
      correctMimeTypes: true  // Simplified check
    }
  }

  static generateDetailedReport(result: ScormValidationResult): string {
    let report = '\n=== Enhanced SCORM Package Validation Report ===\n\n'
    
    report += `Overall Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}\n`
    report += `Package Size: ${(result.performanceMetrics.packageSize / 1024 / 1024).toFixed(2)} MB\n`
    report += `Compression Ratio: ${(result.performanceMetrics.compressionRatio * 100).toFixed(1)}%\n\n`

    // Settings Verification
    report += '📋 Settings Verification:\n'
    report += `  Navigation Mode: ${result.settingsVerification.navigationMode.implemented ? '✅' : '❌'} (Expected: ${result.settingsVerification.navigationMode.expectedMode})\n`
    report += `  Audio Completion: ${result.settingsVerification.audioCompletion.implemented ? '✅' : '❌'} (Required: ${result.settingsVerification.audioCompletion.expectedRequired})\n`
    report += `  Pass Mark: ${result.settingsVerification.assessmentSettings.passMark.correct ? '✅' : '❌'} (Expected: ${result.settingsVerification.assessmentSettings.passMark.expected})\n\n`

    // Structural Checks
    report += '🏗️ Structural Integrity:\n'
    report += `  Manifest: ${result.structuralChecks.requiredFiles.manifest ? '✅' : '❌'}\n`
    report += `  Index HTML: ${result.structuralChecks.requiredFiles.indexHtml ? '✅' : '❌'}\n`
    report += `  SCORM API: ${result.structuralChecks.requiredFiles.scormApi ? '✅' : '❌'}\n`
    report += `  Media Folder: ${result.structuralChecks.requiredFiles.mediaFolder ? '✅' : '❌'}\n\n`

    // Content Analysis
    report += '📚 Content Analysis:\n'
    report += `  Topics: ${result.contentChecks.courseStructure.topicCount}\n`
    report += `  Audio Files: ${result.contentChecks.mediaImplementation.audioFilesLinked}\n`
    report += `  Images: ${result.contentChecks.mediaImplementation.imageFilesLinked}\n`
    report += `  YouTube Videos: ${result.contentChecks.mediaImplementation.youtubeVideosEmbedded}\n`
    report += `  Knowledge Checks: ${result.contentChecks.interactivity.knowledgeChecks}\n\n`

    // Performance Metrics
    report += '⚡ Performance Analysis:\n'
    report += `  Load Time (1 Mbps): ${result.performanceMetrics.loadEstimate.lowBandwidth.toFixed(1)}s\n`
    report += `  Load Time (5 Mbps): ${result.performanceMetrics.loadEstimate.mediumBandwidth.toFixed(1)}s\n`
    report += `  Load Time (25 Mbps): ${result.performanceMetrics.loadEstimate.highBandwidth.toFixed(1)}s\n\n`

    // Errors and Warnings
    if (result.errors.length > 0) {
      report += '❌ Errors:\n'
      result.errors.forEach(error => report += `  - ${error}\n`)
      report += '\n'
    }

    if (result.warnings.length > 0) {
      report += '⚠️ Warnings:\n'
      result.warnings.forEach(warning => report += `  - ${warning}\n`)
      report += '\n'
    }

    return report
  }
}

// Export convenience functions
export const validateScormPackage = (zipBuffer: Uint8Array, settings: CourseSettings) => 
  EnhancedScormValidator.validatePackage(zipBuffer, settings)
export const generateValidationReport = (result: ScormValidationResult) => 
  EnhancedScormValidator.generateDetailedReport(result)