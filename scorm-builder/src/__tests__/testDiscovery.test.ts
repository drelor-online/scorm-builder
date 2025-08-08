import { describe, it, expect } from 'vitest'

describe('Test Discovery', () => {
  it('should discover and run this test file', () => {
    // This test verifies that our vitest configuration correctly discovers test files
    expect(true).toBe(true)
  })

  it('should have access to test globals', () => {
    // Verify that global test utilities are available
    expect(describe).toBeDefined()
    expect(it).toBeDefined()
    expect(expect).toBeDefined()
  })

  it('should load test files from src directory', () => {
    // This test file itself is proof that src/**/*.test.ts files are discovered
    const testFilePath = __filename || import.meta.url
    expect(testFilePath).toContain('src')
    expect(testFilePath).toMatch(/\.test\.ts/)
  })
})