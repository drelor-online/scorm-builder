import { describe, it, expect } from 'vitest'
import { detectMediaTypeFromBlob } from '../mediaExtension'

describe('SVG Media Type Detection', () => {
  it('should detect SVG from image/svg+xml MIME type', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
    
    const result = await detectMediaTypeFromBlob(svgBlob)
    
    expect(result.mimeType).toBe('image/svg+xml')
    expect(result.extension).toBe('svg')
    expect(result.isImage).toBe(true)
  })

  it('should detect SVG from content when MIME type is application/octet-stream', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'
    const svgBlob = new Blob([svgContent], { type: 'application/octet-stream' })
    
    const result = await detectMediaTypeFromBlob(svgBlob)
    
    expect(result.extension).toBe('svg')
    expect(result.isImage).toBe(true)
  })

  it('should detect SVG from content when MIME type is text/plain', async () => {
    const svgContent = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>'
    const svgBlob = new Blob([svgContent], { type: 'text/plain' })
    
    const result = await detectMediaTypeFromBlob(svgBlob)
    
    expect(result.extension).toBe('svg')
    expect(result.isImage).toBe(true)
  })

  it('should detect various image formats correctly', async () => {
    // PNG magic bytes
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    const pngBlob = new Blob([pngBytes], { type: 'image/png' })
    
    const pngResult = await detectMediaTypeFromBlob(pngBlob)
    expect(pngResult.extension).toBe('png')
    expect(pngResult.isImage).toBe(true)
    
    // JPEG magic bytes
    const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])
    const jpegBlob = new Blob([jpegBytes], { type: 'image/jpeg' })
    
    const jpegResult = await detectMediaTypeFromBlob(jpegBlob)
    expect(jpegResult.extension).toBe('jpg')
    expect(jpegResult.isImage).toBe(true)
  })

  it('should return appropriate extension for unknown blob types', async () => {
    const unknownBlob = new Blob(['random content'], { type: 'application/octet-stream' })
    
    const result = await detectMediaTypeFromBlob(unknownBlob)
    
    expect(result.extension).toBe('bin')
    expect(result.isImage).toBe(false)
  })
})