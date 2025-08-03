import JSZip from 'jszip'

export async function validateSCORMPackage(zipBuffer: Uint8Array): Promise<{
  isValid: boolean
  errors: string[]
  warnings: string[]
  info: {
    navigationJsLine116?: string
    indexHtmlLine98?: string
    answeredQuestionsDeclarations: number
    initializeCourseCalls: number
  }
}> {
  const errors: string[] = []
  const warnings: string[] = []
  const info: any = {}
  
  try {
    const zip = await JSZip.loadAsync(zipBuffer)
    
    // Check navigation.js
    const navJs = await zip.file('scripts/navigation.js')?.async('string')
    if (navJs) {
      const navLines = navJs.split('\n')
      info.navigationJsLine116 = navLines[115] || 'Line 116 not found'
      
      // Count answeredQuestions declarations
      const declarations = navJs.match(/(?:let|var|const)\s+answeredQuestions/g) || []
      info.answeredQuestionsDeclarations = declarations.length
      
      if (declarations.length > 1) {
        errors.push(`Found ${declarations.length} declarations of answeredQuestions (should be 1)`)
      }
      
      // Check if window.initializeCourse is set
      if (!navJs.includes('window.initializeCourse = initializeCourse')) {
        errors.push('initializeCourse is not exposed to window')
      }
    } else {
      errors.push('scripts/navigation.js not found')
    }
    
    // Check index.html
    const indexHtml = await zip.file('index.html')?.async('string')
    if (indexHtml) {
      const htmlLines = indexHtml.split('\n')
      info.indexHtmlLine98 = htmlLines[97] || 'Line 98 not found'
      
      // Count initializeCourse calls
      const initCalls = indexHtml.match(/initializeCourse\(\)/g) || []
      info.initializeCourseCalls = initCalls.length
      
      if (initCalls.length > 0) {
        // Check if any are in inline scripts
        const inlineScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g
        let match
        while ((match = inlineScriptRegex.exec(indexHtml)) !== null) {
          if (!match[0].includes('src=') && match[1].includes('initializeCourse()')) {
            const lineNumber = indexHtml.substring(0, match.index).split('\n').length
            errors.push(`Found inline script calling initializeCourse() at line ${lineNumber}`)
          }
        }
      }
    } else {
      errors.push('index.html not found')
    }
    
    // Check for required files
    const requiredFiles = [
      'imsmanifest.xml',
      'scripts/scorm-api.js',
      'styles/main.css',
      'pages/welcome.html',
      'pages/objectives.html',
      'pages/assessment.html'
    ]
    
    for (const file of requiredFiles) {
      if (!zip.file(file)) {
        warnings.push(`Missing expected file: ${file}`)
      }
    }
    
  } catch (error) {
    errors.push(`Failed to parse zip file: ${error}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info
  }
}

export function generateValidationReport(validation: Awaited<ReturnType<typeof validateSCORMPackage>>): string {
  let report = '\n=== SCORM Package Validation Report ===\n\n'
  
  report += `Status: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}\n\n`
  
  if (validation.info) {
    report += 'Package Information:\n'
    report += `- Line 116 in navigation.js: "${validation.info.navigationJsLine116}"\n`
    report += `- Line 98 in index.html: "${validation.info.indexHtmlLine98}"\n`
    report += `- answeredQuestions declarations: ${validation.info.answeredQuestionsDeclarations}\n`
    report += `- initializeCourse() calls in HTML: ${validation.info.initializeCourseCalls}\n`
    report += '\n'
  }
  
  if (validation.errors.length > 0) {
    report += 'Errors:\n'
    validation.errors.forEach(error => {
      report += `- ❌ ${error}\n`
    })
    report += '\n'
  }
  
  if (validation.warnings.length > 0) {
    report += 'Warnings:\n'
    validation.warnings.forEach(warning => {
      report += `- ⚠️ ${warning}\n`
    })
    report += '\n'
  }
  
  if (validation.isValid) {
    report += '✅ This SCORM package should work without JavaScript errors.\n'
  } else {
    report += '❌ This SCORM package may have JavaScript errors when loaded in an LMS.\n'
    report += '\nTo fix these issues, please ensure you are using the latest version of the SCORM Builder.\n'
  }
  
  return report
}