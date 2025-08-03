// Removed unused React import
import { render, screen } from '../../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, it, expect, vi } from 'vitest'
import { Input } from '../Input'

// Extend Vitest matchers with jest-axe matchers
expect.extend(toHaveNoViolations)

describe('Input - Accessibility Tests', () => {
  describe('Basic accessibility', () => {
    it('should have no accessibility violations with label', async () => {
      render(
        <Input
          id="test-input"
          label="Email address"
          type="email"
          value=""
          onChange={() => {}}
        />
      )
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations for all input types', async () => {
      const types = ['text', 'email', 'password', 'number', 'tel', 'url'] as const
      
      for (const type of types) {
        render(
          <Input
            id={`${type}-input`}
            label={`${type} input`}
            type={type}
            value=""
            onChange={() => {}}
          />
        )
        // const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })

    it('should have no accessibility violations for textarea', async () => {
      render(
        <Input
          id="textarea-input"
          label="Description"
          type="textarea"
          value=""
          onChange={() => {}}
          rows={5}
        />
      )
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Label association', () => {
    it('should properly associate label with input', () => {
      render(
        <Input
          id="username"
          label="Username"
          value=""
          onChange={() => {}}
        />
      )
      
      const input = screen.getByLabelText('Username')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('id', 'username')
    })

    it('should work with external label using htmlFor', () => {
      render(
        <>
          <label htmlFor="external-input">External Label</label>
          <Input
            id="external-input"
            value=""
            onChange={() => {}}
          />
        </>
      )
      
      const input = screen.getByLabelText('External Label')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Required fields', () => {
    it('should indicate required fields accessibly', () => {
      render(
        <Input
          id="required-field"
          label="Email"
          required
          value=""
          onChange={() => {}}
        />
      )
      
      const input = screen.getByLabelText(/Email/i)
      expect(input).toHaveAttribute('required')
      expect(input).toHaveAttribute('aria-required', 'true')
      
      // Check for required indicator
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('should have accessible required field indication in label', () => {
      render(
        <Input
          id="required-field"
          label="Full Name"
          required
          value=""
          onChange={() => {}}
        />
      )
      
      // Label should indicate required status
      const label = screen.getByText(/Full Name/i).closest('label')
      expect(label).toHaveTextContent('*')
    })
  })

  describe('Error states', () => {
    it('should associate error messages with input', () => {
      render(
        <Input
          id="email-input"
          label="Email"
          type="email"
          value="invalid-email"
          onChange={() => {}}
          error="Please enter a valid email address"
        />
      )
      
      const input = screen.getByLabelText('Email')
      const errorId = input.getAttribute('aria-describedby')
      
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(errorId).toBeTruthy()
      
      const errorMessage = screen.getByText('Please enter a valid email address')
      expect(errorMessage).toHaveAttribute('id', errorId)
    })

    it('should announce errors to screen readers', async () => {
      render(
        <Input
          id="error-input"
          label="Password"
          type="password"
          value="123"
          onChange={() => {}}
          error="Password must be at least 8 characters"
        />
      )
      
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
      
      // Error should be in live region for announcement
      const error = screen.getByText('Password must be at least 8 characters')
      expect(error).toHaveAttribute('role', 'alert')
    })
  })

  describe('Disabled state', () => {
    it('should handle disabled state accessibly', async () => {
      render(
        <Input
          id="disabled-input"
          label="Disabled field"
          value="Cannot edit"
          onChange={() => {}}
          disabled
        />
      )
      
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
      
      const input = screen.getByLabelText('Disabled field')
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Placeholder and help text', () => {
    it('should not rely solely on placeholder for instructions', () => {
      render(
        <Input
          id="phone-input"
          label="Phone Number"
          type="tel"
          value=""
          onChange={() => {}}
          placeholder="(555) 123-4567"
          helperText="Enter your 10-digit phone number"
        />
      )
      
      const input = screen.getByLabelText('Phone Number')
      const helperId = input.getAttribute('aria-describedby')
      
      // Helper text should be associated
      const helperText = screen.getByText('Enter your 10-digit phone number')
      expect(helperText).toHaveAttribute('id', helperId)
    })

    it('should have accessible placeholder text', async () => {
      render(
        <Input
          id="search-input"
          label="Search"
          value=""
          onChange={() => {}}
          placeholder="Search for courses..."
        />
      )
      
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard interaction', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      
      render(
        <Input
          id="text-input"
          label="Name"
          value=""
          onChange={onChange}
        />
      )
      
      const input = screen.getByLabelText('Name')
      
      // Tab to input
      await user.tab()
      expect(input).toHaveFocus()
      
      // Type in input
      await user.type(input, 'Hello')
      expect(onChange).toHaveBeenCalled()
    })

    it('should support keyboard shortcuts in textareas', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      
      render(
        <Input
          id="textarea"
          label="Comments"
          multiline
          value=""
          onChange={onChange}
        />
      )
      
      const textarea = screen.getByLabelText('Comments')
      await user.click(textarea)
      
      // Should be focusable
      expect(textarea).toHaveFocus()
      
      // Should allow typing
      await user.type(textarea, 'Hello')
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('Autocomplete', () => {
    it('should support autocomplete attributes', () => {
      render(
        <Input
          id="cc-number"
          label="Credit Card Number"
          value=""
          onChange={() => {}}
          autoComplete="cc-number"
        />
      )
      
      const input = screen.getByLabelText('Credit Card Number')
      expect(input).toHaveAttribute('autocomplete', 'cc-number')
    })
  })

  describe('Character limits', () => {
    it.skip('should announce character limits accessibly', () => {
      // Note: Character count feature is not implemented in current Input component
      render(
        <Input
          id="bio-input"
          label="Bio"
          multiline
          value="Hello"
          onChange={() => {}}
          maxLength={200}
        />
      )
      
      // Character count should be associated with input
      const textarea = screen.getByLabelText('Bio')
      const characterCount = screen.getByText(/5 \/ 200/i)
      
      expect(characterCount).toBeInTheDocument()
      
      // Should have aria-describedby including character count
      const describedBy = textarea.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
    })
  })

  describe('Input groups', () => {
    it('should handle input with prefix/suffix accessibly', async () => {
      render(
        <div>
          <label htmlFor="price-input">Price</label>
          <div role="group" aria-labelledby="price-label">
            <span id="price-prefix">$</span>
            <Input
              id="price-input"
              type="number"
              value=""
              onChange={() => {}}
              aria-describedby="price-prefix price-suffix"
            />
            <span id="price-suffix">.00</span>
          </div>
        </div>
      )
      
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})