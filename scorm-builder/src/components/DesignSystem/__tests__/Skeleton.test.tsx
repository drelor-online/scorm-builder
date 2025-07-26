import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Skeleton } from '../Skeleton'

describe('Skeleton', () => {
  describe('Basic Rendering', () => {
    it('should render skeleton with default props', () => {
      render(<Skeleton />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toBeInTheDocument()
      expect(skeleton).toHaveClass('skeleton')
      expect(skeleton).toHaveClass('skeleton-text')
      expect(skeleton).toHaveClass('skeleton-pulse')
    })

    it('should apply custom className', () => {
      render(<Skeleton className="custom-skeleton" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveClass('custom-skeleton')
    })

    it('should be hidden from screen readers', () => {
      render(<Skeleton />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Variants', () => {
    it('should render text variant', () => {
      render(<Skeleton variant="text" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveClass('skeleton-text')
    })

    it('should render rect variant', () => {
      render(<Skeleton variant="rect" />)
      
      const skeleton = screen.getByTestId('skeleton-rect')
      expect(skeleton).toHaveClass('skeleton-rect')
    })

    it('should render circle variant', () => {
      render(<Skeleton variant="circle" />)
      
      const skeleton = screen.getByTestId('skeleton-circle')
      expect(skeleton).toHaveClass('skeleton-circle')
    })
  })

  describe('Dimensions', () => {
    it('should apply width and height', () => {
      render(<Skeleton width="200px" height="50px" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveStyle({
        width: '200px',
        height: '50px'
      })
    })

    it('should apply only width', () => {
      render(<Skeleton width="300px" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveStyle({ width: '300px' })
      expect(skeleton.style.height).toBe('')
    })

    it('should apply only height', () => {
      render(<Skeleton height="100px" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveStyle({ height: '100px' })
      expect(skeleton.style.width).toBe('')
    })

    it('should use size for circle variant', () => {
      render(<Skeleton variant="circle" size="40px" />)
      
      const skeleton = screen.getByTestId('skeleton-circle')
      expect(skeleton).toHaveStyle({
        width: '40px',
        height: '40px'
      })
    })

    it('should prioritize size over width/height for circle', () => {
      render(<Skeleton variant="circle" size="60px" width="100px" height="100px" />)
      
      const skeleton = screen.getByTestId('skeleton-circle')
      expect(skeleton).toHaveStyle({
        width: '60px',
        height: '60px'
      })
    })

    it('should use width/height if size not provided for circle', () => {
      render(<Skeleton variant="circle" width="80px" height="80px" />)
      
      const skeleton = screen.getByTestId('skeleton-circle')
      expect(skeleton).toHaveStyle({
        width: '80px',
        height: '80px'
      })
    })
  })

  describe('Animations', () => {
    it('should apply pulse animation by default', () => {
      render(<Skeleton />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveClass('skeleton-pulse')
    })

    it('should apply shimmer animation', () => {
      render(<Skeleton animation="shimmer" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveClass('skeleton-shimmer')
      expect(skeleton).not.toHaveClass('skeleton-pulse')
    })
  })

  describe('CSS Classes', () => {
    it('should combine all classes correctly', () => {
      render(<Skeleton variant="rect" animation="shimmer" className="my-skeleton" />)
      
      const skeleton = screen.getByTestId('skeleton-rect')
      expect(skeleton).toHaveClass('skeleton')
      expect(skeleton).toHaveClass('skeleton-rect')
      expect(skeleton).toHaveClass('skeleton-shimmer')
      expect(skeleton).toHaveClass('my-skeleton')
    })

    it('should filter out falsy className values', () => {
      render(<Skeleton className="" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      const classes = skeleton.className.split(' ')
      expect(classes).toEqual(['skeleton', 'skeleton-text', 'skeleton-pulse'])
    })
  })

  describe('Different Units', () => {
    it('should accept percentage values', () => {
      render(<Skeleton width="100%" height="50%" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveStyle({
        width: '100%',
        height: '50%'
      })
    })

    it('should accept rem values', () => {
      render(<Skeleton width="10rem" height="2rem" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveStyle({
        width: '10rem',
        height: '2rem'
      })
    })

    it('should accept em values', () => {
      render(<Skeleton width="5em" height="1em" />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveStyle({
        width: '5em',
        height: '1em'
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle no dimensions provided', () => {
      render(<Skeleton />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton.style.width).toBe('')
      expect(skeleton.style.height).toBe('')
    })

    it('should handle invalid size for non-circle variants', () => {
      render(<Skeleton variant="rect" size="100px" />)
      
      const skeleton = screen.getByTestId('skeleton-rect')
      // Size should be ignored for non-circle variants
      expect(skeleton.style.width).toBe('')
      expect(skeleton.style.height).toBe('')
    })

    it('should render multiple skeletons', () => {
      render(
        <>
          <Skeleton data-testid="skeleton-1" />
          <Skeleton variant="rect" data-testid="skeleton-2" />
          <Skeleton variant="circle" data-testid="skeleton-3" />
        </>
      )
      
      expect(screen.getByTestId('skeleton-text')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-rect')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-circle')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should always have aria-hidden true', () => {
      const { rerender } = render(<Skeleton />)
      expect(screen.getByTestId('skeleton-text')).toHaveAttribute('aria-hidden', 'true')
      
      rerender(<Skeleton variant="rect" />)
      expect(screen.getByTestId('skeleton-rect')).toHaveAttribute('aria-hidden', 'true')
      
      rerender(<Skeleton variant="circle" />)
      expect(screen.getByTestId('skeleton-circle')).toHaveAttribute('aria-hidden', 'true')
    })

    it('should be decorative element', () => {
      render(<Skeleton />)
      
      const skeleton = screen.getByTestId('skeleton-text')
      // Should not have role or label
      expect(skeleton).not.toHaveAttribute('role')
      expect(skeleton).not.toHaveAttribute('aria-label')
    })
  })

  describe('Style Combinations', () => {
    it('should handle all props together', () => {
      render(
        <Skeleton 
          variant="rect"
          width="250px"
          height="150px"
          animation="shimmer"
          className="loading-placeholder"
        />
      )
      
      const skeleton = screen.getByTestId('skeleton-rect')
      expect(skeleton).toHaveClass('skeleton')
      expect(skeleton).toHaveClass('skeleton-rect')
      expect(skeleton).toHaveClass('skeleton-shimmer')
      expect(skeleton).toHaveClass('loading-placeholder')
      expect(skeleton).toHaveStyle({
        width: '250px',
        height: '150px'
      })
    })

    it('should handle circle with all props', () => {
      render(
        <Skeleton 
          variant="circle"
          size="48px"
          animation="pulse"
          className="avatar-skeleton"
        />
      )
      
      const skeleton = screen.getByTestId('skeleton-circle')
      expect(skeleton).toHaveClass('skeleton')
      expect(skeleton).toHaveClass('skeleton-circle')
      expect(skeleton).toHaveClass('skeleton-pulse')
      expect(skeleton).toHaveClass('avatar-skeleton')
      expect(skeleton).toHaveStyle({
        width: '48px',
        height: '48px'
      })
    })
  })
})