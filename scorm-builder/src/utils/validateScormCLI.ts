#!/usr/bin/env node
import { readFile } from 'fs/promises'
import { validateSCORMPackage, generateValidationReport } from './scormPackageValidator'
import path from 'path'

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage: npm run validate-scorm <path-to-scorm.zip>')
    console.log('Example: npm run validate-scorm ~/Downloads/Natural_Gas_Safety_SCORM.zip')
    process.exit(1)
  }
  
  const filePath = path.resolve(args[0])
  
  try {
    console.log(`\nValidating SCORM package: ${filePath}\n`)
    
    const zipBuffer = await readFile(filePath)
    const validation = await validateSCORMPackage(new Uint8Array(zipBuffer))
    const report = generateValidationReport(validation)
    
    console.log(report)
    
    process.exit(validation.isValid ? 0 : 1)
  } catch (error) {
    console.error(`\n❌ Error reading file: ${error}\n`)
    process.exit(1)
  }
}

main().catch(console.error)