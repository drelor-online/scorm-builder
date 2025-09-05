/**
 * Tests for useSortAndFilter hook
 * 
 * Tests the headless logic for:
 * - Fuzzy search with fuse.js (title + path)
 * - Sorting by Title, Last Accessed, Folder Path
 * - Sort direction toggles
 * - Performance requirements
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSortAndFilter } from './useSortAndFilter'

// Mock project data matching ProjectDashboard interface
const mockProjects = [
  {
    id: 'project-1',
    name: 'Introduction to React',
    path: '/Users/john/projects/react-intro',
    created: '2024-01-15T10:00:00Z',
    lastAccessed: '2024-01-20T14:30:00Z',
    last_modified: '2024-01-19T16:45:00Z'
  },
  {
    id: 'project-2',
    name: 'Advanced TypeScript Course',
    path: '/Users/john/projects/typescript-advanced',
    created: '2024-01-10T09:00:00Z',
    lastAccessed: '2024-01-18T11:15:00Z',
    last_modified: '2024-01-17T13:20:00Z'
  },
  {
    id: 'project-3',
    name: 'JavaScript Fundamentals',
    path: '/Users/jane/development/js-fundamentals',
    created: '2024-01-05T08:00:00Z',
    lastAccessed: '2024-01-25T09:45:00Z',
    last_modified: '2024-01-24T17:30:00Z'
  },
  {
    id: 'project-4',
    name: 'Python for Beginners',
    path: '/Users/bob/courses/python-basics',
    created: '2024-01-01T07:00:00Z',
    lastAccessed: '2024-01-16T10:20:00Z',
    last_modified: '2024-01-15T14:10:00Z'
  }
]

describe('useSortAndFilter', () => {
  describe('Initial State', () => {
    it('should return all projects sorted by title when title/asc applied', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'title', 'asc')
      )

      // Should be sorted alphabetically by title
      const expectedOrder = ['Advanced TypeScript Course', 'Introduction to React', 'JavaScript Fundamentals', 'Python for Beginners']
      const actualTitles = result.current.map(p => p.name)
      expect(actualTitles).toEqual(expectedOrder)
    })

    it('should accept different sort keys and directions', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'lastAccessed', 'desc')
      )

      // Should return projects sorted by last accessed descending
      expect(result.current[0].id).toBe('project-3') // Most recent: Jan 25
      expect(result.current[1].id).toBe('project-1') // Jan 20
      expect(result.current[2].id).toBe('project-2') // Jan 18
      expect(result.current[3].id).toBe('project-4') // Jan 16
    })
  })

  describe('Search/Filter Functionality', () => {
    it('should filter by project name (fuzzy search)', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, 'react', 'title', 'asc')
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('Introduction to React')
    })

    it('should filter by project path (fuzzy search)', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, 'jane', 'title', 'asc')
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('JavaScript Fundamentals')
      expect(result.current[0].path).toContain('jane')
    })

    it('should handle partial matches (fuzzy)', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, 'type', 'title', 'asc')
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('Advanced TypeScript Course')
    })

    it('should handle case-insensitive search', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, 'PYTHON', 'title', 'asc')
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('Python for Beginners')
    })

    it('should return empty array when no matches found', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, 'nonexistent', 'title', 'asc')
      )

      expect(result.current).toHaveLength(0)
    })

    it('should handle empty search query', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'title', 'asc')
      )

      expect(result.current).toHaveLength(mockProjects.length)
    })

    it('should handle whitespace-only search query', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '   ', 'title', 'asc')
      )

      expect(result.current).toHaveLength(mockProjects.length)
    })
  })

  describe('Sort Functionality', () => {
    it('should sort by title ascending', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'title', 'asc')
      )

      const titles = result.current.map(p => p.name)
      expect(titles).toEqual([
        'Advanced TypeScript Course',
        'Introduction to React', 
        'JavaScript Fundamentals',
        'Python for Beginners'
      ])
    })

    it('should sort by title descending', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'title', 'desc')
      )

      const titles = result.current.map(p => p.name)
      expect(titles).toEqual([
        'Python for Beginners',
        'JavaScript Fundamentals',
        'Introduction to React',
        'Advanced TypeScript Course'
      ])
    })

    it('should sort by lastAccessed ascending (oldest first)', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'lastAccessed', 'asc')
      )

      const ids = result.current.map(p => p.id)
      expect(ids).toEqual(['project-4', 'project-2', 'project-1', 'project-3'])
    })

    it('should sort by lastAccessed descending (newest first)', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'lastAccessed', 'desc')
      )

      const ids = result.current.map(p => p.id)
      expect(ids).toEqual(['project-3', 'project-1', 'project-2', 'project-4'])
    })

    it('should sort by folder path', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'folder', 'asc')
      )

      // Should sort by folder part of path
      const paths = result.current.map(p => p.path)
      expect(paths[0]).toContain('bob') // /Users/bob/courses/python-basics
      expect(paths[1]).toContain('jane') // /Users/jane/development/js-fundamentals  
      expect(paths[2]).toContain('john/projects') // /Users/john/projects/react-intro
      expect(paths[3]).toContain('john/projects') // /Users/john/projects/typescript-advanced
    })

    it('should handle sorting with search applied', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, 'john', 'title', 'desc')
      )

      // Should find both john projects and sort by title desc
      expect(result.current).toHaveLength(2)
      expect(result.current[0].name).toBe('Introduction to React')
      expect(result.current[1].name).toBe('Advanced TypeScript Course')
    })

    it('should handle invalid sort keys gracefully', () => {
      const { result } = renderHook(() => 
        useSortAndFilter(mockProjects, '', 'invalid' as any, 'asc')
      )

      // Should return projects unsorted but still filtered
      expect(result.current).toHaveLength(mockProjects.length)
    })
  })

  describe('Dynamic Updates', () => {
    it('should update results when projects change', () => {
      const { result, rerender } = renderHook(
        ({ projects }) => useSortAndFilter(projects, 'react', 'title', 'asc'),
        { initialProps: { projects: mockProjects } }
      )

      expect(result.current).toHaveLength(1)

      // Add another React project
      const updatedProjects = [...mockProjects, {
        id: 'project-5',
        name: 'React Native Basics',
        path: '/Users/alice/mobile/react-native',
        created: '2024-01-20T10:00:00Z',
        lastAccessed: '2024-01-21T14:30:00Z',
        last_modified: '2024-01-21T16:45:00Z'
      }]

      rerender({ projects: updatedProjects })

      expect(result.current).toHaveLength(2)
      expect(result.current.some(p => p.name === 'React Native Basics')).toBe(true)
    })

    it('should update results when search query changes', () => {
      const { result, rerender } = renderHook(
        ({ query }) => useSortAndFilter(mockProjects, query, 'title', 'asc'),
        { initialProps: { query: 'react' } }
      )

      expect(result.current).toHaveLength(1)

      rerender({ query: 'python' })

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('Python for Beginners')
    })

    it('should update results when sort changes', () => {
      const { result, rerender } = renderHook(
        ({ sortKey, sortDir }) => useSortAndFilter(mockProjects, '', sortKey, sortDir),
        { initialProps: { sortKey: 'title' as const, sortDir: 'asc' as const } }
      )

      const initialOrder = result.current.map(p => p.name)
      expect(initialOrder[0]).toBe('Advanced TypeScript Course')

      rerender({ sortKey: 'title', sortDir: 'desc' })

      const newOrder = result.current.map(p => p.name)
      expect(newOrder[0]).toBe('Python for Beginners')
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `project-${i}`,
        name: `Project ${i}`,
        path: `/path/to/project-${i}`,
        created: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-02T00:00:00Z',
        last_modified: '2024-01-01T12:00:00Z'
      }))

      const startTime = performance.now()
      
      const { result } = renderHook(() => 
        useSortAndFilter(largeDataset, 'Project 1', 'title', 'asc')
      )

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Should process 1000 items in under 50ms
      expect(executionTime).toBeLessThan(50)
      expect(result.current.length).toBeGreaterThan(0)
    })

    it('should be efficient with frequent updates', () => {
      const { result, rerender } = renderHook(
        ({ query }) => useSortAndFilter(mockProjects, query, 'title', 'asc'),
        { initialProps: { query: '' } }
      )

      const startTime = performance.now()
      
      // Simulate rapid typing
      const queries = ['r', 're', 'rea', 'reac', 'react']
      queries.forEach(query => {
        rerender({ query })
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle rapid updates efficiently
      expect(totalTime).toBeLessThan(10)
      expect(result.current).toHaveLength(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty projects array', () => {
      const { result } = renderHook(() => 
        useSortAndFilter([], 'search', 'title', 'asc')
      )

      expect(result.current).toEqual([])
    })

    it('should handle projects with missing fields', () => {
      const incompleteProjects = [
        {
          id: 'project-1',
          name: 'Complete Project',
          path: '/full/path',
          created: '2024-01-01T00:00:00Z',
          lastAccessed: '2024-01-02T00:00:00Z',
          last_modified: '2024-01-01T12:00:00Z'
        },
        {
          id: 'project-2',
          name: 'Incomplete Project',
          path: '',
          created: '2024-01-01T00:00:00Z',
          // Missing lastAccessed and last_modified
        }
      ] as any[]

      const { result } = renderHook(() => 
        useSortAndFilter(incompleteProjects, '', 'lastAccessed', 'desc')
      )

      // Should handle gracefully without crashing
      expect(result.current).toHaveLength(2)
      expect(result.current[0].name).toBe('Complete Project')
    })

    it('should handle special characters in search', () => {
      const specialProjects = [
        {
          id: 'project-1',
          name: 'Project (v2.0)',
          path: '/path/with spaces/and-dashes',
          created: '2024-01-01T00:00:00Z',
          lastAccessed: '2024-01-02T00:00:00Z',
          last_modified: '2024-01-01T12:00:00Z'
        }
      ]

      const { result } = renderHook(() => 
        useSortAndFilter(specialProjects, '(v2.0)', 'title', 'asc')
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('Project (v2.0)')
    })
  })
})