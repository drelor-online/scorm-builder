import React, { useState, useEffect, useRef } from 'react'
import { PageContainer, Section, Flex } from './DesignSystem/Layout'
import { Card } from './DesignSystem/Card'
import { Button } from './DesignSystem/Button'
import { Alert } from './DesignSystem/Alert'
import { Input } from './DesignSystem/Input'
import { Icon } from './DesignSystem/Icons'
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  Book,
  HelpCircle,
  AlertCircle,
  Lightbulb,
  ArrowLeft,
  Hash
} from 'lucide-react'
import { tokens } from './DesignSystem/designTokens'
import { 
  helpTopics, 
  searchTopics, 
  getTopicById, 
  getRelatedTopics, 
  stepToHelpTopic,
  type HelpTopic 
} from '../data/helpTopics'
import './DesignSystem/designSystem.css'
import './HelpPage.css'

interface HelpPageProps {
  onBack?: () => void
  initialTopicId?: string
  currentStep?: number
}

export const HelpPage: React.FC<HelpPageProps> = ({ 
  onBack, 
  initialTopicId,
  currentStep 
}) => {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | HelpTopic['category']>('all')
  const [filteredTopics, setFilteredTopics] = useState<HelpTopic[]>(helpTopics)
  const [scrollToTopicId, setScrollToTopicId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const topicRefs = useRef<Record<string, HTMLElement | null>>({})

  // Categories for filtering
  const categories: Array<{ id: 'all' | HelpTopic['category']; label: string; icon: typeof Book }> = [
    { id: 'all', label: 'All Topics', icon: Book },
    { id: 'workflow', label: 'Workflow Steps', icon: ChevronRight },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
    { id: 'features', label: 'Features', icon: Lightbulb },
    { id: 'faq', label: 'FAQs', icon: HelpCircle }
  ]

  // Initialize with context-sensitive topic
  useEffect(() => {
    let topicToOpen = initialTopicId
    
    // If no explicit topic but we have a current step, use the mapping
    if (!topicToOpen && currentStep !== undefined && currentStep in stepToHelpTopic) {
      topicToOpen = stepToHelpTopic[currentStep]
    }
    
    if (topicToOpen) {
      setExpandedTopics(new Set([topicToOpen]))
      setScrollToTopicId(topicToOpen)
    }
    
    // Focus search on mount
    searchInputRef.current?.focus()
  }, [initialTopicId, currentStep])

  // Handle scrolling when a topic needs to be scrolled to and is expanded
  useEffect(() => {
    if (scrollToTopicId && expandedTopics.has(scrollToTopicId)) {
      console.log('[HelpPage] Attempting to scroll to:', scrollToTopicId)
      console.log('[HelpPage] Current refs:', Object.keys(topicRefs.current))
      
      // Use requestAnimationFrame to ensure DOM has been painted
      requestAnimationFrame(() => {
        const element = topicRefs.current[scrollToTopicId]
        console.log('[HelpPage] Element found:', !!element)
        
        if (element) {
          // Check if the content div actually exists now
          const contentDiv = element.querySelector('.help-topic-content')
          console.log('[HelpPage] Content div found:', !!contentDiv)
          
          if (contentDiv) {
            // Scroll to the element
            console.log('[HelpPage] Scrolling to element')
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            })
            // Clear the scroll target
            setScrollToTopicId(null)
          } else {
            // If content still not rendered, try again on next frame
            console.log('[HelpPage] Content not found, retrying...')
            requestAnimationFrame(() => {
              element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              })
              setScrollToTopicId(null)
            })
          }
        } else {
          console.log('[HelpPage] Element not found in refs!')
        }
      })
    }
  }, [expandedTopics, scrollToTopicId])

  // Filter topics based on search and category
  useEffect(() => {
    let topics = helpTopics

    if (searchQuery.trim()) {
      topics = searchTopics(searchQuery)
    }

    if (selectedCategory !== 'all') {
      topics = topics.filter(topic => topic.category === selectedCategory)
    }

    setFilteredTopics(topics)
  }, [searchQuery, selectedCategory])

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics)
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId)
    } else {
      newExpanded.add(topicId)
    }
    setExpandedTopics(newExpanded)
  }

  const expandAll = () => {
    setExpandedTopics(new Set(filteredTopics.map(t => t.id)))
  }

  const collapseAll = () => {
    setExpandedTopics(new Set())
  }

  const handleKeyDown = (e: React.KeyboardEvent, topicId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleTopic(topicId)
    }
  }

  const getIconForTopic = (topicId: string) => {
    if (topicId.includes('error') || topicId.includes('issue')) return AlertCircle
    if (topicId.includes('faq')) return HelpCircle
    if (topicId.includes('keyboard') || topicId.includes('performance')) return Lightbulb
    return Book
  }

  return (
    <PageContainer className="help-page">
      {/* Header */}
      <Section>
        <Flex justify="space-between" align="center" className="help-header">
          <h1 className="help-title">
            <Icon icon={Book} className="help-title-icon" />
            SCORM Course Builder Help
          </h1>
          <Flex gap="medium">
            <Button
              variant="secondary"
              size="small"
              onClick={expandAll}
              disabled={filteredTopics.length === 0}
            >
              Expand All
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={collapseAll}
              disabled={expandedTopics.size === 0}
            >
              Collapse All
            </Button>
            {onBack && (
              <Button
                variant="primary"
                onClick={onBack}
                data-testid="help-back-button"
              >
                <Icon icon={ArrowLeft} />
                Back to Course Builder
              </Button>
            )}
          </Flex>
        </Flex>
      </Section>

      {/* Search and Filter Bar */}
      <Section className="help-controls">
        <Flex gap="medium" align="center">
          <div className="help-search-container">
            <Icon icon={Search} className="help-search-icon" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="help-search-input"
              aria-label="Search help topics"
            />
          </div>
          <Flex gap="small" className="help-category-filters">
            {categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'primary' : 'tertiary'}
                size="small"
                onClick={() => setSelectedCategory(category.id)}
                className="help-category-button"
              >
                <Icon icon={category.icon} size="sm" />
                {category.label}
              </Button>
            ))}
          </Flex>
        </Flex>
      </Section>

      {/* Table of Contents (Quick Jump) */}
      {filteredTopics.length > 5 && (
        <Section className="help-toc">
          <Card className="help-toc-card">
            <h2 className="help-toc-title">
              <Icon icon={Hash} size="sm" />
              Quick Jump
            </h2>
            <div className="help-toc-links">
              {filteredTopics.map(topic => (
                <button
                  key={topic.id}
                  className="help-toc-link"
                  onClick={() => {
                    // Expand the topic and set it as the scroll target
                    setExpandedTopics(new Set([topic.id]))
                    setScrollToTopicId(topic.id)
                  }}
                >
                  {topic.title}
                </button>
              ))}
            </div>
          </Card>
        </Section>
      )}

      {/* Main Content */}
      <Section className="help-content">
        {filteredTopics.length === 0 ? (
          <Alert variant="info">
            <p>No help topics found matching your search. Try different keywords or browse all topics.</p>
          </Alert>
        ) : (
          <div className="help-topics">
            {filteredTopics.map((topic) => {
              const isExpanded = expandedTopics.has(topic.id)
              const relatedTopics = getRelatedTopics(topic.id)
              const TopicIcon = getIconForTopic(topic.id)
              
              return (
                <Card 
                  key={topic.id}
                  className="help-topic-card"
                  ref={(el) => { 
                    if (el) {
                      console.log('[HelpPage] Setting ref for topic:', topic.id)
                      topicRefs.current[topic.id] = el
                    }
                  }}
                  id={`help-topic-${topic.id}`}
                >
                  <button
                    className="help-topic-header"
                    onClick={() => toggleTopic(topic.id)}
                    onKeyDown={(e) => handleKeyDown(e, topic.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`help-content-${topic.id}`}
                  >
                    <Flex align="center" justify="space-between">
                      <Flex align="center" gap="medium">
                        <Icon icon={TopicIcon} className="help-topic-icon" />
                        <div className="help-topic-title-group">
                          <h3 className="help-topic-title">{topic.title}</h3>
                          <p className="help-topic-summary">{topic.summary}</p>
                        </div>
                      </Flex>
                      <Icon 
                        icon={isExpanded ? ChevronUp : ChevronDown} 
                        className="help-topic-chevron"
                      />
                    </Flex>
                  </button>
                  
                  {isExpanded && (
                    <div 
                      className="help-topic-content"
                      id={`help-content-${topic.id}`}
                      role="region"
                      aria-labelledby={`help-topic-${topic.id}`}
                    >
                      {/* Main Details */}
                      <div className="help-topic-details">
                        <ul className="help-detail-list">
                          {topic.details.map((detail, index) => (
                            <li key={index} className="help-detail-item">
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Tips */}
                      {topic.tips && topic.tips.length > 0 && (
                        <Alert variant="info" className="help-tips">
                          <h4 className="help-tips-title">
                            <Icon icon={Lightbulb} size="sm" />
                            Tips
                          </h4>
                          <ul className="help-tips-list">
                            {topic.tips.map((tip, index) => (
                              <li key={index}>{tip}</li>
                            ))}
                          </ul>
                        </Alert>
                      )}
                      
                      {/* Warnings */}
                      {topic.warnings && topic.warnings.length > 0 && (
                        <Alert variant="warning" className="help-warnings">
                          <h4 className="help-warnings-title">
                            <Icon icon={AlertCircle} size="sm" />
                            Important Notes
                          </h4>
                          <ul className="help-warnings-list">
                            {topic.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </Alert>
                      )}
                      
                      {/* Related Topics */}
                      {relatedTopics.length > 0 && (
                        <div className="help-related">
                          <h4 className="help-related-title">See Also:</h4>
                          <Flex gap="small" wrap>
                            {relatedTopics.map(related => (
                              <Button
                                key={related.id}
                                variant="tertiary"
                                size="small"
                                onClick={() => {
                                  // Expand the topic and set it as the scroll target
                                  setExpandedTopics(new Set([related.id]))
                                  setScrollToTopicId(related.id)
                                }}
                                className="help-related-link"
                              >
                                {related.title}
                              </Button>
                            ))}
                          </Flex>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </Section>
    </PageContainer>
  )
}

// Default export for lazy loading compatibility
export default HelpPage