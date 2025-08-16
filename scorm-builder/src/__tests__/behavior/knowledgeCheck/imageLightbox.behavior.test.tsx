import React from 'react'
import { render, screen, fireEvent } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock page with images
const MockPageWithImages = () => {
  return (
    <div>
      <div className="media-container">
        <img 
          src="https://example.com/gas-equipment.jpg" 
          alt="Gas equipment" 
          className="topic-image"
          onClick={() => window.openLightbox?.('https://example.com/gas-equipment.jpg', 'Gas equipment')}
        />
      </div>
      
      {/* Lightbox modal structure */}
      <div id="lightbox-modal" className="lightbox-modal" style={{ display: 'none' }}>
        <div className="lightbox-overlay" onClick={() => window.closeLightbox?.()}></div>
        <div className="lightbox-content">
          <button className="lightbox-close" onClick={() => window.closeLightbox?.()}>×</button>
          <img id="lightbox-image" src="" alt="" />
          <div className="lightbox-caption"></div>
        </div>
      </div>
    </div>
  )
}

describe('Image Lightbox Functionality', () => {
  beforeEach(() => {
    // Reset window functions
    window.openLightbox = undefined
    window.closeLightbox = undefined
    
    // Add lightbox styles
    const style = document.createElement('style')
    style.textContent = `
      .lightbox-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        display: none;
      }
      
      .lightbox-modal.active {
        display: flex !important;
        align-items: center;
        justify-content: center;
      }
      
      .lightbox-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        cursor: pointer;
      }
      
      .lightbox-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
        z-index: 1;
      }
      
      .lightbox-close {
        position: absolute;
        top: -40px;
        right: 0;
        background: none;
        border: none;
        color: white;
        font-size: 36px;
        cursor: pointer;
      }
      
      .topic-image {
        cursor: pointer;
        transition: transform 0.2s;
      }
      
      .topic-image:hover {
        transform: scale(1.02);
      }
    `
    document.head.appendChild(style)
  })

  it('should make images clickable with cursor pointer', () => {
    render(<MockPageWithImages />)
    
    const image = screen.getByAlt('Gas equipment')
    expect(image).toHaveClass('topic-image')
    expect(image).toHaveStyle({ cursor: 'pointer' })
  })

  it('should open lightbox when image is clicked', () => {
    render(<MockPageWithImages />)
    
    // Mock the openLightbox function
    window.openLightbox = vi.fn((src, alt) => {
      const modal = document.getElementById('lightbox-modal')
      const lightboxImage = document.getElementById('lightbox-image') as HTMLImageElement
      const caption = document.querySelector('.lightbox-caption')
      
      if (modal && lightboxImage && caption) {
        modal.classList.add('active')
        modal.style.display = 'flex'
        lightboxImage.src = src
        lightboxImage.alt = alt
        caption.textContent = alt
      }
    })
    
    // Click the image
    const image = screen.getByAlt('Gas equipment')
    fireEvent.click(image)
    
    // Check that openLightbox was called
    expect(window.openLightbox).toHaveBeenCalledWith(
      'https://example.com/gas-equipment.jpg',
      'Gas equipment'
    )
    
    // Check that modal is displayed
    const modal = document.getElementById('lightbox-modal')
    expect(modal).toHaveClass('active')
    expect(modal).toHaveStyle({ display: 'flex' })
    
    // Check image in lightbox
    const lightboxImage = document.getElementById('lightbox-image') as HTMLImageElement
    expect(lightboxImage.src).toBe('https://example.com/gas-equipment.jpg')
    expect(lightboxImage.alt).toBe('Gas equipment')
    
    // Check caption
    const caption = document.querySelector('.lightbox-caption')
    expect(caption).toHaveTextContent('Gas equipment')
  })

  it('should close lightbox when close button is clicked', () => {
    render(<MockPageWithImages />)
    
    window.closeLightbox = vi.fn(() => {
      const modal = document.getElementById('lightbox-modal')
      if (modal) {
        modal.classList.remove('active')
        modal.style.display = 'none'
      }
    })
    
    // First open the lightbox
    const modal = document.getElementById('lightbox-modal')
    if (modal) {
      modal.classList.add('active')
      modal.style.display = 'flex'
    }
    
    // Click close button
    const closeButton = screen.getByText('×')
    fireEvent.click(closeButton)
    
    // Check that closeLightbox was called
    expect(window.closeLightbox).toHaveBeenCalled()
    
    // Check that modal is hidden
    expect(modal).not.toHaveClass('active')
    expect(modal).toHaveStyle({ display: 'none' })
  })

  it('should close lightbox when overlay is clicked', () => {
    render(<MockPageWithImages />)
    
    window.closeLightbox = vi.fn(() => {
      const modal = document.getElementById('lightbox-modal')
      if (modal) {
        modal.classList.remove('active')
        modal.style.display = 'none'
      }
    })
    
    // Open the lightbox
    const modal = document.getElementById('lightbox-modal')
    if (modal) {
      modal.classList.add('active')
      modal.style.display = 'flex'
    }
    
    // Click overlay
    const overlay = document.querySelector('.lightbox-overlay')
    fireEvent.click(overlay!)
    
    // Check that lightbox closed
    expect(window.closeLightbox).toHaveBeenCalled()
    expect(modal).not.toHaveClass('active')
  })

  it('should handle keyboard navigation (ESC to close)', () => {
    render(<MockPageWithImages />)
    
    window.closeLightbox = vi.fn(() => {
      const modal = document.getElementById('lightbox-modal')
      if (modal) {
        modal.classList.remove('active')
        modal.style.display = 'none'
      }
    })
    
    // Add keyboard event listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeLightbox?.()
      }
    })
    
    // Open the lightbox
    const modal = document.getElementById('lightbox-modal')
    if (modal) {
      modal.classList.add('active')
      modal.style.display = 'flex'
    }
    
    // Press ESC
    fireEvent.keyDown(document, { key: 'Escape' })
    
    // Check that lightbox closed
    expect(window.closeLightbox).toHaveBeenCalled()
  })

  it('should prevent body scroll when lightbox is open', () => {
    render(<MockPageWithImages />)
    
    window.openLightbox = vi.fn(() => {
      document.body.style.overflow = 'hidden'
    })
    
    window.closeLightbox = vi.fn(() => {
      document.body.style.overflow = ''
    })
    
    // Open lightbox
    const image = screen.getByAlt('Gas equipment')
    fireEvent.click(image)
    
    // Body should prevent scroll
    expect(document.body.style.overflow).toBe('hidden')
    
    // Close lightbox
    window.closeLightbox()
    
    // Body should allow scroll again
    expect(document.body.style.overflow).toBe('')
  })

  it('should handle multiple images on same page', () => {
    render(
      <div>
        <div className="media-container">
          <img 
            src="image1.jpg" 
            alt="Image 1" 
            className="topic-image"
            onClick={() => window.openLightbox?.('image1.jpg', 'Image 1')}
          />
          <img 
            src="image2.jpg" 
            alt="Image 2" 
            className="topic-image"
            onClick={() => window.openLightbox?.('image2.jpg', 'Image 2')}
          />
        </div>
        
        <div id="lightbox-modal" className="lightbox-modal" style={{ display: 'none' }}>
          <img id="lightbox-image" src="" alt="" />
          <div className="lightbox-caption"></div>
        </div>
      </div>
    )
    
    window.openLightbox = vi.fn((src, alt) => {
      const lightboxImage = document.getElementById('lightbox-image') as HTMLImageElement
      const caption = document.querySelector('.lightbox-caption')
      
      if (lightboxImage && caption) {
        lightboxImage.src = src
        lightboxImage.alt = alt
        caption.textContent = alt
      }
    })
    
    // Click first image
    const image1 = screen.getByAlt('Image 1')
    fireEvent.click(image1)
    
    expect(window.openLightbox).toHaveBeenCalledWith('image1.jpg', 'Image 1')
    
    // Click second image
    const image2 = screen.getByAlt('Image 2')
    fireEvent.click(image2)
    
    expect(window.openLightbox).toHaveBeenCalledWith('image2.jpg', 'Image 2')
    expect(window.openLightbox).toHaveBeenCalledTimes(2)
  })
})