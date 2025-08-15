module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true,
    jest: true
  },
  globals: {
    // Browser APIs
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    ReadableStream: 'readonly',
    btoa: 'readonly',
    atob: 'readonly',
    MediaRecorder: 'readonly',
    requestAnimationFrame: 'readonly',
    Storage: 'readonly',
    crypto: 'readonly',
    confirm: 'readonly',
    // Node.js globals
    Buffer: 'readonly',
    __filename: 'readonly',
    require: 'readonly',
    // DOM types
    HTMLButtonElement: 'readonly',
    HTMLDivElement: 'readonly',
    HTMLAudioElement: 'readonly',
    HTMLAnchorElement: 'readonly',
    HTMLFormElement: 'readonly',
    Element: 'readonly',
    Node: 'readonly',
    NodeJS: 'readonly',
    CSSStyleDeclaration: 'readonly',
    BeforeUnloadEvent: 'readonly',
    PopStateEvent: 'readonly',
    TouchEvent: 'readonly',
    ErrorEvent: 'readonly',
    MediaStream: 'readonly',
    Response: 'readonly',
    URLSearchParams: 'readonly',
    AbortController: 'readonly',
    AbortSignal: 'readonly',
    // Testing globals
    MediaReference: 'readonly',
    afterEach: 'readonly',
    __REACT_DEVTOOLS_GLOBAL_HOOK__: 'readonly',
    // Vitest globals
    vi: 'readonly',
    describe: 'readonly',
    test: 'readonly',
    it: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    waitFor: 'readonly',
    fireEvent: 'readonly',
    jest: 'readonly'
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
