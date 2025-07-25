#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Find all source files
function findSourceFiles(dir, files = []) {
  const items = fs.readdirSync(dir)
  
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', '__tests__', 'test'].includes(item)) {
        findSourceFiles(fullPath, files)
      }
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      if (!item.endsWith('.test.ts') && !item.endsWith('.test.tsx') && !item.endsWith('.d.ts')) {
        files.push(fullPath)
      }
    }
  }
  
  return files
}

// Find test file for a source file
function findTestFile(sourceFile) {
  const dir = path.dirname(sourceFile)
  const basename = path.basename(sourceFile)
  const nameWithoutExt = basename.replace(/\.(ts|tsx)$/, '')
  
  // Check for test files in various locations
  const testPatterns = [
    path.join(dir, '__tests__', `${nameWithoutExt}.test.tsx`),
    path.join(dir, '__tests__', `${nameWithoutExt}.test.ts`),
    path.join(dir, '__tests__', `${nameWithoutExt}.intent.test.tsx`),
    path.join(dir, '__tests__', `${nameWithoutExt}.simple.test.tsx`),
    path.join(dir, `${nameWithoutExt}.test.tsx`),
    path.join(dir, `${nameWithoutExt}.test.ts`),
  ]
  
  for (const pattern of testPatterns) {
    if (fs.existsSync(pattern)) {
      return pattern
    }
  }
  
  return null
}

// Analyze coverage
const srcDir = path.join(__dirname, '..', 'src')
const sourceFiles = findSourceFiles(srcDir)
const coverage = {
  total: sourceFiles.length,
  tested: 0,
  untested: [],
  byCategory: {}
}

for (const file of sourceFiles) {
  const relativePath = path.relative(srcDir, file)
  const category = relativePath.split(path.sep)[0]
  
  if (!coverage.byCategory[category]) {
    coverage.byCategory[category] = { total: 0, tested: 0, untested: [] }
  }
  
  coverage.byCategory[category].total++
  
  const hasTest = findTestFile(file) !== null
  if (hasTest) {
    coverage.tested++
    coverage.byCategory[category].tested++
  } else {
    coverage.untested.push(relativePath)
    coverage.byCategory[category].untested.push(relativePath)
  }
}

// Generate report
console.log('\\n=== Test Coverage Analysis ===\\n')
console.log(`Total source files: ${coverage.total}`)
console.log(`Files with tests: ${coverage.tested}`)
console.log(`Files without tests: ${coverage.untested.length}`)
console.log(`Coverage: ${((coverage.tested / coverage.total) * 100).toFixed(1)}%`)

console.log('\\n=== Coverage by Category ===\\n')
for (const [category, data] of Object.entries(coverage.byCategory)) {
  const percentage = ((data.tested / data.total) * 100).toFixed(1)
  console.log(`${category}: ${data.tested}/${data.total} (${percentage}%)`)
}

console.log('\\n=== Top 10 Untested Files (Priority) ===\\n')
const priorityFiles = coverage.untested
  .filter(f => !f.includes('types/') && !f.includes('constants/'))
  .slice(0, 10)

priorityFiles.forEach((file, i) => {
  console.log(`${i + 1}. ${file}`)
})

// Save detailed report
const reportPath = path.join(__dirname, '..', 'coverage-analysis.json')
fs.writeFileSync(reportPath, JSON.stringify(coverage, null, 2))
console.log(`\\nDetailed report saved to: ${reportPath}`)