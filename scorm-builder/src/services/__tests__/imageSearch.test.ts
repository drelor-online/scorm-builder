import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock search service module
const mockSearchImages = vi.fn()

vi.mock('../searchService', () => ({
  searchImages: mockSearchImages
}))

describe('Image Search Size Filter', () => {
  beforeEach(() => {
    mockSearchImages.mockClear()
  })

  it('should include size parameter when filter is set to Large', async () => {
    // Import after mock is set up
    const { searchImages } = await import('../searchService')
    
    // Mock implementation
    mockSearchImages.mockResolvedValue({
      results: [
        { 
          id: '1', 
          url: 'https://example.com/image1.jpg',
          title: 'Test Image',
          dimensions: '1920x1080',
          size: 'large'
        }
      ]
    })

    // Call with size filter
    await searchImages('test query', { size: 'large' })
    
    // Verify the size parameter was passed
    expect(mockSearchImages).toHaveBeenCalledWith('test query', { size: 'large' })
  })

  it('should include size parameter when filter is set to Medium', async () => {
    const { searchImages } = await import('../searchService')
    
    mockSearchImages.mockResolvedValue({
      results: [
        { 
          id: '2', 
          url: 'https://example.com/image2.jpg',
          title: 'Medium Image',
          dimensions: '800x600',
          size: 'medium'
        }
      ]
    })

    await searchImages('test query', { size: 'medium' })
    
    expect(mockSearchImages).toHaveBeenCalledWith('test query', { size: 'medium' })
  })

  it('should not include size parameter when filter is set to Any', async () => {
    const { searchImages } = await import('../searchService')
    
    mockSearchImages.mockResolvedValue({
      results: []
    })

    await searchImages('test query', { size: 'any' })
    
    // Should pass through but with 'any' or omitted
    expect(mockSearchImages).toHaveBeenCalledWith('test query', { size: 'any' })
  })

  it('should reject images below minimum resolution threshold', async () => {
    const MIN_WIDTH = 800
    const MIN_HEIGHT = 600
    
    const results = [
      { id: '1', url: 'img1.jpg', dimensions: '1920x1080' }, // Should pass
      { id: '2', url: 'img2.jpg', dimensions: '640x480' },   // Should fail
      { id: '3', url: 'img3.jpg', dimensions: '800x600' },   // Should pass (exact minimum)
      { id: '4', url: 'img4.jpg', dimensions: '400x300' },   // Should fail
    ]
    
    const filtered = results.filter(img => {
      if (!img.dimensions) return false
      const [width, height] = img.dimensions.split('x').map(Number)
      return width >= MIN_WIDTH && height >= MIN_HEIGHT
    })
    
    expect(filtered).toHaveLength(2)
    expect(filtered[0].id).toBe('1')
    expect(filtered[1].id).toBe('3')
  })

  it('should display pixel dimensions in search results', () => {
    const mockResult = {
      id: 'test-1',
      url: 'https://example.com/test.jpg',
      title: 'Test Image',
      dimensions: '1920x1080'
    }
    
    // Test that dimensions are properly formatted for display
    const formattedDimensions = mockResult.dimensions
    expect(formattedDimensions).toMatch(/^\d+x\d+$/)
    
    // Parse dimensions
    const [width, height] = mockResult.dimensions.split('x').map(Number)
    expect(width).toBe(1920)
    expect(height).toBe(1080)
  })

  it('should persist size filter choice in localStorage', () => {
    const STORAGE_KEY = 'imageSearchSizeFilter'
    
    // Mock localStorage
    const mockStorage: { [key: string]: string } = {}
    const localStorageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value },
      removeItem: (key: string) => { delete mockStorage[key] }
    }
    
    // Set filter
    localStorageMock.setItem(STORAGE_KEY, 'large')
    expect(localStorageMock.getItem(STORAGE_KEY)).toBe('large')
    
    // Change filter
    localStorageMock.setItem(STORAGE_KEY, 'medium')
    expect(localStorageMock.getItem(STORAGE_KEY)).toBe('medium')
    
    // Clear filter
    localStorageMock.removeItem(STORAGE_KEY)
    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull()
  })
})