import { pathToFileURL } from 'url';
import { resolve } from 'path';

export default {
  paths: ['tests/bdd/features/**/*.feature'],
  import: [
    'tests/bdd/steps/**/*.ts',
    'tests/bdd/support/**/*.ts'
  ],
  format: [
    'progress',
    'json:tests/bdd/reports/cucumber-report.json',
    'html:tests/bdd/reports/cucumber-report.html'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  },
  parallel: 1,
  worldParameters: {
    headless: process.env.HEADLESS !== 'false',
    baseUrl: process.env.BASE_URL || 'http://localhost:1421'
  }
};