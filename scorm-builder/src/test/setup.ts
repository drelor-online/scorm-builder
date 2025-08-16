import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { beforeAll, afterAll, vi, afterEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock Tauri API with proper structure
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}))

vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn().mockResolvedValue({}),
  dialog: {
    open: vi.fn(),
    save: vi.fn(),
  },
  fs: {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock fetch
global.fetch = vi.fn()

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock window.__TAURI__ for Tauri API
const mockTauriInvoke = vi.fn().mockImplementation(() => Promise.resolve({}))

Object.defineProperty(window, '__TAURI__', {
  value: {
    invoke: mockTauriInvoke,
    tauri: {
      invoke: mockTauriInvoke,
    },
  },
  writable: true,
  configurable: true,
})

// Also add to global for cases where window might not be available
;(global as any).__TAURI__ = {
  invoke: mockTauriInvoke,
  tauri: {
    invoke: mockTauriInvoke,
  },
}

// Suppress console noise in tests for performance
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  info: console.info
}

beforeAll(() => {
  // Suppress verbose MediaService and BlobURLCache logging
  console.log = (...args: any[]) => {
    const message = String(args[0])
    if (
      message.includes('[MediaService') ||
      message.includes('[BlobURLCache]') ||
      message.includes('[FileStorage') ||
      message.includes('[DEBUG]') ||
      message.includes('MediaService v2.0.5') ||
      message.includes('LOGGER] UltraSimpleLogger') ||
      message.includes('STARTUP] Page loaded')
    ) {
      return // Suppress noisy test logs
    }
    originalConsole.log.call(console, ...args)
  }

  console.warn = (...args: any[]) => {
    const message = String(args[0])
    if (
      message.includes('extractNumericProjectId') ||
      message.includes('No project open') ||
      message.includes('PromiseRejectionHandledWarning')
    ) {
      return // Suppress expected warnings in tests
    }
    originalConsole.warn.call(console, ...args)
  }

  console.error = (...args: any[]) => {
    const message = String(args[0])
    if (
      message.includes('Warning: ReactDOM.render') ||
      message.includes('Warning: An update to') ||
      message.includes('wrapped in act(...)') 
    ) {
      return // Suppress React testing warnings
    }
    originalConsole.error.call(console, ...args)
  }

  // Suppress debug and info entirely in tests
  console.debug = () => {}
  console.info = () => {}
})

afterAll(() => {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.debug = originalConsole.debug
  console.info = originalConsole.info
})