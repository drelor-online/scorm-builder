#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: node generate-test.js <path-to-source-file>')
  process.exit(1)
}

const sourceFile = args[0]
const isComponent = sourceFile.includes('components/')
const isHook = sourceFile.includes('hooks/')
const isService = sourceFile.includes('services/')
const isUtil = sourceFile.includes('utils/')

const fileName = path.basename(sourceFile).replace(/\.(ts|tsx)$/, '')
const testDir = path.join(path.dirname(sourceFile), '__tests__')
const testFile = path.join(testDir, `${fileName}.test.${sourceFile.endsWith('.tsx') ? 'tsx' : 'ts'}`)

// Create test directory if it doesn't exist
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true })
}

// Generate appropriate test template
let template = ''

if (isComponent) {
  template = `import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ${fileName} } from '../${fileName}'

// Mock any dependencies
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn(),
}))

describe('${fileName}', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render without crashing', () => {
    render(<${fileName} />)
    // Add specific element checks here
  })

  it('should handle user interactions', async () => {
    render(<${fileName} />)
    
    // Example: Click a button
    // const button = screen.getByRole('button', { name: /click me/i })
    // fireEvent.click(button)
    
    // Wait for async operations
    // await waitFor(() => {
    //   expect(screen.getByText(/success/i)).toBeInTheDocument()
    // })
  })

  it('should display correct data', () => {
    // const mockData = { title: 'Test Title' }
    // render(<${fileName} data={mockData} />)
    // expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  // Add more specific tests based on component functionality
})`
} else if (isHook) {
  template = `import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ${fileName} } from '../${fileName}'

describe('${fileName}', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() => ${fileName}())
    
    // Check initial state
    // expect(result.current.value).toBe(defaultValue)
  })

  it('should update state correctly', () => {
    const { result } = renderHook(() => ${fileName}())
    
    act(() => {
      // Call hook methods
      // result.current.setValue('new value')
    })
    
    // expect(result.current.value).toBe('new value')
  })

  it('should handle edge cases', () => {
    const { result } = renderHook(() => ${fileName}())
    
    // Test edge cases
  })
})`
} else if (isService) {
  template = `import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ${fileName} } from '../${fileName}'

// Mock dependencies
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn(),
}))

describe('${fileName}', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle successful operations', async () => {
    // Mock successful response
    vi.mocked(invoke).mockResolvedValue({ success: true })
    
    // Call service method
    // const result = await ${fileName}.someMethod()
    
    // Verify result
    // expect(result).toEqual({ success: true })
  })

  it('should handle errors gracefully', async () => {
    // Mock error response
    vi.mocked(invoke).mockRejectedValue(new Error('Test error'))
    
    // Test error handling
    // await expect(${fileName}.someMethod()).rejects.toThrow('Test error')
  })

  it('should validate input parameters', () => {
    // Test input validation
  })
})`
} else if (isUtil) {
  template = `import { describe, it, expect } from 'vitest'
import { ${fileName} } from '../${fileName}'

describe('${fileName}', () => {
  it('should handle normal cases', () => {
    // Test normal functionality
    // const result = ${fileName}('input')
    // expect(result).toBe('expected output')
  })

  it('should handle edge cases', () => {
    // Test edge cases
    // expect(${fileName}(null)).toBe(defaultValue)
    // expect(${fileName}(undefined)).toBe(defaultValue)
    // expect(${fileName}('')).toBe(defaultValue)
  })

  it('should handle invalid input', () => {
    // Test error cases
    // expect(() => ${fileName}(invalidInput)).toThrow()
  })
})`
} else {
  template = `import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ${fileName} } from '../${fileName}'

describe('${fileName}', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should work correctly', () => {
    // Add your tests here
  })
})`
}

// Write test file
fs.writeFileSync(testFile, template)
console.log(`Test file created: ${testFile}`)
console.log('\\nNext steps:')
console.log('1. Review the generated test file')
console.log('2. Add specific test cases based on the source code')
console.log('3. Run: npm test ' + path.relative(process.cwd(), testFile))