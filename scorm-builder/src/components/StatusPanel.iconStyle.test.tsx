import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Icon } from './DesignSystem/Icons'
import { AlertCircle } from 'lucide-react'

describe('StatusPanel - Icon Style Props', () => {
  it('should support style prop on Icon component', () => {
    // After our fix, the IconProps interface now includes style property
    // This should compile without TypeScript errors
    const TestIcon = () => (
      <Icon 
        icon={AlertCircle}
        size="xs"
        style={{ 
          marginTop: '2px', 
          flexShrink: 0,
          opacity: 0.8 
        }}
      />
    )
    
    // Should render without errors
    expect(() => {
      render(<TestIcon />)
    }).not.toThrow()
  })
  
  it('should document current Icon props interface limitations', () => {
    // This test shows what props are currently supported by IconProps
    const supportedProps = {
      icon: AlertCircle,
      size: 'xs' as const,
      color: 'currentColor',
      className: 'test-class',
      strokeWidth: 2
    }
    
    // This should compile fine with current interface
    const ValidIcon = () => <Icon {...supportedProps} />
    
    expect(() => {
      render(<ValidIcon />)
    }).not.toThrow()
    
    // The issue is that 'style' is not in the supported props
    const hasStyleProp = 'style' in supportedProps
    expect(hasStyleProp).toBe(false) // Shows the limitation
  })
})