module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true,
    jest: true
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
    'vite.config.ts'
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
    }]
  },
  overrides: [
    {
      files: ['*.config.ts', '*.config.js', 'vite.config.*.ts', 'vitest.config.ts'],
      env: {
        node: true
      }
    }
  ]
}
