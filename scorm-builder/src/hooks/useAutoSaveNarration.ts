import { useCallback, useRef } from 'react'
import { useStorage } from '../contexts/PersistentStorageContext'

export function useAutoSaveNarration(topicId: string) {
  const storage = useStorage()
  const lastSavedRef = useRef<string>('')
  
  const saveNarration = useCallback(async (narration: string) => {
    if (!storage.isInitialized || !storage.currentProjectId) return
    
    // Only save if content changed
    if (narration === lastSavedRef.current) return
    
    try {
      await storage.saveContent(`${topicId}-narration`, {
        topicId,
        narration,
        timestamp: Date.now()
      })
      lastSavedRef.current = narration
    } catch (error) {
      console.error('Failed to auto-save narration:', error)
    }
  }, [storage, topicId])
  
  const saveAudioFile = useCallback(async (file: File) => {
    if (!storage.isInitialized || !storage.currentProjectId) return
    
    try {
      await storage.storeMedia(
        `${topicId}-audio`,
        file,
        'audio',
        {
          fileName: file.name,
          size: file.size,
          duration: 0, // Will be updated when audio loads
          timestamp: Date.now()
        }
      )
    } catch (error) {
      console.error('Failed to save audio file:', error)
    }
  }, [storage, topicId])
  
  const loadNarration = useCallback(async () => {
    if (!storage.isInitialized || !storage.currentProjectId) return null
    
    try {
      const saved = await storage.getContent(`${topicId}-narration`)
      if (saved) {
        lastSavedRef.current = saved.narration || ''
        return saved.narration || ''
      }
    } catch (error) {
      console.error('Failed to load narration:', error)
    }
    return ''
  }, [storage, topicId])
  
  const loadAudioFile = useCallback(async () => {
    if (!storage.isInitialized || !storage.currentProjectId) return null
    
    try {
      const media = await storage.getMedia(`${topicId}-audio`)
      if (media) {
        // Convert blob to File object
        const file = new File([media.blob], media.metadata?.fileName || 'audio.mp3', {
          type: media.type
        })
        return file
      }
    } catch (error) {
      console.error('Failed to load audio file:', error)
    }
    return null
  }, [storage, topicId])
  
  return {
    saveNarration,
    saveAudioFile,
    loadNarration,
    loadAudioFile,
    isReady: storage.isInitialized && !!storage.currentProjectId
  }
}