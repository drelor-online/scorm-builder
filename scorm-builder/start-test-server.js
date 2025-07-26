import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🚀 Starting Vite dev server in test mode...')

const vite = spawn('npx', ['vite', '--config', 'vite.config.bdd.ts', '--mode', 'test'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MODE: 'test',
    VITE_MODE: 'test'
  },
  cwd: __dirname,
  shell: true
})

vite.on('exit', (code) => {
  console.log(`Vite exited with code ${code}`)
  process.exit(code)
})