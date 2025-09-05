/**
 * useSortAndFilter Hook
 * 
 * Headless hook for client-side search and sort functionality
 * Uses fuse.js for fuzzy search on title and path
 * Supports sorting by title, lastAccessed, and folder path
 * Optimized for performance with large datasets
 */

import { useMemo } from 'react'
import Fuse from 'fuse.js'

// Project interface matching ProjectDashboard
interface Project {
  id: string
  name: string
  path?: string
  created: string
  lastAccessed?: string
  last_modified?: string
}

export type SortKey = 'title' | 'lastAccessed' | 'folder'
export type SortDirection = 'asc' | 'desc'

/**
 * Hook for sorting and filtering projects
 */
export function useSortAndFilter(
  projects: Project[],
  searchQuery: string,
  sortKey: SortKey,
  sortDirection: SortDirection
): Project[] {
  return useMemo(() => {
    // Start with all projects
    let filteredProjects = [...projects]

    // Apply search filter if query exists
    const trimmedQuery = searchQuery.trim()
    if (trimmedQuery) {
      // Configure Fuse.js for fuzzy search with more restrictive threshold
      const fuseOptions = {
        keys: [
          { name: 'name', weight: 0.7 }, // Higher weight for project name
          { name: 'path', weight: 0.3 }  // Lower weight for path
        ],
        threshold: 0.3, // More restrictive for better matching
        includeScore: true,
        ignoreLocation: true, // Search entire string, not just beginning
        minMatchCharLength: 1
      }

      const fuse = new Fuse(projects, fuseOptions)
      const searchResults = fuse.search(trimmedQuery)
      filteredProjects = searchResults.map(result => result.item)
    }

    // Apply sorting
    filteredProjects.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortKey) {
        case 'title':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break

        case 'lastAccessed':
          // Use lastAccessed, fallback to last_modified, then created
          aValue = new Date(a.lastAccessed || a.last_modified || a.created).getTime()
          bValue = new Date(b.lastAccessed || b.last_modified || b.created).getTime()
          break

        case 'folder':
          // Extract folder part of path for sorting
          aValue = extractFolderPath(a.path || '').toLowerCase()
          bValue = extractFolderPath(b.path || '').toLowerCase()
          break

        default:
          // No sorting for unknown keys - preserve order
          return 0
      }

      // Compare values
      let comparison = 0
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue)
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      }

      // Apply sort direction
      return sortDirection === 'desc' ? -comparison : comparison
    })

    return filteredProjects
  }, [projects, searchQuery, sortKey, sortDirection])
}

/**
 * Extract folder path from full path
 * e.g., "/Users/john/projects/my-project" -> "/Users/john/projects"
 */
function extractFolderPath(fullPath: string): string {
  if (!fullPath) return ''
  
  const pathParts = fullPath.split(/[/\\]/)
  // Remove the last part (filename/project name) to get folder
  return pathParts.slice(0, -1).join('/')
}