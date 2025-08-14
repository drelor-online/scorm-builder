module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true,
    jest: true
  },
  globals: {
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    ReadableStream: 'readonly',
    btoa: 'readonly',
    atob: 'readonly',
    MediaReference: 'readonly',
    afterEach: 'readonly',
    require: 'readonly',
    __REACT_DEVTOOLS_GLOBAL_HOOK__: 'readonly',
    // Vitest globals
    vi: 'readonly',
    describe: 'readonly',
    test: 'readonly',
    it: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly'
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist/**', 
    '.eslintrc.cjs',
    'archive/**',
    'tests/**',
    'playwright-report/**',
    'test-results/**',
    'coverage/**',
    '**/*.mjs',
    'vite.config.*.ts',
    'vitest.config.ts',
    'vite.config.ts',
    '.vite-temp/**',
    '.vite/**',
    '**/node_modules/**'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-undef': 'off' // TypeScript handles undefined variables better than ESLint
  },
  overrides: [
    {
      files: ['*.config.ts', '*.config.js', 'vite.config.*.ts', 'vitest.config.ts'],
      env: {
        node: true
      }
    },
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      parserOptions: {
        project: './tsconfig.json'
      },
      rules: {
        'no-undef': 'off' // TypeScript handles this
      }
    }
  ]
}
