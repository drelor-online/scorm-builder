import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SCORMPackageBuilderRefactored } from '../SCORMPackageBuilderRefactored'
import { MediaStorage } from '../../utils/mediaStorage'
import { CourseContent } from '../../types'

// Mock dependencies
jest.mock('../../utils/mediaStorage')
jest.mock('../../services/spaceEfficientScormGenerator')
jest.mock('../../services/projectStorageAdapter')

describe('SCORMPackageBuilderRefactored - Welcome Media ID', () => {
  let mockStorage: jest.Mocked<MediaStorage>

  beforeEach(() => {
    mockStorage = new MediaStorage() as jest.Mocked<MediaStorage>
    ;(MediaStorage as jest.Mock).mockImplementation(() => mockStorage)
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should look for welcome media with correct ID based on filename', async () => {
    const mockCourseContent: CourseContent = {
      courseName: 'Test Course',
      courseIdentifier: 'test-001',
      description: 'Test description',
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        audioFile: '0001-welcome.mp3',
        captionFile: '0001-welcome.vtt'
      },
      objectives: {
        title: 'Objectives',
        items: [],
        audioFile: '0002-objectives.mp3'
      },
      topics: []
    }

    // Mock getMedia to track what IDs are requested
    const getMediaCalls: string[] = []
    mockStorage.getMedia.mockImplementation(async (id: string) => {
      getMediaCalls.push(id)
      return null
    })

    render(
      <SCORMPackageBuilderRefactored 
        courseContent={mockCourseContent}
        scormVersion="1.2"
      />
    )

    await waitFor(() => {
      // Check that it's looking for the correct IDs
      expect(getMediaCalls).toContain('audio-0001')
      expect(getMediaCalls).toContain('caption-0001')
    })

    // Verify warning messages
    expect(console.warn).toHaveBeenCalledWith(
      'No audio blob found for welcome page with ID: audio-0001'
    )
    expect(console.warn).toHaveBeenCalledWith(
      'No caption blob found for welcome page with ID: caption-0001'
    )
  })

  it('should handle welcome files with 0000 prefix', async () => {
    const mockCourseContent: CourseContent = {
      courseName: 'Test Course',
      courseIdentifier: 'test-001',
      description: 'Test description',
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        audioFile: '0000-welcome.mp3',
        captionFile: '0000-welcome.vtt'
      },
      objectives: {
        title: 'Objectives',
        items: [],
        audioFile: '0001-objectives.mp3'
      },
      topics: []
    }

    // Mock getMedia to return blobs for 0000 IDs
    mockStorage.getMedia.mockImplementation(async (id: string) => {
      if (id === 'audio-0000' || id === 'caption-0000') {
        return {
          id,
          type: id.startsWith('audio') ? 'audio' : 'caption',
          blob: new Blob(['test'], { type: 'audio/mp3' }),
          metadata: {}
        }
      }
      return null
    })

    render(
      <SCORMPackageBuilderRefactored 
        courseContent={mockCourseContent}
        scormVersion="1.2"
      />
    )

    await waitFor(() => {
      // Should successfully load media
      expect(console.log).toHaveBeenCalledWith(
        'Loaded welcome page audio with block number: 0000'
      )
      expect(console.log).toHaveBeenCalledWith(
        'Loaded welcome page caption with block number: 0000'
      )
    })
  })
})