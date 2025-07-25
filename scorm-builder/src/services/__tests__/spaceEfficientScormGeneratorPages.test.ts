import { describe, it, expect, beforeEach } from 'vitest'
import { generateWelcomePage } from '../spaceEfficientScormGeneratorPages'

describe('spaceEfficientScormGeneratorPages', () => {
  describe('generateWelcomePage', () => {
    let mockCourseContent: any

    beforeEach(() => {
      mockCourseContent = {
        title: 'Test Course',
        welcome: {
          title: 'Welcome to the Course',
          content: 'This is a test course about important topics.',
          startButtonText: 'Begin Learning'
        }
      }
    })

    it('should generate a complete HTML page', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html lang="en">')
      expect(html).toContain('</html>')
      expect(html).toContain('<head>')
      expect(html).toContain('<body>')
    })

    it('should include meta tags and viewport', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('<meta charset="UTF-8">')
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
    })

    it('should link to the main CSS file', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('<link rel="stylesheet" href="../styles/main.css">')
    })

    it('should display the welcome title and content', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain(`<h1>${mockCourseContent.welcome.title}</h1>`)
      expect(html).toContain(`<p>${mockCourseContent.welcome.content}</p>`)
    })

    it('should use custom start button text when provided', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('Begin Learning')
      expect(html).toContain('class="start-button"')
      expect(html).toContain('onclick="parent.navigateNext()"')
    })

    it('should use default start button text when not provided', () => {
      mockCourseContent.welcome.startButtonText = undefined
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('Start Course')
    })

    it('should include media when present', () => {
      mockCourseContent.welcome.media = [
        {
          id: 'welcome-img-1',
          title: 'Welcome Image',
          url: 'welcome.png',
          type: 'image'
        }
      ]
      
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('class="welcome-media"')
      expect(html).toContain(`<img src="../media/images/${mockCourseContent.welcome.media[0].id}.png"`)
      expect(html).toContain(`alt="${mockCourseContent.welcome.media[0].title}"`)
    })

    it('should add click handler to enlarge images', () => {
      mockCourseContent.welcome.media = [
        {
          id: 'welcome-img-1',
          title: 'Welcome Image',
          url: 'welcome.png',
          type: 'image'
        }
      ]
      
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('onclick="parent.enlargeImage(')
      expect(html).toContain('style="cursor: pointer;"')
      expect(html).toContain(`'../media/images/${mockCourseContent.welcome.media[0].id}.png'`)
      expect(html).toContain(`'${mockCourseContent.welcome.media[0].title}'`)
    })

    it('should not include media section when no media present', () => {
      mockCourseContent.welcome.media = []
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).not.toContain('class="welcome-media"')
      expect(html).not.toContain('<img')
    })

    it('should not include media section when media is undefined', () => {
      mockCourseContent.welcome.media = undefined
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).not.toContain('class="welcome-media"')
      expect(html).not.toContain('<img')
    })

    it('should handle special characters in content', () => {
      mockCourseContent.welcome.title = 'Welcome & Introduction'
      mockCourseContent.welcome.content = 'Learn about <important> topics & "best practices"'
      
      const html = generateWelcomePage(mockCourseContent)
      
      // HTML should contain the raw characters (not escaped)
      expect(html).toContain('Welcome & Introduction')
      expect(html).toContain('Learn about <important> topics & "best practices"')
    })

    it('should generate valid HTML structure', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      // Check for proper nesting
      expect(html).toContain('<div class="welcome-container">')
      expect(html).toContain('</div>')
      
      // Check button is inside container
      const containerStart = html.indexOf('<div class="welcome-container">')
      const containerEnd = html.indexOf('</div>')
      const buttonIndex = html.indexOf('<button class="start-button"')
      
      expect(buttonIndex).toBeGreaterThan(containerStart)
      expect(buttonIndex).toBeLessThan(containerEnd)
    })

    it('should handle empty welcome content gracefully', () => {
      mockCourseContent.welcome.title = ''
      mockCourseContent.welcome.content = ''
      
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('<h1></h1>')
      expect(html).toContain('<p></p>')
      expect(html).toContain('<button') // Button should still be present
    })

    it('should use consistent file paths for media', () => {
      mockCourseContent.welcome.media = [
        {
          id: 'test-media',
          title: 'Test Media',
          url: 'test.jpg',
          type: 'image'
        }
      ]
      
      const html = generateWelcomePage(mockCourseContent)
      
      // Check that all media references use ../media/images/ path
      const mediaMatches = html.match(/\.\.\/media\/images\/test-media\.png/g)
      expect(mediaMatches).toBeTruthy()
      expect(mediaMatches!.length).toBe(2) // Once in src, once in onclick
    })
  })
})