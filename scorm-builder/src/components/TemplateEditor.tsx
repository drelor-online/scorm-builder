import React, { useState, useRef, useEffect } from 'react'
import { 
  Button, 
  Card, 
  Input, 
  ButtonGroup,
  Section,
  Grid,
  Flex,
  Modal
} from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import './DesignSystem/designSystem.css'
import styles from './TemplateEditor.module.css'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useNotifications } from '../contexts/NotificationContext'

interface TemplateEditorProps {
  onClose: () => void
  onSave?: () => void
}

interface CustomTemplate {
  topics: string[]
  promptSections: {
    introduction: string
    structure: string
    topics: string
    output: string
  }
}

interface CustomTemplates {
  [templateName: string]: CustomTemplate
}

// Tag definitions
const AVAILABLE_TAGS = [
  { tag: '{{courseTitle}}', description: 'The name of the course' },
  { tag: '{{difficulty}}', description: 'The difficulty level (Basic, Easy, Medium, Hard, Expert)' },
  { tag: '{{topics}}', description: 'The list of topics (comma-separated)' },
  { tag: '{{topicCount}}', description: 'The number of topics' }
]

// Sample data for preview
const SAMPLE_DATA = {
  courseTitle: 'Sample Course',
  difficulty: 'Medium',
  topics: ['Topic 1', 'Topic 2', 'Topic 3'],
  topicCount: 3
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ onClose: _onClose, onSave }) => {
  const storage = useStorage()
  const { success, error: notifyError } = useNotifications()
  const [customTemplates, setCustomTemplates] = useState<CustomTemplates>({})
  
  const [editMode, setEditMode] = useState<'list' | 'create' | 'edit'>('list')
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [topics, setTopics] = useState('')
  const [promptSections, setPromptSections] = useState({
    introduction: '',
    structure: '',
    topics: '',
    output: ''
  })
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<keyof typeof promptSections>('introduction')
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({})

  // Load templates from file storage on mount
  useEffect(() => {
    const loadTemplates = async () => {
      if (storage && storage.isInitialized) {
        try {
          const templates = await storage.getContent('custom-templates')
          if (templates) {
            setCustomTemplates(templates)
          }
        } catch (error) {
          console.error('Failed to load custom templates:', error)
        }
      }
    }
    loadTemplates()
  }, [storage?.isInitialized])
  
  // Save templates to file storage whenever they change
  useEffect(() => {
    const saveTemplates = async () => {
      if (storage && storage.isInitialized && Object.keys(customTemplates).length > 0) {
        try {
          await storage.saveContent('custom-templates', customTemplates)
        } catch (error) {
          console.error('Failed to save custom templates:', error)
        }
      }
    }
    saveTemplates()
  }, [customTemplates, storage?.isInitialized])

  const handleCreateNew = () => {
    setEditMode('create')
    setCurrentTemplate(null)
    setTemplateName('')
    setTopics('')
    setPromptSections({
      introduction: 'Create a {{difficulty}} level {{courseTitle}} course.',
      structure: 'The course will cover {{topicCount}} topics.',
      topics: 'Topics to cover: {{topics}}',
      output: 'Generate comprehensive course content in JSON format.'
    })
    setError('')
  }

  const handleEdit = (templateName: string) => {
    setEditMode('edit')
    setCurrentTemplate(templateName)
    setTemplateName(templateName)
    const template = customTemplates[templateName]
    setTopics(template.topics.join('\n'))
    setPromptSections(template.promptSections || {
      introduction: '',
      structure: '',
      topics: '',
      output: ''
    })
    setError('')
  }

  const handleDelete = (templateName: string) => {
    const newTemplates = { ...customTemplates }
    delete newTemplates[templateName]
    setCustomTemplates(newTemplates)
    setShowDeleteConfirm(null)
    success(`Template "${templateName}" deleted`)
  }

  const handleSave = () => {
    setError('')
    
    if (!templateName.trim()) {
      setError('Template name is required')
      return
    }
    
    if (editMode === 'create' && customTemplates[templateName]) {
      setError('Template name already exists')
      return
    }
    
    if (!topics.trim()) {
      setError('At least one topic is required')
      return
    }
    
    const topicsArray = topics.split('\n').filter(t => t.trim())
    
    const newTemplate: CustomTemplate = {
      topics: topicsArray,
      promptSections
    }
    
    setCustomTemplates({
      ...customTemplates,
      [templateName]: newTemplate
    })
    
    success(editMode === 'create' ? 'Template created successfully' : 'Template updated successfully')
    
    setEditMode('list')
    if (onSave) onSave()
  }

  const insertTag = (tag: string) => {
    const section = activeSection
    const textarea = textareaRefs.current[section]
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = promptSections[section]
    
    const newText = text.substring(0, start) + tag + text.substring(end)
    setPromptSections({
      ...promptSections,
      [section]: newText
    })
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + tag.length, start + tag.length)
    }, 0)
  }

  const getPreview = () => {
    const allSections = Object.values(promptSections).join('\n\n')
    return allSections
      .replace(/\{\{courseTitle\}\}/g, SAMPLE_DATA.courseTitle)
      .replace(/\{\{difficulty\}\}/g, SAMPLE_DATA.difficulty)
      .replace(/\{\{topics\}\}/g, SAMPLE_DATA.topics.join(', '))
      .replace(/\{\{topicCount\}\}/g, SAMPLE_DATA.topicCount.toString())
  }

  const renderTemplateList = () => {
    const templates = Object.keys(customTemplates)
    
    return (
      <>
        <Section>
          <Flex justify="space-between" align="center" className={styles.header}>
            <h3 className={styles.headerTitle}>Custom Templates</h3>
            <Button variant="primary" onClick={handleCreateNew}>
              Add New Template
            </Button>
          </Flex>
          
          {templates.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p className={styles.emptyMessage}>
                  No custom templates yet
                </p>
                <Button variant="primary" onClick={handleCreateNew}>
                  Create Your First Template
                </Button>
              </div>
            </Card>
          ) : (
            <div className={styles.templatesList}>
              {templates.map(templateName => (
                <Card key={templateName} className={styles.templateCard}>
                  <Flex justify="space-between" align="center">
                    <div>
                      <h4 className={styles.templateTitle}>{templateName}</h4>
                      <p className={styles.templateDescription}>
                        {customTemplates[templateName].topics.length} topics
                      </p>
                    </div>
                    <Flex gap="small">
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => handleEdit(templateName)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => setShowDeleteConfirm(templateName)}
                      >
                        Delete
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <Modal
            isOpen={true}
            onClose={() => setShowDeleteConfirm(null)}
            title="Delete Template"
            size="small"
          >
            <div className={styles.modalContent}>
              <p>Are you sure you want to delete "{showDeleteConfirm}"?</p>
              <Flex gap="medium" justify="end" className={styles.modalActions}>
                <Button 
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="danger"
                  onClick={() => handleDelete(showDeleteConfirm)}
                >
                  Confirm Delete
                </Button>
              </Flex>
            </div>
          </Modal>
        )}
      </>
    )
  }

  const renderTemplateForm = () => {
    const sectionDescriptions = {
      introduction: 'Sets the context and overview for the course',
      structure: 'Defines how the course will be organized',
      topics: 'Specifies the depth and detail for each topic',
      output: 'Describes the format and structure of the generated content'
    }

    return (
      <Section>
        <Flex justify="space-between" align="center" className={styles.header}>
          <h3 className={styles.headerTitle}>
            {editMode === 'create' ? 'Create New Template' : `Edit "${currentTemplate}"`}
          </h3>
          <Button variant="secondary" onClick={() => setEditMode('list')}>
            Cancel
          </Button>
        </Flex>

        {error && (
          <div className={styles.errorAlert}>
            {error}
          </div>
        )}

        <Grid cols={1} gap="large">
          {/* Template Name */}
          <div>
            <Input
              label="Template Name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Safety Training"
              disabled={editMode === 'edit'}
              required
            />
          </div>

          {/* Topics */}
          <div>
            <label htmlFor="template-topics" className="input-label">
              Topics
              <span className={styles.inlineDescription}>
                (one per line)
              </span>
            </label>
            <textarea
              id="template-topics"
              className={styles.topicsTextarea}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Topic 1&#10;Topic 2&#10;Topic 3"
            />
          </div>

          {/* Prompt Builder */}
          <div>
            <h4 className={styles.sectionTitle}>Prompt Builder</h4>
            
            {/* Tag Buttons */}
            <div className={styles.tagButtonsContainer}>
              <p className={styles.tagButtonsLabel}>
                Click to insert tags:
              </p>
              <ButtonGroup gap="small">
                {AVAILABLE_TAGS.map(({ tag }) => (
                  <Button
                    key={tag}
                    variant="secondary"
                    size="small"
                    onClick={() => insertTag(tag)}
                    type="button"
                  >
                    Insert {tag}
                  </Button>
                ))}
              </ButtonGroup>
            </div>

            {/* Prompt Sections */}
            <Grid cols={1} gap="medium">
              {Object.entries(promptSections).map(([section, value]) => (
                <div key={section}>
                  <label htmlFor={`prompt-${section}`} className="input-label">
                    {section.charAt(0).toUpperCase() + section.slice(1)} Section
                    <span className={styles.sectionDescription}>
                      {sectionDescriptions[section as keyof typeof sectionDescriptions]}
                    </span>
                  </label>
                  <textarea
                    id={`prompt-${section}`}
                    ref={(el) => { textareaRefs.current[section] = el }}
                    className={`${styles.promptTextarea} ${activeSection === section ? styles.promptTextareaActive : ''}`}
                    value={value}
                    onChange={(e) => setPromptSections({ ...promptSections, [section]: e.target.value })}
                    onFocus={() => setActiveSection(section as keyof typeof promptSections)}
                    placeholder={`Enter ${section} section...`}
                  />
                </div>
              ))}
            </Grid>
          </div>

          {/* Preview */}
          <Card>
            <h4 className={styles.sectionTitle}>Preview</h4>
            <div className={styles.previewBox}>
              {getPreview()}
            </div>
          </Card>

          {/* Available Tags Reference */}
          <Card>
            <h4 className={styles.sectionTitle}>Available Tags</h4>
            <div className={styles.templatesList}>
              {AVAILABLE_TAGS.map(({ tag, description }) => (
                <div key={tag} className={styles.tagItem}>
                  <code className={styles.tagCode}>
                    {tag}
                  </code>
                  <span className={styles.tagDescription}>
                    - {description}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Save Button */}
          <Flex justify="end" gap="medium">
            <Button variant="secondary" onClick={() => setEditMode('list')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save Template
            </Button>
          </Flex>
        </Grid>
      </Section>
    )
  }

  return (
    <>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <div className={styles.header}>
            <h2 className={styles.modalTitle}>Template Editor</h2>
            <p className={styles.modalSubtitle}>
              Manage custom templates for your courses
            </p>
          </div>
        </div>

        <div className={styles.modalBody}>
          {editMode === 'list' ? renderTemplateList() : renderTemplateForm()}
        </div>
      </div>

    </>
  )
}

export default TemplateEditor;