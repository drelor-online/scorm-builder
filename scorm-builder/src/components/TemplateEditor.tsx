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
import { Toast } from './Toast'
import './DesignSystem/designSystem.css'

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
  const [customTemplates, setCustomTemplates] = useState<CustomTemplates>(() => {
    const saved = localStorage.getItem('customTemplates')
    return saved ? JSON.parse(saved) : {}
  })
  
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<keyof typeof promptSections>('introduction')
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({})

  // Save templates to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('customTemplates', JSON.stringify(customTemplates))
  }, [customTemplates])

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
    setToast({ message: `Template "${templateName}" deleted`, type: 'success' })
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
    
    setToast({ 
      message: editMode === 'create' ? 'Template created successfully' : 'Template updated successfully', 
      type: 'success' 
    })
    
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
          <Flex justify="space-between" align="center" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Custom Templates</h3>
            <Button variant="primary" onClick={handleCreateNew}>
              Add New Template
            </Button>
          </Flex>
          
          {templates.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>
                  No custom templates yet
                </p>
                <Button variant="primary" onClick={handleCreateNew}>
                  Create Your First Template
                </Button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {templates.map(templateName => (
                <Card key={templateName} style={{ padding: '1rem' }}>
                  <Flex justify="space-between" align="center">
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>{templateName}</h4>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#a1a1aa' }}>
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
            <div style={{ padding: '1rem' }}>
              <p>Are you sure you want to delete "{showDeleteConfirm}"?</p>
              <Flex gap="medium" justify="end" style={{ marginTop: '1.5rem' }}>
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
        <Flex justify="space-between" align="center" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>
            {editMode === 'create' ? 'Create New Template' : `Edit "${currentTemplate}"`}
          </h3>
          <Button variant="secondary" onClick={() => setEditMode('list')}>
            Cancel
          </Button>
        </Flex>

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(220, 38, 38, 0.1)', 
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '0.375rem',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#ef4444'
          }}>
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
              <span style={{ color: '#a1a1aa', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                (one per line)
              </span>
            </label>
            <textarea
              id="template-topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Topic 1&#10;Topic 2&#10;Topic 3"
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: '#18181b',
                border: `1px solid ${tokens.colors.border.default}`,
                color: '#e4e4e7',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Prompt Builder */}
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Prompt Builder</h4>
            
            {/* Tag Buttons */}
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
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
                    <span style={{ 
                      display: 'block', 
                      fontSize: '0.75rem', 
                      color: '#71717a',
                      fontWeight: 'normal',
                      marginTop: '0.25rem'
                    }}>
                      {sectionDescriptions[section as keyof typeof sectionDescriptions]}
                    </span>
                  </label>
                  <textarea
                    id={`prompt-${section}`}
                    ref={(el) => { textareaRefs.current[section] = el }}
                    value={value}
                    onChange={(e) => setPromptSections({ ...promptSections, [section]: e.target.value })}
                    onFocus={() => setActiveSection(section as keyof typeof promptSections)}
                    placeholder={`Enter ${section} section...`}
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#18181b',
                      border: activeSection === section ? '1px solid #3b82f6' : '1px solid #3f3f46',
                      color: '#e4e4e7',
                      fontSize: '0.875rem',
                      resize: 'vertical',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
              ))}
            </Grid>
          </div>

          {/* Preview */}
          <Card>
            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Preview</h4>
            <div style={{
              backgroundColor: '#09090b',
              border: '1px solid #27272a',
              borderRadius: '0.375rem',
              padding: '1rem',
              fontSize: '0.875rem',
              color: '#a1a1aa',
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {getPreview()}
            </div>
          </Card>

          {/* Available Tags Reference */}
          <Card>
            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Available Tags</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {AVAILABLE_TAGS.map(({ tag, description }) => (
                <div key={tag} style={{ fontSize: '0.875rem' }}>
                  <code style={{ 
                    backgroundColor: '#27272a', 
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    color: '#3b82f6'
                  }}>
                    {tag}
                  </code>
                  <span style={{ marginLeft: '0.5rem', color: '#a1a1aa' }}>
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
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0
      }}>
        <div style={{ 
          padding: '1.5rem 1.5rem 0 1.5rem',
          flexShrink: 0 
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>Template Editor</h2>
            <p style={{ margin: 0, color: '#a1a1aa' }}>
              Manage custom templates for your courses
            </p>
          </div>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 1.5rem 1.5rem 1.5rem',
          minHeight: 0
        }}>
          {editMode === 'list' ? renderTemplateList() : renderTemplateForm()}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}