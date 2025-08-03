import React, { useState, useRef, useEffect, useCallback } from 'react'
import { CourseContentUnion } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import JSZip from 'jszip'
import { PageLayout } from './PageLayout'
import { ConfirmDialog } from './ConfirmDialog'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { 
  Button, 
  Card, 
  ButtonGroup,
  Grid,
  Alert,
  Modal,
  Icon,
  ProgressBar
} from './DesignSystem'
import { FileAudio, FileText, Eye, Mic, Circle, Save } from 'lucide-react'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import { useStepData } from '../hooks/useStepData'
import { blobUrlManager } from '../utils/blobUrlManager'
import { generateAudioRecordingId } from '../utils/idGenerator'

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
  mediaId?: string // MediaRegistry ID
}

interface CaptionFile {
  blockNumber: string
  content: string
  mediaId?: string // MediaRegistry ID
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
        id: `${anyContent.welcomePage.id || 'welcome'}-narration`,
        text: anyContent.welcomePage.narration,
        blockNumber: String(blockCounter++).padStart(4, '0'),
        pageId: anyContent.welcomePage.id || 'welcome',
        pageTitle: anyContent.welcomePage.title
      })
    }

    // Add learning objectives page narration
    if (anyContent.learningObjectivesPage?.narration) {
      blocks.push({
        id: `${anyContent.learningObjectivesPage.id || 'objectives'}-narration`,
        text: anyContent.learningObjectivesPage.narration,
        blockNumber: String(blockCounter++).padStart(4, '0'),
        pageId: anyContent.learningObjectivesPage.id || 'objectives',
        pageTitle: anyContent.learningObjectivesPage.title
      })
    }
  }

  // Process topics (both formats)
  if (content.topics && Array.isArray(content.topics)) {
    content.topics.forEach(topic => {
      const anyTopic = topic as any
      if (anyTopic.narration) {
        blocks.push({
          id: `${anyTopic.id}-narration`,
          text: anyTopic.narration,
          blockNumber: String(blockCounter++).padStart(4, '0'),
          pageId: anyTopic.id,
          pageTitle: anyTopic.title
        })
      }
    })
  }

  return blocks
}

