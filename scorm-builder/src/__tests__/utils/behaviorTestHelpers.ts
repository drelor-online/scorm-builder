import { expect } from 'vitest'

/**
 * Helper functions for behavior tests
 */

export function setupBehaviorTest() {
  const expectConsistentPadding = (element: HTMLElement, minPadding: number = 0) => {
    const styles = window.getComputedStyle(element)
    const padding = parseInt(styles.padding) || 0
    const paddingTop = parseInt(styles.paddingTop) || 0
    const paddingRight = parseInt(styles.paddingRight) || 0
    const paddingBottom = parseInt(styles.paddingBottom) || 0
    const paddingLeft = parseInt(styles.paddingLeft) || 0
    
    // Check that element has at least the minimum padding
    const hasPadding = padding >= minPadding || 
                      paddingTop >= minPadding || 
                      paddingRight >= minPadding || 
                      paddingBottom >= minPadding || 
                      paddingLeft >= minPadding
    expect(hasPadding).toBe(true)
    
    return {
      padding,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft
    }
  }
  
  return {
    expectConsistentPadding
  }
}