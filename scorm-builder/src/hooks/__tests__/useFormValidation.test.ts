import { describe, it, expect, act } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFormValidation } from '../useFormValidation'

describe('useFormValidation', () => {
  describe('Initialization', () => {
    it('should initialize with no errors and nothing touched', () => {
      const { result } = renderHook(() => useFormValidation({}))

      expect(result.current.errors).toEqual({})
      expect(result.current.touched).toEqual({})
      expect(result.current.isValid).toBe(true)
    })

    it('should accept validation rules', () => {
      const rules = {
        email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        name: { required: true, minLength: 2, maxLength: 50 }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      expect(result.current.errors).toEqual({})
      expect(result.current.isValid).toBe(true)
    })
  })

  describe('Field Validation', () => {
    it('should validate required fields', () => {
      const rules = {
        name: { required: true }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Empty value should fail
      let error = result.current.validateField('name', '')
      expect(error).toBe('Name is required')

      // Null value should fail
      error = result.current.validateField('name', null)
      expect(error).toBe('Name is required')

      // Valid value should pass
      error = result.current.validateField('name', 'John')
      expect(error).toBeUndefined()
    })

    it('should validate pattern matching', () => {
      const rules = {
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Invalid email should fail
      let error = result.current.validateField('email', 'invalid-email')
      expect(error).toBe('Please enter a valid email address')

      // Valid email should pass
      error = result.current.validateField('email', 'test@example.com')
      expect(error).toBeUndefined()

      // Empty value should pass (not required)
      error = result.current.validateField('email', '')
      expect(error).toBeUndefined()
    })

    it('should validate minLength', () => {
      const rules = {
        password: { minLength: 8 }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Too short should fail
      let error = result.current.validateField('password', 'short')
      expect(error).toBe('Password must be at least 8 characters')

      // Exact length should pass
      error = result.current.validateField('password', '12345678')
      expect(error).toBeUndefined()

      // Longer should pass
      error = result.current.validateField('password', 'verylongpassword')
      expect(error).toBeUndefined()
    })

    it('should validate maxLength', () => {
      const rules = {
        username: { maxLength: 15 }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Too long should fail
      let error = result.current.validateField('username', 'verylongusername123')
      expect(error).toBe('Username must be no more than 15 characters')

      // Exact length should pass
      error = result.current.validateField('username', '123456789012345')
      expect(error).toBeUndefined()

      // Shorter should pass
      error = result.current.validateField('username', 'short')
      expect(error).toBeUndefined()
    })

    it('should validate custom rules', () => {
      const rules = {
        confirmPassword: {
          custom: (value: string) => {
            if (value !== 'password123') {
              return 'Passwords do not match'
            }
            return undefined
          }
        }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Non-matching should fail
      let error = result.current.validateField('confirmPassword', 'different')
      expect(error).toBe('Passwords do not match')

      // Matching should pass
      error = result.current.validateField('confirmPassword', 'password123')
      expect(error).toBeUndefined()
    })

    it('should apply multiple validation rules', () => {
      const rules = {
        username: {
          required: true,
          minLength: 3,
          maxLength: 20,
          pattern: /^[a-zA-Z0-9_]+$/
        }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Required check first
      let error = result.current.validateField('username', '')
      expect(error).toBe('Username is required')

      // Pattern check
      error = result.current.validateField('username', 'user@name')
      expect(error).toBe('Username format is invalid')

      // MinLength check
      error = result.current.validateField('username', 'ab')
      expect(error).toBe('Username must be at least 3 characters')

      // MaxLength check
      error = result.current.validateField('username', 'verylongusername12345')
      expect(error).toBe('Username must be no more than 20 characters')

      // Valid username
      error = result.current.validateField('username', 'valid_user123')
      expect(error).toBeUndefined()
    })

    it('should handle fields without validation rules', () => {
      const rules = {
        email: { required: true }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Field without rules should always pass
      const error = result.current.validateField('unknown', 'any value')
      expect(error).toBeUndefined()
    })
  })

  describe('Form Validation', () => {
    it('should validate entire form', () => {
      const rules = {
        email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        name: { required: true, minLength: 2 }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // Invalid form
      act(() => {
        const isValid = result.current.validateForm({
          email: 'invalid',
          name: 'J'
        })
        expect(isValid).toBe(false)
      })

      expect(result.current.errors).toEqual({
        email: 'Please enter a valid email address',
        name: 'Name must be at least 2 characters'
      })
      expect(result.current.isValid).toBe(false)

      // Valid form
      act(() => {
        const isValid = result.current.validateForm({
          email: 'test@example.com',
          name: 'John'
        })
        expect(isValid).toBe(true)
      })

      expect(result.current.errors).toEqual({})
      expect(result.current.isValid).toBe(true)
    })

    it('should handle missing fields in form validation', () => {
      const rules = {
        email: { required: true },
        name: { required: true }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      act(() => {
        const isValid = result.current.validateForm({
          email: 'test@example.com'
          // name is missing
        })
        expect(isValid).toBe(false)
      })

      expect(result.current.errors).toEqual({
        name: 'Name is required'
      })
    })
  })

  describe('Touched State', () => {
    it('should track touched fields', () => {
      const { result } = renderHook(() => useFormValidation({}))

      expect(result.current.touched).toEqual({})

      // Mark field as touched
      act(() => {
        result.current.setFieldTouched('email')
      })

      expect(result.current.touched).toEqual({ email: true })

      // Mark another field
      act(() => {
        result.current.setFieldTouched('name', true)
      })

      expect(result.current.touched).toEqual({ email: true, name: true })

      // Mark field as untouched
      act(() => {
        result.current.setFieldTouched('email', false)
      })

      expect(result.current.touched).toEqual({ email: false, name: true })
    })
  })

  describe('Error Management', () => {
    it('should set field errors manually', () => {
      const { result } = renderHook(() => useFormValidation({}))

      // Set an error
      act(() => {
        result.current.setFieldError('email', 'Custom error message')
      })

      expect(result.current.errors).toEqual({ email: 'Custom error message' })
      expect(result.current.isValid).toBe(false)

      // Set another error
      act(() => {
        result.current.setFieldError('name', 'Another error')
      })

      expect(result.current.errors).toEqual({
        email: 'Custom error message',
        name: 'Another error'
      })

      // Clear an error
      act(() => {
        result.current.setFieldError('email', undefined)
      })

      expect(result.current.errors).toEqual({ name: 'Another error' })

      // Clear last error
      act(() => {
        result.current.setFieldError('name', undefined)
      })

      expect(result.current.errors).toEqual({})
      expect(result.current.isValid).toBe(true)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle real-world form validation flow', () => {
      const rules = {
        email: { 
          required: true, 
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
        },
        password: { 
          required: true, 
          minLength: 8,
          custom: (value: string) => {
            if (!/[A-Z]/.test(value)) {
              return 'Password must contain at least one uppercase letter'
            }
            if (!/[0-9]/.test(value)) {
              return 'Password must contain at least one number'
            }
            return undefined
          }
        }
      }

      const { result } = renderHook(() => useFormValidation(rules))

      // User starts typing email
      act(() => {
        result.current.setFieldTouched('email')
      })

      // Validate on blur with invalid email
      const emailError = result.current.validateField('email', 'invalid')
      expect(emailError).toBe('Please enter a valid email address')

      // User fixes email
      const fixedEmailError = result.current.validateField('email', 'user@example.com')
      expect(fixedEmailError).toBeUndefined()

      // User starts typing password
      act(() => {
        result.current.setFieldTouched('password')
      })

      // Too short password
      let passwordError = result.current.validateField('password', 'short')
      expect(passwordError).toBe('Password must be at least 8 characters')

      // Missing uppercase
      passwordError = result.current.validateField('password', 'password123')
      expect(passwordError).toBe('Password must contain at least one uppercase letter')

      // Missing number
      passwordError = result.current.validateField('password', 'PasswordABC')
      expect(passwordError).toBe('Password must contain at least one number')

      // Valid password
      passwordError = result.current.validateField('password', 'Password123')
      expect(passwordError).toBeUndefined()

      // Submit form
      act(() => {
        const isValid = result.current.validateForm({
          email: 'user@example.com',
          password: 'Password123'
        })
        expect(isValid).toBe(true)
      })

      expect(result.current.isValid).toBe(true)
    })

    it('should handle dynamic validation rules', () => {
      let requireConfirmation = false

      const getDynamicRules = () => ({
        password: { required: true, minLength: 8 },
        ...(requireConfirmation && {
          confirmPassword: {
            required: true,
            custom: (value: string) => {
              if (value !== 'password123') {
                return 'Passwords do not match'
              }
              return undefined
            }
          }
        })
      })

      const { result, rerender } = renderHook(
        () => useFormValidation(getDynamicRules())
      )

      // Initially, only password is required
      act(() => {
        const isValid = result.current.validateForm({
          password: 'password123'
        })
        expect(isValid).toBe(true)
      })

      // Enable confirmation requirement
      requireConfirmation = true
      rerender()

      // Now confirmation is required
      act(() => {
        const isValid = result.current.validateForm({
          password: 'password123'
        })
        expect(isValid).toBe(false)
      })

      expect(result.current.errors).toEqual({
        confirmPassword: 'ConfirmPassword is required'
      })
    })
  })
})