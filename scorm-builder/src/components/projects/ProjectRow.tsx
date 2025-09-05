/**
 * ProjectRow Component
 * 
 * Individual row in the virtualized projects list
 * Layout: Pin star + folder icon + title block + last accessed + actions
 * Height: 56px with proper spacing and hover states
 */

import React, { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Folder, Star, MoreHorizontal } from 'lucide-react'
import { ProjectActions } from './ProjectActions'

// Project interface matching ProjectDashboard
interface Project {
  id: string
  name: string
  path?: string
  created: string
  lastAccessed?: string
  last_modified?: string
}

interface ProjectRowProps {
  project: Project
  supportPinning?: boolean
  isPinned?: boolean
  onPin?: (projectId: string, pinned: boolean) => void
  onOpen: (projectId: string, projectPath: string) => void
  onExport: (projectId: string) => void
  onDelete: (projectId: string) => void
  onRename: (projectId: string, currentName: string) => void
  onOpenFolder: (projectId: string) => void
}

export function ProjectRow({
  project,
  supportPinning = false,
  isPinned = false,
  onPin,
  onOpen,
  onExport,
  onDelete,
  onRename,
  onOpenFolder
}: ProjectRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  // Format last accessed date
  const formatLastAccessed = (project: Project) => {
    const date = project.lastAccessed || project.last_modified || project.created
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  const getAbsoluteDate = (project: Project) => {
    const date = project.lastAccessed || project.last_modified || project.created
    try {
      return new Date(date).toLocaleString()
    } catch {
      return ''
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        onOpen(project.id, project.path || '')
        break
      case 'Delete':
        e.preventDefault()
        if (onDelete) {
          onDelete(project.id)
        }
        break
      case 'F2':
        e.preventDefault()
        if (onRename) {
          onRename(project.id, project.name)
        }
        break
    }
  }

  // Handle double click
  const handleDoubleClick = () => {
    onOpen(project.id, project.path || '')
  }

  // Handle pin toggle
  const handlePinToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onPin) {
      onPin(project.id, !isPinned)
    }
  }

  // Show open button on hover or focus
  const shouldShowOpenButton = isHovered || isFocused

  return (
    <div
      ref={rowRef}
      role="row"
      tabIndex={0}
      className="group flex items-center h-14 px-4 hover:bg-gray-50 focus:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer border-b border-gray-100"
      aria-label={`${project.name} - ${project.path} - Last accessed ${formatLastAccessed(project)}`}
      aria-describedby={`project-${project.id}-desc`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden description for screen readers */}
      <div id={`project-${project.id}-desc`} className="sr-only">
        Project: {project.name}. Path: {project.path}. Last accessed {getAbsoluteDate(project)}.
        Press Enter to open, Delete to delete, F2 to rename.
      </div>

      {/* Pin star (optional) */}
      {supportPinning && (
        <div className="flex-shrink-0 w-6 mr-3">
          <button
            data-testid="pin-star"
            className={`p-1 hover:bg-gray-200 rounded ${
              isPinned ? 'text-yellow-500' : 'text-gray-400'
            }`}
            onClick={handlePinToggle}
            aria-label={isPinned ? 'Unpin project' : 'Pin project'}
          >
            <Star size={16} fill={isPinned ? 'currentColor' : 'none'} />
          </button>
        </div>
      )}

      {/* Folder icon */}
      <div className="flex-shrink-0 mr-3">
        <Folder data-testid="folder-icon" size={20} className="text-gray-500" />
      </div>

      {/* Title block */}
      <div className="flex-1 min-w-0 mr-4">
        <div
          className="font-semibold text-gray-900 truncate"
          title={project.name}
        >
          {project.name}
        </div>
        <div
          className="text-sm text-gray-500 font-mono truncate"
          title={project.path || 'No path specified'}
        >
          {project.path || 'No path specified'}
        </div>
      </div>

      {/* Last accessed */}
      <div className="flex-shrink-0 w-32 mr-4 text-sm text-gray-500">
        <span title={getAbsoluteDate(project)}>
          {formatLastAccessed(project)}
        </span>
      </div>

      {/* Actions area */}
      <div className="flex-shrink-0 flex items-center space-x-2" data-testid="project-actions">
        {/* Open button (visible on hover/focus) */}
        <button
          data-testid="open-button"
          className={`px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-opacity duration-150 ${
            shouldShowOpenButton ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onOpen(project.id, project.path || '')
          }}
          aria-label={`Open ${project.name}`}
        >
          Open
        </button>

        {/* Overflow menu */}
        <div className="relative">
          <button
            data-testid="overflow-menu"
            className="p-1 hover:bg-gray-200 rounded"
            onClick={(e) => {
              e.stopPropagation()
              setShowActions(!showActions)
            }}
            aria-label={`More actions for ${project.name}`}
            aria-expanded={showActions}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={16} className="text-gray-500" />
          </button>

          {/* Dropdown menu */}
          {showActions && (
            <ProjectActions
              projectId={project.id}
              projectName={project.name}
              onExport={onExport}
              onDelete={onDelete}
              onRename={onRename}
              onOpenFolder={onOpenFolder}
              onClose={() => setShowActions(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}