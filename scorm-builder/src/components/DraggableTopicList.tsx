import React, { useState, useRef } from 'react'
import { GripVertical, X } from 'lucide-react'
import { Button } from './DesignSystem'
import styles from './DraggableTopicList.module.css'

interface DraggableTopicListProps {
  topics: string[]
  onChange: (topics: string[]) => void
  onSwitchToTextarea: () => void
  className?: string
}

export const DraggableTopicList: React.FC<DraggableTopicListProps> = ({
  topics,
  onChange,
  onSwitchToTextarea,
  className
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null)
  const dragItemRef = useRef<HTMLLIElement>(null)

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
    
    // Add visual feedback
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    setDraggedIndex(null)
    setDraggedOverIndex(null)
    
    // Reset visual feedback
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault()
    setDraggedOverIndex(index)
  }

  const handleDragLeave = () => {
    setDraggedOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLLIElement>, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null) return
    
    const newTopics = [...topics]
    const draggedTopic = newTopics[draggedIndex]
    
    // Remove the dragged item
    newTopics.splice(draggedIndex, 1)
    
    // Insert at the new position
    newTopics.splice(dropIndex, 0, draggedTopic)
    
    onChange(newTopics)
    setDraggedIndex(null)
    setDraggedOverIndex(null)
  }

  const removeTopic = (index: number) => {
    const newTopics = topics.filter((_, i) => i !== index)
    onChange(newTopics)
  }

  const addNewTopic = () => {
    const newTopics = [...topics, 'New topic']
    onChange(newTopics)
  }

  const updateTopic = (index: number, value: string) => {
    const newTopics = [...topics]
    newTopics[index] = value
    onChange(newTopics)
  }

  if (topics.length === 0) {
    return (
      <div className={`${styles.emptyState} ${className || ''}`}>
        <p>No topics yet. Add some topics to get started.</p>
        <Button size="small" variant="primary" onClick={addNewTopic}>
          Add First Topic
        </Button>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>Course Topics ({topics.length})</span>
        <div className={styles.headerActions}>
          <Button 
            size="small" 
            variant="secondary" 
            onClick={onSwitchToTextarea}
            aria-label="Switch to text editor"
            title="Switch to text editor for manual editing"
          >
            Edit as Text
          </Button>
          <Button 
            size="small" 
            variant="primary" 
            onClick={addNewTopic}
            aria-label="Add new topic"
            title="Add a new topic to the list"
          >
            Add Topic
          </Button>
        </div>
      </div>
      
      <ul className={styles.topicList} role="list">
        {topics.map((topic, index) => (
          <li
            key={index}
            ref={draggedIndex === index ? dragItemRef : null}
            className={`${styles.topicItem} ${
              draggedOverIndex === index ? styles.dragOver : ''
            } ${draggedIndex === index ? styles.dragging : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            role="listitem"
            aria-label={`Topic ${index + 1}: ${topic}`}
          >
            <div className={styles.dragHandle}>
              <GripVertical 
                size={16} 
                className={styles.gripIcon}
                aria-label={`Drag handle for topic ${index + 1}`}
              />
            </div>
            
            <div className={styles.topicContent}>
              <span className={styles.topicNumber}>{index + 1}.</span>
              <input
                type="text"
                value={topic}
                onChange={(e) => updateTopic(index, e.target.value)}
                className={styles.topicInput}
                placeholder="Enter topic..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addNewTopic()
                  }
                }}
                aria-label={`Edit topic ${index + 1}`}
              />
            </div>
            
            <button
              type="button"
              onClick={() => removeTopic(index)}
              className={styles.removeButton}
              aria-label={`Remove topic ${index + 1}`}
              title={`Remove topic: ${topic}`}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      
      <div className={styles.footer}>
        <p className={styles.hint}>
          💡 Drag topics to reorder, or click "Edit as Text" for manual editing
        </p>
      </div>
    </div>
  )
}