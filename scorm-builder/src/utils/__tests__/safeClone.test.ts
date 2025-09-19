import { describe, it, expect, vi } from 'vitest'
import { safeDeepClone, hasCircularReferences, safeCloneWithCircularHandling } from '../safeClone'

describe('safeClone', () => {
  describe('safeDeepClone', () => {
    it('should clone primitive values', () => {
      expect(safeDeepClone(null)).toBe(null)
      expect(safeDeepClone(undefined)).toBe(undefined)
      expect(safeDeepClone(42)).toBe(42)
      expect(safeDeepClone('hello')).toBe('hello')
      expect(safeDeepClone(true)).toBe(true)
    })

    it('should deep clone objects', () => {
      const original = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4, 5]
        }
      }

      const cloned = safeDeepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
      expect(cloned.b.d).not.toBe(original.b.d)
    })

    it('should deep clone arrays', () => {
      const original = [1, [2, 3], { a: 4 }]
      const cloned = safeDeepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned[1]).not.toBe(original[1])
      expect(cloned[2]).not.toBe(original[2])
    })

    it('should use structuredClone when available', () => {
      const mockStructuredClone = vi.fn().mockReturnValue({ cloned: true })

      // Mock structuredClone as available
      ;(global as any).structuredClone = mockStructuredClone

      const original = { test: 'data' }
      const result = safeDeepClone(original)

      expect(mockStructuredClone).toHaveBeenCalledWith(original)
      expect(result).toEqual({ cloned: true })

      // Cleanup
      delete (global as any).structuredClone
    })

    it('should fallback to JSON methods when structuredClone fails', () => {
      const mockStructuredClone = vi.fn().mockImplementation(() => {
        throw new Error('structuredClone failed')
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Mock structuredClone as available but failing
      ;(global as any).structuredClone = mockStructuredClone

      const original = { test: 'data' }
      const result = safeDeepClone(original)

      expect(mockStructuredClone).toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(result).toEqual(original)
      expect(result).not.toBe(original)

      // Cleanup
      delete (global as any).structuredClone
      consoleWarnSpy.mockRestore()
    })
  })

  describe('hasCircularReferences', () => {
    it('should return false for non-circular objects', () => {
      expect(hasCircularReferences(null)).toBe(false)
      expect(hasCircularReferences(42)).toBe(false)
      expect(hasCircularReferences({ a: 1, b: { c: 2 } })).toBe(false)
      expect(hasCircularReferences([1, [2, 3]])).toBe(false)
    })

    it('should detect circular references in objects', () => {
      const obj: any = { a: 1 }
      obj.self = obj

      expect(hasCircularReferences(obj)).toBe(true)
    })

    it('should detect circular references in arrays', () => {
      const arr: any = [1, 2]
      arr.push(arr)

      expect(hasCircularReferences(arr)).toBe(true)
    })

    it('should detect deep circular references', () => {
      const obj: any = { a: { b: { c: {} } } }
      obj.a.b.c.back = obj

      expect(hasCircularReferences(obj)).toBe(true)
    })
  })

  describe('safeCloneWithCircularHandling', () => {
    it('should clone objects without circular references normally', () => {
      const original = { a: 1, b: { c: 2 } }
      const cloned = safeCloneWithCircularHandling(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
    })

    it('should replace circular references with [Circular] markers', () => {
      const obj: any = { a: 1, b: { c: 2 } }
      obj.self = obj
      obj.b.parent = obj

      const cloned = safeCloneWithCircularHandling(obj)

      expect(cloned.a).toBe(1)
      expect(cloned.b.c).toBe(2)
      expect(cloned.self).toBe('[Circular]')
      expect(cloned.b.parent).toBe('[Circular]')
    })

    it('should handle circular references in arrays', () => {
      const arr: any = [1, 2, {}]
      arr[2].ref = arr
      arr.push(arr)

      const cloned = safeCloneWithCircularHandling(arr)

      expect(cloned[0]).toBe(1)
      expect(cloned[1]).toBe(2)
      expect(cloned[2].ref).toBe('[Circular]')
      expect(cloned[3]).toBe('[Circular]')
    })
  })
})