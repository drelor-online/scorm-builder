/**
 * ProjectsList Component
 * 
 * Virtualized table-style list for projects with search and sort
 * Uses react-virtuoso for performance with large datasets
 * Replaces the card grid in ProjectDashboard
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { ProjectRow } from './ProjectRow'
import { useSortAndFilter, SortKey, SortDirection } from '../../hooks/useSortAndFilter'

// Project interface matching ProjectDashboard
interface Project {
  id: string
  name: string
  path?: string
  created: string
  lastAccessed?: string
  last_modified?: string
}

interface ProjectsListProps {
  projects: Project[]
  supportPinning?: boolean
  pinnedProjects?: Set<string>
  searchPlaceholder?: string
  onOpen: (projectId: string, projectPath: string) => void
  onExport: (projectId: string) => void
  onDelete: (projectId: string) => void
  onRename: (projectId: string, currentName: string) => void
  onOpenFolder: (projectId: string) => void
  onPin?: (projectId: string, pinned: boolean) => void
  onSearchChange?: (query: string) => void
  className?: string
}

const STORAGE_KEYS = {
  SEARCH_QUERY: 'projects-list-search',
  SORT_KEY: 'projects-list-sort-key',
  SORT_DIRECTION: 'projects-list-sort-direction'
}

export function ProjectsList({
  projects = [],
  supportPinning = false,
  pinnedProjects = new Set(),
  searchPlaceholder = "Search projects by name or path...",
  onOpen,
  onExport,
  onDelete,
  onRename,
  onOpenFolder,
  onPin,
  onSearchChange,
  className = ''
}: ProjectsListProps) {
  // Load settings from localStorage
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SEARCH_QUERY) || ''
    } catch {
      return ''
    }
  })

  const [sortKey, setSortKey] = useState<SortKey>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEYS.SORT_KEY) as SortKey) || 'lastAccessed'
    } catch {
      return 'lastAccessed'
    }
  })

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEYS.SORT_DIRECTION) as SortDirection) || 'desc'
    } catch {
      return 'desc'
    }
  })

  const searchInputRef = useRef<HTMLInputElement>(null)
  const virtuosoRef = useRef(null)
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_QUERY, searchQuery)
    } catch {
      // Ignore localStorage errors
    }
  }, [searchQuery])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SORT_KEY, sortKey)
    } catch {
      // Ignore localStorage errors
    }
  }, [sortKey])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SORT_DIRECTION, sortDirection)
    } catch {
      // Ignore localStorage errors
    }
  }, [sortDirection])

  // Get filtered and sorted projects
  const filteredProjects = useSortAndFilter(projects, searchQuery, sortKey, sortDirection)

  // Separate pinned and unpinned projects
  const { pinnedList, unpinnedList } = useMemo(() => {
    if (!supportPinning || pinnedProjects.size === 0) {
      return { pinnedList: [], unpinnedList: filteredProjects }
    }

    const pinned = filteredProjects.filter(p => pinnedProjects.has(p.id))
    const unpinned = filteredProjects.filter(p => !pinnedProjects.has(p.id))
    
    return { pinnedList: pinned, unpinnedList: unpinned }
  }, [filteredProjects, pinnedProjects, supportPinning])

  // Combined list with pinned projects first
  const displayProjects = useMemo(() => {
    return [...pinnedList, ...unpinnedList]
  }, [pinnedList, unpinnedList])

  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    // Clear previous timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }

    // Set new timer for debounced search
    const timer = setTimeout(() => {
      setSearchQuery(value)
      onSearchChange?.(value)
    }, 150) // 150ms debounce as specified

    setSearchDebounceTimer(timer)
  }, [searchDebounceTimer, onSearchChange])

  // Immediate input value state for responsive UI
  const [searchInputValue, setSearchInputValue] = useState(searchQuery)

  // Handle search input change
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInputValue(value)
    handleSearchChange(value)
  }

  // Handle sort column click
  const handleSortChange = useCallback((newSortKey: SortKey) => {
    if (sortKey === newSortKey) {
      // Toggle direction if same column
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to desc for lastAccessed, asc for others
      setSortKey(newSortKey)
      setSortDirection(newSortKey === 'lastAccessed' ? 'desc' : 'asc')
    }
  }, [sortKey])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' key (when not in input)
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !isInInput(e.target)) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      
      // Escape to clear search
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchInputValue('')
        handleSearchChange('')
        searchInputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSearchChange])

  // Helper to check if target is an input element
  const isInInput = (target: EventTarget | null): boolean => {
    if (!target) return false
    const element = target as HTMLElement
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.contentEditable === 'true'
  }

  // Render individual project row
  const renderProject = useCallback((index: number) => {
    const project = displayProjects[index]
    if (!project) return null

    return (
      <ProjectRow
        key={project.id}
        project={project}
        supportPinning={supportPinning}
        isPinned={pinnedProjects.has(project.id)}
        onPin={onPin}
        onOpen={onOpen}
        onExport={onExport}
        onDelete={onDelete}
        onRename={onRename}
        onOpenFolder={onOpenFolder}
      />
    )
  }, [displayProjects, supportPinning, pinnedProjects, onPin, onOpen, onExport, onDelete, onRename, onOpenFolder])

  // Get sort icon
  const getSortIcon = (columnKey: SortKey) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown size={14} className="text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className="text-blue-600" />
      : <ArrowDown size={14} className="text-blue-600" />
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`} data-testid="projects-list">
      {/* Header with search */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="relative">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchInputValue}
            onChange={handleSearchInputChange}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            data-testid="search-input"
            aria-label="Search projects"
          />
          {searchInputValue && (
            <button
              onClick={() => {
                setSearchInputValue('')
                handleSearchChange('')
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex-shrink-0 flex items-center h-12 px-4 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
        {/* Pin column spacer */}
        {supportPinning && <div className="w-6 mr-3" />}
        
        {/* Icon column spacer */}
        <div className="flex-shrink-0 mr-3 w-5" />

        {/* Title column */}
        <button
          className="flex-1 flex items-center space-x-2 text-left hover:text-gray-900"
          onClick={() => handleSortChange('title')}
          data-testid="sort-title"
        >
          <span>Title</span>
          {getSortIcon('title')}
        </button>

        {/* Last accessed column */}
        <button
          className="flex-shrink-0 w-32 flex items-center space-x-2 text-left hover:text-gray-900 mr-4"
          onClick={() => handleSortChange('lastAccessed')}
          data-testid="sort-last-accessed"
        >
          <span>Last Accessed</span>
          {getSortIcon('lastAccessed')}
        </button>

        {/* Actions column spacer */}
        <div className="flex-shrink-0 w-24">Actions</div>
      </div>

      {/* Results info */}
      <div className="flex-shrink-0 px-4 py-2 text-sm text-gray-600 bg-gray-50 border-b border-gray-200">
        {searchQuery ? (
          <span>
            {displayProjects.length} of {projects.length} projects
            {pinnedList.length > 0 && ` (${pinnedList.length} pinned)`}
          </span>
        ) : (
          <span>
            {projects.length} projects
            {pinnedList.length > 0 && ` (${pinnedList.length} pinned)`}
          </span>
        )}
      </div>

      {/* Virtualized project list */}
      <div className="flex-1 min-h-0">
        {displayProjects.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <div className="text-lg mb-2">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </div>
              <div className="text-sm">
                {searchQuery ? (
                  <>Try adjusting your search terms</>
                ) : (
                  <>Create your first project to get started</>
                )}
              </div>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={displayProjects.length}
            itemContent={renderProject}
            overscan={5}
            data-testid="virtualized-list"
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}