import { useState, useEffect } from 'react'

interface NetworkStatus {
  isOnline: boolean
  lastOnline: Date | null
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastOnline, setLastOnline] = useState<Date | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setLastOnline(null) // Clear last online time when back online
    }

    const handleOffline = () => {
      setIsOnline(false)
      setLastOnline(new Date()) // Record when went offline
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
    lastOnline
  }
}