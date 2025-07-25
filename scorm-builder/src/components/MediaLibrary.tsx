import React, { useState, useCallback, useMemo, useRef } from 'react'
import { Card, Button, Input, EmptyState } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import { Toast } from './Toast'

export interface MediaItem {
  id: string
  name: string
  type: 'image' | 'video' | 'audio' | 'document'
  url: string
  thumbnailUrl?: string
  size: number
  duration?: number
  uploadedAt: Date
  tags?: string[]
}

interface MediaLibraryProps {
  items: MediaItem[]
  onSelect: (item: MediaItem | MediaItem[]) => void
  onUpload: (file: { file: File; name: string; type: string; size: number }) => void
  onDelete: (id: string) => void
  multiSelect?: boolean
  acceptedFileTypes?: string[]
}

type FilterType = 'all' | 'image' | 'video' | 'audio' | 'document'
type SortBy = 'date' | 'name' | 'size'

export function MediaLibrary({
  items,
  onSelect,
  onUpload,
  onDelete,
  multiSelect = false,
  acceptedFileTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf']
}: MediaLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    items.forEach(item => item.tags?.forEach(tag => tags.add(tag)))
    return Array.from(tags).sort()
  }, [items])

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let filtered = items

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType)
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter(item => item.tags?.includes(selectedTag))
    }

    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'size':
          return b.size - a.size
        case 'date':
        default:
          return b.uploadedAt.getTime() - a.uploadedAt.getTime()
      }
    })

    return filtered
  }, [items, filterType, searchQuery, selectedTag, sortBy])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${Math.round(mb)} MB`
  }

  // Format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Get file type from file
  const getFileType = (file: File): 'image' | 'video' | 'audio' | 'document' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'document'
  }

  // Validate file type
  const isValidFileType = (file: File): boolean => {
    return acceptedFileTypes.some(type => {
      if (type.includes('*')) {
        const [category] = type.split('/')
        return file.type.startsWith(category + '/')
      }
      return file.type === type
    })
  }

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    
    if (!isValidFileType(file)) {
      setUploadError('File type not supported')
      setTimeout(() => setUploadError(null), 3000)
      return
    }

    setUploadError(null)
    setUploadProgress(0)

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev === null || prev >= 100) {
          clearInterval(interval)
          return null
        }
        return prev + 10
      })
    }, 100)

    onUpload({
      file,
      name: file.name,
      type: getFileType(file),
      size: file.size
    })
  }, [onUpload, acceptedFileTypes])

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  // Handle item selection
  const handleItemSelect = useCallback((itemId: string) => {
    if (multiSelect) {
      const newSelected = new Set(selectedItems)
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId)
      } else {
        newSelected.add(itemId)
      }
      setSelectedItems(newSelected)
    } else {
      const item = items.find(i => i.id === itemId)
      if (item) onSelect(item)
    }
  }, [multiSelect, selectedItems, items, onSelect])

  // Handle multi-select action
  const handleMultiSelectAction = useCallback(() => {
    const selected = items.filter(item => selectedItems.has(item.id))
    onSelect(selected)
    setSelectedItems(new Set())
  }, [selectedItems, items, onSelect])

  // Handle delete
  const handleDelete = useCallback((itemId: string) => {
    onDelete(itemId)
    setDeleteConfirm(null)
  }, [onDelete])

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    const itemsToDelete = Array.from(selectedItems)
    setBulkDeleteProgress({ current: 1, total: itemsToDelete.length })
    
    for (let i = 0; i < itemsToDelete.length; i++) {
      if (i > 0) {
        setBulkDeleteProgress({ current: i + 1, total: itemsToDelete.length })
      }
      await new Promise(resolve => setTimeout(resolve, 100)) // Simulate async deletion
      onDelete(itemsToDelete[i])
    }
    
    setSelectedItems(new Set())
    setBulkDeleteProgress(null)
    setDeleteConfirm(null)
  }, [selectedItems, onDelete])

  return (
    <div style={{ padding: tokens.spacing.lg }}>
      <h2 style={{
        fontSize: tokens.typography.fontSize['2xl'],
        fontWeight: tokens.typography.fontWeight.semibold,
        marginBottom: tokens.spacing.lg
      }}>
        Media Library
      </h2>

      {/* Upload area */}
      <div
        data-testid="media-drop-zone"
        className={isDragging ? 'drag-over' : ''}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? tokens.colors.primary.main : tokens.colors.border.default}`,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing.xl,
          marginBottom: tokens.spacing.lg,
          textAlign: 'center',
          backgroundColor: isDragging ? tokens.colors.primary.main : tokens.colors.background.tertiary,
          transition: 'all 0.2s ease'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFileTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
          aria-label="Upload"
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          Upload Files
        </Button>
        <p style={{
          marginTop: tokens.spacing.sm,
          color: tokens.colors.text.secondary
        }}>
          or drag and drop files here
        </p>
        {uploadProgress !== null && (
          <div style={{ marginTop: tokens.spacing.md }}>
            <div role="progressbar" style={{
              width: '100%',
              height: '4px',
              backgroundColor: tokens.colors.background.card,
              borderRadius: tokens.borderRadius.sm,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: tokens.colors.primary.main,
                transition: 'width 0.3s ease'
              }} />
            </div>
            <p style={{
              marginTop: tokens.spacing.xs,
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.text.secondary
            }}>
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
        {uploadError && (
          <p style={{
            marginTop: tokens.spacing.sm,
            color: tokens.colors.danger.main
          }}>
            {uploadError}
          </p>
        )}
      </div>

      {/* Filters and search */}
      <div style={{
        display: 'flex',
        gap: tokens.spacing.md,
        marginBottom: tokens.spacing.lg,
        flexWrap: 'wrap'
      }}>
        <Input
          placeholder="Search media..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
          {(['all', 'image', 'video', 'audio', 'document'] as FilterType[]).map(type => (
            <Button
              key={type}
              variant={filterType === type ? 'primary' : 'secondary'}
              size="small"
              onClick={() => setFilterType(type)}
            >
              {type === 'all' ? 'All' : `${type.charAt(0).toUpperCase()}${type.slice(1)}s`}
            </Button>
          ))}
        </div>

        <select
          aria-label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          style={{
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            borderRadius: tokens.borderRadius.md,
            border: `1px solid ${tokens.colors.border.default}`,
            backgroundColor: tokens.colors.background.secondary,
            fontSize: tokens.typography.fontSize.sm
          }}
        >
          <option value="date">Sort by Date</option>
          <option value="name">Sort by Name</option>
          <option value="size">Sort by Size</option>
        </select>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div style={{
          display: 'flex',
          gap: tokens.spacing.xs,
          marginBottom: tokens.spacing.lg,
          flexWrap: 'wrap'
        }}>
          {allTags.map(tag => (
            <Button
              key={tag}
              variant={selectedTag === tag ? 'primary' : 'tertiary'}
              size="small"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      {/* Multi-select actions */}
      {multiSelect && (
        <div style={{
          padding: tokens.spacing.md,
          backgroundColor: selectedItems.size > 0 ? tokens.colors.primary.main : tokens.colors.background.secondary,
          borderRadius: tokens.borderRadius.md,
          marginBottom: tokens.spacing.lg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: tokens.spacing.md,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
            <span>
              {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'} selected
              {(() => {
                const visibleSelectedCount = filteredItems.filter(item => selectedItems.has(item.id)).length
                const hiddenCount = selectedItems.size - visibleSelectedCount
                return hiddenCount > 0 ? ` (${hiddenCount} not visible)` : ''
              })()}
            </span>
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                if (selectedItems.size === filteredItems.length) {
                  setSelectedItems(new Set())
                } else {
                  setSelectedItems(new Set(filteredItems.map(item => item.id)))
                }
              }}
            >
              {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          {selectedItems.size > 0 && (
            <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
              <Button
                variant="danger"
                size="small"
                onClick={() => setDeleteConfirm('bulk')}
              >
                Delete Selected ({selectedItems.size})
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  const selected = items.filter(item => selectedItems.has(item.id))
                  const urls = selected.map(item => item.url)
                  const names = selected.map(item => item.name)
                  
                  if (selected.length === 1) {
                    // Single file - download directly
                    const link = document.createElement('a')
                    link.href = urls[0]
                    link.download = names[0]
                    link.style.display = 'none'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  } else {
                    // Multiple files - show preparing message
                    setToast({ message: 'Preparing download...', type: 'info' })
                    
                    // Create download links for each selected item
                    urls.forEach((url, index) => {
                      setTimeout(() => {
                        const link = document.createElement('a')
                        link.href = url
                        link.download = names[index]
                        link.style.display = 'none'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }, index * 100)
                    })
                  }
                }}
              >
                Download Selected
              </Button>
              <Button onClick={handleMultiSelectAction}>
                Use Selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Media grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<div style={{ fontSize: '48px' }}>📁</div>}
          title="No media items"
          description="Upload your first file to get started"
          action={{
            label: 'Upload File',
            onClick: () => fileInputRef.current?.click()
          }}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: tokens.spacing.md
        }}>
          {filteredItems.map(item => (
            <Card
              key={item.id}
              data-testid="media-item"
              style={{
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Checkbox for multi-select */}
              {multiSelect && (
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => handleItemSelect(item.id)}
                  style={{
                    position: 'absolute',
                    top: tokens.spacing.sm,
                    left: tokens.spacing.sm,
                    zIndex: 1
                  }}
                />
              )}

              {/* Thumbnail */}
              <div style={{
                width: '100%',
                height: '150px',
                backgroundColor: tokens.colors.background.tertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {item.type === 'image' && item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                {item.type === 'video' && (
                  <div style={{ fontSize: '48px' }}>🎥</div>
                )}
                {item.type === 'audio' && (
                  <div style={{ fontSize: '48px' }}>🎵</div>
                )}
                {item.type === 'document' && (
                  <div style={{ fontSize: '48px' }}>📄</div>
                )}
              </div>

              {/* Item info */}
              <div style={{ padding: tokens.spacing.md }}>
                <h4 style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  marginBottom: tokens.spacing.xs,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.name}
                </h4>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.text.secondary
                }}>
                  <span>{formatFileSize(item.size)}</span>
                  {item.duration && <span>{formatDuration(item.duration)}</span>}
                </div>
                
                {/* Actions */}
                <div style={{
                  display: 'flex',
                  gap: tokens.spacing.xs,
                  marginTop: tokens.spacing.sm
                }}>
                  <Button
                    size="small"
                    variant="primary"
                    onClick={() => !multiSelect && onSelect(item)}
                  >
                    Select
                  </Button>
                  <Button
                    size="small"
                    variant="tertiary"
                    onClick={() => setDeleteConfirm(item.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {/* Preview on hover */}
              {hoveredItem === item.id && (
                <div
                  data-testid="media-preview"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2
                  }}
                >
                  {item.type === 'image' && (
                    <img
                      src={item.url}
                      alt={item.name}
                      style={{ maxWidth: '90%', maxHeight: '90%' }}
                    />
                  )}
                  {item.type === 'video' && (
                    <video
                      src={item.url}
                      controls
                      style={{ maxWidth: '90%', maxHeight: '90%' }}
                    />
                  )}
                  {item.type === 'audio' && (
                    <audio src={item.url} controls />
                  )}
                </div>
              )}

              {/* Delete confirmation */}
              {deleteConfirm === item.id && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: tokens.spacing.md,
                    zIndex: 3
                  }}
                >
                  <p>Delete this item?</p>
                  <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
                    <Button
                      size="small"
                      variant="danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
      {deleteConfirm === 'bulk' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: tokens.colors.background.card,
            borderRadius: tokens.borderRadius.lg,
            padding: tokens.spacing.xl,
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              marginBottom: tokens.spacing.md
            }}>
              Delete {selectedItems.size} selected items?
            </h3>
            <p style={{
              color: tokens.colors.text.secondary,
              marginBottom: tokens.spacing.lg
            }}>
              This action cannot be undone. All selected items will be permanently deleted.
            </p>
            {bulkDeleteProgress && (
              <div style={{ marginBottom: tokens.spacing.lg }}>
                <div role="progressbar" style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: tokens.colors.background.tertiary,
                  borderRadius: tokens.borderRadius.sm,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%`,
                    height: '100%',
                    backgroundColor: tokens.colors.primary.main,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <p style={{
                  marginTop: tokens.spacing.sm,
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.text.secondary,
                  textAlign: 'center'
                }}>
                  Deleting {bulkDeleteProgress.current} of {bulkDeleteProgress.total}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={!!bulkDeleteProgress}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                disabled={!!bulkDeleteProgress}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}