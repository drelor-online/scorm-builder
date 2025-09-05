/**
 * Unified project types and data helpers
 * 
 * Handles data mismatches between different project field names
 * and provides consistent access methods
 */

export type ProjectRow = {
  id: string
  name: string
  path?: string
  filePath?: string
  created?: string
  lastAccessed?: string
  last_modified?: string
}

/**
 * Get the project path, handling both path and filePath fields
 */
export function getProjectPath(p: ProjectRow): string {
  return p.path || p.filePath || ''
}

/**
 * Get the last accessed date, with fallback priority
 */
export function getLastAccessed(p: ProjectRow): string {
  return p.lastAccessed || p.last_modified || p.created || ''
}