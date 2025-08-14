import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type DirtySection = 'courseSeed' | 'courseContent' | 'media' | 'activities'

interface DirtySections {
  courseSeed: boolean
  courseContent: boolean
  media: boolean
  activities: boolean
}

interface UnsavedChangesState {
  hasUnsavedChanges: boolean
  sections: DirtySections
}

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean
  isDirty: (section: DirtySection) => boolean
  markDirty: (section: DirtySection) => void
  resetDirty: (section: DirtySection) => void
  resetAll: () => void
  getDirtyState: () => UnsavedChangesState
}

interface UnsavedChangesProviderProps {
  children: React.ReactNode
  onDirtyChange?: (state: UnsavedChangesState) => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined)

export const UnsavedChangesProvider: React.FC<UnsavedChangesProviderProps> = ({ 
  children, 
  onDirtyChange 
}) => {
  const [sections, setSections] = useState<DirtySections>({
    courseSeed: false,
    courseContent: false,
    media: false,
    activities: false
  })

  // Computed value for overall unsaved changes
  const hasUnsavedChanges = Object.values(sections).some(Boolean)

  // Check if a specific section is dirty
  const isDirty = useCallback((section: DirtySection): boolean => {
    return sections[section] || false
  }, [sections])

  // Mark a section as dirty
  const markDirty = useCallback((section: DirtySection) => {
    setSections(prevSections => {
      // Only update if the value actually changes
      if (prevSections[section] === true) {
        return prevSections // Return the same object reference to prevent re-render
      }
      
      return {
        ...prevSections,
        [section]: true
      }
    })
  }, [])

  // Reset a specific section's dirty flag
  const resetDirty = useCallback((section: DirtySection) => {
    setSections(prevSections => {
      // Only update if the value actually changes
      if (prevSections[section] === false) {
        return prevSections // Return the same object reference to prevent re-render
      }
      
      return {
        ...prevSections,
        [section]: false
      }
    })
  }, [])

  // Reset all dirty flags
  const resetAll = useCallback(() => {
    setSections({
      courseSeed: false,
      courseContent: false,
      media: false,
      activities: false
    })
  }, [])

  // Get current dirty state
  const getDirtyState = useCallback((): UnsavedChangesState => ({
    hasUnsavedChanges,
    sections: { ...sections }
  }), [hasUnsavedChanges, sections])

  // Notify parent of changes
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange({
        hasUnsavedChanges,
        sections: { ...sections }
      })
    }
  }, [hasUnsavedChanges, sections, onDirtyChange])

  const contextValue: UnsavedChangesContextType = {
    hasUnsavedChanges,
    isDirty,
    markDirty,
    resetDirty,
    resetAll,
    getDirtyState
  }

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      {children}
    </UnsavedChangesContext.Provider>
  )
}

export const useUnsavedChanges = (): UnsavedChangesContextType => {
  const context = useContext(UnsavedChangesContext)
  if (context === undefined) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider')
  }
  return context
}