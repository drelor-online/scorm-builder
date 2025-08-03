import React from 'react'
import { Skeleton } from './Skeleton'
import { LoadingSpinner } from './LoadingSpinner'
import { Card } from './Card'
import { tokens } from './designTokens'
import './designSystem.css'

export interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'shimmer' | 'progress'
  text?: string
  progress?: number
  count?: number
  layout?: 'list' | 'grid' | 'form'
  fullScreen?: boolean
  overlay?: boolean
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'spinner',
  text = 'Loading...',
  progress,
  count = 3,
  layout = 'list',
  fullScreen = false,
  overlay = false
}) => {
  // Skeleton loading for different layouts
  const renderSkeleton = () => {
    const skeletonItems = Array.from({ length: count }, (_, i) => (
      <Card key={i} style={{ marginBottom: tokens.spacing.md }}>
        <div style={{ display: 'flex', gap: tokens.spacing.md }}>
          <Skeleton variant="circle" size="48px" animation="shimmer" />
          <div style={{ flex: 1 }}>
            <Skeleton width="60%" height="20px" animation="shimmer" />
            <div style={{ marginTop: tokens.spacing.sm }}>
              <Skeleton width="100%" height="16px" animation="shimmer" />
              <div style={{ marginTop: '4px' }}>
                <Skeleton width="80%" height="16px" animation="shimmer" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    ))

    if (layout === 'grid') {
      return (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: tokens.spacing.lg
        }}>
          {skeletonItems}
        </div>
      )
    }

    if (layout === 'form') {
      return (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.xl }}>
            <div>
              <Skeleton width="100px" height="16px" animation="shimmer" />
              <div style={{ marginTop: tokens.spacing.sm }}>
                <Skeleton width="100%" height="40px" animation="shimmer" />
              </div>
            </div>
            <div>
              <Skeleton width="120px" height="16px" animation="shimmer" />
              <div style={{ marginTop: tokens.spacing.sm }}>
                <Skeleton width="100%" height="40px" animation="shimmer" />
              </div>
            </div>
            <div>
              <Skeleton width="80px" height="16px" animation="shimmer" />
              <div style={{ marginTop: tokens.spacing.sm }}>
                <Skeleton width="100%" height="120px" animation="shimmer" />
              </div>
            </div>
            <Skeleton width="150px" height="40px" animation="shimmer" />
          </div>
        </Card>
      )
    }

    return <div>{skeletonItems}</div>
  }

  // Progress bar loading
  const renderProgress = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: tokens.spacing.lg,
      padding: tokens.spacing['2xl']
    }}>
      <LoadingSpinner size="large" />
      {text && (
        <p style={{
          color: tokens.colors.text.secondary,
          fontSize: tokens.typography.fontSize.base
        }}>
          {text}
        </p>
      )}
      {progress !== undefined && (
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: tokens.colors.background.tertiary,
            borderRadius: tokens.borderRadius.full,
            overflow: 'hidden'
          }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                height: '100%',
                backgroundColor: tokens.colors.primary[500],
                transition: 'width 300ms ease',
                borderRadius: tokens.borderRadius.full
              }}
            />
          </div>
          <p style={{
            textAlign: 'center',
            marginTop: tokens.spacing.sm,
            color: tokens.colors.text.tertiary,
            fontSize: tokens.typography.fontSize.sm
          }}>
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  )

  // Main content based on variant
  let content: React.ReactNode

  switch (variant) {
    case 'skeleton':
    case 'shimmer':
      content = renderSkeleton()
      break
    case 'progress':
      content = renderProgress()
      break
    default:
      content = <LoadingSpinner size="large" text={text} />
  }

  // Wrap in overlay if needed
  if (overlay || fullScreen) {
    return (
      <div style={{
        position: fullScreen ? 'fixed' : 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: overlay ? tokens.colors.background.overlay : 'transparent',
        zIndex: tokens.zIndex.modal,
        backdropFilter: overlay ? 'blur(4px)' : 'none'
      }}>
        <div className="animate-fadeIn">
          {content}
        </div>
      </div>
    )
  }

  return <div className="loading-state">{content}</div>
}

// Utility components for common loading patterns
export const PageLoading: React.FC<{ text?: string }> = ({ text = 'Loading page...' }) => (
  <LoadingState variant="spinner" text={text} fullScreen />
)

export const ContentLoading: React.FC<{ count?: number; layout?: 'list' | 'grid' }> = ({ 
  count = 3, 
  layout = 'list' 
}) => (
  <LoadingState variant="skeleton" count={count} layout={layout} />
)

export const FormLoading: React.FC = () => (
  <LoadingState variant="skeleton" layout="form" />
)

export const UploadProgress: React.FC<{ progress: number; text?: string }> = ({ 
  progress, 
  text = 'Uploading...' 
}) => (
  <LoadingState variant="progress" progress={progress} text={text} overlay />
)