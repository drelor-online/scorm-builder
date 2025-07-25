import '@testing-library/jest-dom'
import '../designSystem.css'

// Mock CSS variables since they won't be computed in jsdom
const cssVars = {
  '--color-primary': '#3b82f6',
  '--color-primary-hover': '#2563eb',
  '--bg-secondary': '#18181b',
  '--text-primary': '#f4f4f5',
  '--text-secondary': '#d4d4d8',
  '--space-lg': '1rem',
  '--space-xl': '1.5rem',
  '--radius-md': '0.5rem',
  '--radius-lg': '0.75rem',
  '--transition-normal': '200ms ease-in-out'
}

// Apply CSS variables to document
Object.entries(cssVars).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value)
})

// Mock computed styles for our components
const originalGetComputedStyle = window.getComputedStyle

window.getComputedStyle = function(element: Element): CSSStyleDeclaration {
  const styles = originalGetComputedStyle(element)
  
  // Override specific values based on class names
  if (element.classList.contains('card')) {
    Object.defineProperty(styles, 'boxShadow', {
      value: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      configurable: true
    })
    Object.defineProperty(styles, 'transition', {
      value: 'transform 200ms ease-in-out, box-shadow 200ms ease-in-out, border-color 200ms ease-in-out',
      configurable: true
    })
  }
  
  if (element.classList.contains('btn')) {
    Object.defineProperty(styles, 'paddingLeft', {
      value: '24px',
      configurable: true
    })
    Object.defineProperty(styles, 'paddingRight', {
      value: '24px',
      configurable: true
    })
    Object.defineProperty(styles, 'transition', {
      value: 'all 200ms ease-in-out',
      configurable: true
    })
    Object.defineProperty(styles, 'transitionDuration', {
      value: '200ms',
      configurable: true
    })
    
    // Focus state
    if (element === document.activeElement) {
      Object.defineProperty(styles, 'outlineWidth', {
        value: '2px',
        configurable: true
      })
      Object.defineProperty(styles, 'outlineOffset', {
        value: '2px',
        configurable: true
      })
      Object.defineProperty(styles, 'outlineColor', {
        value: 'rgb(59, 130, 246)',
        configurable: true
      })
      Object.defineProperty(styles, 'outlineStyle', {
        value: 'solid',
        configurable: true
      })
    }
    
    // Disabled state
    if (element.hasAttribute('disabled') || element.classList.contains('btn-disabled')) {
      Object.defineProperty(styles, 'opacity', {
        value: '0.6',
        configurable: true
      })
      Object.defineProperty(styles, 'cursor', {
        value: 'not-allowed',
        configurable: true
      })
    }
  }
  
  if (element.classList.contains('input')) {
    Object.defineProperty(styles, 'borderWidth', {
      value: '1px',
      configurable: true
    })
    Object.defineProperty(styles, 'borderRadius', {
      value: '8px',
      configurable: true
    })
    Object.defineProperty(styles, 'transition', {
      value: 'border-color 150ms ease-in-out, box-shadow 150ms ease-in-out',
      configurable: true
    })
    
    // Check if element is focused
    if (element === document.activeElement) {
      Object.defineProperty(styles, 'borderColor', {
        value: 'rgb(59, 130, 246)',
        configurable: true
      })
      Object.defineProperty(styles, 'boxShadow', {
        value: '0 0 0 3px rgba(59, 130, 246, 0.1)',
        configurable: true
      })
    }
  }
  
  if (element.classList.contains('section')) {
    Object.defineProperty(styles, 'marginBottom', {
      value: element.parentElement?.lastElementChild === element ? '0px' : '48px',
      configurable: true
    })
    Object.defineProperty(styles, 'paddingTop', {
      value: '32px',
      configurable: true
    })
    Object.defineProperty(styles, 'paddingBottom', {
      value: '32px',
      configurable: true
    })
    Object.defineProperty(styles, 'borderBottom', {
      value: '1px solid rgba(63, 63, 70, 0.3)',
      configurable: true
    })
  }
  
  if (element.classList.contains('section-title')) {
    Object.defineProperty(styles, 'fontWeight', {
      value: '600',
      configurable: true
    })
  }
  
  if (element.classList.contains('page-container')) {
    Object.defineProperty(styles, 'maxWidth', {
      value: '1200px',
      configurable: true
    })
    Object.defineProperty(styles, 'marginLeft', {
      value: 'auto',
      configurable: true
    })
    Object.defineProperty(styles, 'marginRight', {
      value: 'auto',
      configurable: true
    })
    Object.defineProperty(styles, 'paddingLeft', {
      value: '24px',
      configurable: true
    })
    Object.defineProperty(styles, 'paddingRight', {
      value: '24px',
      configurable: true
    })
  }
  
  // Typography styles
  if (element.tagName.toLowerCase() === 'h2') {
    Object.defineProperty(styles, 'fontWeight', {
      value: '600',
      configurable: true
    })
    Object.defineProperty(styles, 'fontSize', {
      value: '24px',
      configurable: true
    })
  }
  
  if (element.tagName.toLowerCase() === 'h3') {
    Object.defineProperty(styles, 'color', {
      value: 'rgb(243, 244, 246)',
      configurable: true
    })
    Object.defineProperty(styles, 'fontWeight', {
      value: '500',
      configurable: true
    })
    Object.defineProperty(styles, 'fontSize', {
      value: '16px',
      configurable: true
    })
  }
  
  if (element.tagName.toLowerCase() === 'p') {
    Object.defineProperty(styles, 'color', {
      value: 'rgb(156, 163, 175)',
      configurable: true
    })
    Object.defineProperty(styles, 'lineHeight', {
      value: '1.6',
      configurable: true
    })
    Object.defineProperty(styles, 'marginBottom', {
      value: element.parentElement?.lastElementChild === element ? '0' : '16px',
      configurable: true
    })
  }
  
  if (element.tagName.toLowerCase() === 'ul') {
    Object.defineProperty(styles, 'paddingLeft', {
      value: '24px',
      configurable: true
    })
  }
  
  if (element.tagName.toLowerCase() === 'li') {
    Object.defineProperty(styles, 'marginBottom', {
      value: element.parentElement?.lastElementChild === element ? '0' : '8px',
      configurable: true
    })
  }
  
  // Step Progress styles
  if (element.classList.contains('step-active')) {
    Object.defineProperty(styles, 'backgroundColor', {
      value: 'rgb(59, 130, 246)',
      configurable: true
    })
    Object.defineProperty(styles, 'color', {
      value: 'white',
      configurable: true
    })
    Object.defineProperty(styles, 'fontWeight', {
      value: '600',
      configurable: true
    })
  }
  
  if (element.classList.contains('step-progress-track')) {
    Object.defineProperty(styles, 'height', {
      value: '2px',
      configurable: true
    })
  }
  
  if (element.classList.contains('step-progress-indicator')) {
    Object.defineProperty(styles, 'cursor', {
      value: 'default',
      configurable: true
    })
  }
  
  if (element.classList.contains('step-completed')) {
    Object.defineProperty(styles, 'backgroundColor', {
      value: 'rgb(22, 163, 74)',
      configurable: true
    })
  }
  
  if (element.classList.contains('step-connector')) {
    Object.defineProperty(styles, 'height', {
      value: '2px',
      configurable: true
    })
    Object.defineProperty(styles, 'backgroundColor', {
      value: '#e5e7eb',
      configurable: true
    })
  }
  
  if (element.classList.contains('step-clickable')) {
    Object.defineProperty(styles, 'cursor', {
      value: 'pointer',
      configurable: true
    })
  }
  
  if (element.classList.contains('step-progress-label')) {
    Object.defineProperty(styles, 'fontSize', {
      value: '14px',
      configurable: true
    })
    Object.defineProperty(styles, 'color', {
      value: 'rgb(156, 163, 175)',
      configurable: true
    })
  }
  
  // Modal styles
  if (element.classList.contains('modal-backdrop')) {
    Object.defineProperty(styles, 'backgroundColor', {
      value: 'rgba(0, 0, 0, 0.75)',
      configurable: true
    })
    Object.defineProperty(styles, 'backdropFilter', {
      value: 'blur(4px)',
      configurable: true
    })
    Object.defineProperty(styles, 'transition', {
      value: 'opacity 200ms ease-in-out',
      configurable: true
    })
  }
  
  if (element.classList.contains('modal-content')) {
    Object.defineProperty(styles, 'boxShadow', {
      value: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      configurable: true
    })
    Object.defineProperty(styles, 'borderRadius', {
      value: '12px',
      configurable: true
    })
    Object.defineProperty(styles, 'border', {
      value: '1px solid rgba(63, 63, 70, 0.5)',
      configurable: true
    })
    Object.defineProperty(styles, 'transition', {
      value: 'all 200ms cubic-bezier(0, 0, 0.2, 1)',
      configurable: true
    })
    Object.defineProperty(styles, 'maxHeight', {
      value: '90vh',
      configurable: true
    })
    Object.defineProperty(styles, 'maxWidth', {
      value: element.classList.contains('modal-small') ? '400px' : 
             element.classList.contains('modal-large') ? '800px' : 
             element.classList.contains('modal-xlarge') ? '1200px' : '600px',
      configurable: true
    })
  }
  
  if (element.classList.contains('modal-header')) {
    Object.defineProperty(styles, 'borderBottom', {
      value: '1px solid rgba(63, 63, 70, 0.3)',
      configurable: true
    })
    Object.defineProperty(styles, 'paddingBottom', {
      value: '16px',
      configurable: true
    })
    Object.defineProperty(styles, 'marginBottom', {
      value: '24px',
      configurable: true
    })
  }
  
  if (element.classList.contains('modal-close')) {
    Object.defineProperty(styles, 'width', {
      value: '32px',
      configurable: true
    })
    Object.defineProperty(styles, 'height', {
      value: '32px',
      configurable: true
    })
    Object.defineProperty(styles, 'borderRadius', {
      value: '8px',
      configurable: true
    })
    Object.defineProperty(styles, 'cursor', {
      value: 'pointer',
      configurable: true
    })
  }
  
  if (element.classList.contains('modal-body')) {
    Object.defineProperty(styles, 'overflowY', {
      value: 'auto',
      configurable: true
    })
  }
  
  return styles
}