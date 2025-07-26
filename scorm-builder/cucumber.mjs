// Set up ts-node for ES modules
process.env.TS_NODE_PROJECT = './tests/bdd/tsconfig.json'

export default {
  paths: ['tests/bdd/features/**/*.feature'],
  import: ['tests/bdd/steps/**/*.ts', 'tests/bdd/support/**/*.ts'],
  loader: ['ts-node/esm'],
  format: [
    '@cucumber/pretty-formatter',
    'json:tests/bdd/reports/cucumber-report.json'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  },
  publishQuiet: true,
  timeout: 20000 // 20 second timeout
}