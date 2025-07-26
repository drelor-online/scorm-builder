import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormField } from '../FormField'

describe('FormField', () => {
  describe('Basic rendering', () => {
    it('should render with label and input', () => {
      render(<FormField label="Email" name="email" />)
      
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should show required asterisk when required', () => {
      render(<FormField label="Email" name="email" required />)
      
      expect(screen.getByLabelText('required')).toHaveTextContent('*')
    })

    it('should render help text when provided', () => {
      render(
        <FormField 
          label="Email" 
          name="email" 
          helpText="Enter your email address" 
        />
      )
      
      expect(screen.getByText('Enter your email address')).toBeInTheDocument()
    })

    it('should use custom id when provided', () => {
      render(<FormField label="Email" name="email" id="custom-email" />)
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveAttribute('id', 'custom-email')
    })

    it('should generate unique id when not provided', () => {
      const { container } = render(
        <>
          <FormField label="Email 1" name="email1" />
          <FormField label="Email 2" name="email2" />
        </>
      )
      
      const inputs = container.querySelectorAll('input')
      expect(inputs[0].id).not.toBe(inputs[1].id)
    })
  })

  describe('Error handling', () => {
    it('should not show error initially even if provided', () => {
      render(<FormField label="Email" name="email" error="Invalid email" />)
      
      expect(screen.queryByText('Invalid email')).not.toBeInTheDocument()
    })

    it('should show error after field is touched', () => {
      render(<FormField label="Email" name="email" error="Invalid email" touched />)
      
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should show error after blur', async () => {
      render(<FormField label="Email" name="email" error="Invalid email" />)
      
      const input = screen.getByLabelText('Email')
      
      fireEvent.focus(input)
      fireEvent.blur(input)
      
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
    })

    it('should hide help text when error is shown', () => {
      render(
        <FormField 
          label="Email" 
          name="email" 
          error="Invalid email"
          helpText="Enter your email"
          touched
        />
      )
      
      expect(screen.queryByText('Enter your email')).not.toBeInTheDocument()
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
    })

    it('should set aria-invalid when error is shown', () => {
      render(<FormField label="Email" name="email" error="Invalid email" touched />)
      
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    })

    it('should set aria-describedby for error message', () => {
      render(<FormField label="Email" name="email" error="Invalid email" touched />)
      
      const input = screen.getByLabelText('Email')
      const errorId = input.getAttribute('aria-describedby')
      
      expect(errorId).toBeTruthy()
      expect(document.getElementById(errorId!)).toHaveTextContent('Invalid email')
    })
  })

  describe('Success state', () => {
    it('should show success indicator when success and touched', () => {
      render(<FormField label="Email" name="email" success touched />)
      
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('should not show success if there is an error', () => {
      render(
        <FormField 
          label="Email" 
          name="email" 
          success 
          error="Invalid email"
          touched
        />
      )
      
      expect(screen.queryByText('✓')).not.toBeInTheDocument()
    })

    it('should apply success styling', () => {
      render(<FormField label="Email" name="email" success touched />)
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveClass('input-success')
    })
  })

  describe('Validation', () => {
    it('should call onValidate on blur when validationMode is onBlur', () => {
      const onValidate = vi.fn()
      render(
        <FormField 
          label="Email" 
          name="email" 
          onValidate={onValidate}
          validationMode="onBlur"
        />
      )
      
      const input = screen.getByLabelText('Email')
      fireEvent.change(input, { target: { value: 'test@example.com' } })
      fireEvent.blur(input)
      
      expect(onValidate).toHaveBeenCalledWith('test@example.com')
    })

    it('should call onValidate on change when validationMode is onChange', () => {
      const onValidate = vi.fn()
      render(
        <FormField 
          label="Email" 
          name="email" 
          onValidate={onValidate}
          validationMode="onChange"
        />
      )
      
      const input = screen.getByLabelText('Email')
      fireEvent.change(input, { target: { value: 'test@example.com' } })
      
      expect(onValidate).toHaveBeenCalledWith('test@example.com')
    })

    it('should not call onValidate if not provided', () => {
      const onChange = vi.fn()
      const onBlur = vi.fn()
      
      render(
        <FormField 
          label="Email" 
          name="email" 
          onChange={onChange}
          onBlur={onBlur}
        />
      )
      
      const input = screen.getByLabelText('Email')
      fireEvent.change(input, { target: { value: 'test' } })
      fireEvent.blur(input)
      
      expect(onChange).toHaveBeenCalled()
      expect(onBlur).toHaveBeenCalled()
    })
  })

  describe('Event handlers', () => {
    it('should call onChange handler', () => {
      const onChange = vi.fn()
      render(<FormField label="Email" name="email" onChange={onChange} />)
      
      const input = screen.getByLabelText('Email')
      fireEvent.change(input, { target: { value: 'test@example.com' } })
      
      expect(onChange).toHaveBeenCalled()
    })

    it('should call onBlur handler', () => {
      const onBlur = vi.fn()
      render(<FormField label="Email" name="email" onBlur={onBlur} />)
      
      const input = screen.getByLabelText('Email')
      fireEvent.blur(input)
      
      expect(onBlur).toHaveBeenCalled()
    })

    it('should update touched state on blur', () => {
      const { rerender } = render(<FormField label="Email" name="email" error="Required" />)
      
      expect(screen.queryByText('Required')).not.toBeInTheDocument()
      
      const input = screen.getByLabelText('Email')
      fireEvent.blur(input)
      
      expect(screen.getByText('Required')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should associate label with input', () => {
      render(<FormField label="Email Address" name="email" />)
      
      const input = screen.getByLabelText('Email Address')
      expect(input).toHaveAttribute('name', 'email')
    })

    it('should have proper ARIA attributes for errors', () => {
      render(<FormField label="Email" name="email" error="Invalid email" touched />)
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      
      const describedBy = input.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      expect(document.getElementById(describedBy!)).toHaveTextContent('Invalid email')
    })

    it('should have aria-describedby for help text', () => {
      render(<FormField label="Email" name="email" helpText="Enter your email" />)
      
      const input = screen.getByLabelText('Email')
      const describedBy = input.getAttribute('aria-describedby')
      
      expect(describedBy).toBeTruthy()
      expect(document.getElementById(describedBy!)).toHaveTextContent('Enter your email')
    })

    it('should use aria-live for error messages', () => {
      render(<FormField label="Email" name="email" error="Invalid email" touched />)
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Styling', () => {
    it('should apply custom className', () => {
      render(<FormField label="Email" name="email" className="custom-input" />)
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveClass('custom-input')
    })

    it('should apply error styling when showing error', () => {
      render(<FormField label="Email" name="email" error="Invalid" touched />)
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveClass('input-error')
    })

    it('should combine multiple classes correctly', () => {
      render(
        <FormField 
          label="Email" 
          name="email" 
          error="Invalid"
          touched
          className="custom-class"
        />
      )
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveClass('input-error', 'custom-class')
    })
  })

  describe('Props forwarding', () => {
    it('should forward additional props to Input', () => {
      render(
        <FormField 
          label="Email" 
          name="email" 
          placeholder="email@example.com"
          type="email"
          autoComplete="email"
        />
      )
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveAttribute('placeholder', 'email@example.com')
      expect(input).toHaveAttribute('type', 'email')
      expect(input).toHaveAttribute('autoComplete', 'email')
    })

    it('should maintain controlled component behavior', () => {
      const Component = () => {
        const [value, setValue] = React.useState('')
        return (
          <FormField 
            label="Email" 
            name="email" 
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )
      }
      
      render(<Component />)
      
      const input = screen.getByLabelText('Email')
      expect(input).toHaveValue('')
      
      fireEvent.change(input, { target: { value: 'test@example.com' } })
      expect(input).toHaveValue('test@example.com')
    })
  })

  describe('Edge cases', () => {
    it('should handle touched prop updates', () => {
      const { rerender } = render(
        <FormField label="Email" name="email" error="Required" touched={false} />
      )
      
      expect(screen.queryByText('Required')).not.toBeInTheDocument()
      
      rerender(<FormField label="Email" name="email" error="Required" touched={true} />)
      
      expect(screen.getByText('Required')).toBeInTheDocument()
    })

    it('should handle empty error string', () => {
      render(<FormField label="Email" name="email" error="" touched />)
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should handle validation without error prop', () => {
      const onValidate = vi.fn()
      render(
        <FormField 
          label="Email" 
          name="email" 
          onValidate={onValidate}
          validationMode="onChange"
        />
      )
      
      const input = screen.getByLabelText('Email')
      fireEvent.change(input, { target: { value: 'test' } })
      
      expect(onValidate).toHaveBeenCalledWith('test')
    })
  })
})