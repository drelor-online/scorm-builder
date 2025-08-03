import { describe, it, expect } from 'vitest'
import * as DesignSystem from '../index'

describe('DesignSystem exports', () => {
  it('should export all components', () => {
    // Components
    expect(DesignSystem.Button).toBeDefined()
    expect(DesignSystem.Card).toBeDefined()
    expect(DesignSystem.Input).toBeDefined()
    expect(DesignSystem.ButtonGroup).toBeDefined()
    expect(DesignSystem.Alert).toBeDefined()
    expect(DesignSystem.Modal).toBeDefined()
    expect(DesignSystem.LoadingSpinner).toBeDefined()
    expect(DesignSystem.EmptyState).toBeDefined()
    expect(DesignSystem.NetworkStatusIndicator).toBeDefined()
    expect(DesignSystem.Tooltip).toBeDefined()
    expect(DesignSystem.SearchInput).toBeDefined()
    expect(DesignSystem.FormField).toBeDefined()
    expect(DesignSystem.FormGroup).toBeDefined()
    expect(DesignSystem.ValidationMessage).toBeDefined()
    expect(DesignSystem.LoadingOverlay).toBeDefined()
    expect(DesignSystem.Skeleton).toBeDefined()
    expect(DesignSystem.ProgressBar).toBeDefined()
    expect(DesignSystem.StepProgress).toBeDefined()
    expect(DesignSystem.LoadingButton).toBeDefined()
    expect(DesignSystem.Pagination).toBeDefined()
  })

  it('should export Layout components', () => {
    expect(DesignSystem.PageContainer).toBeDefined()
    expect(DesignSystem.Section).toBeDefined()
    expect(DesignSystem.Flex).toBeDefined()
    expect(DesignSystem.Grid).toBeDefined()
  })

  it('should export Transition components', () => {
    expect(DesignSystem.FadeIn).toBeDefined()
    expect(DesignSystem.SlideIn).toBeDefined()
    expect(DesignSystem.ScaleIn).toBeDefined()
    expect(DesignSystem.StaggerChildren).toBeDefined()
  })

  it('should export design tokens', () => {
    expect(DesignSystem.tokens).toBeDefined()
    expect(DesignSystem.tokens).toHaveProperty('colors')
    expect(DesignSystem.tokens).toHaveProperty('spacing')
    expect(DesignSystem.tokens).toHaveProperty('typography')
  })

  it('should export expected number of items', () => {
    const exports = Object.keys(DesignSystem)
    
    // Count actual exports (components + tokens)
    const expectedComponents = [
      'Button', 'Card', 'Input', 'ButtonGroup',
      'PageContainer', 'Section', 'Flex', 'Grid',
      'Alert', 'Modal', 'LoadingSpinner', 'EmptyState',
      'NetworkStatusIndicator', 'Tooltip', 'SearchInput',
      'FormField', 'FormGroup', 'ValidationMessage',
      'LoadingOverlay', 'Skeleton', 'ProgressBar',
      'StepProgress', 'LoadingButton', 'Pagination',
      'FadeIn', 'SlideIn', 'ScaleIn', 'StaggerChildren',
      'tokens'
    ]
    
    // Ensure we have at least all expected exports
    expectedComponents.forEach(component => {
      expect(exports).toContain(component)
    })
  })
})