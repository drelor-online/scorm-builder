import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section, PageContainer, Card } from '../'
import './setupTests'

describe('Visual Hierarchy and Spacing Tests', () => {
  describe('Section Spacing', () => {
    it('should have consistent vertical spacing between sections', () => {
      const { container } = render(
        <PageContainer>
          <Section title="First Section">Content 1</Section>
          <Section title="Second Section">Content 2</Section>
          <Section title="Third Section">Content 3</Section>
        </PageContainer>
      )
      
      const sections = container.querySelectorAll('.section')
      sections.forEach((section, index) => {
        const styles = window.getComputedStyle(section)
        
        // All sections should have consistent bottom margin except the last
        if (index < sections.length - 1) {
          expect(styles.marginBottom).toBe('48px') // Increased from 32px
        } else {
          expect(styles.marginBottom).toBe('0px')
        }
        
        // Sections should have consistent internal padding
        expect(styles.paddingTop).toBe('32px')
        expect(styles.paddingBottom).toBe('32px')
      })
    })

    it('should have proper heading hierarchy', () => {
      const { container } = render(
        <Section title="Test Section">
          <h3>Subsection Title</h3>
          <p>Content paragraph</p>
        </Section>
      )
      
      const sectionTitle = container.querySelector('.section-title')
      const subsectionTitle = container.querySelector('h3')
      
      const sectionStyles = window.getComputedStyle(sectionTitle!)
      const subsectionStyles = window.getComputedStyle(subsectionTitle!)
      
      // Section title should be larger
      expect(parseFloat(sectionStyles.fontSize)).toBeGreaterThan(parseFloat(subsectionStyles.fontSize))
      
      // Both should have consistent font weight
      expect(sectionStyles.fontWeight).toBe('600')
      expect(subsectionStyles.fontWeight).toBe('500')
    })
  })

  describe('Card Visual Hierarchy', () => {
    it('should have elevated appearance with shadow', () => {
      const { container } = render(
        <Card title="Test Card">
          Card content
        </Card>
      )
      
      const card = container.querySelector('.card')
      const styles = window.getComputedStyle(card!)
      
      // Should have a more prominent shadow
      expect(styles.boxShadow).toMatch(/0 4px 6px/)
    })

    it('should have hover state with increased elevation', () => {
      const { container } = render(
        <Card title="Test Card">
          Card content
        </Card>
      )
      
      const card = container.querySelector('.card')
      expect(card).toHaveClass('card-hover-lift')
    })
  })

  describe('Content Spacing', () => {
    it('should have consistent paragraph spacing', () => {
      const { container } = render(
        <Section>
          <p>First paragraph</p>
          <p>Second paragraph</p>
          <p>Third paragraph</p>
        </Section>
      )
      
      const paragraphs = container.querySelectorAll('p')
      paragraphs.forEach((p, index) => {
        const styles = window.getComputedStyle(p)
        
        // Paragraphs should have bottom margin except the last
        if (index < paragraphs.length - 1) {
          expect(styles.marginBottom).toBe('16px')
        }
        
        // Line height for readability
        expect(styles.lineHeight).toBe('1.6')
      })
    })

    it('should have proper list spacing', () => {
      const { container } = render(
        <Section>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
        </Section>
      )
      
      const list = container.querySelector('ul')
      const listItems = container.querySelectorAll('li')
      
      const listStyles = window.getComputedStyle(list!)
      expect(listStyles.paddingLeft).toBe('24px')
      
      listItems.forEach((li, index) => {
        const styles = window.getComputedStyle(li)
        if (index < listItems.length - 1) {
          expect(styles.marginBottom).toBe('8px')
        } else {
          expect(styles.marginBottom).toBe('0')
        }
      })
    })
  })

  describe('Page Container Constraints', () => {
    it('should have maximum width for readability', () => {
      const { container } = render(
        <PageContainer>
          <Section>Content</Section>
        </PageContainer>
      )
      
      const pageContainer = container.querySelector('.page-container')
      const styles = window.getComputedStyle(pageContainer!)
      
      expect(styles.maxWidth).toBe('1200px')
      expect(styles.marginLeft).toBe('auto')
      expect(styles.marginRight).toBe('auto')
      expect(styles.paddingLeft).toBe('24px')
      expect(styles.paddingRight).toBe('24px')
    })
  })
})