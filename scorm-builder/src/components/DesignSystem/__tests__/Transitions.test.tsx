import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FadeIn } from '../Transitions'
import { SlideIn } from '../Transitions'
import { ScaleIn } from '../Transitions'
import { StaggerChildren } from '../Transitions'

describe('Smooth Transitions - User Intent Tests', () => {
  describe('User expects content to fade in smoothly', () => {
    it('should fade in content when it becomes visible', async () => {
      const { rerender } = render(
        <FadeIn show={false}>
          <div>Content to fade in</div>
        </FadeIn>
      )
      
      // Initially content should be hidden
      expect(screen.queryByText('Content to fade in')).not.toBeInTheDocument()
      
      // Show content
      rerender(
        <FadeIn show={true}>
          <div>Content to fade in</div>
        </FadeIn>
      )
      
      // Content should fade in
      expect(screen.getByText('Content to fade in')).toBeInTheDocument()
      
      // Wait for the activation to happen
      await waitFor(() => {
        expect(screen.getByText('Content to fade in').parentElement).toHaveClass('fade-in-active')
      }, { timeout: 50 })
    })

    it('should support custom duration', () => {
      render(
        <FadeIn show={true} duration={500}>
          <div>Slow fade content</div>
        </FadeIn>
      )
      
      const element = screen.getByText('Slow fade content').parentElement
      expect(element).toHaveStyle({ transitionDuration: '500ms' })
    })
  })

  describe('User expects content to slide in from different directions', () => {
    it('should slide in from left by default', () => {
      render(
        <SlideIn show={true}>
          <div>Sliding content</div>
        </SlideIn>
      )
      
      const element = screen.getByText('Sliding content').parentElement
      expect(element).toHaveClass('slide-in-left-active')
    })

    it('should slide in from specified direction', () => {
      render(
        <SlideIn show={true} direction="right">
          <div>Right sliding content</div>
        </SlideIn>
      )
      
      const element = screen.getByText('Right sliding content').parentElement
      expect(element).toHaveClass('slide-in-right-active')
    })

    it('should support sliding from top and bottom', () => {
      const { rerender } = render(
        <SlideIn show={true} direction="top">
          <div>Top sliding</div>
        </SlideIn>
      )
      
      expect(screen.getByText('Top sliding').parentElement).toHaveClass('slide-in-top-active')
      
      rerender(
        <SlideIn show={true} direction="bottom">
          <div>Bottom sliding</div>
        </SlideIn>
      )
      
      expect(screen.getByText('Bottom sliding').parentElement).toHaveClass('slide-in-bottom-active')
    })
  })

  describe('User expects scale animations for emphasis', () => {
    it('should scale content from center', () => {
      render(
        <ScaleIn show={true}>
          <div>Scaling content</div>
        </ScaleIn>
      )
      
      const element = screen.getByText('Scaling content').parentElement
      expect(element).toHaveClass('scale-in-active')
    })

    it('should support custom scale origin', () => {
      render(
        <ScaleIn show={true} origin="top-left">
          <div>Corner scale</div>
        </ScaleIn>
      )
      
      const element = screen.getByText('Corner scale').parentElement
      expect(element).toHaveStyle({ transformOrigin: 'top left' })
    })
  })

  describe('User expects staggered animations for lists', () => {
    it('should stagger children animations', async () => {
      const { container } = render(
        <StaggerChildren show={true} staggerDelay={100}>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </StaggerChildren>
      )
      
      const items = [
        screen.getByText('Item 1').parentElement,
        screen.getByText('Item 2').parentElement,
        screen.getByText('Item 3').parentElement
      ]
      
      // Each item should have increasing animation delay
      expect(items[0]).toHaveStyle({ animationDelay: '0ms' })
      expect(items[1]).toHaveStyle({ animationDelay: '100ms' })
      expect(items[2]).toHaveStyle({ animationDelay: '200ms' })
    })

    it('should apply specified animation type to children', () => {
      render(
        <StaggerChildren show={true} animation="slide-up">
          <div>Slide item 1</div>
          <div>Slide item 2</div>
        </StaggerChildren>
      )
      
      const items = [
        screen.getByText('Slide item 1').parentElement,
        screen.getByText('Slide item 2').parentElement
      ]
      
      items.forEach(item => {
        expect(item).toHaveClass('stagger-slide-up')
      })
    })
  })

  describe('User expects page transitions', () => {
    it('should transition between pages smoothly', async () => {
      const { rerender } = render(
        <FadeIn show={true} exitBeforeEnter>
          <div key="page1">Page 1</div>
        </FadeIn>
      )
      
      expect(screen.getByText('Page 1')).toBeInTheDocument()
      
      // Change to page 2
      rerender(
        <FadeIn show={true} exitBeforeEnter>
          <div key="page2">Page 2</div>
        </FadeIn>
      )
      
      // Should wait for page 1 to exit before page 2 enters
      await waitFor(() => {
        expect(screen.queryByText('Page 1')).not.toBeInTheDocument()
        expect(screen.getByText('Page 2')).toBeInTheDocument()
      })
    })
  })
})