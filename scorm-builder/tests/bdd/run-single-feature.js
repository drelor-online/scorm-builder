import { spawn } from 'child_process'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load test environment variables
config({ path: join(__dirname, '.env.test') })

const feature = process.argv[2]
if (!feature) {
  console.error('Please provide a feature file path')
  process.exit(1)
}

console.log(`Running feature: ${feature}`)

const cucumber = spawn('npx', [
  'cucumber-js',
  '--config', 'cucumber-single.mjs',
  feature
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BASE_URL: process.env.BASE_URL || 'http://localhost:1421'
  },
  cwd: join(__dirname, '../..'),
  shell: true
})

cucumber.on('exit', code => {
  process.exit(code)
})