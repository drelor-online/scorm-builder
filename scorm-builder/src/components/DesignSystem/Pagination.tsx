import React from 'react'
import { Button } from './Button'
import { Flex } from './Layout'
import './designSystem.css'

export interface PaginationProps {
  currentPage: number
  hasNextPage: boolean
  onPageChange: (page: number) => void
  isLoading?: boolean
  totalResults?: number
  resultsPerPage?: number
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  hasNextPage,
  onPageChange,
  isLoading = false,
  totalResults,
  resultsPerPage = 10
}) => {
  const hasPreviousPage = currentPage > 1
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && hasPreviousPage && !isLoading) {
      onPageChange(currentPage - 1)
    } else if (e.key === 'ArrowRight' && hasNextPage && !isLoading) {
      onPageChange(currentPage + 1)
    }
  }

  const startResult = (currentPage - 1) * resultsPerPage + 1
  const endResult = currentPage * resultsPerPage
  const resultText = totalResults 
    ? `Showing ${startResult}-${Math.min(endResult, totalResults)} of ${totalResults} results`
    : `Showing ${startResult}-${endResult} of many results`

  return (
    <div 
      className="pagination-container" 
      data-testid="pagination-controls"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        marginTop: '1rem',
        padding: '1rem',
        borderTop: '1px solid var(--color-border-default)',
      }}
    >
      <Flex justify="space-between" align="center">
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          {isLoading ? 'Loading more results...' : resultText}
        </div>
        
        <Flex gap="small" align="center">
          <Button
            variant="secondary"
            size="small"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPreviousPage || isLoading}
            aria-label="Go to previous page"
          >
            Previous Page
          </Button>
          
          <span style={{ 
            padding: '0.25rem 0.75rem',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-primary)'
          }}>
            Page {currentPage}
          </span>
          
          <Button
            variant="secondary"
            size="small"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage || isLoading}
            aria-label="Go to next page"
          >
            Next Page
          </Button>
        </Flex>
      </Flex>
    </div>
  )
}