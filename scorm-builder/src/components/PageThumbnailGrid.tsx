import React, { useEffect, useState } from 'react'
import { CourseContent, Page, Topic } from '../types/aiPrompt'
import { Card } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import { Home, Target, Image as ImageIcon, Video } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'

interface PageThumbnailGridProps {
  courseContent: CourseContent | null
  currentPageId: string
  onPageSelect: (pageId: string) => void
}

// Media Preview Component
const MediaPreview: React.FC<{ page: Page | Topic }> = ({ page }) => {
  const { getMediaForPage, createBlobUrl } = useUnifiedMedia()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  
  useEffect(() => {
    const loadMedia = async () => {
      if (!page.id) return
      
      const pageMedia = getMediaForPage(page.id)
      const firstMedia = pageMedia.find(m => m.type === 'image' || m.type === 'video')
      
      if (firstMedia) {
        // Use storageId if available, fallback to id for backward compatibility
        const mediaId = firstMedia.storageId || firstMedia.id
        const url = await createBlobUrl(mediaId)
        setMediaUrl(url)
      }
    }
    
    loadMedia()
  }, [page.id, getMediaForPage, createBlobUrl])
  
  const hasVideo = page.media?.some((m: any) => m.type === 'video')
  
  if (!mediaUrl) {
    return (
      <div style={{
        width: '100%',
        height: '80px',
        backgroundColor: tokens.colors.background.secondary,
        borderRadius: '0.25rem',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.colors.text.tertiary
      }}>
        {hasVideo ? <Video size={24} /> : <ImageIcon size={24} />}
      </div>
    )
  }
  
  return (
    <div style={{
      width: '100%',
      height: '80px',
      borderRadius: '0.25rem',
      marginBottom: '0.5rem',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: tokens.colors.background.secondary
    }}>
      {hasVideo ? (
        <>
          <video 
            src={mediaUrl || undefined}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '50%',
            width: '2rem',
            height: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Video size={16} color="white" />
          </div>
        </>
      ) : (
        <img 
          src={mediaUrl || undefined}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          loading="lazy"
        />
      )}
    </div>
  )
}

export const PageThumbnailGrid: React.FC<PageThumbnailGridProps> = ({
  courseContent,
  currentPageId,
  onPageSelect
}) => {
  if (!courseContent) {
    return (
      <div data-testid="loading-skeleton" style={{ padding: '1rem' }}>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {[1, 2, 3, 4].map(i => (
            <Card key={i} style={{ 
              height: '200px',
              backgroundColor: tokens.colors.background.secondary,
              animation: 'pulse 1.5s infinite'
            }}>
              <div />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Helper to extract text content and truncate
  const getContentPreview = (html: string, maxLength: number = 100): string => {
    const temp = document.createElement('div')
    temp.innerHTML = DOMPurify.sanitize(html)
    const text = temp.textContent || temp.innerText || ''
    
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Helper to get media count
  const getMediaCount = (page: Page | Topic): number => {
    return page.media?.length || 0
  }

  // Helper to check if page has media
  const hasMedia = (page: Page | Topic): boolean => {
    return getMediaCount(page) > 0
  }

  // Create array of all pages
  const allPages: Array<Page | Topic> = [
    courseContent.welcomePage,
    courseContent.objectivesPage || courseContent.learningObjectivesPage, // Handle both naming conventions
    ...courseContent.topics
  ].filter(Boolean) // Remove any undefined entries

  return (
    <div 
      data-testid="page-thumbnail-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
        padding: '1rem'
      }}
    >
      {allPages.map((page, index) => {
        const isWelcome = page.id === 'welcome'
        const isObjectives = page.id === 'objectives'
        const isCurrent = page.id === currentPageId
        const mediaCount = getMediaCount(page)
        
        return (
          <Card
            key={page.id}
            data-testid={`page-thumbnail-${page.id}`}
            className={isCurrent ? 'selected' : ''}
            onClick={() => onPageSelect(page.id)}
            style={{
              cursor: 'pointer',
              border: `2px solid ${isCurrent ? tokens.colors.primary[500] : tokens.colors.border.default}`,
              transition: 'all 0.2s',
              position: 'relative',
              overflow: 'hidden',
              ...(isCurrent && {
                boxShadow: `0 0 0 3px ${tokens.colors.primary[500]}33`
              })
            }}
          >
            {/* Page Type Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              {isWelcome ? (
                <div 
                  data-testid="page-icon-welcome"
                  data-icon="home"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: tokens.colors.primary[100],
                    color: tokens.colors.primary[600],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Home size={16} />
                </div>
              ) : isObjectives ? (
                <div 
                  data-testid="page-icon-objectives"
                  data-icon="target"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: tokens.colors.success[100],
                    color: tokens.colors.success[600],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Target size={16} />
                </div>
              ) : (
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: tokens.colors.background.secondary,
                  color: tokens.colors.text.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {index - 1}
                </div>
              )}
              <h4 style={{ 
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {page.title}
              </h4>
            </div>

            {/* Media Preview */}
            {hasMedia(page) && (
              <MediaPreview page={page} />
            )}

            {/* Content Preview */}
            <div 
              data-testid={`content-preview-${page.id}`}
              style={{
                fontSize: '0.75rem',
                color: tokens.colors.text.secondary,
                lineHeight: 1.4,
                marginBottom: '0.5rem',
                minHeight: '6rem',  // Increased from 3rem to 6rem (96px)
                maxHeight: '8rem',  // Add max height with scrolling
                overflowY: 'auto',
                paddingRight: '0.25rem'
              }}
            >
              {getContentPreview(page.content)}
            </div>

            {/* Media Indicator */}
            {hasMedia(page) && (
              <div 
                data-testid="media-indicator"
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  backgroundColor: tokens.colors.success[500],
                  color: 'white',
                  borderRadius: '50%',
                  width: '1.5rem',
                  height: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem'
                }}
                title="Has media"
              >
                <span style={{ display: 'none' }}>✓ Has media</span>
                ✓
              </div>
            )}

            {/* Media Count Badge */}
            {mediaCount > 1 && (
              <div style={{
                position: 'absolute',
                bottom: '0.5rem',
                right: '0.5rem',
                backgroundColor: tokens.colors.background.secondary,
                color: tokens.colors.text.primary,
                borderRadius: '0.25rem',
                padding: '0.125rem 0.5rem',
                fontSize: '0.625rem',
                fontWeight: 500
              }}>
                {mediaCount} media items
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// Add pulse animation
const style = document.createElement('style')
style.textContent = `
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 0.8; }
    100% { opacity: 0.6; }
  }
  
  .selected {
    transform: scale(1.02);
  }
  
  .selected:hover {
    transform: scale(1.02) !important;
  }
  
  [data-testid^="page-thumbnail-"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`
document.head.appendChild(style)