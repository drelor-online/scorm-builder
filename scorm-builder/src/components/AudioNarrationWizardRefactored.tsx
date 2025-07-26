import React, { useState, useRef, useEffect } from 'react'
import { CourseContentUnion, CourseContent } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import JSZip from 'jszip'
import { PageLayout } from './PageLayout'
import { CoursePreview } from './CoursePreview'
import { ConfirmDialog } from './ConfirmDialog'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { 
  Button, 
  Card, 
  Input, 
  ButtonGroup,
  Section,
  Flex,
  Grid,
  Alert,
  Modal
} from './DesignSystem'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useStepData } from '../hooks/useStepData'
import { blobUrlManager } from '../utils/blobUrlManager'
import { generateMediaId, getPageIndex } from '../services/idGenerator'

interface AudioNarrationWizardProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  onNext: (enhancedContent: CourseContentUnion) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

interface AudioFile {
  blockNumber: string
  file: File
  url: string
}

interface CaptionFile {
  blockNumber: string
  content: string
}

// Unified narration block structure for internal use
interface UnifiedNarrationBlock {
  id: string
  text: string
  blockNumber: string
  pageId: string
  pageTitle: string
}

// Convert course content to unified narration blocks for easier handling
function extractNarrationBlocks(content: CourseContentUnion): UnifiedNarrationBlock[] {
  const blocks: UnifiedNarrationBlock[] = []
  let blockCounter = 1

  // Check if it has new format pages
  const hasNewPages = 'welcomePage' in content && 'learningObjectivesPage' in content
  
  if (hasNewPages) {
    // Add welcome page narration
    const anyContent = content as any
    if (anyContent.welcomePage?.narration) {
      blocks.push({
        id: `${anyContent.welcomePage.id}-narration`,
        text: anyContent.welcomePage.narration,
        blockNumber: String(blockCounter++).padStart(4, '0'),
        pageId: anyContent.welcomePage.id,
        pageTitle: anyContent.welcomePage.title
      })
    }

    // Add learning objectives page narration
    if (anyContent.learningObjectivesPage?.narration) {
      blocks.push({
        id: `${anyContent.learningObjectivesPage.id}-narration`,
        text: anyContent.learningObjectivesPage.narration,
        blockNumber: String(blockCounter++).padStart(4, '0'),
        pageId: anyContent.learningObjectivesPage.id,
        pageTitle: anyContent.learningObjectivesPage.title
      })
    }
  }

  // Process topics (both formats)
  if (content.topics && Array.isArray(content.topics)) {
    content.topics.forEach(topic => {
      const anyTopic = topic as any
      
      // Check if it's new format (single narration string)
      if (typeof anyTopic.narration === 'string') {
        blocks.push({
          id: `${topic.id}-narration`,
          text: anyTopic.narration,
          blockNumber: String(blockCounter++).padStart(4, '0'),
          pageId: topic.id,
          pageTitle: topic.title
        })
      }
      // Check if it's old format (array of narration blocks)
      else if (Array.isArray(anyTopic.narration)) {
        anyTopic.narration.forEach((narration: any) => {
          const blockNumber = narration.blockNumber || String(blockCounter).padStart(4, '0')
          blocks.push({
            id: narration.id || `${topic.id}-narration-${blockNumber}`,
            text: narration.text,
            blockNumber: blockNumber,
            pageId: topic.id,
            pageTitle: topic.title
          })
          // Only increment if we generated a new block number
          if (!narration.blockNumber) {
            blockCounter++
          }
        })
      }
    })
  }

  return blocks
}

