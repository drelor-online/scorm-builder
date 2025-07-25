import { describe, it, expect } from 'vitest'
import { adjustCaptionTiming } from '../captionTimingAdjuster'

describe('Caption Timing Adjuster', () => {
  it('should parse VTT timestamps correctly', () => {
    const result = adjustCaptionTiming(
      'WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello world',
      10, // 10 second audio duration
      5   // 5 second caption duration
    )
    
    expect(result).toContain('00:00:02.000 --> 00:00:10.000')
  })

  it('should handle multiple cues', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
First caption

00:00:02.000 --> 00:00:04.000
Second caption

00:00:04.000 --> 00:00:05.000
Third caption`

    const result = adjustCaptionTiming(vtt, 10, 5)
    
    expect(result).toContain('00:00:00.000 --> 00:00:04.000')
    expect(result).toContain('00:00:04.000 --> 00:00:08.000')
    expect(result).toContain('00:00:08.000 --> 00:00:10.000')
  })

  it('should preserve WEBVTT header and cue text', () => {
    const vtt = `WEBVTT
NOTE This is a note

00:00:00.000 --> 00:00:05.000
Caption text with <b>formatting</b>`

    const result = adjustCaptionTiming(vtt, 10, 5)
    
    expect(result).toContain('WEBVTT')
    expect(result).toContain('NOTE This is a note')
    expect(result).toContain('Caption text with <b>formatting</b>')
  })

  it('should handle edge case where caption duration is 0', () => {
    const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:00.000\nInstant caption'
    
    const result = adjustCaptionTiming(vtt, 10, 0)
    
    // Should not divide by zero, return original
    expect(result).toBe(vtt)
  })

  it('should handle fractional seconds properly', () => {
    const vtt = `WEBVTT

00:00:00.500 --> 00:00:01.750
Caption one

00:00:01.750 --> 00:00:03.000
Caption two`

    const result = adjustCaptionTiming(vtt, 6, 3)
    
    expect(result).toContain('00:00:01.000 --> 00:00:03.500')
    expect(result).toContain('00:00:03.500 --> 00:00:06.000')
  })

  it('should find the last timestamp automatically if caption duration not provided', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
First

00:00:02.000 --> 00:00:05.000
Last caption`

    const result = adjustCaptionTiming(vtt, 10)
    
    // Should scale from 5 seconds to 10 seconds (2x)
    expect(result).toContain('00:00:00.000 --> 00:00:04.000')
    expect(result).toContain('00:00:04.000 --> 00:00:10.000')
  })
})