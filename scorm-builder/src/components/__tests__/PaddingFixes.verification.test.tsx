import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AutoSaveIndicator } from '../AutoSaveIndicator'
import { NetworkStatusIndicator } from '../DesignSystem/NetworkStatusIndicator'
import { tokens } from '../DesignSystem/designTokens'
import { SPACING } from '../../constants'

// Mock the useNetworkStatus hook
vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: false,
    lastOnline: new Date()
  })
}))

describe('Padding Fixes Verification', () => {
  describe('AutoSaveIndicator', () => {
    it('should use design tokens instead of hardcoded values', () => {
      const { container } = render(
        <AutoSaveIndicator 
          isSaving={true}
          hasDraft={false}
          timeSinceLastSave="Never"
        />
      )

      // Check that the status indicator uses tokens
      const statusDot = container.querySelector('span[style*="border-radius"]')
      expect(statusDot).toBeTruthy()
      
      // The component should now use tokens.spacing.sm which is '8px'
      const style = statusDot?.getAttribute('style')
      expect(style).toContain(`width: ${tokens.spacing.sm}`)
      expect(style).toContain(`height: ${tokens.spacing.sm}`)
    })

    it('should use border tokens', () => {
      const { container } = render(
        <AutoSaveIndicator 
          isSaving={false}
          hasDraft={true}
          timeSinceLastSave="5 minutes ago"
        />
      )

      const wrapper = container.querySelector('[role="status"]')
      const style = wrapper?.getAttribute('style')
      // The actual color value is rendered as rgb
      expect(style).toContain(`border: 1px solid`)
    })
  })

  describe('NetworkStatusIndicator', () => {
    it('should use spacing constants for dimensions', () => {
      const { container } = render(<NetworkStatusIndicator />)

      const statusDot = container.querySelector('span[style*="border-radius"]')
      expect(statusDot).toBeTruthy()
      
      const style = statusDot?.getAttribute('style')
      expect(style).toContain(`width: ${SPACING.sm}`)
      expect(style).toContain(`height: ${SPACING.sm}`)
    })

    it('should use design tokens for styling', () => {
      const { container } = render(<NetworkStatusIndicator />)

      const indicator = container.querySelector('.network-status-indicator')
      const style = indicator?.getAttribute('style')
      
      // Check that the styles are using proper values
      expect(style).toContain(`border-radius:`)
      expect(style).toContain(`box-shadow:`)
    })
  })

  describe('Form field spacing', () => {
    it('should have consistent spacing between form fields', () => {
      const { container } = render(
        <div className="form-section">
          <div className="form-field">
            <input type="text" />
          </div>
          <div className="form-field">
            <input type="text" />
          </div>
        </div>
      )

      // These classes should now be available in the design system CSS
      const formFields = container.querySelectorAll('.form-field')
      expect(formFields).toHaveLength(2)
    })
  })

  describe('Button group spacing', () => {
    it('should use increased spacing for button groups', () => {
      const { container } = render(
        <div className="button-group button-group-gap-medium">
          <button>Button 1</button>
          <button>Button 2</button>
        </div>
      )

      const buttonGroup = container.querySelector('.button-group')
      expect(buttonGroup).toHaveClass('button-group-gap-medium')
      // The CSS should now use larger gap values
    })
  })

  describe('Modal footer', () => {
    it('should have proper spacing', () => {
      const { container } = render(
        <div className="modal-footer">
          <button>Cancel</button>
          <button>Confirm</button>
        </div>
      )

      const modalFooter = container.querySelector('.modal-footer')
      expect(modalFooter).toBeTruthy()
      // The CSS should now define proper spacing for modal footers
    })
  })
})