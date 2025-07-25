import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button, ButtonGroup, Flex } from '../DesignSystem'

describe('Button Spacing Fix Tests', () => {
  describe('ButtonGroup spacing', () => {
    it('should apply proper gap between buttons', () => {
      const { container } = render(
        <ButtonGroup gap="medium">
          <Button variant="secondary">Button 1</Button>
          <Button variant="secondary">Button 2</Button>
          <Button variant="primary">Button 3</Button>
        </ButtonGroup>
      )

      const buttonGroup = container.querySelector('.button-group')
      expect(buttonGroup).toHaveClass('button-group-gap-medium')
    })
  })

  describe('Flex component spacing', () => {
    it('should apply flex gap classes correctly', () => {
      const { container } = render(
        <Flex gap="medium" justify="space-between" align="center">
          <div>Left content</div>
          <div>Right content</div>
        </Flex>
      )

      const flexContainer = container.querySelector('.flex')
      expect(flexContainer).toHaveClass('flex-gap-medium')
      expect(flexContainer).toHaveClass('flex-justify-space-between')
      expect(flexContainer).toHaveClass('flex-align-center')
    })

    it('should support button groups inside flex', () => {
      const { container } = render(
        <Flex justify="space-between" gap="medium">
          <ButtonGroup gap="medium">
            <Button variant="secondary">Paste</Button>
            <Button variant="secondary">Choose File</Button>
          </ButtonGroup>
          <Button variant="primary">Validate</Button>
        </Flex>
      )

      const flexContainer = container.querySelector('.flex')
      expect(flexContainer).toHaveClass('flex-gap-medium')
      
      const buttonGroup = container.querySelector('.button-group')
      expect(buttonGroup).toHaveClass('button-group-gap-medium')
    })
  })

  describe('Button styling consistency', () => {
    it('should render buttons with consistent sizes', () => {
      const { container } = render(
        <div>
          <Button variant="secondary" size="medium">Button 1</Button>
          <Button variant="secondary" size="medium">Button 2</Button>
          <Button variant="primary" size="medium">Button 3</Button>
        </div>
      )

      const buttons = container.querySelectorAll('.btn')
      buttons.forEach(button => {
        expect(button).toHaveClass('btn-medium')
      })
    })
  })
})