export const AudioNarrationWizard: React.FC<AudioNarrationWizardProps> = ({
  courseContent,
  courseSeedData,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onSaveAs,
  onOpen,
  onHelp,
  onStepClick
}) => {
  const storage = useStorage()
  const initialBlocks = extractNarrationBlocks(courseContent)
  console.log('[AudioNarrationWizard] Initial narration blocks:', initialBlocks.map(b => ({
    blockNumber: b.blockNumber,
    pageId: b.pageId,
    pageTitle: b.pageTitle
  })))
  const [narrationBlocks, setNarrationBlocks] = useState<UnifiedNarrationBlock[]>(initialBlocks)
  const [audioFiles, setAudioFiles] = useState<Map<string, AudioFile>>(new Map())
  const [captionFiles, setCaptionFiles] = useState<Map<string, CaptionFile>>(new Map())
  const [isUploading, setIsUploading] = useState(false)
  const [audioUploaded, setAudioUploaded] = useState(false)
  const [captionsUploaded, setCaptionsUploaded] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [storageError, setStorageError] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  
  // Confirmation dialog state
  const [showRemoveAudioConfirm, setShowRemoveAudioConfirm] = useState(false)
  const [audioToRemove, setAudioToRemove] = useState<string | null>(null)
  const [showRemoveCaptionConfirm, setShowRemoveCaptionConfirm] = useState(false)
  const [captionToRemove, setCaptionToRemove] = useState<string | null>(null)
  
  // Recording state
  const [showRecordingModal, setShowRecordingModal] = useState(false)
  const [recordingBlockId, setRecordingBlockId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null)
  
  // Caption preview state
  const [showCaptionPreview, setShowCaptionPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null)
  const [parsedCaptions, setParsedCaptions] = useState<Array<{ timing: string; text: string[] }>>([])
  const audioInputRef = useRef<HTMLInputElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)
  const individualRefs = useRef<Map<string, { audio: HTMLInputElement | null; caption: HTMLInputElement | null }>>(new Map())

  // Data loading function that can be called by useStepData
  const loadPersistedData = async () => {
    console.log('[AudioNarrationWizard] loadPersistedData called, storage initialized:', storage?.isInitialized)
    
    if (!storage || !storage.isInitialized) {
      setIsLoadingData(false)
      return
    }
    
    try {
      setIsLoadingData(true)
        
        // Load narration blocks from storage per topic
        const loadedNarrationBlocks: UnifiedNarrationBlock[] = []
        const topics = courseContent.topics || []
        
        // Load narration for welcome page if exists
        if ('welcomePage' in courseContent) {
          const welcomeNarration = await storage.getContent('narration-welcome')
          if (welcomeNarration && Array.isArray(welcomeNarration)) {
            welcomeNarration.forEach((narration: any, index: number) => {
              loadedNarrationBlocks.push({
                id: narration.id || 'welcome-narration',
                text: narration.text,
                blockNumber: narration.blockNumber || String(index + 1).padStart(4, '0'),
                pageId: 'welcome',
                pageTitle: 'Welcome'
              })
            })
          }
        }
        
        // Load narration for objectives page if exists
        if ('learningObjectivesPage' in courseContent) {
          const objectivesNarration = await storage.getContent('narration-objectives')
          if (objectivesNarration && Array.isArray(objectivesNarration)) {
            objectivesNarration.forEach((narration: any) => {
              loadedNarrationBlocks.push({
                id: narration.id || 'objectives-narration',
                text: narration.text,
                blockNumber: narration.blockNumber || '0002',
                pageId: 'objectives',
                pageTitle: 'Learning Objectives'
              })
            })
          }
        }
        
        // Load narration for each topic
        for (const topic of topics) {
          const topicNarration = await storage.getContent(`narration-${topic.id}`)
          if (topicNarration && Array.isArray(topicNarration)) {
            topicNarration.forEach((narration: any) => {
              loadedNarrationBlocks.push({
                id: narration.id || `${topic.id}-narration`,
                text: narration.text,
                blockNumber: narration.blockNumber,
                pageId: topic.id,
                pageTitle: topic.title
              })
            })
          }
        }
        
        // If we loaded narration blocks, use them; otherwise use extracted ones
        if (loadedNarrationBlocks.length > 0) {
          setNarrationBlocks(loadedNarrationBlocks)
        }
        
        // Load audio files from media storage per topic
        const loadedAudioFiles = new Map<string, AudioFile>()
        console.log('[AudioNarrationWizard] Loading audio files from storage...')
        
        // Load audio for each topic
        for (const topic of topics) {
          try {
            const topicAudioMedia = await storage.getMediaForTopic(topic.id)
            console.log(`[AudioNarrationWizard] Media for topic ${topic.id}:`, topicAudioMedia?.length || 0)
            
            if (topicAudioMedia && Array.isArray(topicAudioMedia)) {
              console.log(`[AudioNarrationWizard] Topic ${topic.id} media items:`, topicAudioMedia.map(item => ({
                id: item.id,
                type: item.type,
                mediaType: item.mediaType,
                metadata: item.metadata,
                hasBlob: !!item.blob
              })))
              for (const mediaItem of topicAudioMedia) {
                console.log(`[AudioNarrationWizard] Processing media item:`, JSON.stringify({
                  id: mediaItem.id,
                  type: mediaItem.type,
                  mediaType: mediaItem.mediaType,
                  metadata: mediaItem.metadata,
                  hasBlob: !!mediaItem.blob,
                  allKeys: Object.keys(mediaItem)
                }, null, 2))
                // Check if it's an audio file by ID pattern
                if (mediaItem.id?.startsWith('audio-') && mediaItem.metadata?.blockNumber && mediaItem.blob) {
                  // Validate that we have a proper blob
                  if (!(mediaItem.blob instanceof Blob)) {
                    console.warn(`Invalid blob for topic ${topic.id}, blockNumber: ${mediaItem.metadata.blockNumber}`)
                    continue
                  }
                  
                  const blockNumber = mediaItem.metadata.blockNumber
                  const file = new File(
                    [mediaItem.blob], 
                    mediaItem.metadata?.fileName || `${blockNumber}-audio.mp3`, 
                    { type: mediaItem.type || 'audio/mpeg' }
                  )
                  
                  // Use blob URL manager to persist URLs across navigation
                  const urlKey = `audio-${topic.id}-${blockNumber}`
                  const url = blobUrlManager.getOrCreateUrl(urlKey, mediaItem.blob)
                  
                  loadedAudioFiles.set(blockNumber, {
                    blockNumber,
                    file,
                    url
                  })
                }
              }
            }
          } catch (error) {
            console.error(`Error loading audio for topic ${topic.id}:`, error)
          }
        }
        
        // Also check for welcome and objectives audio if they exist
        if ('welcomePage' in courseContent) {
          const welcomeAudio = await storage.getMediaForTopic('welcome')
          console.log('[AudioNarrationWizard] Welcome audio media:', welcomeAudio.length)
          for (const mediaItem of welcomeAudio) {
            console.log('[AudioNarrationWizard] Welcome media item:', {
              id: mediaItem.id,
              type: mediaItem.type,
              mediaType: mediaItem.mediaType,
              metadata: mediaItem.metadata,
              hasBlob: !!mediaItem.blob,
              blobType: mediaItem.blob?.type,
              allKeys: Object.keys(mediaItem)
            })
            // Check if it's an audio file by ID pattern
            if (mediaItem.id?.startsWith('audio-') && mediaItem.metadata?.blockNumber && mediaItem.blob) {
              // Validate that we have a proper blob
              if (!(mediaItem.blob instanceof Blob)) {
                console.warn(`Invalid blob for welcome page, blockNumber: ${mediaItem.metadata.blockNumber}`)
                continue
              }
              
              const blockNumber = mediaItem.metadata.blockNumber
              const file = new File(
                [mediaItem.blob], 
                mediaItem.metadata?.fileName || `${blockNumber}-audio.mp3`, 
                { type: mediaItem.type || 'audio/mpeg' }
              )
              
              // Use blob URL manager to persist URLs across navigation
              const urlKey = `audio-welcome-${blockNumber}`
              const url = blobUrlManager.getOrCreateUrl(urlKey, mediaItem.blob)
              
              loadedAudioFiles.set(blockNumber, {
                blockNumber,
                file,
                url
              })
            }
          }
        }
        
        if ('learningObjectivesPage' in courseContent) {
          // Get the actual ID from the learningObjectivesPage
          const objectivesId = (courseContent as any).learningObjectivesPage.id || 'objectives'
          const objectivesAudio = await storage.getMediaForTopic(objectivesId)
          console.log('[AudioNarrationWizard] Objectives audio media:', objectivesAudio.length)
          for (const mediaItem of objectivesAudio) {
            console.log('[AudioNarrationWizard] Objectives media item:', mediaItem)
            // Check if it's an audio file by ID pattern
            if (mediaItem.id?.startsWith('audio-') && mediaItem.metadata?.blockNumber && mediaItem.blob) {
              // Validate that we have a proper blob
              if (!(mediaItem.blob instanceof Blob)) {
                console.warn(`Invalid blob for objectives page, blockNumber: ${mediaItem.metadata.blockNumber}`)
                continue
              }
              
              const blockNumber = mediaItem.metadata.blockNumber
              const file = new File(
                [mediaItem.blob], 
                mediaItem.metadata?.fileName || `${blockNumber}-audio.mp3`, 
                { type: mediaItem.type || 'audio/mpeg' }
              )
              
              // Use blob URL manager to persist URLs across navigation
              const urlKey = `audio-objectives-${blockNumber}`
              const url = blobUrlManager.getOrCreateUrl(urlKey, mediaItem.blob)
              
              loadedAudioFiles.set(blockNumber, {
                blockNumber,
                file,
                url
              })
            }
          }
        }
        
        console.log('[AudioNarrationWizard] Loaded audio files:', loadedAudioFiles.size)
        console.log('[AudioNarrationWizard] Audio files map:', Array.from(loadedAudioFiles.entries()))
        setAudioFiles(loadedAudioFiles)
        if (loadedAudioFiles.size > 0) {
          setAudioUploaded(true)
        }
        
        // Load caption files from media storage
        const loadedCaptionFiles = new Map<string, CaptionFile>()
        
        // Load captions for each topic
        for (const topic of topics) {
          try {
            const topicCaptions = await storage.getMediaForTopic(topic.id)
            
            for (const mediaItem of topicCaptions) {
              console.log(`[AudioNarrationWizard] Caption item for ${topic.id}:`, JSON.stringify({
                id: mediaItem.id,
                type: mediaItem.type,
                mediaType: mediaItem.mediaType,
                metadata: mediaItem.metadata,
                hasBlob: !!mediaItem.blob,
                allKeys: Object.keys(mediaItem)
              }, null, 2))
              // Check if it's a caption by ID pattern since type/mediaType might not be set
              if (mediaItem.metadata?.blockNumber && mediaItem.id?.startsWith('caption-') && mediaItem.blob) {
                try {
                  const blockNumber = mediaItem.metadata.blockNumber
                  const content = await mediaItem.blob.text()
                  
                  loadedCaptionFiles.set(blockNumber, {
                    blockNumber,
                    content
                  })
                } catch (blobError) {
                  console.error(`Error reading caption blob for block ${mediaItem.metadata?.blockNumber}:`, blobError)
                  setStorageError(`Failed to read caption file. The file may be corrupted.`)
                }
              }
            }
          } catch (error) {
            console.error(`Error loading captions for topic ${topic.id}:`, error)
            // Don't set error for missing captions as they're optional
          }
        }
        
        // Also check for welcome and objectives captions
        if ('welcomePage' in courseContent) {
          try {
            const welcomeCaptions = await storage.getMediaForTopic('welcome')
            for (const mediaItem of welcomeCaptions) {
              // Check if it's a caption by ID pattern since type/mediaType might not be set
              if (mediaItem.metadata?.blockNumber && mediaItem.id?.startsWith('caption-') && mediaItem.blob) {
                const blockNumber = mediaItem.metadata.blockNumber
                const content = await mediaItem.blob.text()
                
                loadedCaptionFiles.set(blockNumber, {
                  blockNumber,
                  content
                })
              }
            }
          } catch (error) {
            console.error('Error loading welcome captions:', error)
          }
        }
        
        if ('learningObjectivesPage' in courseContent) {
          try {
            const objectivesId = (courseContent as any).learningObjectivesPage.id || 'objectives'
            const objectivesCaptions = await storage.getMediaForTopic(objectivesId)
            for (const mediaItem of objectivesCaptions) {
              // Check if it's a caption by ID pattern since type/mediaType might not be set
              if (mediaItem.metadata?.blockNumber && mediaItem.id?.startsWith('caption-') && mediaItem.blob) {
                const blockNumber = mediaItem.metadata.blockNumber
                const content = await mediaItem.blob.text()
                
                loadedCaptionFiles.set(blockNumber, {
                  blockNumber,
                  content
                })
              }
            }
          } catch (error) {
            console.error('Error loading objectives captions:', error)
          }
        }
        
        setCaptionFiles(loadedCaptionFiles)
        if (loadedCaptionFiles.size > 0) {
          setCaptionsUploaded(true)
        }
      } catch (error) {
        console.error('Error loading persisted data:', error)
        setStorageError('Failed to load saved data. Please check your browser storage settings.')
      } finally {
        setIsLoadingData(false)
      }
    }

  // Use useStepData to load data when the audio step (step 4) becomes active
  useStepData(loadPersistedData, { 
    step: 4,
    dependencies: [storage?.isInitialized, courseContent]
  })

  // Save data to persistent storage
  const saveDataToStorage = async () => {
    if (!storage || !storage.isInitialized) {
      setStorageError('Storage is not available. Audio files will not be saved.')
      return
    }
    
    try {
      // Group narration blocks by topic/page
      const narrationByPage: Record<string, UnifiedNarrationBlock[]> = {}
      
      narrationBlocks.forEach(block => {
        const pageId = block.pageId
        if (!narrationByPage[pageId]) {
          narrationByPage[pageId] = []
        }
        narrationByPage[pageId].push(block)
      })
      
      // Save narration blocks per topic/page
      for (const [pageId, blocks] of Object.entries(narrationByPage)) {
        await storage.saveContent(`narration-${pageId}`, blocks)
      }
      
      // Convert caption files map to object
      const captionFilesObject: Record<string, CaptionFile> = {}
      captionFiles.forEach((captionFile, blockNumber) => {
        captionFilesObject[blockNumber] = captionFile
      })
      
      // Save caption files and audio metadata to a central location
      await storage.saveContent('audio-narration-data', {
        captionFiles: captionFilesObject,
        // Store audio metadata for reference
        audioMetadata: Array.from(audioFiles.entries()).map(([blockNumber, audioFile]) => ({
          blockNumber,
          fileName: audioFile.file.name,
          storageId: `audio-${blockNumber}`
        }))
      })
    } catch (error) {
      console.error('Error saving data to storage:', error)
      if (error instanceof Error && error.message.includes('quota')) {
        setStorageError('Storage quota exceeded. Please free up space and try again.')
      } else {
        setStorageError('Error saving audio data. Please try again.')
      }
    }
  }

  const handleNext = async () => {
    // Save all data before navigating
    await saveDataToStorage()
    
    // Ensure storage is available before proceeding
    if (!storage || !storage.isInitialized) {
      setStorageError('Storage is not available. Cannot proceed without saving audio files.')
      return
    }
    
    // Create enhanced content with audio file references
    const contentWithAudio: any = { ...courseContent }
    
    // Check if it's new format
    if ('welcomePage' in contentWithAudio && 'learningObjectivesPage' in contentWithAudio) {
      // Process welcome page audio
      const welcomeBlock = narrationBlocks.find(b => b.pageId === 'welcome')
      if (welcomeBlock) {
        const audioFile = audioFiles.get(welcomeBlock.blockNumber)
        const captionFile = captionFiles.get(welcomeBlock.blockNumber)
        
        if (audioFile) {
          // Store audio in persistent storage
          try {
            await storage.storeMedia(
              generateMediaId('audio', getPageIndex('welcome')),
              audioFile.file,
              'audio',
              {
                blockNumber: welcomeBlock.blockNumber,
                fileName: audioFile.file.name,
                topicId: 'welcome'
              }
            )
          } catch (error) {
            console.error('Error storing welcome audio:', error)
          }
          
          // Add audio reference to media array (not the blob itself)
          if (!contentWithAudio.welcomePage.media) {
            contentWithAudio.welcomePage.media = []
          }
          contentWithAudio.welcomePage.media.push({
            id: `audio-${welcomeBlock.blockNumber}`,
            type: 'audio',
            url: audioFile.url,
            title: 'Narration',
            storageId: `audio-${welcomeBlock.blockNumber}` // Reference to storage
          })
          
          // Set audio file reference
          contentWithAudio.welcomePage.audioFile = `${welcomeBlock.blockNumber}-welcome.mp3`
          
          if (captionFile) {
            // Store caption in persistent storage
            try {
              await storage.storeMedia(
                generateMediaId('caption', getPageIndex('welcome')),
                new Blob([captionFile.content], { type: 'text/vtt' }),
                'caption',
                {
                  blockNumber: welcomeBlock.blockNumber,
                  topicId: 'welcome'
                }
              )
            } catch (error) {
              console.error('Error storing welcome caption:', error)
            }
            
            contentWithAudio.welcomePage.captionFile = `${welcomeBlock.blockNumber}-welcome.vtt`
            contentWithAudio.welcomePage.captionContent = captionFile.content
          }
        }
      }
      
      // Process objectives page audio
      const objectivesBlock = narrationBlocks.find(b => b.pageId === 'objectives')
      if (objectivesBlock) {
        const audioFile = audioFiles.get(objectivesBlock.blockNumber)
        const captionFile = captionFiles.get(objectivesBlock.blockNumber)
        
        if (audioFile) {
          // Store audio in persistent storage
          try {
            await storage.storeMedia(
              generateMediaId('audio', getPageIndex('objectives')),
              audioFile.file,
              'audio',
              {
                blockNumber: objectivesBlock.blockNumber,
                fileName: audioFile.file.name,
                topicId: objectivesBlock.pageId
              }
            )
          } catch (error) {
            console.error('Error storing objectives audio:', error)
          }
          
          // Add audio reference to media array (not the blob itself)
          if (!contentWithAudio.learningObjectivesPage.media) {
            contentWithAudio.learningObjectivesPage.media = []
          }
          contentWithAudio.learningObjectivesPage.media.push({
            id: generateMediaId('audio', getPageIndex('objectives')),
            type: 'audio',
            url: audioFile.url,
            title: 'Narration',
            storageId: `audio-${objectivesBlock.blockNumber}` // Reference to storage
          })
          
          // Set audio file reference
          contentWithAudio.learningObjectivesPage.audioFile = `${objectivesBlock.blockNumber}-objectives.mp3`
          
          if (captionFile) {
            // Store caption in persistent storage
            try {
              await storage.storeMedia(
                generateMediaId('caption', getPageIndex('objectives')),
                new Blob([captionFile.content], { type: 'text/vtt' }),
                'caption',
                {
                  blockNumber: objectivesBlock.blockNumber,
                  topicId: objectivesBlock.pageId
                }
              )
            } catch (error) {
              console.error('Error storing objectives caption:', error)
            }
            
            contentWithAudio.learningObjectivesPage.captionFile = `${objectivesBlock.blockNumber}-objectives.vtt`
            contentWithAudio.learningObjectivesPage.captionContent = captionFile.content
          }
        }
      }
      
      // Process topic audio
      for (let topicIndex = 0; topicIndex < contentWithAudio.topics.length; topicIndex++) {
        const topic = contentWithAudio.topics[topicIndex]
        const topicBlock = narrationBlocks.find(b => b.pageId === topic.id)
        if (topicBlock) {
          const audioFile = audioFiles.get(topicBlock.blockNumber)
          const captionFile = captionFiles.get(topicBlock.blockNumber)
          
          if (audioFile) {
            // Add audio reference to media array (not the blob itself)
            if (!topic.media) {
              topic.media = []
            }
            topic.media.push({
              id: generateMediaId('audio', getPageIndex('topic', topicIndex)),
              type: 'audio',
              url: '', // Empty URL - will be loaded from MediaStore when needed
              title: 'Narration',
              storageId: generateMediaId('audio', getPageIndex('topic', topicIndex)) // Reference to storage
            })
            
            // Set audio file reference
            const topicSlug = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            topic.audioFile = `${topicBlock.blockNumber}-${topicSlug}.mp3`
            
            if (captionFile) {
              // Store caption in persistent storage
              try {
                await storage.storeMedia(
                  generateMediaId('caption', getPageIndex('topic', topicIndex)),
                  new Blob([captionFile.content], { type: 'text/vtt' }),
                  'caption',
                  {
                    blockNumber: topicBlock.blockNumber,
                    topicId: topic.id
                  }
                )
              } catch (error) {
                console.error(`Error storing caption for topic ${topic.title}:`, error)
              }
              
              topic.captionFile = `${topicBlock.blockNumber}-${topicSlug}.vtt`
              topic.captionContent = captionFile.content
            }
          }
        }
      }
    }
    
    onNext(contentWithAudio)
  }

  const handleRemoveAudioClick = (blockNumber: string) => {
    setAudioToRemove(blockNumber)
    setShowRemoveAudioConfirm(true)
  }

  const handleConfirmRemoveAudio = async () => {
    if (audioToRemove) {
      // Get the audio file to release the URL reference
      const audioFile = audioFiles.get(audioToRemove)
      if (audioFile?.url) {
        // Release the blob URL reference but don't revoke it immediately
        // as it might still be needed elsewhere
        const block = narrationBlocks.find(n => n.blockNumber === audioToRemove)
        if (block) {
          const urlKey = `audio-${block.pageId}-${audioToRemove}`
          blobUrlManager.releaseUrl(urlKey)
        }
      }
      
      // Remove from the map
      setAudioFiles(prev => {
        const newMap = new Map(prev)
        newMap.delete(audioToRemove)
        return newMap
      })
      
      // Note: We don't delete from PersistentStorage here as the audio might be needed
      // for other sessions or if the user wants to restore it later
      
      // Save updated state
      await saveDataToStorage()
      
      // Reset state
      setAudioToRemove(null)
      setShowRemoveAudioConfirm(false)
    }
  }

  const handleRemoveCaptionClick = (blockNumber: string) => {
    setCaptionToRemove(blockNumber)
    setShowRemoveCaptionConfirm(true)
  }

  const handleConfirmRemoveCaption = async () => {
    if (captionToRemove) {
      // Remove from the map
      setCaptionFiles(prev => {
        const newMap = new Map(prev)
        newMap.delete(captionToRemove)
        return newMap
      })
      
      // Remove from media storage
      try {
        const block = narrationBlocks.find(n => n.blockNumber === captionToRemove)
        if (block && storage) {
          // Note: We don't delete from storage as captions might be needed later
          // The caption is only removed from the current session
        }
      } catch (error) {
        console.error('Error removing caption from storage:', error)
      }
      
      // Save updated state
      await saveDataToStorage()
      
      // Reset state
      setCaptionToRemove(null)
      setShowRemoveCaptionConfirm(false)
    }
  }

  const downloadNarrationFile = () => {
    const narrationText = narrationBlocks
      .map(block => block.text)
      .join('\n\n')
    
    const blob = new Blob([narrationText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'narration-blocks.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleAudioZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file containing audio files')
      event.target.value = '' // Reset file input
      return
    }
    
    // Validate file size (500MB limit for ZIP files)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      const sizeMB = Math.round(file.size / (1024 * 1024))
      setError(`ZIP file size (${sizeMB}MB) exceeds the maximum allowed size of 500MB`)
      event.target.value = '' // Reset file input
      return
    }
    
    setIsUploading(true)
    try {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      const newAudioFiles = new Map<string, AudioFile>()
      
      // Process each file in the zip
      const supportedAudioExtensions = ['.mp3', '.wav', '.ogg', '.webm']
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        const lowerFilename = filename.toLowerCase()
        const isAudioFile = supportedAudioExtensions.some(ext => lowerFilename.endsWith(ext))
        
        if (isAudioFile && !zipEntry.dir) {
          // Extract block number from filename (e.g., "0001-Block.mp3" -> "0001")
          const match = filename.match(/(\d{4})/)
          if (match) {
            const blockNumber = match[1]
            const audioBlob = await zipEntry.async('blob')
            
            // Determine MIME type based on extension
            let mimeType = 'audio/mpeg' // default to MP3
            if (lowerFilename.endsWith('.wav')) mimeType = 'audio/wav'
            else if (lowerFilename.endsWith('.ogg')) mimeType = 'audio/ogg'
            else if (lowerFilename.endsWith('.webm')) mimeType = 'audio/webm'
            
            const audioFile = new File([audioBlob], filename, { type: mimeType })
            
            // Use blob URL manager to persist URLs across navigation
            const urlKey = `audio-upload-${blockNumber}`
            const audioUrl = blobUrlManager.getOrCreateUrl(urlKey, audioBlob)
            
            // Store in persistent storage
            if (!storage || !storage.isInitialized) {
              throw new Error('Storage is not available')
            }
            
            try {
              // Find the corresponding narration block to get the topicId
              const narrationBlock = narrationBlocks.find(block => block.blockNumber === blockNumber)
              const topicId = narrationBlock?.pageId || 'unknown'
              console.log(`[AudioNarrationWizard] Storing audio: blockNumber=${blockNumber}, topicId=${topicId}, filename=${filename}`)
              
              // Calculate numeric ID based on page type
              let mediaId = `audio-${blockNumber}` // fallback
              if (narrationBlock) {
                if (narrationBlock.pageId === 'welcome') {
                  mediaId = generateMediaId('audio', getPageIndex('welcome'))
                } else if (narrationBlock.pageId === 'objectives' || narrationBlock.pageId === 'learning-objectives') {
                  mediaId = generateMediaId('audio', getPageIndex('objectives'))
                } else if (narrationBlock.pageId.startsWith('topic-') || narrationBlock.pageId) {
                  // Find topic index - topics in narrationBlocks are ordered sequentially
                  const allBlocks = narrationBlocks.filter(b => 
                    !['welcome', 'objectives', 'learning-objectives'].includes(b.pageId)
                  )
                  const topicIndex = allBlocks.findIndex(b => b.blockNumber === blockNumber)
                  if (topicIndex >= 0) {
                    mediaId = generateMediaId('audio', getPageIndex('topic', topicIndex))
                  }
                }
              }
              console.log(`[AudioNarrationWizard] Storing audio ${mediaId} for block ${blockNumber}, pageId: ${narrationBlock?.pageId}`)
              
              await storage.storeMedia(
                mediaId,
                audioFile,
                'audio',
                {
                  blockNumber,
                  fileName: filename,
                  topicId
                }
              )
            } catch (storageError) {
              console.error(`Error storing audio for block ${blockNumber}:`, storageError)
              if (storageError instanceof Error && storageError.message.includes('quota')) {
                throw new Error('Storage quota exceeded. Please free up space and try again.')
              }
              throw storageError
            }
            
            newAudioFiles.set(blockNumber, {
              blockNumber,
              file: audioFile,
              url: audioUrl
            })
          }
        }
      }
      
      // Clear existing audio files first (release old URL references)
      audioFiles.forEach((_, blockNumber) => {
        const block = narrationBlocks.find(n => n.blockNumber === blockNumber)
        if (block) {
          const urlKey = `audio-${block.pageId}-${blockNumber}`
          blobUrlManager.releaseUrl(urlKey)
        }
      })
      
      setAudioFiles(newAudioFiles)
      setAudioUploaded(true)
      
      // Save all data to storage
      await saveDataToStorage()
    } catch (error) {
      console.error('Error processing audio zip:', error)
      if (error instanceof Error) {
        setStorageError(error.message)
      } else {
        setStorageError('Error processing audio zip file. Please try again.')
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleCaptionZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file containing VTT caption files')
      event.target.value = '' // Reset file input
      return
    }
    
    // Validate file size (50MB limit for caption ZIP files)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      const sizeMB = Math.round(file.size / (1024 * 1024))
      setError(`Caption ZIP file size (${sizeMB}MB) exceeds the maximum allowed size of 50MB`)
      event.target.value = '' // Reset file input
      return
    }
    
    try {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      const newCaptionFiles = new Map<string, CaptionFile>()
      
      // Process each file in the zip
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (filename.endsWith('.vtt') && !zipEntry.dir) {
          // Extract block number from filename (e.g., "0001-Block.vtt" -> "0001")
          const match = filename.match(/(\d{4})/)
          if (match) {
            const blockNumber = match[1]
            const content = await zipEntry.async('string')
            const blob = await zipEntry.async('blob')
            
            // Find the block to get the pageId
            const block = narrationBlocks.find(n => n.blockNumber === blockNumber)
            if (block) {
              // Calculate numeric ID based on page type
              let mediaId = `caption-${blockNumber}` // fallback
              if (block.pageId === 'welcome') {
                mediaId = generateMediaId('caption', getPageIndex('welcome'))
              } else if (block.pageId === 'objectives' || block.pageId === 'learning-objectives') {
                mediaId = generateMediaId('caption', getPageIndex('objectives'))
              } else if (block.pageId.startsWith('topic-') || block.pageId) {
                // Find topic index - topics in narrationBlocks are ordered sequentially
                const allBlocks = narrationBlocks.filter(b => 
                  !['welcome', 'objectives', 'learning-objectives'].includes(b.pageId)
                )
                const topicIndex = allBlocks.findIndex(b => b.blockNumber === blockNumber)
                if (topicIndex >= 0) {
                  mediaId = generateMediaId('caption', getPageIndex('topic', topicIndex))
                }
              }
              console.log(`[AudioNarrationWizard] Storing caption ${mediaId} for block ${blockNumber}, pageId: ${block.pageId}`)
              
              // Save caption to media storage
              const captionFile = new File([blob], filename, { type: 'text/vtt' })
              await storage.storeMedia(
                mediaId,
                captionFile,
                'caption',
                {
                  blockNumber: blockNumber,
                  fileName: filename,
                  uploadedAt: new Date().toISOString(),
                  topicId: block.pageId
                }
              )
            }
            
            newCaptionFiles.set(blockNumber, {
              blockNumber,
              content
            })
          }
        }
      }
      
      // Clear existing caption files first
      setCaptionFiles(newCaptionFiles)
      setCaptionsUploaded(true)
      
      // Save all data to storage
      await saveDataToStorage()
    } catch (error) {
      console.error('Error processing captions zip:', error)
      setError('Error processing captions zip file')
    }
  }

  const handleEditClick = (block: UnifiedNarrationBlock) => {
    setEditingBlockId(block.id)
    setEditText(block.text)
  }

  const handleSaveEdit = async (blockId: string) => {
    // Update the narration blocks
    setNarrationBlocks(prev => prev.map(block =>
      block.id === blockId
        ? { ...block, text: editText }
        : block
    ))
    
    setEditingBlockId(null)
    setEditText('')
    
    // Save to storage
    await saveDataToStorage()
  }

  const handleCancelEdit = () => {
    setEditingBlockId(null)
    setEditText('')
  }

  // Recording functions
  const handleRecordClick = (block: UnifiedNarrationBlock) => {
    const hasExistingAudio = audioFiles.has(block.blockNumber)
    if (hasExistingAudio) {
      if (confirm('This will replace the existing audio. Continue?')) {
        setRecordingBlockId(block.id)
        setShowRecordingModal(true)
        setRecordingError(null)
      }
    } else {
      setRecordingBlockId(block.id)
      setShowRecordingModal(true)
      setRecordingError(null)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream)
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        setAudioChunks(chunks)
      }
      
      setMediaRecorder(recorder)
      setAudioChunks([])
      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setRecordingError('Could not access microphone. Please check your browser permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      
      // Create preview URL when recording stops
      if (audioChunks.length > 0) {
        // Clean up previous preview URL if it exists
        if (recordingPreviewUrl) {
          URL.revokeObjectURL(recordingPreviewUrl)
        }
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        const url = URL.createObjectURL(audioBlob)
        setRecordingPreviewUrl(url)
      }
    }
  }

  const saveRecording = async () => {
    if (audioChunks.length > 0 && recordingBlockId) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
      const audioFile = new File([audioBlob], `recorded-${Date.now()}.wav`, { type: 'audio/wav' })
      
      // Use blob URL manager to persist URLs across navigation
      const block = narrationBlocks.find(n => n.id === recordingBlockId)
      const urlKey = block ? `audio-recorded-${block.blockNumber}` : `audio-recorded-temp-${Date.now()}`
      const url = blobUrlManager.getOrCreateUrl(urlKey, audioFile)
      if (block) {
        try {
          // Store the audio blob in persistent storage
          if (!storage || !storage.isInitialized) {
            throw new Error('Storage is not available')
          }
          
          // Calculate numeric ID based on page type
          let mediaId = `audio-${block.blockNumber}` // fallback
          if (block.pageId === 'welcome') {
            mediaId = generateMediaId('audio', getPageIndex('welcome'))
          } else if (block.pageId === 'objectives' || block.pageId === 'learning-objectives') {
            mediaId = generateMediaId('audio', getPageIndex('objectives'))
          } else if (block.pageId.startsWith('topic-') || block.pageId) {
            // Find topic index - topics in narrationBlocks are ordered sequentially
            const allBlocks = narrationBlocks.filter(b => 
              !['welcome', 'objectives', 'learning-objectives'].includes(b.pageId)
            )
            const topicIndex = allBlocks.findIndex(b => b.blockNumber === block.blockNumber)
            if (topicIndex >= 0) {
              mediaId = generateMediaId('audio', getPageIndex('topic', topicIndex))
            }
          }
          console.log(`[AudioNarrationWizard] Storing recorded audio ${mediaId} for block ${block.blockNumber}, pageId: ${block.pageId}`)
          
          await storage.storeMedia(
            mediaId,
            audioFile,
            'audio',
            {
              blockNumber: block.blockNumber,
              fileName: audioFile.name,
              recordedAt: new Date().toISOString(),
              topicId: block.pageId
            }
          )
          
          // Update local state
          setAudioFiles(prev => new Map(prev).set(block.blockNumber, {
            blockNumber: block.blockNumber,
            file: audioFile,
            url
          }))
          
          // Save all data to storage
          await saveDataToStorage()
        } catch (error) {
          console.error('Error saving recording:', error)
          if (error instanceof Error && error.message.includes('quota')) {
            setStorageError('Storage quota exceeded. Please free up space and try again.')
          } else if (error instanceof Error && error.message.includes('not available')) {
            setStorageError('Storage is not available. Please check your browser settings.')
          } else {
            setStorageError('Error saving audio recording. Please try again.')
          }
        }
      }
      
      setShowRecordingModal(false)
      setRecordingBlockId(null)
      setAudioChunks([])
      setRecordingTime(0)
      
      // Clean up preview URL
      if (recordingPreviewUrl) {
        URL.revokeObjectURL(recordingPreviewUrl)
        setRecordingPreviewUrl(null)
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    setShowRecordingModal(false)
    setRecordingBlockId(null)
    setAudioChunks([])
    setIsRecording(false)
    setRecordingTime(0)
    setRecordingError(null)
    
    // Clean up preview URL
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl)
      setRecordingPreviewUrl(null)
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  // Caption preview functions
  const handlePreviewCaption = (block: UnifiedNarrationBlock) => {
    const captionFile = captionFiles.get(block.blockNumber)
    if (captionFile) {
      const parsed = parseVTT(captionFile.content)
      setParsedCaptions(parsed)
      setPreviewBlockId(block.id)
      setShowCaptionPreview(true)
    }
  }

  const parseVTT = (vttContent: string): Array<{ timing: string; text: string[] }> => {
    const lines = vttContent.split('\n')
    const cues: Array<{ timing: string; text: string[] }> = []
    let currentCue: { timing: string; text: string[] } | null = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes('-->')) {
        if (currentCue) {
          cues.push(currentCue)
        }
        currentCue = { timing: line, text: [] }
      } else if (line && currentCue && !line.startsWith('WEBVTT')) {
        currentCue.text.push(line)
      }
    }
    
    if (currentCue) {
      cues.push(currentCue)
    }
    
    return cues
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup effect - only clean up recording preview, not persisted audio
  useEffect(() => {
    const currentPreviewUrl = recordingPreviewUrl
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      
      // Only clean up recording preview URL
      // Do NOT revoke stored audio file URLs as they need to persist when navigating away
      if (currentPreviewUrl) {
        console.log('[AudioNarrationWizard] Revoking recording preview URL:', currentPreviewUrl)
        URL.revokeObjectURL(currentPreviewUrl)
      }
    }
  }, [recordingPreviewUrl])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const coursePreviewElement = courseSeedData && 'welcomePage' in courseContent ? (
    <CoursePreview 
      courseContent={courseContent as CourseContent}
      courseSeedData={courseSeedData}
    />
  ) : null

  return (
    <PageLayout
      currentStep={4}
      title="Audio Narration Wizard"
      description="Add voiceover narration to your course content"
      coursePreview={coursePreviewElement}
      autoSaveIndicator={<AutoSaveIndicatorConnected />}
      onSettingsClick={onSettingsClick}
      onBack={onBack}
      onNext={handleNext}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      {/* Loading indicator */}
      {isLoadingData && (
        <div data-testid="loading-indicator" style={{ display: 'none' }}>Loading...</div>
      )}
      
      {/* Storage error alert */}
      {storageError && (
        <Section>
          <Alert variant="error">
            {storageError}
          </Alert>
        </Section>
      )}
      
      {/* General error alert */}
      {error && (
        <Section>
          <Alert variant="error">
            {error}
          </Alert>
        </Section>
      )}

      {/* Bulk Upload Section */}
      <Section>
        <Card title="Bulk Audio Upload with Murf.ai Integration">
          {/* Download Narration Button */}
          <div style={{ marginBottom: '1.5rem' }}>
            <ButtonGroup gap="medium">
              <Button
                onClick={downloadNarrationFile}
                variant="primary"
                icon="📥"
                data-testid="download-narration-button"
              >
                Download Narration Text
              </Button>
            </ButtonGroup>
          </div>

          {/* Warning about replacement */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Alert variant="warning">
              ⚠️ Bulk upload will replace all existing audio and caption files. Make sure you have all required files in your ZIP archive.
            </Alert>
          </div>

          {/* Upload Grid */}
          <div data-testid="bulk-upload-grid" style={{ marginBottom: '2rem' }}>
            <Grid cols={2} gap="large">
            {/* Audio Upload */}
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', marginBottom: '0.75rem' }}>
                Audio Files (.zip)
              </h4>
              <ButtonGroup gap="small" direction="vertical" style={{ alignItems: 'center' }}>
                <Button
                  onClick={() => audioInputRef.current?.click()}
                  variant="secondary"
                  disabled={isUploading}
                  icon="📁"
                  data-testid="upload-audio-zip-button"
                >
                  {isUploading ? 'Uploading...' : 'Upload Audio ZIP'}
                </Button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleAudioZipUpload}
                  style={{ display: 'none' }}
                  aria-label="Upload audio zip"
                  data-testid="audio-zip-input"
                />
                {audioUploaded && (
                  <Alert variant="success">
                    ✓ {audioFiles.size} audio files uploaded
                  </Alert>
                )}
              </ButtonGroup>
            </div>

            {/* Caption Upload */}
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', marginBottom: '0.75rem' }}>
                Caption Files (.zip)
              </h4>
              <ButtonGroup gap="small" direction="vertical" style={{ alignItems: 'center' }}>
                <Button
                  onClick={() => captionInputRef.current?.click()}
                  variant="secondary"
                  icon="📁"
                  data-testid="upload-captions-zip-button"
                >
                  Upload Captions ZIP
                </Button>
                <input
                  ref={captionInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleCaptionZipUpload}
                  style={{ display: 'none' }}
                  aria-label="Upload captions zip"
                  data-testid="captions-zip-input"
                />
                {captionsUploaded && (
                  <Alert variant="success">
                    ✓ {captionFiles.size} caption files uploaded
                  </Alert>
                )}
              </ButtonGroup>
            </div>
            </Grid>
          </div>

          {/* Murf.ai Instructions */}
          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #3f3f46' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 500, color: '#e4e4e7', margin: '0 0 1rem 0' }}>
              How to use Murf.ai for professional voiceovers:
            </h4>
            
            <Grid cols={2} gap="large">
              {/* Steps */}
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', marginBottom: '0.75rem' }}>
                  Step-by-step guide:
                </h5>
                <ol style={{ fontSize: '0.875rem', color: '#a1a1aa', paddingLeft: '1.5rem', margin: '0 0 1rem 0' }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Go to murf.ai and create a new project
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Upload the narration script, select "Split by paragraphs"
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Select an appropriate voice and preview
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>For Audio:</strong>
                    <ul style={{ listStyle: 'none', paddingLeft: '1rem', marginTop: '0.25rem' }}>
                      <li>Select Export → Voice only</li>
                      <li>Download as: Split by blocks</li>
                      <li>Format: .MP3</li>
                      <li>Quality: High</li>
                      <li>Channel: Stereo</li>
                    </ul>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>For Captions:</strong>
                    <ul style={{ listStyle: 'none', paddingLeft: '1rem', marginTop: '0.25rem' }}>
                      <li>Select Export → Script</li>
                      <li>Download as: Split by blocks</li>
                      <li>Format: .VTT</li>
                    </ul>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Upload the audio and caption zip files below - they will automatically be applied to the right topics
                  </li>
                </ol>

                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', marginBottom: '0.75rem' }}>
                  File naming convention:
                </h5>
                <div style={{ 
                  backgroundColor: '#18181b', 
                  border: `1px solid ${tokens.colors.border.default}`, 
                  borderRadius: '0.25rem', 
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#a1a1aa',
                  marginBottom: '1rem'
                }}>
                  <div>0001-Block.mp3</div>
                  <div>0002-Block.mp3</div>
                  <div>0003-Block.mp3</div>
                  <div>...</div>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#71717a', fontStyle: 'italic' }}>
                  Name your audio files exactly as shown above to match block numbers
                </p>
              </div>

              {/* Features and Tips */}
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', marginBottom: '0.75rem' }}>
                  Murf.ai features:
                </h5>
                <ul style={{ fontSize: '0.875rem', color: '#a1a1aa', paddingLeft: '1.5rem', margin: '0 0 1rem 0' }}>
                  <li style={{ marginBottom: '0.5rem' }}>120+ AI voices in different accents</li>
                  <li style={{ marginBottom: '0.5rem' }}>20+ languages supported</li>
                  <li style={{ marginBottom: '0.5rem' }}>Adjustable speed and pitch</li>
                  <li style={{ marginBottom: '0.5rem' }}>Add pauses and emphasis</li>
                  <li style={{ marginBottom: '0.5rem' }}>Background music options</li>
                </ul>

                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', marginBottom: '0.75rem' }}>
                  Tips for best results:
                </h5>
                <ul style={{ fontSize: '0.875rem', color: '#a1a1aa', paddingLeft: '1.5rem', margin: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>Preview different voices before committing</li>
                  <li style={{ marginBottom: '0.5rem' }}>Add pauses between sentences for natural flow</li>
                  <li style={{ marginBottom: '0.5rem' }}>Use the same voice for consistent narration throughout</li>
                  <li style={{ marginBottom: '0.5rem' }}>Export at high quality (minimum 128kbps)</li>
                </ul>
              </div>
            </Grid>
          </div>
        </Card>
      </Section>

      {/* Narration Blocks */}
      <Section>
        <Card title="Narration Blocks">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {narrationBlocks.map((block) => {
              const hasAudio = audioFiles.has(block.blockNumber)
              const hasCaption = captionFiles.has(block.blockNumber)
              const isEditing = editingBlockId === block.id
              
              if (!individualRefs.current.has(block.id)) {
                individualRefs.current.set(block.id, { audio: null, caption: null })
              }

              return (
                <div
                  key={block.id}
                  data-testid="narration-block"
                  style={{
                    backgroundColor: '#18181b',
                    border: `1px solid ${tokens.colors.border.default}`,
                    borderRadius: '0.5rem',
                    padding: '1rem'
                  }}
                >
                  {/* Block Header */}
                  <Flex justify="space-between" align="center" style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Flex gap="medium" align="center" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {block.blockNumber}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>
                        {block.pageTitle}
                      </span>
                    </Flex>
                    <Flex gap="small" align="center" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {hasAudio && (
                        <span style={{ color: '#86efac', fontSize: '0.875rem' }}>
                          ✓ Audio
                        </span>
                      )}
                      {hasCaption && (
                        <span style={{ color: '#86efac', fontSize: '0.875rem' }}>
                          ✓ Caption
                        </span>
                      )}
                    </Flex>
                  </Flex>

                  {/* Block Content */}
                  {isEditing ? (
                    <>
                      <Input
                        multiline
                        rows={4}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        fullWidth
                        className="textarea"
                        style={{ marginBottom: '0.75rem' }}
                      />
                      <Flex gap="small">
                        <Button
                          onClick={() => handleSaveEdit(block.id)}
                          variant="primary"
                          size="small"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="secondary"
                          size="small"
                        >
                          Cancel
                        </Button>
                      </Flex>
                    </>
                  ) : (
                    <>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#e4e4e7',
                        lineHeight: 1.6,
                        margin: '0 0 0.75rem 0'
                      }}>
                        {block.text}
                      </p>
                      <Flex gap="small" wrap style={{ display: 'flex', flexWrap: 'wrap' }}>
                        <Button
                          onClick={() => handleEditClick(block)}
                          variant="tertiary"
                          size="small"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleRecordClick(block)}
                          variant="primary"
                          size="small"
                        >
                          🎙️ Record Audio
                        </Button>
                        <Button
                          onClick={() => individualRefs.current.get(block.id)?.audio?.click()}
                          variant="secondary"
                          size="small"
                          aria-label="Upload Audio File"
                        >
                          📁 Upload Audio
                        </Button>
                        <input
                          ref={(el) => {
                            const refs = individualRefs.current.get(block.id)
                            if (refs) refs.audio = el
                          }}
                          type="file"
                          accept="audio/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              try {
                                // Validate file type
                                const supportedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
                                if (!supportedAudioTypes.includes(file.type)) {
                                  setError(`Unsupported audio format: ${file.type}. Please use MP3, WAV, OGG, or WebM.`)
                                  e.target.value = '' // Reset file input
                                  return
                                }
                                
                                // Validate file size (50MB limit for audio files)
                                const maxSize = 50 * 1024 * 1024 // 50MB
                                if (file.size > maxSize) {
                                  const sizeMB = Math.round(file.size / (1024 * 1024))
                                  setError(`Audio file size (${sizeMB}MB) exceeds the maximum allowed size of 50MB`)
                                  e.target.value = '' // Reset file input
                                  return
                                }
                                
                                // Use blob URL manager to persist URLs across navigation
                                const urlKey = `audio-individual-${block.blockNumber}`
                                const url = blobUrlManager.getOrCreateUrl(urlKey, file)
                                
                                // Store in persistent storage
                                if (!storage || !storage.isInitialized) {
                                  throw new Error('Storage is not available')
                                }
                                
                                // Calculate numeric ID based on page type
                                let mediaId = `audio-${block.blockNumber}` // fallback
                                if (block.pageId === 'welcome') {
                                  mediaId = generateMediaId('audio', getPageIndex('welcome'))
                                } else if (block.pageId === 'objectives') {
                                  mediaId = generateMediaId('audio', getPageIndex('objectives'))
                                } else if (block.pageId.startsWith('topic-')) {
                                  // Find topic index
                                  const topicBlocks = narrationBlocks.filter(b => b.pageId.startsWith('topic-'))
                                  const topicIndex = topicBlocks.findIndex(b => b.blockNumber === block.blockNumber)
                                  if (topicIndex >= 0) {
                                    mediaId = generateMediaId('audio', getPageIndex('topic', topicIndex))
                                  }
                                }
                                
                                // Extract numeric index from pageId for consistent storage
                                let topicIndex = -1
                                if (block.pageId.startsWith('topic-')) {
                                  topicIndex = parseInt(block.pageId.replace('topic-', ''))
                                }
                                
                                await storage.storeMedia(
                                  mediaId,
                                  file,
                                  'audio',
                                  {
                                    blockNumber: block.blockNumber,
                                    fileName: file.name,
                                    uploadedAt: new Date().toISOString(),
                                    topicId: block.pageId,
                                    topicIndex: topicIndex >= 0 ? topicIndex : undefined
                                  }
                                )
                                
                                setAudioFiles(prev => new Map(prev).set(block.blockNumber, {
                                  blockNumber: block.blockNumber,
                                  file,
                                  url
                                }))
                                
                                // Save all data to storage
                                await saveDataToStorage()
                              } catch (error) {
                                console.error('Error saving audio:', error)
                                if (error instanceof Error && error.message.includes('quota')) {
                                  setStorageError('Storage quota exceeded. Please free up space and try again.')
                                } else if (error instanceof Error && error.message.includes('not available')) {
                                  setStorageError('Storage is not available. Please check your browser settings.')
                                } else {
                                  setStorageError('Error saving audio file. Please try again.')
                                }
                              }
                            }
                          }}
                        />
                        {hasAudio && (
                          <Button
                            onClick={() => handleRemoveAudioClick(block.blockNumber)}
                            variant="danger"
                            size="small"
                          >
                            Remove Audio
                          </Button>
                        )}
                        <Button
                          onClick={() => individualRefs.current.get(block.id)?.caption?.click()}
                          variant="secondary"
                          size="small"
                          aria-label="Upload Caption File"
                        >
                          📄 Upload Caption
                        </Button>
                        <input
                          ref={(el) => {
                            const refs = individualRefs.current.get(block.id)
                            if (refs) refs.caption = el
                          }}
                          type="file"
                          accept=".vtt"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              try {
                                // Validate file type
                                if (!file.name.endsWith('.vtt')) {
                                  setError('Please upload a WebVTT (.vtt) caption file')
                                  e.target.value = '' // Reset file input
                                  return
                                }
                                
                                // Validate file size (5MB limit for caption files)
                                const maxSize = 5 * 1024 * 1024 // 5MB
                                if (file.size > maxSize) {
                                  const sizeMB = Math.round(file.size / (1024 * 1024))
                                  setError(`Caption file size (${sizeMB}MB) exceeds the maximum allowed size of 5MB`)
                                  e.target.value = '' // Reset file input
                                  return
                                }
                                
                                // Check if replacing existing caption
                                const hasExistingCaption = captionFiles.has(block.blockNumber)
                                if (hasExistingCaption) {
                                  const confirmed = window.confirm('This will replace the existing caption file. Continue?')
                                  if (!confirmed) {
                                    e.target.value = '' // Reset file input
                                    return
                                  }
                                }
                                
                                const content = await file.text()
                                
                                // Basic VTT validation
                                if (!content.trim().startsWith('WEBVTT')) {
                                  setError('Invalid VTT file. Caption files must start with "WEBVTT"')
                                  e.target.value = '' // Reset file input
                                  return
                                }
                                
                                // Calculate numeric ID based on page type
                                let mediaId = `caption-${block.blockNumber}` // fallback
                                if (block.pageId === 'welcome') {
                                  mediaId = generateMediaId('caption', getPageIndex('welcome'))
                                } else if (block.pageId === 'objectives') {
                                  mediaId = generateMediaId('caption', getPageIndex('objectives'))
                                } else if (block.pageId.startsWith('topic-')) {
                                  // Find topic index
                                  const topicBlocks = narrationBlocks.filter(b => b.pageId.startsWith('topic-'))
                                  const topicIndex = topicBlocks.findIndex(b => b.blockNumber === block.blockNumber)
                                  if (topicIndex >= 0) {
                                    mediaId = generateMediaId('caption', getPageIndex('topic', topicIndex))
                                  }
                                }
                                
                                // Save caption to media storage
                                await storage.storeMedia(
                                  mediaId,
                                  file,
                                  'caption',
                                  {
                                    blockNumber: block.blockNumber,
                                    fileName: file.name,
                                    uploadedAt: new Date().toISOString(),
                                    topicId: block.pageId
                                  }
                                )
                                
                                // Update local state
                                setCaptionFiles(prev => new Map(prev).set(block.blockNumber, {
                                  blockNumber: block.blockNumber,
                                  content
                                }))
                                
                                // Save all data to storage
                                await saveDataToStorage()
                              } catch (error) {
                                console.error('Error saving caption:', error)
                                setStorageError('Failed to save caption file. Please try again.')
                              }
                            }
                          }}
                        />
                        {hasCaption && (
                          <>
                            <Button
                              onClick={() => handlePreviewCaption(block)}
                              variant="secondary"
                              size="small"
                            >
                              👁️ Preview Caption
                            </Button>
                            <Button
                              onClick={() => handleRemoveCaptionClick(block.blockNumber)}
                              variant="danger"
                              size="small"
                            >
                              Remove Caption
                            </Button>
                          </>
                        )}
                      </Flex>
                    </>
                  )}

                  {/* Audio Player */}
                  {hasAudio && !isEditing && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <audio
                        data-testid={`audio-player-${block.blockNumber}`}
                        controls
                        style={{ width: '100%', height: '2rem' }}
                        src={audioFiles.get(block.blockNumber)?.url}
                      />
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a1a1aa' }}>
                        {audioFiles.get(block.blockNumber)?.file.name}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </Section>

      {/* Status Summary */}
      {(audioUploaded || captionsUploaded) && (
        <Section>
          <Card title="Upload Summary">
            <Grid cols={2} gap="medium">
              <Alert variant={audioUploaded ? 'success' : 'info'}>
                <strong>Audio Files:</strong> {audioUploaded ? `${audioFiles.size} files uploaded` : 'Not uploaded'}
              </Alert>
              <Alert variant={captionsUploaded ? 'success' : 'info'}>
                <strong>Caption Files:</strong> {captionsUploaded ? `${captionFiles.size} files uploaded` : 'Not uploaded'}
              </Alert>
            </Grid>
          </Card>
        </Section>
      )}

      {/* Recording Modal */}
      {showRecordingModal && recordingBlockId && (
        <Modal
          isOpen={showRecordingModal}
          onClose={cancelRecording}
          title={`Record Audio for ${narrationBlocks.find(b => b.id === recordingBlockId)?.pageTitle || ''}`}
          size="small"
        >
          <div data-testid="recording-modal" style={{ padding: '1rem' }}>
            {recordingError ? (
              <Alert variant="error">
                {recordingError}
              </Alert>
            ) : (
              <>
                {!isRecording && audioChunks.length === 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ marginBottom: '1.5rem', color: '#a1a1aa' }}>
                      Click the button below to start recording audio using your microphone.
                    </p>
                    <Button
                      onClick={startRecording}
                      variant="primary"
                      size="large"
                    >
                      🎙️ Start Recording
                    </Button>
                  </div>
                )}

                {isRecording && (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      data-testid="recording-timer"
                      style={{
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        color: '#ef4444',
                        marginBottom: '1rem'
                      }}
                    >
                      🔴 {formatTime(recordingTime)}
                    </div>
                    <p style={{ marginBottom: '1.5rem', color: '#a1a1aa' }}>
                      Recording in progress...
                    </p>
                    <Button
                      onClick={stopRecording}
                      variant="danger"
                      size="large"
                    >
                      ⏹️ Stop Recording
                    </Button>
                  </div>
                )}

                {!isRecording && audioChunks.length > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ marginBottom: '1.5rem', color: '#a1a1aa' }}>
                      Recording complete. Would you like to save this recording?
                    </p>
                    <audio
                      controls
                      src={recordingPreviewUrl || ''}
                      style={{ width: '100%', marginBottom: '1.5rem' }}
                    />
                    <Flex gap="medium" justify="center">
                      <Button
                        onClick={saveRecording}
                        variant="success"
                        size="medium"
                      >
                        💾 Save Recording
                      </Button>
                      <Button
                        onClick={cancelRecording}
                        variant="secondary"
                        size="medium"
                      >
                        Cancel
                      </Button>
                    </Flex>
                  </div>
                )}
              </>
            )}

            {!recordingError && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <Button
                  onClick={cancelRecording}
                  variant="tertiary"
                  size="small"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Caption Preview Modal */}
      {showCaptionPreview && previewBlockId && (
        <Modal
          isOpen={showCaptionPreview}
          onClose={() => setShowCaptionPreview(false)}
          title="Caption Preview"
          size="medium"
        >
          <div data-testid="caption-preview-modal" style={{ padding: '1rem' }}>
            {(() => {
              const block = narrationBlocks.find(b => b.id === previewBlockId)
              const hasAudio = block && audioFiles.has(block.blockNumber)
              
              return (
                <>
                  {hasAudio && block ? (
                    <>
                      <audio
                        data-testid="caption-preview-audio"
                        controls
                        src={audioFiles.get(block.blockNumber)?.url}
                        style={{ width: '100%', marginBottom: '1.5rem' }}
                      />
                    </>
                  ) : (
                    <Alert variant="info">
                      No audio file uploaded for synchronized playback.
                    </Alert>
                  )}

                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    backgroundColor: '#18181b',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #3f3f46'
                  }}>
                    {parsedCaptions.length > 0 ? (
                      parsedCaptions.map((caption, index) => (
                        <div
                          key={index}
                          className="caption-item"
                          style={{
                            marginBottom: '1rem',
                            padding: '0.75rem',
                            borderRadius: '0.25rem',
                            backgroundColor: 'transparent',
                            color: '#e4e4e7',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            marginBottom: '0.25rem',
                            color: '#71717a'
                          }}>
                            {caption.timing}
                          </div>
                          <div>
                            {caption.text.join(' ')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <Alert variant="warning">
                        Invalid caption format or empty caption file.
                      </Alert>
                    )}
                  </div>

                  <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <Button
                      onClick={() => setShowCaptionPreview(false)}
                      variant="secondary"
                    >
                      Close
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        </Modal>
      )}

      {/* Remove Audio Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveAudioConfirm}
        title="Remove Audio"
        message="Are you sure you want to remove the audio for this narration block? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmRemoveAudio}
        onCancel={() => {
          setShowRemoveAudioConfirm(false)
          setAudioToRemove(null)
        }}
      />

      {/* Remove Caption Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveCaptionConfirm}
        title="Remove Caption"
        message="Are you sure you want to remove the caption for this narration block? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmRemoveCaption}
        onCancel={() => {
          setShowRemoveCaptionConfirm(false)
          setCaptionToRemove(null)
        }}
      />
    </PageLayout>
  )
}