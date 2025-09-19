/**
 * Project ID Extraction Utility
 *
 * Shared utility to ensure consistent project ID extraction across
 * FileStorage and coordinatedProjectLoading.
 */

/**
 * Extract actual project ID from path if needed
 * ProjectId might be a full path like "C:\...\project.scormproj" or just an ID like "1234567890"
 */
export const extractProjectId = (id: string): string => {
  if (!id) return ''

  // If it's a path, extract the project ID from the filename
  if (id.includes('.scormproj')) {
    // Extract from path like "...\ProjectName_1234567890.scormproj"
    const filename = id.split('\\').pop() || id.split('/').pop() || id
    const match = filename.match(/_(\d+)\.scormproj$/)
    if (match) {
      return match[1]
    }
    // Fallback: try to get ID from the beginning if no underscore pattern
    const idMatch = filename.match(/^(\d+)/)
    if (idMatch) {
      return idMatch[1]
    }
  }

  // If it's already just an ID (all digits), return as-is
  if (/^\d+$/.test(id)) {
    return id
  }

  // Last resort: return the original
  return id
}