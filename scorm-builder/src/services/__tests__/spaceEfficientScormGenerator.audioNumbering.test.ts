import { describe, it, expect } from 'vitest'
import { generateWelcomePage, generateObjectivesPage } from '../spaceEfficientScormGeneratorPages'

describe('SCORM Generator - Audio File Numbering', () => {
  it('should use 0001 for welcome page audio (not 0000)', () => {
    const courseContent = {
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        audioFile: '0001-welcome.mp3',
        captionFile: '0001-welcome.vtt'
      }
    }

    const html = generateWelcomePage(courseContent)
    
    // Should NOT replace 0001 with 0000
    expect(html).toContain('src="../media/audio/0001-welcome.mp3"')
    expect(html).toContain('src="../media/captions/0001-welcome.vtt"')
    expect(html).not.toContain('0000-welcome.mp3')
    expect(html).not.toContain('0000-welcome.vtt')
  })

  it('should use 0002 for objectives page audio', () => {
    const courseContent = {
      objectives: ['Objective 1', 'Objective 2'],
      objectivesPage: {
        audioFile: '0002-objectives.mp3',
        captionFile: '0002-objectives.vtt'
      }
    }

    const html = generateObjectivesPage(courseContent)
    
    // Should use 0002 for objectives
    expect(html).toContain('src="../media/audio/0002-objectives.mp3"')
    expect(html).toContain('src="../media/captions/0002-objectives.vtt"')
  })

  it('should handle missing audio files gracefully', () => {
    const courseContentNoAudio = {
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course'
        // No audioFile or captionFile
      }
    }

    const html = generateWelcomePage(courseContentNoAudio)
    
    // Should not include audio player when no audio file
    expect(html).not.toContain('<audio')
    expect(html).not.toContain('audio-player')
  })
})