import { postProcessSCORMPackage } from './src/services/scormPostProcessor'
import JSZip from 'jszip'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Fix an existing SCORM package by applying post-processing
 */
async function fixSCORMPackage(inputPath: string, outputPath?: string) {
  console.log(`📦 Loading SCORM package from: ${inputPath}`)
  
  try {
    // Read the SCORM package
    const data = await fs.readFile(inputPath)
    const zip = await JSZip.loadAsync(data)
    
    console.log('🔧 Applying fixes...')
    console.log('  - Converting YouTube videos to iframe embeds')
    console.log('  - Adding missing audio players')
    console.log('  - Injecting knowledge check questions')
    
    // Apply post-processing
    const processedZip = await postProcessSCORMPackage(zip)
    
    // Generate the fixed package
    const outputBuffer = await processedZip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })
    
    // Determine output path
    const finalOutputPath = outputPath || inputPath.replace(/\.zip$/i, '_fixed.zip')
    
    // Write the fixed package
    await fs.writeFile(finalOutputPath, outputBuffer)
    
    console.log(`✅ Fixed SCORM package saved to: ${finalOutputPath}`)
    console.log('\nThe following fixes were applied:')
    console.log('  1. YouTube videos converted from <video> tags to proper iframe embeds')
    console.log('  2. Audio players added to pages with audio files')
    console.log('  3. Knowledge check questions injected from assessment page')
    console.log('  4. Navigation blocking configuration updated')
    
  } catch (error) {
    console.error('❌ Error fixing SCORM package:', error)
    process.exit(1)
  }
}

// Check command line arguments
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: npx tsx fix-scorm-package.ts <input-path> [output-path]')
  console.log('\nExample:')
  console.log('  npx tsx fix-scorm-package.ts "C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural_Gas_Safety_SCORM.zip"')
  process.exit(1)
}

// Run the fix
fixSCORMPackage(args[0], args[1]).catch(console.error)