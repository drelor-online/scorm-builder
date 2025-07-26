export default {
  // CI/CD configuration for stable tests only
  parallel: 1,
  format: [
    'progress-bar',
    'json:test-results/cucumber-report.json',
    'html:test-results/cucumber-report.html',
    'junit:test-results/cucumber-report.xml'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  },
  import: [
    'tests/bdd/steps/**/*.ts',
    'tests/bdd/support/**/*.ts'
  ],
  loader: ['ts-node/esm'],
  paths: ['tests/bdd/features/**/*.feature'],
  require: [],
  requireModule: [],
  // Only run stable tests in CI
  tags: '@stable and not @wip and not @skip',
  // Fail fast in CI
  failFast: true,
  // Strict mode for CI
  strict: true,
  // Retry failed tests once
  retry: 1,
  // Set reasonable timeout for CI
  timeout: 30000
}