export function AudioNarrationWizard({
  courseContent,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onSaveAs,
  onOpen,
  onHelp,
  onStepClick
}: AudioNarrationWizardProps) {
  const storage = useStorage()
  const { 
    storeMedia,
    getMedia,
    getMediaForPage,
    createBlobUrl,
    revokeBlobUrl,
    getAllMedia
  } = useUnifiedMedia()
  
  // Extract narration blocks
  const initialBlocks = extractNarrationBlocks(courseContent)
  console.log('[AudioNarrationWizard] Initial narration blocks:', initialBlocks.map(b => ({
    blockNumber: b.blockNumber,
    pageId: b.pageId,
    pageTitle: b.pageTitle
  })))
  
  // Log the objectives page details specifically
  const objectivesBlock = initialBlocks.find(b => b.pageTitle?.toLowerCase().includes('objective') || b.pageId.includes('objective'))
  if (objectivesBlock) {
    console.log('[AudioNarrationWizard] Objectives block details:', {
      blockNumber: objectivesBlock.blockNumber,
      pageId: objectivesBlock.pageId,
      pageTitle: objectivesBlock.pageTitle,
      id: objectivesBlock.id
    })
  }
  
  const [narrationBlocks, setNarrationBlocks] = useState<UnifiedNarrationBlock[]>(initialBlocks)
  const [audioFiles, setAudioFiles] = useState<Map<string, AudioFile>>(new Map())
  const [captionFiles, setCaptionFiles] = useState<Map<string, CaptionFile>>(new Map())
  const [isUploading, setIsUploading] = useState(false)
  const [audioUploaded, setAudioUploaded] = useState(false)
  const [captionsUploaded, setCaptionsUploaded] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string
    percent: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null)
  const [blockToReplaceAudio, setBlockToReplaceAudio] = useState<UnifiedNarrationBlock | null>(null)
  
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

  // Create preview URL when audioChunks change and recording is stopped
  useEffect(() => {
    console.log('[AudioNarrationWizard] Preview URL effect:', {
      isRecording,
      audioChunksLength: audioChunks.length,
      showRecordingModal
    })
    if (!isRecording && audioChunks.length > 0 && showRecordingModal) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
      const url = URL.createObjectURL(audioBlob)
      console.log('[AudioNarrationWizard] Setting preview URL:', url)
      setRecordingPreviewUrl(url)
    }
  }, [isRecording, audioChunks, showRecordingModal])

  // Load persisted data function for useStepData hook
  const loadPersistedData = useCallback(async () => {

    try {
      console.log('[AudioNarrationWizard] Loading persisted data...')
      
      // First check if course content already has audioId/captionId fields
      const audioIdsInContent: (string | null)[] = []
      const captionIdsInContent: (string | null)[] = []
      
      // Check welcome page - push null if no media to maintain index alignment
      if ('welcomePage' in courseContent) {
        const welcomeAudio = courseContent.welcomePage.media?.find(m => m.type === 'audio')
        audioIdsInContent.push(welcomeAudio?.id || null)
        // Captions are stored separately, not in media array
        captionIdsInContent.push(null)
      }
      
      // Check objectives page - push null if no media to maintain index alignment
      if ('learningObjectivesPage' in courseContent) {
        const objAudio = courseContent.learningObjectivesPage.media?.find(m => m.type === 'audio')
        audioIdsInContent.push(objAudio?.id || null)
        // Captions are stored separately, not in media array
        captionIdsInContent.push(null)
      }
      
      // Check topics - push null if no media to maintain index alignment
      if ('topics' in courseContent && Array.isArray(courseContent.topics)) {
        courseContent.topics.forEach((topic: any) => {
          const topicAudio = topic.media?.find((m: any) => m.type === 'audio')
          audioIdsInContent.push(topicAudio?.id || null)
          // Captions are stored separately, not in media array
          captionIdsInContent.push(null)
        })
      }
      
      console.log('[AudioNarrationWizard] Found in course content:', audioIdsInContent.length, 'audio IDs,', captionIdsInContent.length, 'caption IDs')
      
      // If we have audio IDs in content, try to load from MediaRegistry
      if (audioIdsInContent.length > 0) {
        const newAudioFiles = new Map<string, AudioFile>()
        const newCaptionFiles = new Map<string, CaptionFile>()
        
        // Load each audio ID from MediaRegistry
        for (let i = 0; i < audioIdsInContent.length; i++) {
          const audioId = audioIdsInContent[i]
          const block = narrationBlocks[i]
          
          if (block && audioId && audioId !== null) {
            try {
              // Get media from UnifiedMedia
              const mediaData = await getMedia(audioId)
              
              if (mediaData) {
                const fileName = mediaData.metadata?.original_name || mediaData.metadata?.originalName || `${block.blockNumber}-Block.mp3`
                const blob = new Blob([mediaData.data], { type: mediaData.metadata?.mimeType || 'audio/mpeg' })
                const file = new File([blob], fileName, { type: mediaData.metadata?.mimeType || 'audio/mpeg' })
                const url = URL.createObjectURL(blob)
                
                newAudioFiles.set(block.blockNumber, {
                  blockNumber: block.blockNumber,
                  file: file,
                  url: url,
                  mediaId: audioId
                })
                console.log(`[AudioNarrationWizard] Loaded audio from MediaRegistry: ${audioId} for block ${block.blockNumber}`)
              }
            } catch (error) {
              console.error(`[AudioNarrationWizard] Failed to load audio ${audioId}:`, error)
            }
          } else if (block && !audioId) {
            console.log(`[AudioNarrationWizard] No audio ID for block ${block.blockNumber} (${block.pageTitle})`)
          }
        }
        
        // Load caption IDs similarly
        for (let i = 0; i < captionIdsInContent.length; i++) {
          const captionId = captionIdsInContent[i]
          const block = narrationBlocks[i]
          
          if (block && captionId && captionId !== null) {
            newCaptionFiles.set(block.blockNumber, {
              blockNumber: block.blockNumber,
              content: '', // Will be loaded when needed
              mediaId: captionId
            })
            console.log(`[AudioNarrationWizard] Found caption ID: ${captionId} for block ${block.blockNumber}`)
          } else if (block && !captionId) {
            console.log(`[AudioNarrationWizard] No caption ID for block ${block.blockNumber} (${block.pageTitle})`)
          }
        }
        
        setAudioFiles(newAudioFiles)
        setCaptionFiles(newCaptionFiles)
        setAudioUploaded(newAudioFiles.size > 0)
        setCaptionsUploaded(newCaptionFiles.size > 0)
        console.log('[AudioNarrationWizard] Loaded from course content:', newAudioFiles.size, 'audio files,', newCaptionFiles.size, 'caption files')
        return
      }
      
      // Get all media items
      const allMediaItems = getAllMedia()
      console.log('[AudioNarrationWizard] Total media items:', allMediaItems.length)
      allMediaItems.forEach(item => {
        console.log('[AudioNarrationWizard] Media item:', item.id, item.type, item.pageId)
      })
      
      let allAudioItems = allMediaItems.filter(item => item.type === 'audio')
      let allCaptionItems = allMediaItems.filter(item => item.type === 'caption')
      
      console.log('[AudioNarrationWizard] Found media items:', allAudioItems.length, 'audio,', allCaptionItems.length, 'caption')
      
      // Load audio files from media items
      const newAudioFiles = new Map<string, AudioFile>()
      for (const item of allAudioItems) {
        // Find the corresponding narration block
        const block = narrationBlocks.find(b => b.pageId === item.pageId)
        if (block) {
          const mediaData = await getMedia(item.id)
          if (mediaData) {
            const blob = new Blob([mediaData.data], { type: mediaData.metadata?.mimeType || 'audio/mpeg' })
            const file = new File([blob], item.fileName, { type: blob.type })
            const url = blobUrlManager.getOrCreateUrl(`audio-${block.blockNumber}`, blob)
            newAudioFiles.set(block.blockNumber, {
              blockNumber: block.blockNumber,
              file,
              url,
              mediaId: item.id
            })
          }
        }
      }
      setAudioFiles(newAudioFiles)
      
      // Load caption files
      const newCaptionFiles = new Map<string, CaptionFile>()
      for (const item of allCaptionItems) {
        // Find the corresponding narration block
        const block = narrationBlocks.find(b => b.pageId === item.pageId)
        if (block) {
          const mediaData = await getMedia(item.id)
          if (mediaData) {
            const content = new TextDecoder().decode(mediaData.data)
            newCaptionFiles.set(block.blockNumber, {
              blockNumber: block.blockNumber,
              content,
              mediaId: item.id
            })
          }
        }
      }
      setCaptionFiles(newCaptionFiles)
      
      // Set upload flags
      setAudioUploaded(newAudioFiles.size > 0)
      setCaptionsUploaded(newCaptionFiles.size > 0)
      console.log('[AudioNarrationWizard] Loaded from MediaRegistry:', newAudioFiles.size, 'audio files,', newCaptionFiles.size, 'caption files')
    } catch (error) {
      console.error('[AudioNarrationWizard] Error loading existing media:', error)
      setError('Failed to load saved data. Please check your browser storage settings.')
    }
  }, [getMedia, getAllMedia, narrationBlocks, courseContent])

  // Use useStepData to load data when the audio step (step 4) becomes active
  useStepData(loadPersistedData, { 
    step: 4,
    dependencies: [courseContent]
  })

  // Auto-save function to update course content with audio IDs
  const autoSaveToCourseContent = useCallback(() => {
    if (!onSave) return
    
    // Create enhanced content with MediaRegistry IDs
    const contentWithAudio = JSON.parse(JSON.stringify(courseContent))
    
    // Process welcome page
    if ('welcomePage' in contentWithAudio) {
      const welcomeBlock = narrationBlocks.find(b => b.pageId === 'welcome')
      if (welcomeBlock) {
        const audioFile = audioFiles.get(welcomeBlock.blockNumber)
        const captionFile = captionFiles.get(welcomeBlock.blockNumber)
        
        if (audioFile?.mediaId) {
          contentWithAudio.welcomePage.audioId = audioFile.mediaId
        }
        if (captionFile?.mediaId) {
          contentWithAudio.welcomePage.captionId = captionFile.mediaId
        }
      }
    }
    
    // Process objectives page
    if ('learningObjectivesPage' in contentWithAudio) {
      const objectivesBlock = narrationBlocks.find(b => 
        b.pageId === 'objectives' || 
        b.pageId === 'learningObjectives' || 
        b.pageId === 'learning-objectives' ||
        b.pageTitle?.toLowerCase().includes('objective')
      )
      
      if (objectivesBlock) {
        const audioFile = audioFiles.get(objectivesBlock.blockNumber)
        const captionFile = captionFiles.get(objectivesBlock.blockNumber)
        
        if (audioFile?.mediaId) {
          contentWithAudio.learningObjectivesPage.audioId = audioFile.mediaId
        }
        if (captionFile?.mediaId) {
          contentWithAudio.learningObjectivesPage.captionId = captionFile.mediaId
        }
      }
    }
    
    // Process topics
    contentWithAudio.topics.forEach((topic: any) => {
      const topicBlock = narrationBlocks.find(b => b.pageId === topic.id)
      if (topicBlock) {
        const audioFile = audioFiles.get(topicBlock.blockNumber)
        const captionFile = captionFiles.get(topicBlock.blockNumber)
        
        if (audioFile?.mediaId) {
          topic.audioId = audioFile.mediaId
        }
        if (captionFile?.mediaId) {
          topic.captionId = captionFile.mediaId
        }
      }
    })
    
    console.log('[AudioNarrationWizard] Auto-saving to course content')
    // Store in context and trigger save callback
    if (storage && storage.currentProjectId) {
      storage.saveContent('audioNarration', contentWithAudio)
    }
    if (onSave) {
      onSave() // Trigger parent save handler
    }
  }, [courseContent, narrationBlocks, audioFiles, captionFiles, onSave])

  // Auto-save whenever audio or caption files change
  useEffect(() => {
    if (audioFiles.size > 0 || captionFiles.size > 0) {
      const debounceTimer = setTimeout(() => {
        autoSaveToCourseContent()
      }, 500) // Debounce to avoid too many saves
      
      return () => clearTimeout(debounceTimer)
    }
  }, [audioFiles, captionFiles, autoSaveToCourseContent])

  const handleNext = async () => {
    // No longer need to check for mediaRegistry

    // Save one more time before navigating
    autoSaveToCourseContent()
    
    // Create enhanced content with MediaRegistry IDs for navigation
    const contentWithAudio = JSON.parse(JSON.stringify(courseContent))
    
    // Process welcome page
    if ('welcomePage' in contentWithAudio) {
      const welcomeBlock = narrationBlocks.find(b => b.pageId === 'welcome')
      if (welcomeBlock) {
        const audioFile = audioFiles.get(welcomeBlock.blockNumber)
        const captionFile = captionFiles.get(welcomeBlock.blockNumber)
        
        if (audioFile?.mediaId) {
          contentWithAudio.welcomePage.audioId = audioFile.mediaId
        }
        if (captionFile?.mediaId) {
          contentWithAudio.welcomePage.captionId = captionFile.mediaId
        }
      }
    }
    
    // Process objectives page
    if ('learningObjectivesPage' in contentWithAudio) {
      const objectivesBlock = narrationBlocks.find(b => 
        b.pageId === 'objectives' || 
        b.pageId === 'learningObjectives' || 
        b.pageId === 'learning-objectives' ||
        b.pageTitle?.toLowerCase().includes('objective')
      )
      console.log('[AudioNarrationWizard] Processing objectives page:', {
        blockFound: !!objectivesBlock,
        blockNumber: objectivesBlock?.blockNumber,
        pageId: objectivesBlock?.pageId
      })
      
      if (objectivesBlock) {
        const audioFile = audioFiles.get(objectivesBlock.blockNumber)
        const captionFile = captionFiles.get(objectivesBlock.blockNumber)
        
        console.log('[AudioNarrationWizard] Objectives audio/caption:', {
          audioFile: !!audioFile,
          audioMediaId: audioFile?.mediaId,
          captionFile: !!captionFile,
          captionMediaId: captionFile?.mediaId
        })
        
        if (audioFile?.mediaId) {
          contentWithAudio.learningObjectivesPage.audioId = audioFile.mediaId
          console.log('[AudioNarrationWizard] Set objectives audioId:', audioFile.mediaId)
        }
        if (captionFile?.mediaId) {
          contentWithAudio.learningObjectivesPage.captionId = captionFile.mediaId
          console.log('[AudioNarrationWizard] Set objectives captionId:', captionFile.mediaId)
        }
      } else {
        console.log('[AudioNarrationWizard] WARNING: No objectives block found!')
      }
    }
    
    // Process topics
    contentWithAudio.topics.forEach((topic: any) => {
      const topicBlock = narrationBlocks.find(b => b.pageId === topic.id)
      if (topicBlock) {
        const audioFile = audioFiles.get(topicBlock.blockNumber)
        const captionFile = captionFiles.get(topicBlock.blockNumber)
        
        if (audioFile?.mediaId) {
          topic.audioId = audioFile.mediaId
        }
        if (captionFile?.mediaId) {
          topic.captionId = captionFile.mediaId
        }
      }
    })
    
    console.log('[AudioNarrationWizard] Final content with audio:', {
      welcomeAudioId: contentWithAudio.welcomePage?.audioId,
      objectivesAudioId: contentWithAudio.learningObjectivesPage?.audioId,
      topicAudioIds: contentWithAudio.topics?.map((t: any) => ({ id: t.id, audioId: t.audioId }))
    })
    
    onNext(contentWithAudio)
  }

  // Handle file uploads using MediaRegistry
  const handleAudioFileChange = async (event: React.ChangeEvent<HTMLInputElement>, block: UnifiedNarrationBlock) => {
    
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      // Register with MediaRegistry
      console.log('[AudioNarrationWizard] Registering audio with MediaRegistry:', block.pageId, 'audio')
      const storedItem = await storeMedia(file, block.pageId, 'audio', {
        blockNumber: block.blockNumber,
        fileName: file.name
      }, (progress) => {
        setUploadProgress({
          fileName: file.name,
          percent: progress.percent
        })
      })
      console.log('[AudioNarrationWizard] Audio stored successfully:', storedItem.id)
      
      // Create URL for preview
      const url = blobUrlManager.getOrCreateUrl(`audio-${block.blockNumber}`, file)
      
      setAudioFiles(prev => new Map(prev).set(block.blockNumber, {
        blockNumber: block.blockNumber,
        file,
        url,
        mediaId: storedItem.id
      }))
      
      // Clear upload progress
      setUploadProgress(null)
      
      console.log(`[AudioNarrationWizard] Stored audio ${storedItem.id} for block ${block.blockNumber}`)
      
      // Trigger save to prevent unsaved changes dialog
      if (onSave) {
        console.log('[AudioNarrationWizard] Triggering auto-save after audio upload')
        onSave()
      }
    } catch (error) {
      console.error('Error registering audio:', error)
    }
  }

  const handleCaptionFileChange = async (event: React.ChangeEvent<HTMLInputElement>, block: UnifiedNarrationBlock) => {
    
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      // Read file content - handle browsers that don't support File.text()
      const content = await new Promise<string>((resolve, reject) => {
        if (file.text) {
          file.text().then(resolve).catch(reject)
        } else {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsText(file)
        }
      })
      
      // Register with MediaRegistry
      const storedItem = await storeMedia(file, block.pageId, 'caption', {
        blockNumber: block.blockNumber
      })
      
      setCaptionFiles(prev => new Map(prev).set(block.blockNumber, {
        blockNumber: block.blockNumber,
        content,
        mediaId: storedItem.id
      }))
      
      console.log(`[AudioNarrationWizard] Stored caption ${storedItem.id} for block ${block.blockNumber}`)
      
      // Trigger save to prevent unsaved changes dialog
      if (onSave) {
        console.log('[AudioNarrationWizard] Triggering auto-save after caption upload')
        onSave()
      }
    } catch (error) {
      console.error('Error registering caption:', error)
    }
  }

  // Recording functions
  const handleRecordClick = (block: UnifiedNarrationBlock) => {
    const hasExistingAudio = audioFiles.has(block.blockNumber)
    if (hasExistingAudio) {
      setBlockToReplaceAudio(block)
    } else {
      setRecordingBlockId(block.id)
      setShowRecordingModal(true)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data])
        }
      }
      
      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordingError(null)
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setRecordingError('Unable to access microphone. Please check your permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const saveRecording = async () => {
    if (audioChunks.length === 0 || !recordingBlockId) return
    
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
    const audioFile = new File([audioBlob], generateAudioRecordingId(), { type: 'audio/wav' })
    
    const block = narrationBlocks.find(n => n.id === recordingBlockId)
    if (block) {
      try {
        // Register with MediaRegistry
        const storedItem = await storeMedia(audioFile, block.pageId, 'audio', {
          blockNumber: block.blockNumber,
          fileName: audioFile.name,
          recordedAt: new Date().toISOString()
        }, (progress) => {
          setUploadProgress({
            fileName: 'Recording',
            percent: progress.percent
          })
        })
        
        const url = blobUrlManager.getOrCreateUrl(`audio-recorded-${block.blockNumber}`, audioFile)
        
        setAudioFiles(prev => new Map(prev).set(block.blockNumber, {
          blockNumber: block.blockNumber,
          file: audioFile,
          url,
          mediaId: storedItem.id
        }))
        
        console.log(`[AudioNarrationWizard] Stored recorded audio ${storedItem.id} for block ${block.blockNumber}`)
        
        // Trigger save to prevent unsaved changes dialog
        if (onSave) {
          console.log('[AudioNarrationWizard] Triggering auto-save after recording')
          onSave()
        }
      } catch (error) {
        console.error('Error saving recorded audio:', error)
      }
    }
    
    // Reset recording state
    setShowRecordingModal(false)
    setRecordingBlockId(null)
    setAudioChunks([])
    setRecordingTime(0)
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl)
      setRecordingPreviewUrl(null)
    }
  }

  const cancelRecording = () => {
    if (isRecording) {
      stopRecording()
    }
    
    setShowRecordingModal(false)
    setRecordingBlockId(null)
    setAudioChunks([])
    setRecordingTime(0)
    setRecordingError(null)
    
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl)
      setRecordingPreviewUrl(null)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Bulk upload functions
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
    
    setIsUploading(true)
    setError(null)
    
    try {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      const newAudioFiles = new Map<string, AudioFile>()
      
      // Process each file in the ZIP
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir && /\.(mp3|wav|m4a|ogg)$/i.test(filename)) {
          const blockNumber = filename.match(/(\d{4})/)?.[1]
          if (blockNumber) {
            const arrayBuffer = await zipEntry.async('arraybuffer')
            const blob = new Blob([arrayBuffer], { type: 'audio/*' })
            const audioFile = new File([blob], filename, { type: 'audio/*' })
            
            // Register with MediaRegistry
            const block = narrationBlocks.find(n => n.blockNumber === blockNumber)
            if (block) {
              const storedItem = await storeMedia(audioFile, block.pageId, 'audio', {
                originalName: filename
              }, (progress) => {
                setUploadProgress({
                  fileName: filename,
                  percent: progress.percent
                })
              })
              
              const url = URL.createObjectURL(blob)
              newAudioFiles.set(blockNumber, {
                blockNumber,
                file: audioFile,
                url,
                mediaId: storedItem.id
              })
            }
          }
        }
      }
      
      // Replace all existing audio files
      audioFiles.forEach(audio => URL.revokeObjectURL(audio.url))
      setAudioFiles(newAudioFiles)
      setAudioUploaded(newAudioFiles.size > 0)
      
      event.target.value = '' // Reset file input
    } catch (error) {
      console.error('Error processing audio ZIP:', error)
      setError('Failed to process audio ZIP file')
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  const handleCaptionZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file containing caption files')
      event.target.value = '' // Reset file input
      return
    }
    
    setIsUploading(true)
    setError(null)
    
    try {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      const newCaptionFiles = new Map<string, CaptionFile>()
      
      // Process each file in the ZIP
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir && /\.(vtt|srt)$/i.test(filename)) {
          const blockNumber = filename.match(/(\d{4})/)?.[1]
          if (blockNumber) {
            const content = await zipEntry.async('text')
            
            // Register with MediaRegistry
            const block = narrationBlocks.find(n => n.blockNumber === blockNumber)
            if (block) {
              const blob = new Blob([content], { type: 'text/vtt' })
              const captionFile = new File([blob], filename, { type: 'text/vtt' })
              
              const storedItem = await storeMedia(captionFile, block.pageId, 'caption', {
                originalName: filename
              })
              
              newCaptionFiles.set(blockNumber, {
                blockNumber,
                content,
                mediaId: storedItem.id
              })
            }
          }
        }
      }
      
      // Replace all existing caption files
      setCaptionFiles(newCaptionFiles)
      setCaptionsUploaded(newCaptionFiles.size > 0)
      
      event.target.value = '' // Reset file input
    } catch (error) {
      console.error('Error processing caption ZIP:', error)
      setError('Failed to process caption ZIP file')
    } finally {
      setIsUploading(false)
    }
  }

  // Render
  return (
    <PageLayout
      currentStep={4}
      title="Audio Narration"
      description="Add audio narration and captions to your course"
      autoSaveIndicator={<AutoSaveIndicatorConnected />}
      onNext={handleNext}
      onBack={onBack}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
      onSettingsClick={onSettingsClick}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Summary */}
        <Card variant="default" padding="medium">
          <h3 style={{ marginBottom: '1rem' }}>Narration Blocks</h3>
          <Grid cols={2} gap="medium">
            <Alert variant={audioUploaded ? 'success' : 'info'}>
              <strong>Audio Files:</strong> {audioUploaded ? `${audioFiles.size} files uploaded` : 'Not uploaded'}
            </Alert>
            <Alert variant={captionsUploaded ? 'success' : 'info'}>
              <strong>Caption Files:</strong> {captionsUploaded ? `${captionFiles.size} files uploaded` : 'Not uploaded'}
            </Alert>
          </Grid>
        </Card>

        {/* Show error if any */}
        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {/* Bulk Upload Section */}
        <Card variant="default" padding="medium">
          <h3 style={{ marginBottom: '1rem' }}>Bulk Audio Upload</h3>
          
          {/* Workflow Instructions */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: tokens.colors.text.primary }}>Workflow</h4>
            <Grid cols={2} gap="medium">
              <div>
                <h5 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: tokens.colors.text.secondary }}>
                  Option 1: Individual Recording
                </h5>
                <p style={{ fontSize: '0.875rem', color: tokens.colors.text.tertiary }}>
                  Record or upload audio files for each narration block individually using the controls below.
                </p>
              </div>
              <div>
                <h5 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: tokens.colors.text.secondary }}>
                  Option 2: Bulk Upload via Murf.ai
                </h5>
                <p style={{ fontSize: '0.875rem', color: tokens.colors.text.tertiary }}>
                  Download all narration text, generate audio using Murf.ai, then upload the ZIP files.
                </p>
              </div>
            </Grid>
          </div>

          {/* Download Button */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Button
              onClick={downloadNarrationFile}
              variant="primary"
              data-testid="download-narration-button"
            >
              Download Narration Text
            </Button>
          </div>

          {/* Warning */}
          <Alert variant="warning">
            ⚠️ Bulk upload will replace all existing audio and caption files. Make sure you have all required files in your ZIP archive.
          </Alert>

          {/* Upload Grid */}
          <Grid cols={2} gap="large">
            {/* Audio Upload */}
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '0.75rem' }}>
                Audio Files (.zip)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Button
                  onClick={() => document.getElementById('audio-zip-input')?.click()}
                  variant="secondary"
                  disabled={isUploading}
                  data-testid="upload-audio-zip-button"
                >
                  {isUploading ? 'Uploading...' : 'Upload Audio ZIP'}
                </Button>
                <input
                  id="audio-zip-input"
                  type="file"
                  accept=".zip"
                  onChange={handleAudioZipUpload}
                  style={{ display: 'none' }}
                  aria-label="Upload audio zip"
                  data-testid="audio-zip-input"
                />
                {uploadProgress && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.875rem', color: tokens.colors.text.secondary, marginBottom: '0.25rem' }}>
                      Uploading {uploadProgress.fileName}
                    </p>
                    <ProgressBar 
                      value={uploadProgress.percent} 
                      max={100}
                      label={`Upload progress: ${uploadProgress.percent}%`}
                    />
                  </div>
                )}
                {audioUploaded && (
                  <Alert variant="success">
                    ✓ {audioFiles.size} audio files uploaded
                  </Alert>
                )}
              </div>
            </div>

            {/* Caption Upload */}
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '0.75rem' }}>
                Caption Files (.zip)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Button
                  onClick={() => document.getElementById('captions-zip-input')?.click()}
                  variant="secondary"
                  data-testid="upload-captions-zip-button"
                >
                  Upload Captions ZIP
                </Button>
                <input
                  id="captions-zip-input"
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
              </div>
            </div>
          </Grid>

          {/* Detailed Instructions */}
          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: `1px solid ${tokens.colors.border.light}` }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 500, color: tokens.colors.text.primary, margin: '0 0 1rem 0' }}>
              How to use Murf.ai for professional voiceovers:
            </h4>
            
            <Grid cols={2} gap="large">
              {/* Steps */}
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '0.75rem' }}>
                  Step-by-step guide:
                </h5>
                <ol style={{ fontSize: '0.875rem', color: tokens.colors.text.tertiary, paddingLeft: '1.5rem', margin: '0 0 1rem 0' }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Download narration text using the button above
                  </li>
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
                    Upload the ZIP files here
                  </li>
                </ol>

                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '0.75rem' }}>
                  File naming convention:
                </h5>
                <div style={{ 
                  backgroundColor: tokens.colors.background.secondary, 
                  border: `1px solid ${tokens.colors.border.default}`, 
                  borderRadius: tokens.borderRadius.sm, 
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: tokens.colors.text.tertiary,
                  marginBottom: '1rem'
                }}>
                  <div>0001-Block.mp3</div>
                  <div>0002-Block.mp3</div>
                  <div>0003-Block.mp3</div>
                  <div>...</div>
                </div>
                <p style={{ fontSize: '0.75rem', color: tokens.colors.text.quaternary, fontStyle: 'italic' }}>
                  Name your audio files exactly as shown above to match block numbers
                </p>
              </div>

              {/* Features and Tips */}
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '0.75rem' }}>
                  Murf.ai features:
                </h5>
                <ul style={{ fontSize: '0.875rem', color: tokens.colors.text.tertiary, paddingLeft: '1.5rem', margin: '0 0 1rem 0' }}>
                  <li style={{ marginBottom: '0.5rem' }}>120+ AI voices in different accents</li>
                  <li style={{ marginBottom: '0.5rem' }}>20+ languages supported</li>
                  <li style={{ marginBottom: '0.5rem' }}>Adjustable speed and pitch</li>
                  <li style={{ marginBottom: '0.5rem' }}>Add pauses and emphasis</li>
                  <li style={{ marginBottom: '0.5rem' }}>Background music options</li>
                </ul>

                <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '0.75rem' }}>
                  Tips for best results:
                </h5>
                <ul style={{ fontSize: '0.875rem', color: tokens.colors.text.tertiary, paddingLeft: '1.5rem', margin: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>Preview different voices before committing</li>
                  <li style={{ marginBottom: '0.5rem' }}>Add pauses between sentences for natural flow</li>
                  <li style={{ marginBottom: '0.5rem' }}>Use the same voice for consistent narration throughout</li>
                  <li style={{ marginBottom: '0.5rem' }}>Export at high quality (minimum 128kbps)</li>
                </ul>
              </div>
            </Grid>
          </div>
        </Card>

        {/* Individual narration blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {narrationBlocks.map((block) => {
            const hasAudio = audioFiles.has(block.blockNumber)
            const hasCaption = captionFiles.has(block.blockNumber)
            const isEditing = editingBlockId === block.id
            
            return (
              <Card key={block.id} variant="default" padding="medium">
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>
                    {block.pageTitle} (Block {block.blockNumber})
                  </h4>
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: tokens.colors.background.secondary,
                          color: tokens.colors.text.primary,
                          border: `1px solid ${tokens.colors.border.default}`,
                          resize: 'vertical'
                        }}
                      />
                      <ButtonGroup gap="small" style={{ marginTop: '0.5rem' }}>
                        <Button
                          onClick={() => {
                            setNarrationBlocks(prev => prev.map(b =>
                              b.id === block.id ? { ...b, text: editingText } : b
                            ))
                            setEditingBlockId(null)
                          }}
                          size="small"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={() => setEditingBlockId(null)}
                          variant="secondary"
                          size="small"
                        >
                          Cancel
                        </Button>
                      </ButtonGroup>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '0.5rem',
                        backgroundColor: tokens.colors.background.secondary,
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setEditingBlockId(block.id)
                        setEditingText(block.text)
                      }}
                    >
                      <p style={{ margin: 0, color: tokens.colors.text.secondary }}>
                        {block.text}
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Audio controls */}
                  <ButtonGroup gap="small">
                    <Button
                      onClick={() => handleRecordClick(block)}
                      variant={hasAudio ? 'secondary' : 'primary'}
                      size="small"
                    >
                      <Icon icon={Mic} size="sm" /> {hasAudio ? 'Replace' : 'Record'} Audio
                    </Button>
                    <Button
                      onClick={() => document.getElementById(`audio-upload-${block.blockNumber}`)?.click()}
                      variant="secondary"
                      size="small"
                    >
                      <Icon icon={FileAudio} size="sm" /> {hasAudio ? 'Replace' : 'Upload'} Audio
                    </Button>
                    <input
                      id={`audio-upload-${block.blockNumber}`}
                      type="file"
                      accept="audio/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleAudioFileChange(e, block)}
                    />
                  </ButtonGroup>

                  {/* Caption controls */}
                  <ButtonGroup gap="small">
                    <Button
                      onClick={() => document.getElementById(`caption-upload-${block.blockNumber}`)?.click()}
                      variant="secondary"
                      size="small"
                    >
                      <Icon icon={FileText} size="sm" /> {hasCaption ? 'Replace' : 'Upload'} Caption
                    </Button>
                    <input
                      id={`caption-upload-${block.blockNumber}`}
                      type="file"
                      accept=".vtt,.srt"
                      style={{ display: 'none' }}
                      onChange={(e) => handleCaptionFileChange(e, block)}
                    />
                    {hasCaption && (
                      <Button
                        onClick={() => {
                          setPreviewBlockId(block.id)
                          setShowPreview(true)
                        }}
                        variant="secondary"
                        size="small"
                      >
                        <Icon icon={Eye} size="sm" /> Preview Caption
                      </Button>
                    )}
                  </ButtonGroup>
                </div>

                {/* Show audio player if audio exists */}
                {hasAudio && (
                  <div style={{ marginTop: '1rem' }}>
                    <audio
                      controls
                      style={{ width: '100%', height: '2rem' }}
                      src={audioFiles.get(block.blockNumber)?.url}
                    />
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a1a1aa' }}>
                      {audioFiles.get(block.blockNumber)?.file.name}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>


        {/* Recording Modal */}
        {showRecordingModal && (
          <Modal
            isOpen={showRecordingModal}
            onClose={cancelRecording}
            title={`Record Audio for ${narrationBlocks.find(b => b.id === recordingBlockId)?.pageTitle || ''}`}
            size="small"
          >
            <div style={{ textAlign: 'center' }}>
              {!isRecording && !recordingPreviewUrl && (
                <div>
                  <p style={{ marginBottom: '1.5rem' }}>
                    Click the button below to start recording
                  </p>
                  <Button
                    onClick={startRecording}
                    variant="primary"
                    size="large"
                    data-testid="start-recording-button"
                  >
                    <Icon icon={Mic} size="md" /> Start Recording
                  </Button>
                </div>
              )}
              
              {isRecording && (
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ef4444' }}>
                    <Icon icon={Circle} size="sm" color="#ef4444" /> {formatTime(recordingTime)}
                  </div>
                  <p style={{ marginBottom: '1.5rem', color: '#a1a1aa' }}>
                    Recording in progress...
                  </p>
                  <Button
                    onClick={stopRecording}
                    variant="danger"
                    size="large"
                    data-testid="stop-recording-button"
                  >
                    Stop Recording
                  </Button>
                </div>
              )}
              
              {recordingPreviewUrl && (
                <div>
                  <audio
                    controls
                    src={recordingPreviewUrl}
                    style={{ width: '100%', marginBottom: '1.5rem' }}
                  />
                  <ButtonGroup gap="medium" align="center">
                    <Button
                      onClick={saveRecording}
                      variant="primary"
                      data-testid="save-recording-button"
                    >
                      <Icon icon={Save} size="sm" /> Save Recording
                    </Button>
                    <Button
                      onClick={() => {
                        setRecordingPreviewUrl(null)
                        setAudioChunks([])
                        setRecordingTime(0)
                      }}
                      variant="secondary"
                    >
                      Re-record
                    </Button>
                  </ButtonGroup>
                </div>
              )}
              
              {recordingError && (
                <Alert variant="error">
                  {recordingError}
                </Alert>
              )}
            </div>
          </Modal>
        )}

        {/* Caption Preview Modal */}
        {showPreview && previewBlockId && (
          <Modal
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
            title="Caption Preview"
            size="medium"
          >
            {(() => {
              const block = narrationBlocks.find(b => b.id === previewBlockId)
              const hasAudio = block && audioFiles.has(block.blockNumber)
              
              return (
                <div>
                  {hasAudio && block && (
                    <audio
                      data-testid="caption-preview-audio"
                      controls
                      src={audioFiles.get(block.blockNumber)?.url}
                      style={{ width: '100%', marginBottom: '1.5rem' }}
                    />
                  )}
                  <div
                    style={{
                      backgroundColor: tokens.colors.background.secondary,
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {block && captionFiles.get(block.blockNumber)?.content}
                    </pre>
                  </div>
                </div>
              )
            })()}
          </Modal>
        )}

        {/* Replace Audio Confirmation */}
        {blockToReplaceAudio && (
          <ConfirmDialog
            isOpen={!!blockToReplaceAudio}
            onConfirm={() => {
              if (blockToReplaceAudio) {
                setRecordingBlockId(blockToReplaceAudio.id)
                setShowRecordingModal(true)
                setBlockToReplaceAudio(null)
              }
            }}
            onCancel={() => setBlockToReplaceAudio(null)}
            title="Replace Audio"
            message="This will replace the existing audio file. Are you sure you want to continue?"
            confirmText="Replace"
            cancelText="Cancel"
          />
        )}

        <AutoSaveIndicatorConnected />
      </div>
    </PageLayout>
  )
}

export default AudioNarrationWizard;