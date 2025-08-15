import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'dist/**', 
      'node_modules/**', 
      'src-tauri/**',
      'archive/**',
      'tests/**',
      'playwright-report/**',
      'test-results/**',
      'test-output/**',
      'coverage/**',
      '**/*.mjs',
      '**/*.cjs',
      'vite.config.*.ts',
      'vitest.config.ts',
      'vite.config.ts',
      'build-*.js',
      'regenerate-debug.js',
      'fix-scorm-package.ts',
      'test-*.ts'
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser APIs
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',
        confirm: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        // HTML Elements
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLAudioElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLFormElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeJS: 'readonly',
        CSSStyleDeclaration: 'readonly',
        // Storage & Web APIs
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        performance: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        DataTransfer: 'readonly',
        // Events
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        DragEvent: 'readonly',
        BeforeUnloadEvent: 'readonly',
        PopStateEvent: 'readonly',
        TouchEvent: 'readonly',
        ErrorEvent: 'readonly',
        // Media APIs
        MediaRecorder: 'readonly',
        MediaStream: 'readonly',
        // Network & Crypto
        fetch: 'readonly',
        Response: 'readonly',
        location: 'readonly',
        crypto: 'readonly',
        requestAnimationFrame: 'readonly',
        // Node.js
        process: 'readonly',
        global: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        __filename: 'readonly',
        // Browser encoding
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        ReadableStream: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        Storage: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        // React
        React: 'readonly',
        // Test globals
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
        waitFor: 'readonly',
        fireEvent: 'readonly',
        render: 'readonly',
        screen: 'readonly',
        // Custom test utilities
        MediaReference: 'readonly',
        AppDashboard: 'readonly',
        idGenerator: 'readonly',
        container: 'readonly',
        renderWithStepNavigation: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-undef': 'off', // TypeScript handles undefined variables better than ESLint
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
    },
  },
  {
    files: ['**/*.config.{ts,js}', 'vite.config.*.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
  },
  {
    files: ['**/*.cjs', 'scripts/**/*.js', 'build-portable-package.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        location: 'readonly',
      },
    },
  },
];