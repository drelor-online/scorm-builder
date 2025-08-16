import { createContext, useContext, ReactNode } from 'react'

interface AutoSaveContextValue {
  isSaving: boolean
  lastSaved: Date | null
  hasUnsavedChanges: boolean
  isManualSave: boolean
}

const AutoSaveContext = createContext<AutoSaveContextValue | null>(null)

export function AutoSaveProvider({ 
  children, 
  isSaving, 
  lastSaved,
  hasUnsavedChanges,
  isManualSave = false
}: { 
  children: ReactNode
  isSaving: boolean
  lastSaved: Date | null
  hasUnsavedChanges: boolean
  isManualSave?: boolean
}) {
  return (
    <AutoSaveContext.Provider value={{ isSaving, lastSaved, hasUnsavedChanges, isManualSave }}>
      {children}
    </AutoSaveContext.Provider>
  )
}

export function useAutoSaveState() {
  const context = useContext(AutoSaveContext)
  if (!context) {
    // Return default values if not in context
    return {
      isSaving: false,
      lastSaved: null,
      hasUnsavedChanges: false,
      isManualSave: false
    }
  }
  return context
}