// Removed unused React import
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test/testProviders'
import { ValidationMessage } from '../ValidationMessage'

describe('ValidationMessage', () => {
  describe('Required validation', () => {
    it('should show default required message', () => {
      render(<ValidationMessage type="required" />)
      
      expect(screen.getByText('Field is required')).toBeInTheDocument()
    })

    it('should show required message with custom field name', () => {
      render(<ValidationMessage type="required" fieldName="Email" />)
      
      expect(screen.getByText('Email is required')).toBeInTheDocument()
    })

    it('should show required message with complex field name', () => {
      render(<ValidationMessage type="required" fieldName="First Name" />)
      
      expect(screen.getByText('First Name is required')).toBeInTheDocument()
    })
  })

  describe('Email validation', () => {
    it('should show email validation message', () => {
      render(<ValidationMessage type="email" />)
      
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })

    it('should ignore fieldName for email validation', () => {
      render(<ValidationMessage type="email" fieldName="Contact" />)
      
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })
  })

  describe('MinLength validation', () => {
    it('should show minLength message with value', () => {
      render(<ValidationMessage type="minLength" minLength={8} />)
      
      expect(screen.getByText('Field must be at least 8 characters')).toBeInTheDocument()
    })

    it('should show minLength message with custom field name', () => {
      render(<ValidationMessage type="minLength" fieldName="Password" minLength={10} />)
      
      expect(screen.getByText('Password must be at least 10 characters')).toBeInTheDocument()
    })

    it('should handle undefined minLength gracefully', () => {
      render(<ValidationMessage type="minLength" />)
      
      expect(screen.getByText('Field must be at least undefined characters')).toBeInTheDocument()
    })
  })

  describe('MaxLength validation', () => {
    it('should show maxLength message with value', () => {
      render(<ValidationMessage type="maxLength" maxLength={50} />)
      
      expect(screen.getByText('Field must be no more than 50 characters')).toBeInTheDocument()
    })

    it('should show maxLength message with custom field name', () => {
      render(<ValidationMessage type="maxLength" fieldName="Bio" maxLength={200} />)
      
      expect(screen.getByText('Bio must be no more than 200 characters')).toBeInTheDocument()
    })

    it('should handle undefined maxLength gracefully', () => {
      render(<ValidationMessage type="maxLength" />)
      
      expect(screen.getByText('Field must be no more than undefined characters')).toBeInTheDocument()
    })
  })

  describe('Pattern validation', () => {
    it('should show pattern validation message', () => {
      render(<ValidationMessage type="pattern" />)
      
      expect(screen.getByText('Field format is invalid')).toBeInTheDocument()
    })

    it('should show pattern message with custom field name', () => {
      render(<ValidationMessage type="pattern" fieldName="Phone Number" />)
      
      expect(screen.getByText('Phone Number format is invalid')).toBeInTheDocument()
    })
  })

  describe('Custom validation', () => {
    it('should show custom message when provided', () => {
      render(<ValidationMessage type="custom" message="This username is already taken" />)
      
      expect(screen.getByText('This username is already taken')).toBeInTheDocument()
    })

    it('should show default message when custom message not provided', () => {
      render(<ValidationMessage type="custom" />)
      
      expect(screen.getByText('Invalid value')).toBeInTheDocument()
    })

    it('should ignore fieldName for custom validation', () => {
      render(<ValidationMessage type="custom" fieldName="Username" message="Custom error" />)
      
      expect(screen.getByText('Custom error')).toBeInTheDocument()
    })

    it('should handle empty custom message', () => {
      render(<ValidationMessage type="custom" message="" />)
      
      expect(screen.getByText('Invalid value')).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('should apply validation-message class', () => {
      render(<ValidationMessage type="required" />)
      
      const message = screen.getByText('Field is required')
      expect(message).toHaveClass('validation-message')
    })

    it('should maintain consistent class across all types', () => {
      const types = ['required', 'email', 'minLength', 'maxLength', 'pattern', 'custom'] as const
      
      types.forEach(type => {
        render(
          <ValidationMessage 
            type={type} 
            minLength={5} 
            maxLength={10} 
            message="Test" 
          />
        )
        
        const span = container.querySelector('span')
        expect(span).toHaveClass('validation-message')
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle very long field names', () => {
      const longFieldName = 'This is a very long field name that might break layouts'
      render(<ValidationMessage type="required" fieldName={longFieldName} />)
      
      expect(screen.getByText(`${longFieldName} is required`)).toBeInTheDocument()
    })

    it('should handle special characters in field names', () => {
      render(<ValidationMessage type="required" fieldName="User's Email" />)
      
      expect(screen.getByText("User's Email is required")).toBeInTheDocument()
    })

    it('should handle numbers as length values', () => {
      render(<ValidationMessage type="minLength" minLength={0} />)
      
      expect(screen.getByText('Field must be at least 0 characters')).toBeInTheDocument()
    })

    it('should handle large numbers for length validation', () => {
      render(<ValidationMessage type="maxLength" maxLength={999999} />)
      
      expect(screen.getByText('Field must be no more than 999999 characters')).toBeInTheDocument()
    })

    it('should handle multiple validation messages independently', () => {
      render(
        <>
          <ValidationMessage type="required" fieldName="Name" />
          <ValidationMessage type="email" />
          <ValidationMessage type="custom" message="Custom error" />
        </>
      )
      
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      expect(screen.getByText('Custom error')).toBeInTheDocument()
    })
  })

  describe('Dynamic updates', () => {
    it('should update message when type changes', () => {
      const { rerender } = render(<ValidationMessage type="required" />)
      
      expect(screen.getByText('Field is required')).toBeInTheDocument()
      
      rerender(<ValidationMessage type="email" />)
      
      expect(screen.queryByText('Field is required')).not.toBeInTheDocument()
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })

    it('should update message when fieldName changes', () => {
      const { rerender } = render(<ValidationMessage type="required" fieldName="Name" />)
      
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      
      rerender(<ValidationMessage type="required" fieldName="Email" />)
      
      expect(screen.getByText('Email is required')).toBeInTheDocument()
    })

    it('should update custom message dynamically', () => {
      const { rerender } = render(<ValidationMessage type="custom" message="Error 1" />)
      
      expect(screen.getByText('Error 1')).toBeInTheDocument()
      
      rerender(<ValidationMessage type="custom" message="Error 2" />)
      
      expect(screen.getByText('Error 2')).toBeInTheDocument()
    })
  })
})