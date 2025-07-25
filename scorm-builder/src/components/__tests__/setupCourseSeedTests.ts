import '@testing-library/jest-dom'
import '../DesignSystem/designSystem.css'

// Mock computed styles for CourseSeedInput components
const originalGetComputedStyle = window.getComputedStyle

window.getComputedStyle = function(element: Element): CSSStyleDeclaration {
  const styles = originalGetComputedStyle(element)
  
  // Mock Section styles
  if (element.classList.contains('section')) {
    Object.defineProperty(styles, 'marginBottom', {
      value: '32px',
      configurable: true
    })
  }
  
  // Mock Card styles
  if (element.classList.contains('card')) {
    Object.defineProperty(styles, 'boxShadow', {
      value: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      configurable: true
    })
    Object.defineProperty(styles, 'borderRadius', {
      value: '12px',
      configurable: true
    })
  }
  
  // Mock Input focus styles
  if (element.classList.contains('input') && element === document.activeElement) {
    Object.defineProperty(styles, 'borderColor', {
      value: 'rgb(59, 130, 246)',
      configurable: true
    })
    Object.defineProperty(styles, 'boxShadow', {
      value: '0 0 0 3px rgba(59, 130, 246, 0.1)',
      configurable: true
    })
  }
  
  return styles
}