// Cucumber configuration for running single features
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Set up TypeScript support
process.env.TS_NODE_PROJECT = './tests/bdd/tsconfig.json'

export default {
  // Only look for the specific feature file passed as argument
  paths: process.argv.slice(2).filter(arg => arg.endsWith('.feature')),
  import: [
    'tests/bdd/steps/**/*.ts',
    'tests/bdd/support/**/*.ts'
  ],
  loader: ['ts-node/esm'],
  format: [
    '@cucumber/pretty-formatter',
    'json:tests/bdd/reports/cucumber-report.json'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  }
}