import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CoursePreview } from '../CoursePreview'

describe('CoursePreview - Green Banner Styling', () => {
  const mockActivities = [
    {
      id: 'welcome',
      type: 'page' as const,
      content: {
        title: 'Welcome',
        text: 'Welcome to the course'
      }
    }
  ]
  
  it('should have proper spacing in success banners', () => {
    render(
      <CoursePreview 
        activities={mockActivities}
        courseSeed={{
          courseTitle: 'Test Course',
          difficulty: 3,
          customTopics: [],
          template: 'None',
          templateTopics: []
        }}
      />
    )
    
    // Find success/completion banners
    const banners = screen.getAllByRole('alert')
    const successBanners = banners.filter(banner => {
      const styles = window.getComputedStyle(banner)
      return styles.backgroundColor?.includes('34, 197, 94') || // green
             styles.backgroundColor?.includes('22c55e') ||
             banner.className?.includes('success')
    })
    
    successBanners.forEach(banner => {
      const styles = window.getComputedStyle(banner)
      
      // Check padding
      const paddingTop = parseFloat(styles.paddingTop)
      const paddingBottom = parseFloat(styles.paddingBottom)
      const paddingLeft = parseFloat(styles.paddingLeft)
      const paddingRight = parseFloat(styles.paddingRight)
      
      // Should have adequate padding (at least 8px)
      expect(paddingTop).toBeGreaterThanOrEqual(8)
      expect(paddingBottom).toBeGreaterThanOrEqual(8)
      expect(paddingLeft).toBeGreaterThanOrEqual(12)
      expect(paddingRight).toBeGreaterThanOrEqual(12)
      
      // Check margin for spacing from other elements
      const marginTop = parseFloat(styles.marginTop)
      const marginBottom = parseFloat(styles.marginBottom)
      
      // Should have margin for separation
      expect(marginTop + marginBottom).toBeGreaterThan(0)
    })
  })
  
  it('should have sufficient text contrast in green banners', () => {
    render(
      <CoursePreview 
        activities={mockActivities}
        courseSeed={{
          courseTitle: 'Test Course',
          difficulty: 3,
          customTopics: [],
          template: 'None',
          templateTopics: []
        }}
      />
    )
    
    const banners = screen.getAllByRole('alert')
    const successBanners = banners.filter(banner => 
      banner.className?.includes('success') ||
      window.getComputedStyle(banner).backgroundColor?.includes('34, 197, 94')
    )
    
    successBanners.forEach(banner => {
      const styles = window.getComputedStyle(banner)
      
      // Text should be readable on green background
      // Typically white or very dark text
      const color = styles.color
      
      // Parse RGB values if present
      const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number)
        
        // For green background, text should be either very light or very dark
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        
        // Brightness should be very high (>200) for white text
        // or very low (<50) for dark text
        expect(brightness > 200 || brightness < 50).toBeTruthy()
      }
    })
  })
  
  it('should not have text touching edges of banner', () => {
    render(
      <CoursePreview 
        activities={mockActivities}
        courseSeed={{
          courseTitle: 'Test Course',
          difficulty: 3,
          customTopics: [],
          template: 'None',
          templateTopics: []
        }}
      />
    )
    
    const banners = screen.getAllByRole('alert')
    
    banners.forEach(banner => {
      const textElements = banner.querySelectorAll('p, span, div')
      
      textElements.forEach(textEl => {
        const textStyles = window.getComputedStyle(textEl)
        const bannerStyles = window.getComputedStyle(banner)
        
        // Text elements should not have negative margins
        expect(parseFloat(textStyles.marginLeft || '0')).toBeGreaterThanOrEqual(0)
        expect(parseFloat(textStyles.marginRight || '0')).toBeGreaterThanOrEqual(0)
        
        // Banner should have padding to prevent text from touching edges
        expect(parseFloat(bannerStyles.paddingLeft || '0')).toBeGreaterThan(0)
        expect(parseFloat(bannerStyles.paddingRight || '0')).toBeGreaterThan(0)
      })
    })
  })
})