// Removed unused React import
import { render, screen } from '../../../test/testProviders'
import { describe, it, expect } from 'vitest'
import { FormGroup } from '../FormGroup'

describe('FormGroup', () => {
  describe('Basic Rendering', () => {
    it('should render children', () => {
      render(
        <FormGroup>
          <input data-testid="test-input" />
          <button data-testid="test-button">Submit</button>
        </FormGroup>
      )
      
      expect(screen.getByTestId('test-input')).toBeInTheDocument()
      expect(screen.getByTestId('test-button')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(
        <FormGroup className="custom-form-group">
          <input />
        </FormGroup>
      )
      
      const formGroup = container.firstChild
      expect(formGroup).toHaveClass('form-group')
      expect(formGroup).toHaveClass('custom-form-group')
    })

    it('should not show error summary by default', () => {
      render(
        <FormGroup errors={{ field1: 'Error 1' }}>
          <input />
        </FormGroup>
      )
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Error Summary', () => {
    it('should show error summary when showSummary is true and has errors', () => {
      const errors = {
        username: 'Username is required',
        email: 'Email is invalid',
        password: 'Password must be at least 8 characters'
      }
      
      render(
        <FormGroup errors={errors} showSummary>
          <input />
        </FormGroup>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(screen.getByText('Please fix the following errors:')).toBeInTheDocument()
    })

    it('should list all errors in the summary', () => {
      const errors = {
        username: 'Username is required',
        email: 'Email is invalid',
        password: 'Password must be at least 8 characters'
      }
      
      render(
        <FormGroup errors={errors} showSummary>
          <input />
        </FormGroup>
      )
      
      expect(screen.getByText('Username is required')).toBeInTheDocument()
      expect(screen.getByText('Email is invalid')).toBeInTheDocument()
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })

    it('should not show error summary when showSummary is false', () => {
      const errors = {
        username: 'Username is required'
      }
      
      render(
        <FormGroup errors={errors} showSummary={false}>
          <input />
        </FormGroup>
      )
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should not show error summary when there are no errors', () => {
      render(
        <FormGroup errors={{}} showSummary>
          <input />
        </FormGroup>
      )
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should handle undefined errors', () => {
      render(
        <FormGroup showSummary>
          <input />
        </FormGroup>
      )
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Error List Structure', () => {
    it('should render errors as an unordered list', () => {
      const errors = {
        field1: 'Error 1',
        field2: 'Error 2'
      }
      
      render(
        <FormGroup errors={errors} showSummary>
          <input />
        </FormGroup>
      )
      
      const list = screen.getByRole('list')
      expect(list).toHaveClass('form-group-error-list')
      
      const items = screen.getAllByRole('listitem')
      expect(items).toHaveLength(2)
      expect(items[0]).toHaveClass('form-group-error-item')
    })

    it('should use field names as keys for error list items', () => {
      const errors = {
        username: 'Username error',
        email: 'Email error'
      }
      
      render(
        <FormGroup errors={errors} showSummary>
          <input />
        </FormGroup>
      )
      
      const items = container.querySelectorAll('.form-group-error-item')
      expect(items).toHaveLength(2)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA role for error summary', () => {
      render(
        <FormGroup errors={{ field: 'Error' }} showSummary>
          <input />
        </FormGroup>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('form-group-error-summary')
    })

    it('should have descriptive heading for error summary', () => {
      render(
        <FormGroup errors={{ field: 'Error' }} showSummary>
          <input />
        </FormGroup>
      )
      
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('Please fix the following errors:')
      expect(heading).toHaveClass('form-group-error-title')
    })
  })

  describe('Dynamic Updates', () => {
    it('should update error list when errors change', () => {
      const { rerender } = render(
        <FormGroup errors={{ field1: 'Error 1' }} showSummary>
          <input />
        </FormGroup>
      )
      
      expect(screen.getByText('Error 1')).toBeInTheDocument()
      
      rerender(
        <FormGroup 
          errors={{ 
            field1: 'Updated error',
            field2: 'New error' 
          }} 
          showSummary
        >
          <input />
        </FormGroup>
      )
      
      expect(screen.getByText('Updated error')).toBeInTheDocument()
      expect(screen.getByText('New error')).toBeInTheDocument()
    })

    it('should hide error summary when errors are cleared', () => {
      const { rerender } = render(
        <FormGroup errors={{ field1: 'Error 1' }} showSummary>
          <input />
        </FormGroup>
      )
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      
      rerender(
        <FormGroup errors={{}} showSummary>
          <input />
        </FormGroup>
      )
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty errors object', () => {
      render(
        <FormGroup errors={{}} showSummary>
          <input />
        </FormGroup>
      )
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should handle errors with empty string values', () => {
      const errors = {
        field1: '',
        field2: 'Valid error'
      }
      
      render(
        <FormGroup errors={errors} showSummary>
          <input />
        </FormGroup>
      )
      
      const items = screen.getAllByRole('listitem')
      expect(items).toHaveLength(2) // Both errors shown, even empty ones
    })

    it('should handle multiple children of different types', () => {
      render(
        <FormGroup>
          <div data-testid="div">Div content</div>
          <span data-testid="span">Span content</span>
          {null}
          {false}
          <input data-testid="input" />
        </FormGroup>
      )
      
      expect(screen.getByTestId('div')).toBeInTheDocument()
      expect(screen.getByTestId('span')).toBeInTheDocument()
      expect(screen.getByTestId('input')).toBeInTheDocument()
    })

    it('should render with no children', () => {
      render(<FormGroup />)
      
      expect(container.firstChild).toHaveClass('form-group')
    })
  })

  describe('CSS Classes', () => {
    it('should apply all expected CSS classes', () => {
      render(
        <FormGroup errors={{ field: 'Error' }} showSummary className="custom">
          <input />
        </FormGroup>
      )
      
      const formGroup = container.querySelector('.form-group')
      expect(formGroup).toHaveClass('custom')
      
      const errorSummary = container.querySelector('.form-group-error-summary')
      expect(errorSummary).toBeInTheDocument()
      
      const errorTitle = container.querySelector('.form-group-error-title')
      expect(errorTitle).toBeInTheDocument()
      
      const errorList = container.querySelector('.form-group-error-list')
      expect(errorList).toBeInTheDocument()
      
      const errorItem = container.querySelector('.form-group-error-item')
      expect(errorItem).toBeInTheDocument()
    })
  })
})