import { useState, useCallback } from 'react'

interface UseConfirmDialogOptions {
  message: string
  onConfirm: () => void
  onCancel?: () => void
}

export const useConfirmDialog = () => {
  const [isPending, setIsPending] = useState(false)
  
  const confirm = useCallback((options: UseConfirmDialogOptions) => {
    // Set pending state to prevent UI changes during confirmation
    setIsPending(true)
    
    // Use setTimeout to ensure state updates are flushed before showing dialog
    setTimeout(() => {
      const result = window.confirm(options.message)
      
      if (result) {
        options.onConfirm()
      } else if (options.onCancel) {
        options.onCancel()
      }
      
      setIsPending(false)
    }, 0)
  }, [])
  
  return { confirm, isPending }
}