import React, { useState, useEffect } from 'react'
import { useMedia } from '../hooks/useMedia'
import styles from './MediaLoadingOverlay.module.css'

// Funny loading messages that rotate randomly
const funnyLoadingMessages = [
  "Rewinding the cassette tapes for optimal playback...",
  "Calling the head of Google for YouTube access...",
  "Teaching hamsters to run faster in the server wheels...",
  "Downloading more RAM for your images...",
  "Convincing pixels to align themselves properly...",
  "Negotiating with the cloud for better weather...",
  "Bribing the internet tubes with cookies...",
  "Waking up the sleepy hard drive gnomes...",
  "Polishing the fiber optic cables for maximum shine...",
  "Translating binary to human and back again...",
  "Asking ChatGPT nicely to hurry up...",
  "Feeding caffeine to the processor...",
  "Defrosting the frozen JavaScript modules...",
  "Untangling the ethernet spaghetti...",
  "Summoning the ancient spirits of SCORM..."
]

const getRandomMessage = () => {
  return funnyLoadingMessages[Math.floor(Math.random() * funnyLoadingMessages.length)]
}

interface MediaLoadingOverlayProps {
  message?: string
  showProgress?: boolean
  onCancel?: () => void
  showCancel?: boolean
}

export const MediaLoadingOverlay: React.FC<MediaLoadingOverlayProps> = ({
  message = 'Loading media...',
  showProgress = true,
  onCancel,
  showCancel = false
}) => {
  const { isLoading } = useMedia()
  const [funnyMessage, setFunnyMessage] = useState(getRandomMessage())
  
  // Change the funny message every 3 seconds while loading
  useEffect(() => {
    if (!isLoading) return
    
    const interval = setInterval(() => {
      setFunnyMessage(getRandomMessage())
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isLoading])
  
  if (!isLoading) {
    return null
  }
  
  return (
    <div className={styles.overlay}>
      <div className={styles.loadingCard}>
        <div className={styles.spinner} />
        <div className={styles.content}>
          <h3 className={styles.title}>{message}</h3>
          {showProgress && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} />
              </div>
              <p
                className={styles.progressText}
                role="status"
                aria-live="polite"
              >
                {funnyMessage}
              </p>
            </div>
          )}
          {showCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelButton}
              aria-label="Cancel loading"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MediaLoadingOverlay