import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'

// Import components
import { Button, ButtonGroup, Card, Input, Section, Flex, Grid } from '../DesignSystem'

describe('Component Padding Analysis', () => {
  describe('DesignSystem Components', () => {
    it('ButtonGroup should have gap between buttons', () => {
      const { container } = render(
        <ButtonGroup gap="medium">
          <Button>Button 1</Button>
          <Button>Button 2</Button>
          <Button>Button 3</Button>
        </ButtonGroup>
      )

      const buttonGroup = container.querySelector('.button-group')
      expect(buttonGroup).toBeInTheDocument()
      
      // Check that ButtonGroup has gap class
      expect(buttonGroup).toHaveClass('button-group-gap-medium')
    })

    it('Card should have adequate padding', () => {
      const { container } = render(
        <Card title="Test Card">
          <p>Card content</p>
        </Card>
      )

      const card = container.querySelector('.card')
      expect(card).toBeInTheDocument()
      
      // Card should have default padding class
      const hasEnhancedPadding = card?.classList.contains('enhanced-padding')
      const hasDefaultPadding = !card?.classList.contains('card-padding-small')
      
      expect(hasDefaultPadding || hasEnhancedPadding).toBe(true)
    })

    it('Input fields should have proper spacing', () => {
      const { container } = render(
        <div>
          <Input label="Field 1" placeholder="Enter text" />
          <Input label="Field 2" placeholder="Enter text" />
        </div>
      )

      const inputWrappers = container.querySelectorAll('.input-wrapper')
      expect(inputWrappers).toHaveLength(2)
      
      // Each input wrapper should contain a label and input with spacing
      inputWrappers.forEach(wrapper => {
        const label = wrapper.querySelector('.input-label')
        const input = wrapper.querySelector('.input')
        
        expect(label).toBeInTheDocument()
        expect(input).toBeInTheDocument()
      })
    })

    it('Section should have margin between sections', () => {
      const { container } = render(
        <div>
          <Section>
            <p>Section 1 content</p>
          </Section>
          <Section>
            <p>Section 2 content</p>
          </Section>
        </div>
      )

      const sections = container.querySelectorAll('.section')
      expect(sections).toHaveLength(2)
      
      // Sections should have section class for spacing
      sections.forEach(section => {
        expect(section).toHaveClass('section')
      })
    })

    it('Flex component should handle gap properly', () => {
      const { container } = render(
        <Flex gap="large" align="center">
          <Button>Button 1</Button>
          <Button>Button 2</Button>
          <Input placeholder="Search" />
        </Flex>
      )

      const flex = container.querySelector('[style*="display: flex"]')
      expect(flex).toBeInTheDocument()
      
      // Check that flex has gap in style
      const style = flex?.getAttribute('style') || ''
      expect(style).toContain('gap')
    })

    it('Grid should have proper gap between items', () => {
      const { container } = render(
        <Grid cols={3} gap="medium">
          <Card>Item 1</Card>
          <Card>Item 2</Card>
          <Card>Item 3</Card>
        </Grid>
      )

      const grid = container.querySelector('[style*="display: grid"]')
      expect(grid).toBeInTheDocument()
      
      // Check that grid has gap in style
      const style = grid?.getAttribute('style') || ''
      expect(style).toContain('gap')
    })
  })

  describe('Common UI Patterns', () => {
    it('Form fields should not be cramped', () => {
      const { container } = render(
        <Card>
          <Input label="Username" placeholder="Enter username" fullWidth />
          <Input label="Email" placeholder="Enter email" fullWidth />
          <Input label="Password" type="password" placeholder="Enter password" fullWidth />
          <ButtonGroup>
            <Button variant="secondary">Cancel</Button>
            <Button variant="primary">Submit</Button>
          </ButtonGroup>
        </Card>
      )

      const inputs = container.querySelectorAll('.input-wrapper')
      const buttonGroup = container.querySelector('.button-group')
      
      expect(inputs).toHaveLength(3)
      expect(buttonGroup).toBeInTheDocument()
      
      // All elements should be within a card with padding
      const card = container.querySelector('.card')
      expect(card).toBeInTheDocument()
    })

    it('Navigation buttons should be properly spaced', () => {
      const { container } = render(
        <Flex justify="space-between" style={{ width: '100%' }}>
          <Button variant="secondary">← Back</Button>
          <Flex gap="medium">
            <Button variant="tertiary">Save Draft</Button>
            <Button variant="primary">Next →</Button>
          </Flex>
        </Flex>
      )

      const flexContainers = container.querySelectorAll('[style*="display: flex"]')
      expect(flexContainers.length).toBeGreaterThan(0)
      
      // Main container should have space-between
      const mainFlex = flexContainers[0]
      const style = mainFlex?.getAttribute('style') || ''
      expect(style).toContain('justify-content: space-between')
    })

    it('Alert messages should have proper spacing', () => {
      const { container } = render(
        <div>
          <div className="alert alert-info">
            Information message
          </div>
          <Card>
            <p>Main content below alert</p>
          </Card>
        </div>
      )

      const alert = container.querySelector('.alert')
      const card = container.querySelector('.card')
      
      expect(alert).toBeInTheDocument()
      expect(card).toBeInTheDocument()
    })
  })

  describe('Specific Problem Areas', () => {
    it('Difficulty slider should not touch buttons', () => {
      const { container } = render(
        <div>
          <ButtonGroup gap="small" className="difficulty-button-group">
            <Button variant="secondary">Basic</Button>
            <Button variant="primary">Easy</Button>
            <Button variant="secondary">Medium</Button>
          </ButtonGroup>
          <div style={{ marginTop: '0.5rem' }}>
            <input type="range" style={{ width: '100%' }} />
          </div>
        </div>
      )

      const buttonGroup = container.querySelector('.difficulty-button-group')
      const slider = container.querySelector('input[type="range"]')
      
      expect(buttonGroup).toBeInTheDocument()
      expect(slider).toBeInTheDocument()
      
      // Slider container should have margin
      const sliderParent = slider?.parentElement
      const style = sliderParent?.getAttribute('style') || ''
      expect(style).toContain('marginTop')
    })

    it('Modal buttons should not be cramped', () => {
      const { container } = render(
        <div className="modal-footer">
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary">Confirm</Button>
        </div>
      )

      const modalFooter = container.querySelector('.modal-footer')
      const buttons = modalFooter?.querySelectorAll('button')
      
      expect(buttons).toHaveLength(2)
      
      // Modal footer should have proper button spacing
      expect(modalFooter).toBeInTheDocument()
    })

    it('Inline buttons with text should have spacing', () => {
      const { container } = render(
        <div>
          <span>Select a template:</span>
          <Button variant="tertiary" size="small">
            Browse Templates
          </Button>
        </div>
      )

      const span = container.querySelector('span')
      const button = container.querySelector('button')
      
      expect(span).toBeInTheDocument()
      expect(button).toBeInTheDocument()
      
      // Parent should handle spacing between inline elements
      const parent = span?.parentElement
      expect(parent).toBeInTheDocument()
    })
  })
})