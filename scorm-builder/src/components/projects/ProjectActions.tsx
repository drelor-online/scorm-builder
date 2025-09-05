/**
 * ProjectActions Component
 * 
 * Dropdown menu for project actions (Export, Rename, Delete, Open Folder)
 * Used in ProjectRow overflow menu
 */

import React, { useEffect, useRef } from 'react'
import { Download, Edit, Trash2, FolderOpen } from 'lucide-react'

interface ProjectActionsProps {
  projectId: string
  projectName: string
  onExport: (projectId: string) => void
  onDelete: (projectId: string) => void
  onRename: (projectId: string, currentName: string) => void
  onOpenFolder: (projectId: string) => void
  onClose: () => void
}

export function ProjectActions({
  projectId,
  projectName,
  onExport,
  onDelete,
  onRename,
  onOpenFolder,
  onClose
}: ProjectActionsProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50"
      aria-label={`Actions for ${projectName}`}
    >
      <div className="py-1">
        <button
          role="menuitem"
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => handleAction(() => onExport(projectId))}
        >
          <Download size={16} className="mr-3 text-gray-400" />
          Export
        </button>

        <button
          role="menuitem"
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => handleAction(() => onRename(projectId, projectName))}
        >
          <Edit size={16} className="mr-3 text-gray-400" />
          Rename
        </button>

        <button
          role="menuitem"
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => handleAction(() => onOpenFolder(projectId))}
        >
          <FolderOpen size={16} className="mr-3 text-gray-400" />
          Open Folder
        </button>

        <div className="border-t border-gray-100 my-1" />

        <button
          role="menuitem"
          className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          onClick={() => handleAction(() => onDelete(projectId))}
        >
          <Trash2 size={16} className="mr-3 text-red-400" />
          Delete
        </button>
      </div>
    </div>
  )
}