#!/usr/bin/env node

const { exec } = require('child_process')
const path = require('path')

// Parse command line arguments
const args = process.argv.slice(2)
const isHeaded = args.includes('--headed')
const tag = args.find(arg => arg.startsWith('--tag='))?.split('=')[1]

// Build cucumber command
let command = 'npx cucumber-js'

// Add environment variables
const env = { ...process.env }
if (isHeaded) {
  env.HEADLESS = 'false'
}

// Add tag filter if provided
if (tag) {
  command += ` --tags "${tag}"`
}

// Add format options
command += ' --format @cucumber/pretty-formatter'
command += ' --format json:tests/bdd/reports/cucumber-report.json'

console.log('Running BDD tests...')
console.log('Command:', command)

// Execute cucumber
const cucumber = exec(command, { env })

// Pipe output
cucumber.stdout.pipe(process.stdout)
cucumber.stderr.pipe(process.stderr)

// Handle exit
cucumber.on('exit', (code) => {
  process.exit(code)
})