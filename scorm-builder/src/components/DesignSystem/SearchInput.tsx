import React, { useState, useRef, useEffect } from 'react'
import { useSearchHistory } from '../../hooks/useSearchHistory'
import { useDebounce } from '../../hooks/useDebounce'
import { Input } from './Input'
import { COLORS, SPACING } from '../../constants'
import './designSystem.css'
import { Icon } from './Icons'
import { Search, X } from 'lucide-react'

export interface SearchInputProps {
  onSearch: (value: string) => void
  placeholder?: string
  historyKey?: string
  showHistory?: boolean
  debounceMs?: number
  className?: string
}

const SearchInputComponent: React.FC<SearchInputProps> = ({
  onSearch,
  placeholder = 'Search...',
  historyKey = 'default',
  showHistory = true,
  debounceMs = 0,
  className = ''
}) => {
  const [value, setValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { addToHistory, getFilteredHistory } = useSearchHistory(historyKey)
  const debouncedValue = useDebounce(value, debounceMs)
  
  const filteredHistory = showHistory ? getFilteredHistory(value) : []
  const showHistoryDropdown = showDropdown && showHistory && filteredHistory.length > 0

  // Track if this is the first render
  const isFirstRender = useRef(true)
  
  // Call onSearch when debounced value changes
  useEffect(() => {
    if (debounceMs > 0) {
      // Skip the first render to avoid calling with initial empty value
      if (isFirstRender.current) {
        isFirstRender.current = false
        return
      }
      onSearch(debouncedValue)
    }
  }, [debouncedValue, onSearch, debounceMs])

  // Call onSearch immediately if no debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    setSelectedIndex(-1)
    
    if (debounceMs === 0) {
      onSearch(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showHistoryDropdown) {
      if (e.key === 'Enter' && value.trim()) {
        addToHistory(value)
        onSearch(value)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredHistory.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          const selected = filteredHistory[selectedIndex]
          setValue(selected)
          onSearch(selected)
          addToHistory(selected)
          setShowDropdown(false)
        } else if (value.trim()) {
          addToHistory(value)
          onSearch(value)
          setShowDropdown(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleHistoryItemClick = (item: string) => {
    setValue(item)
    onSearch(item)
    addToHistory(item)
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const handleClear = () => {
    setValue('')
    onSearch('')
    inputRef.current?.focus()
  }

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={`search-input-wrapper ${className}`} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          style={{ paddingRight: value ? '2.5rem' : undefined }}
        />
        
        {/* Search icon */}
        <div
          style={{
            position: 'absolute',
            left: SPACING.md,
            top: '50%',
            transform: 'translateY(-50%)',
            color: COLORS.textMuted,
            pointerEvents: 'none'
          }}
        >
          <Icon icon={Search} size="sm" />
        </div>
        
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: SPACING.sm,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: COLORS.textMuted,
              cursor: 'pointer',
              padding: SPACING.xs,
              borderRadius: '4px',
              transition: 'all 150ms ease-in-out',
              fontSize: '1.2rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Icon icon={X} size="md" />
          </button>
        )}
      </div>
      
      {/* History dropdown */}
      {showHistoryDropdown && (
        <div
          ref={dropdownRef}
          className="search-history-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: SPACING.xs,
            backgroundColor: COLORS.background,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000
          }}
        >
          {filteredHistory.map((item, index) => (
            <div
              key={item}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleHistoryItemClick(item)}
              style={{
                padding: `${SPACING.sm} ${SPACING.md}`,
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: COLORS.text,
                transition: 'background-color 150ms ease-in-out',
                fontSize: '0.875rem'
              }}
              onMouseEnter={(e) => {
                setSelectedIndex(index)
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const SearchInput = React.memo(SearchInputComponent)