import { describe, it, expect } from 'vitest'
import { ErrorBoundary, useErrorHandler } from '../index'

describe('ErrorBoundary exports', () => {
  it('should export ErrorBoundary', () => {
    expect(ErrorBoundary).toBeDefined()
    expect(typeof ErrorBoundary).toBe('function')
  })

  it('should export useErrorHandler', () => {
    expect(useErrorHandler).toBeDefined()
    expect(typeof useErrorHandler).toBe('function')
  })
})