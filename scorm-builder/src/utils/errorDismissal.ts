/**
 * Utility functions for managing dismissed error messages in localStorage
 * Prevents users from seeing the same error messages repeatedly
 */

const DISMISSED_ERRORS_KEY = 'dismissedErrors'

/**
 * Get the list of dismissed error messages from localStorage
 */
export function getDismissedErrors(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_ERRORS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn('Failed to read dismissed errors from localStorage:', error)
    return []
  }
}

/**
 * Check if a specific error message has been dismissed
 */
export function isErrorDismissed(errorMessage: string): boolean {
  const dismissedErrors = getDismissedErrors()
  return dismissedErrors.includes(errorMessage)
}

/**
 * Mark an error message as dismissed
 */
export function dismissError(errorMessage: string): void {
  try {
    const dismissedErrors = getDismissedErrors()
    
    // Avoid duplicates
    if (!dismissedErrors.includes(errorMessage)) {
      dismissedErrors.push(errorMessage)
      
      // Limit to 50 dismissed errors to prevent localStorage bloat
      if (dismissedErrors.length > 50) {
        dismissedErrors.shift() // Remove oldest
      }
      
      localStorage.setItem(DISMISSED_ERRORS_KEY, JSON.stringify(dismissedErrors))
    }
  } catch (error) {
    console.warn('Failed to save dismissed error to localStorage:', error)
  }
}

/**
 * Clear all dismissed errors (useful for testing or reset)
 */
export function clearDismissedErrors(): void {
  try {
    localStorage.removeItem(DISMISSED_ERRORS_KEY)
  } catch (error) {
    console.warn('Failed to clear dismissed errors from localStorage:', error)
  }
}

/**
 * Remove a specific error from the dismissed list (if user wants to see it again)
 */
export function undismissError(errorMessage: string): void {
  try {
    const dismissedErrors = getDismissedErrors()
    const updatedErrors = dismissedErrors.filter(msg => msg !== errorMessage)
    localStorage.setItem(DISMISSED_ERRORS_KEY, JSON.stringify(updatedErrors))
  } catch (error) {
    console.warn('Failed to undismiss error in localStorage:', error)
  }
}