import { describe, it, expect } from 'vitest'
import { extractClipTimingFromUrl } from './mediaUrl'

/**
 * TDD Test: extractClipTimingFromUrl function
 *
 * This function extracts clip timing from YouTube embed URLs that contain
 * start and end parameters, addressing the bug where clip timing is lost
 * after project reload because it's only preserved in the URL.
 */
describe('extractClipTimingFromUrl', () => {
  it('should extract both start and end parameters from embed URL', () => {
    // Arrange
    const embedUrl = 'https://www.youtube.com/embed/iRtsYUBNfnA?start=30&end=60'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert
    expect(result).toEqual({
      clipStart: 30,
      clipEnd: 60
    })
  })

  it('should extract only start parameter when end is missing', () => {
    // Arrange
    const embedUrl = 'https://www.youtube.com/embed/videoId?start=45'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert
    expect(result).toEqual({
      clipStart: 45,
      clipEnd: undefined
    })
  })

  it('should extract only end parameter when start is missing', () => {
    // Arrange
    const embedUrl = 'https://www.youtube.com/embed/videoId?end=120'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert
    expect(result).toEqual({
      clipStart: undefined,
      clipEnd: 120
    })
  })

  it('should handle URLs without timing parameters', () => {
    // Arrange
    const embedUrl = 'https://www.youtube.com/embed/videoId'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert
    expect(result).toEqual({
      clipStart: undefined,
      clipEnd: undefined
    })
  })

  it('should handle URLs with other parameters mixed in', () => {
    // Arrange
    const embedUrl = 'https://www.youtube.com/embed/videoId?rel=0&start=90&modestbranding=1&end=180&autoplay=0'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert
    expect(result).toEqual({
      clipStart: 90,
      clipEnd: 180
    })
  })

  it('should handle zero values correctly', () => {
    // Arrange: Zero is a valid clip timing value
    const embedUrl = 'https://www.youtube.com/embed/videoId?start=0&end=0'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert
    expect(result).toEqual({
      clipStart: 0,
      clipEnd: 0
    })
  })

  it('should handle invalid or malformed URLs gracefully', () => {
    // Arrange: Various invalid inputs
    const invalidUrls = [
      '',
      null as any,
      undefined as any,
      'not-a-url',
      'malformed?start=abc&end=def'
    ]

    // Act & Assert
    invalidUrls.forEach(url => {
      const result = extractClipTimingFromUrl(url)
      expect(result).toEqual({
        clipStart: undefined,
        clipEnd: undefined
      })
    })
  })

  it('should extract timing from any valid URL with start/end parameters', () => {
    // Arrange: Valid URL format but not YouTube (function should still extract parameters)
    const validUrl = 'https://not-youtube.com/embed/id?start=30&end=90'

    // Act
    const result = extractClipTimingFromUrl(validUrl)

    // Assert: Should extract parameters from any valid URL
    expect(result).toEqual({
      clipStart: 30,
      clipEnd: 90
    })
  })

  it('should handle non-numeric parameter values', () => {
    // Arrange: Invalid numeric values
    const embedUrl = 'https://www.youtube.com/embed/videoId?start=abc&end=def'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert: Should return undefined for invalid numbers
    expect(result).toEqual({
      clipStart: undefined,
      clipEnd: undefined
    })
  })

  it('should handle negative values by treating them as undefined', () => {
    // Arrange: Negative values (invalid for YouTube timing)
    const embedUrl = 'https://www.youtube.com/embed/videoId?start=-10&end=-5'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert: Negative values should be treated as invalid
    expect(result).toEqual({
      clipStart: undefined,
      clipEnd: undefined
    })
  })

  it('should handle decimal values by rounding down', () => {
    // Arrange: Decimal values
    const embedUrl = 'https://www.youtube.com/embed/videoId?start=45.7&end=120.9'

    // Act
    const result = extractClipTimingFromUrl(embedUrl)

    // Assert: Should round down decimal values
    expect(result).toEqual({
      clipStart: 45,
      clipEnd: 120
    })
  })
})