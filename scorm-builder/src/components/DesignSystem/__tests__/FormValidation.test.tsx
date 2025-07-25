import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormField } from '../FormField'
import { FormGroup } from '../FormGroup'
import { ValidationMessage } from '../ValidationMessage'
import { useFormValidation } from '../../../hooks/useFormValidation'
import { renderHook, act } from '@testing-library/react'

describe('Form Validation - User Intent Tests', () => {
  describe('User expects clear validation feedback', () => {
    it('should show validation error when field is invalid', async () => {
      const user = userEvent.setup()
      render(
        <FormField
          label="Email"
          type="email"
          value=""
          error="Please enter a valid email"
          touched={true}
        />
      )
      
      // Error message should be visible
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument()
      
      // Field should have error styling
      const input = screen.getByLabelText('Email')
      expect(input).toHaveClass('input-error')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should show success state when field is valid', () => {
      render(
        <FormField
          label="Email"
          type="email"
          value="user@example.com"
          success={true}
          touched={true}
        />
      )
      
      // Field should have success styling
      const input = screen.getByLabelText('Email')
      expect(input).toHaveClass('input-success')
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })

    it('should not show validation state until field is touched', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <FormField
          label="Email"
          type="email"
          value=""
          error="Please enter a valid email"
          touched={false}
        />
      )
      
      // Error should not be visible initially
      expect(screen.queryByText('Please enter a valid email')).not.toBeInTheDocument()
      
      // After touching the field
      rerender(
        <FormField
          label="Email"
          type="email"
          value=""
          error="Please enter a valid email"
          touched={true}
        />
      )
      
      // Error should now be visible
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument()
    })
  })

  describe('User expects helpful error messages', () => {
    it('should provide specific validation messages for different error types', () => {
      const { rerender } = render(
        <ValidationMessage
          type="required"
          fieldName="Email"
        />
      )
      
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      
      rerender(
        <ValidationMessage
          type="email"
          fieldName="Email"
        />
      )
      
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      
      rerender(
        <ValidationMessage
          type="minLength"
          fieldName="Password"
          minLength={8}
        />
      )
      
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })

    it('should support custom error messages', () => {
      render(
        <ValidationMessage
          type="custom"
          message="This username is already taken"
        />
      )
      
      expect(screen.getByText('This username is already taken')).toBeInTheDocument()
    })
  })

  describe('User expects live validation feedback', () => {
    it('should validate on blur by default', async () => {
      const user = userEvent.setup()
      const onValidate = vi.fn()
      
      const TestComponent = () => {
        const [value, setValue] = React.useState('')
        return (
          <FormField
            label="Email"
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onValidate={onValidate}
          />
        )
      }
      
      render(<TestComponent />)
      
      const input = screen.getByLabelText('Email')
      
      // Type invalid email
      await user.type(input, 'invalid')
      
      // Validation should not run yet
      expect(onValidate).not.toHaveBeenCalled()
      
      // Blur the field
      await user.tab()
      
      // Validation should run
      expect(onValidate).toHaveBeenCalledWith('invalid')
    })

    it('should support realtime validation mode', async () => {
      const user = userEvent.setup()
      const onValidate = vi.fn()
      
      render(
        <FormField
          label="Email"
          type="email"
          value=""
          onValidate={onValidate}
          validationMode="onChange"
        />
      )
      
      const input = screen.getByLabelText('Email')
      
      // Type each character
      await user.type(input, 'test')
      
      // Validation should run for each character
      expect(onValidate).toHaveBeenCalledTimes(4)
    })
  })

  describe('User expects form-level validation', () => {
    it('should validate all fields before submission', async () => {
      const { result } = renderHook(() => useFormValidation({
        email: {
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        },
        password: {
          required: true,
          minLength: 8
        }
      }))
      
      // Try to validate empty form
      act(() => {
        result.current.validateForm({
          email: '',
          password: ''
        })
      })
      
      // Should have errors for both fields
      expect(result.current.errors).toEqual({
        email: 'Email is required',
        password: 'Password is required'
      })
      expect(result.current.isValid).toBe(false)
    })

    it('should show summary of all errors', () => {
      render(
        <FormGroup
          errors={{
            email: 'Email is required',
            password: 'Password must be at least 8 characters',
            username: 'Username is already taken'
          }}
          showSummary={true}
        >
          <div>Form fields here</div>
        </FormGroup>
      )
      
      // Should show error summary
      expect(screen.getByText('Please fix the following errors:')).toBeInTheDocument()
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      expect(screen.getByText('Username is already taken')).toBeInTheDocument()
    })
  })

  describe('User expects accessible validation', () => {
    it('should announce errors to screen readers', async () => {
      const { rerender } = render(
        <FormField
          label="Email"
          type="email"
          value=""
          error=""
          touched={true}
        />
      )
      
      // Add error
      rerender(
        <FormField
          label="Email"
          type="email"
          value=""
          error="Email is required"
          touched={true}
        />
      )
      
      // Error should be in live region
      const liveRegion = screen.getByRole('alert')
      expect(liveRegion).toHaveTextContent('Email is required')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('should link error messages to form fields', () => {
      render(
        <FormField
          label="Email"
          type="email"
          value=""
          error="Email is required"
          touched={true}
          id="email-field"
        />
      )
      
      const input = screen.getByLabelText('Email')
      const errorId = input.getAttribute('aria-describedby')
      
      expect(errorId).toBeTruthy()
      const errorElement = document.getElementById(errorId!)
      expect(errorElement).toHaveTextContent('Email is required')
    })
  })
})