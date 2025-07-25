import { useState, useCallback } from 'react'

interface ValidationRule {
  required?: boolean
  pattern?: RegExp
  minLength?: number
  maxLength?: number
  custom?: (value: any) => string | undefined
}

interface ValidationRules {
  [field: string]: ValidationRule
}

export const useFormValidation = (rules: ValidationRules) => {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback((field: string, value: any): string | undefined => {
    const rule = rules[field]
    if (!rule) return undefined

    if (rule.required && !value) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`
    }

    if (rule.pattern && value && !rule.pattern.test(value)) {
      if (field === 'email') {
        return 'Please enter a valid email address'
      }
      return `${field.charAt(0).toUpperCase() + field.slice(1)} format is invalid`
    }

    if (rule.minLength && value && value.length < rule.minLength) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} must be at least ${rule.minLength} characters`
    }

    if (rule.maxLength && value && value.length > rule.maxLength) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} must be no more than ${rule.maxLength} characters`
    }

    if (rule.custom) {
      return rule.custom(value)
    }

    return undefined
  }, [rules])

  const validateForm = useCallback((values: Record<string, any>) => {
    const newErrors: Record<string, string> = {}
    
    Object.keys(rules).forEach(field => {
      const error = validateField(field, values[field])
      if (error) {
        newErrors[field] = error
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [rules, validateField])

  const setFieldTouched = useCallback((field: string, isTouched: boolean = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }))
  }, [])

  const setFieldError = useCallback((field: string, error: string | undefined) => {
    setErrors(prev => {
      if (error) {
        return { ...prev, [field]: error }
      } else {
        const { [field]: _, ...rest } = prev
        return rest
      }
    })
  }, [])

  const isValid = Object.keys(errors).length === 0

  return {
    errors,
    touched,
    isValid,
    validateField,
    validateForm,
    setFieldTouched,
    setFieldError
  }
}