#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🏗️  Building for production...\n')

// Check for required environment variables
const requiredEnvVars = [
  'VITE_GOOGLE_IMAGE_API_KEY',
  'VITE_GOOGLE_CSE_ID',
  'VITE_YOUTUBE_API_KEY'
]

const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:')
  missingVars.forEach(varName => console.error(`   - ${varName}`))
  console.error('\nPlease set these in your .env.local file or environment')
  process.exit(1)
}

// Clean previous build
console.log('🧹 Cleaning previous build...')
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true })
}

// Run TypeScript check
console.log('📝 Running TypeScript checks...')
try {
  execSync('npm run type-check', { stdio: 'inherit' })
} catch (error) {
  console.error('❌ TypeScript errors found. Please fix them before building.')
  process.exit(1)
}

// Run tests
console.log('🧪 Running tests...')
try {
  execSync('npm test -- --run', { stdio: 'inherit' })
} catch (error) {
  console.error('❌ Tests failed. Please fix them before building.')
  process.exit(1)
}

// Build with production config
console.log('🔨 Building with production configuration...')
try {
  execSync('vite build --config vite.config.prod.ts', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  })
} catch (error) {
  console.error('❌ Build failed:', error.message)
  process.exit(1)
}

// Generate security headers file for deployment
console.log('🔒 Generating security headers...')
const headersContent = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://www.googleapis.com https://youtube.googleapis.com; frame-src 'self' https://www.youtube.com https://player.vimeo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
`

fs.writeFileSync(path.join(distPath, '_headers'), headersContent)

// Create production info file
const buildInfo = {
  version: require('../package.json').version,
  buildTime: new Date().toISOString(),
  environment: 'production'
}

fs.writeFileSync(
  path.join(distPath, 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
)

console.log('\n✅ Production build completed successfully!')
console.log(`📁 Output directory: ${distPath}`)
console.log(`📊 Bundle stats available at: ${path.join(distPath, 'stats.html')}\n`)