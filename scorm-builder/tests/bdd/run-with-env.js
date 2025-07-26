import { config } from 'dotenv'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load test environment variables
const result = config({ path: join(__dirname, '.env.test') })
if (result.error) {
  console.error('Failed to load .env.test:', result.error)
} else {
  console.log('✅ Loaded environment variables:', Object.keys(result.parsed || {}))
}

// Pass all arguments to cucumber
const args = process.argv.slice(2)
const cucumber = spawn('npx', ['cucumber-js', '--config', 'cucumber.mjs', ...args], {
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