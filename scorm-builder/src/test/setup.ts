import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend vitest's expect with jest-dom matchers
expect.extend(matchers)

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
    addListener: vi.fn(),
    removeListener: vi.fn(),
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

// Mock window.alert
window.alert = vi.fn()

// Mock window.confirm
window.confirm = vi.fn(() => true)

// Mock Tauri API dialog
vi.mock('@tauri-apps/api/dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
}

// Mock CSS computed styles for tests
const createMockStyles = (element: Element) => {
  const classList = element.classList;
  const tagName = element.tagName.toLowerCase();
  
  let styles: any = {
    // Default values
    display: 'block',
    marginTop: '',
    marginBottom: '',
    padding: '',
    gap: '',
    justifyContent: '',
    borderStyle: 'none',
    borderWidth: '0px',
    backgroundColor: 'transparent',
    aspectRatio: '',
    overflow: 'visible',
    width: '',
    height: '',
    objectFit: '',
    fontSize: '14px',
    minHeight: '',
    boxShadow: 'none',
    fontWeight: 'normal',
    transition: '',
  };
  
  // Apply styles based on classes
  if (classList.contains('stepper-container')) {
    styles.marginTop = '16px';
  }
  
  if (classList.contains('navigation-buttons')) {
    styles.display = 'flex';
    styles.justifyContent = 'space-between';
    styles.marginTop = '32px';
  }
  
  if (classList.contains('card') && classList.contains('enhanced-padding')) {
    styles.padding = '32px';
  }
  
  if (classList.contains('card') && !classList.contains('enhanced-padding')) {
    styles.padding = '24px';
  }
  
  if (classList.contains('card-grid')) {
    styles.gap = '20px';
  }
  
  if (classList.contains('card-section')) {
    styles.marginTop = '16px';
  }
  
  if (classList.contains('narration-add-button')) {
    styles.borderStyle = 'dashed';
    styles.borderWidth = '2px';
    styles.backgroundColor = 'transparent';
  }
  
  if (classList.contains('narration-actions')) {
    styles.display = 'flex';
    styles.gap = '12px';
  }
  
  if (classList.contains('image-item')) {
    styles.aspectRatio = '16 / 9';
    styles.overflow = 'hidden';
  }
  
  if (tagName === 'img' && element.parentElement?.classList.contains('image-item')) {
    styles.width = '100%';
    styles.height = '100%';
    styles.objectFit = 'cover';
  }
  
  if (classList.contains('btn')) {
    styles.padding = '10px 20px';
    styles.fontSize = '16px';
    styles.minHeight = '44px';
  }
  
  if (classList.contains('btn-primary')) {
    styles.backgroundColor = 'rgb(59, 130, 246)';
  }
  
  if (classList.contains('btn-secondary')) {
    styles.backgroundColor = 'rgb(107, 114, 128)';
  }
  
  if (classList.contains('btn-success')) {
    styles.backgroundColor = 'rgb(34, 197, 94)';
  }
  
  if (classList.contains('btn-danger')) {
    styles.backgroundColor = 'rgb(239, 68, 68)';
  }
  
  return styles;
}

// Override getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  value: (element: Element) => {
    const styles = createMockStyles(element)
    return {
      ...styles,
      getPropertyValue: (prop: string) => {
        // Convert camelCase to kebab-case
        const kebabProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
        return styles[prop] || styles[kebabProp] || ''
      }
    }
  }
})