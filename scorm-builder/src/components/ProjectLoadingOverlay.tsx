import React from 'react'
import styles from './MediaLoadingOverlay.module.css'

interface ProjectLoadingOverlayProps {
  isLoading: boolean
  loadingProgress?: {
    current: number
    total: number
    phase: string
  }
}

export const ProjectLoadingOverlay: React.FC<ProjectLoadingOverlayProps> = ({ 
  isLoading,
  loadingProgress
}) => {
  if (!isLoading) {
    return null
  }
  
  const progressPercent = loadingProgress 
    ? Math.round((loadingProgress.current / loadingProgress.total) * 100)
    : 0
  
  return (
    <div className={styles.overlay}>
      <div className={styles.loadingCard}>
        <div className={styles.spinner} />
        <div className={styles.content}>
          <h3 className={styles.title}>Loading Project...</h3>
          {loadingProgress && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className={styles.progressText}>
                {loadingProgress.phase} ({loadingProgress.current}/{loadingProgress.total})
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectLoadingOverlay