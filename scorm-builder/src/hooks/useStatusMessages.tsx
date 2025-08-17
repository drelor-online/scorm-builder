import { useState, useCallback } from 'react'
import { StatusMessage } from '../components/StatusPanel'

export const useStatusMessages = () => {
  const [messages, setMessages] = useState<StatusMessage[]>([])
  
  const addMessage = useCallback((
    type: StatusMessage['type'],
    title: string,
    message: string
  ) => {
    const newMessage: StatusMessage = {
      id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: Date.now()
    }
    
    setMessages(prev => [newMessage, ...prev])
    
    return newMessage.id
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