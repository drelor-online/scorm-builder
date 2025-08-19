import { useState, useCallback } from 'react'
import { StatusMessage } from '../components/StatusPanel'

export const useStatusMessages = () => {
  const [messages, setMessages] = useState<StatusMessage[]>([])
  
  const addMessage = useCallback((
    type: StatusMessage['type'],
    title: string,
    message: string
  ) => {
    const now = Date.now()
    const DUPLICATE_THRESHOLD = 3000 // 3 seconds
    
    // Check for recent duplicate messages (same type, title, and message)
    const isDuplicate = (msg: StatusMessage) => {
      return msg.type === type && 
             msg.title === title && 
             msg.message === message &&
             !msg.dismissed &&
             (now - msg.timestamp) < DUPLICATE_THRESHOLD
    }
    
    // Don't add duplicate if a recent identical message exists
    const hasDuplicate = (prevMessages: StatusMessage[]) => {
      return prevMessages.some(isDuplicate)
    }
    
    let messageId: string = ''
    
    setMessages(prev => {
      if (hasDuplicate(prev)) {
        // Return existing messages without adding duplicate
        return prev
      }
      
      const newMessage: StatusMessage = {
        id: `status-${now}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        message,
        timestamp: now
      }
      
      messageId = newMessage.id
      return [newMessage, ...prev]
    })
    
    return messageId
  }, [])
  
  const addSuccess = useCallback((title: string, message: string) => {
    return addMessage('success', title, message)
  }, [addMessage])
  
  const addError = useCallback((title: string, message: string) => {
    return addMessage('error', title, message)
  }, [addMessage])
  
  const addWarning = useCallback((title: string, message: string) => {
    return addMessage('warning', title, message)
  }, [addMessage])
  
  const addInfo = useCallback((title: string, message: string) => {
    return addMessage('info', title, message)
  }, [addMessage])
  
  const dismissMessage = useCallback((messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, dismissed: true }
          : msg
      )
    )
  }, [])
  
  const clearAllMessages = useCallback(() => {
    setMessages(prev => 
      prev.map(msg => ({ ...msg, dismissed: true }))
    )
  }, [])
  
  const removeOldMessages = useCallback(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    setMessages(prev => 
      prev.filter(msg => 
        msg.timestamp > oneHourAgo && !msg.dismissed
      )
    )
  }, [])
  
  return {
    messages,
    addMessage,
    addSuccess,
    addError,
    addWarning,
    addInfo,
    dismissMessage,
    clearAllMessages,
    removeOldMessages
  }
}

export default useStatusMessages