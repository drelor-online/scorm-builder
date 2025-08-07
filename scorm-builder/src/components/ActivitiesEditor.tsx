import React, { useState, useEffect } from 'react'
import { CourseContent, LegacyCourseContent, CourseContentUnion, KnowledgeCheckQuestion, AssessmentQuestion, Activity } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import { PageLayout } from './PageLayout'
import { COLORS } from '../constants'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { ConfirmDialog } from './ConfirmDialog'
import QuestionEditorModal from './QuestionEditorModal'
import { 
  Button, 
  Card, 
  Input, 
  ButtonGroup,
  Section,
  Flex,
  Grid
} from './DesignSystem'
import './DesignSystem/designSystem.css'
import { useStorage } from '../contexts/PersistentStorageContext'
import { generateActivityId } from '../utils/idGenerator'
import DOMPurify from 'dompurify'

interface ActivitiesEditorProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  onNext: (content: CourseContentUnion) => void
  onBack: () => void
  onUpdateContent?: (content: CourseContentUnion) => void  // FIX: Add callback to update parent
  onSettingsClick?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

// Type guard to check if content is new format
function isNewFormat(content: CourseContentUnion): content is CourseContent {
  return content != null && 'welcomePage' in content && 'learningObjectivesPage' in content && 'assessment' in content
}

// Type guard to check if content is old format
function isOldFormat(content: CourseContentUnion): content is LegacyCourseContent {
  return content != null && 'activities' in content && 'quiz' in content
}

// Interface for editing knowledge check questions
interface EditingKnowledgeCheck {
  topicId: string
  questionId: string
  question: KnowledgeCheckQuestion
}

// Interface for editing assessment questions
interface EditingAssessment {
  questionId: string
  question: AssessmentQuestion
}

// Badge component for question types
const QuestionTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const colors = {
    'multiple-choice': COLORS.activityColors['multiple-choice'],
    'true-false': COLORS.activityColors['true-false'],
    'fill-in-the-blank': COLORS.activityColors['fill-in-the-blank'],
    'fill-in-blank': COLORS.activityColors['fill-in-the-blank']
  }
  
  const labels = {
    'multiple-choice': 'Multiple Choice',
    'true-false': 'True/False',
    'fill-in-the-blank': 'Fill in the Blank',
    'fill-in-blank': 'Fill in the Blank'
  }
  
  return (
    <span style={{
      fontSize: '0.75rem',
      padding: '0.25rem 0.5rem',
      backgroundColor: colors[type as keyof typeof colors] || '#6b7280',
      color: 'white',
      borderRadius: '0.25rem',
      display: 'inline-block'
    }}>
      {labels[type as keyof typeof labels] || type}
    </span>
  )
}

// Alert component
const Alert: React.FC<{ 
  type: 'info' | 'warning' | 'success'
  children: React.ReactNode 
}> = ({ type, children }) => {
  const colors = {
    info: COLORS.alertColors.info,
    warning: COLORS.alertColors.warning,
    success: COLORS.alertColors.success
  }
  
  return (
    <div className={`alert alert-${type}`} style={{
      backgroundColor: colors[type].background,
      border: `1px solid ${colors[type].border}`,
      borderRadius: '0.5rem',
      padding: '1rem',
      color: colors[type].text,
      fontSize: '0.875rem'
    }}>
      {children}
    </div>
  )
}

// Modal component removed - using QuestionEditorModal instead

export const ActivitiesEditor: React.FC<ActivitiesEditorProps> = ({ 
  courseContent,
  onNext, 
  onBack,
  onUpdateContent,  // FIX: Add onUpdateContent 
  onSettingsClick, 
  onSave, 
  onSaveAs,
  onOpen, 
  onHelp,
  onStepClick 
}) => {
  const [content, setContent] = useState(courseContent)
  
  // FIX: Use ref to track latest content and avoid stale closures
  const contentRef = React.useRef(content)
  React.useEffect(() => {
    contentRef.current = content
  }, [content])
  
  // Sync internal state with prop changes
  useEffect(() => {
    setContent(courseContent)
  }, [courseContent])
  
  // FIX: Update parent whenever content changes
  useEffect(() => {
    // Skip initial mount and only update if content has actually changed
    if (onUpdateContent && content !== courseContent) {
      onUpdateContent(content)
    }
  }, [content])
  const [editingKnowledgeCheck, setEditingKnowledgeCheck] = useState<EditingKnowledgeCheck | null>(null)
  const [editingAssessment, setEditingAssessment] = useState<EditingAssessment | null>(null)
  const [editingActivity, setEditingActivity] = useState<string | null>(null)
  const [editText, setEditText] = useState({ title: '', instructions: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [itemToRemove, setItemToRemove] = useState<{ type: 'knowledgeCheck' | 'assessment' | 'activity'; topicId: string; questionIndex: number } | null>(null)
  const [isEditingPassMark, setIsEditingPassMark] = useState(false)
  const [tempPassMark, setTempPassMark] = useState(80)
  const [isAddingKnowledgeCheck, setIsAddingKnowledgeCheck] = useState<string | null>(null) // topicId
  const [isAddingAssessment, setIsAddingAssessment] = useState(false)
  
  // Use storage hook - handle case where it might not be available
  let storage = null
  try {
    storage = useStorage()
  } catch (error) {
    // Storage provider not available, component will work without persistence
    console.warn('PersistentStorage not available, activities will not be persisted:', error)
  }
  
  // Load existing activities data on mount
  useEffect(() => {
    const loadActivitiesData = async () => {
      // Only load if storage is available and initialized
      if (!storage || !storage.isInitialized || !storage.currentProjectId) {
        return
      }
      
      setIsLoading(true)
      try {
        const savedContent = await storage.getContent('activities')
        if (savedContent) {
          setContent(savedContent)
        }
      } catch (error) {
        console.error('Error loading activities data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadActivitiesData()
  }, [storage])
  
  // Save content to storage whenever it changes
  useEffect(() => {
    const saveActivitiesData = async () => {
      // Only save if storage is available and initialized
      if (!storage || !storage.isInitialized || !storage.currentProjectId) {
        return
      }
      
      try {
        await storage.saveContent('activities', content)
        // Also trigger the onSave callback for silent save
        if (onSave) {
          onSave() // Silent save already handled by localStorage
        }
      } catch (error) {
        console.error('Error saving activities data:', error)
      }
    }
    
    // Debounce saving to avoid too many writes
    const timeoutId = setTimeout(saveActivitiesData, 1000)
    return () => clearTimeout(timeoutId)
  }, [content, storage, onSave])

  const addActivity = () => {
    if (!isOldFormat(content)) return;
    const newActivity = { 
      id: generateActivityId(), 
      title: 'New Activity', 
      instructions: '', 
      type: 'multiple-choice' as const,
      content: {}
    }
    setContent(prev => {
      if (!isOldFormat(prev)) return prev;
      return { ...prev, activities: [...prev.activities, newActivity] };
    });
  }

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity.id)
    setEditText({ title: activity.title, instructions: activity.instructions })
  }

  const handleSaveActivity = (activityId: string) => {
    setContent(prev => {
      if (!isOldFormat(prev)) return prev;
      return {
        ...prev,
        activities: prev.activities.map(act =>
          act.id === activityId
            ? { ...act, title: editText.title, instructions: editText.instructions }
            : act
        )
      };
    });
    setEditingActivity(null);
    setEditText({ title: '', instructions: '' });
  }
  
  const handleConfirmRemove = () => {
    if (!itemToRemove || !isNewFormat(content)) {
      setShowRemoveConfirm(false)
      setItemToRemove(null)
      return
    }
    
    const { type, topicId, questionIndex } = itemToRemove
    
    if (type === 'knowledgeCheck') {
      setContent(prev => {
        if (!isNewFormat(prev)) return prev
        return {
          ...prev,
          topics: prev.topics.map(topic => {
            if (topic.id === topicId && topic.knowledgeCheck) {
              const newQuestions = [...topic.knowledgeCheck.questions]
              newQuestions.splice(questionIndex, 1)
              return {
                ...topic,
                knowledgeCheck: {
                  ...topic.knowledgeCheck,
                  questions: newQuestions
                }
              }
            }
            return topic
          })
        }
      })
    } else if (type === 'assessment') {
      // FIX: Remove from assessment questions, not knowledge check questions
      setContent(prev => {
        if (!isNewFormat(prev)) return prev
        return {
          ...prev,
          assessment: prev.assessment ? {
            ...prev.assessment,
            questions: prev.assessment.questions.filter((_, index) => index !== questionIndex)
          } : prev.assessment
        }
      })
    }
    
    setShowRemoveConfirm(false)
    setItemToRemove(null)
  }
  
  const handleCancelRemove = () => {
    setShowRemoveConfirm(false)
    setItemToRemove(null)
  }

  // Calculate statistics
  const getStatistics = () => {
    if (!isNewFormat(content)) return { total: 0, knowledgeCheck: 0, assessment: 0 }
    
    const knowledgeCheckCount = content.topics.reduce((acc, topic) => 
      acc + (topic.knowledgeCheck?.questions?.length || 0), 0
    )
    const assessmentCount = content.assessment?.questions?.length || 0
    
    return {
      total: knowledgeCheckCount + assessmentCount,
      knowledgeCheck: knowledgeCheckCount,
      assessment: assessmentCount
    }
  }

  const stats = getStatistics()


  return (
    <PageLayout
      currentStep={5}
      title={isNewFormat(content) ? 'Questions & Assessment Editor' : 'Activities & Quiz Editor'}
      description={isNewFormat(content) 
        ? 'Review and edit all questions in your course'
        : 'Create engaging activities and assessments for your course'}
      autoSaveIndicator={<AutoSaveIndicatorConnected />}
      onSettingsClick={onSettingsClick}
      onBack={onBack}
      onNext={async () => {
        // FIX: Use ref to get latest content and avoid stale closure
        const latestContent = contentRef.current
        
        // Save final state before navigating
        if (storage && storage.isInitialized && storage.currentProjectId) {
          try {
            await storage.saveContent('activities', latestContent)
          } catch (error) {
            console.error('Error saving activities data before navigation:', error)
          }
        }
        onNext(latestContent)
      }}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      {isLoading ? (
        <Section>
          <Card title="Loading" padding="large">
            <div style={{ 
              textAlign: 'center', 
              color: '#a1a1aa',
              padding: '2rem'
            }}>
              Loading activities data...
            </div>
          </Card>
        </Section>
      ) : isNewFormat(content) ? (
        // New format: Knowledge Check and Assessment Editor
        <>
          {/* Summary Statistics */}
          <Section>
            <Card title="Summary Statistics" padding="large">
              <Grid cols={3} gap="medium">
                <Alert type="info">
                  <strong>Total Questions:</strong> {stats.total}
                </Alert>
                <Alert type="info">
                  <strong>Knowledge Check Questions:</strong> {stats.knowledgeCheck}
                </Alert>
                <Alert type="info">
                  <strong>Assessment Questions:</strong> {stats.assessment}
                </Alert>
              </Grid>
            </Card>
          </Section>

          {/* Knowledge Checks by Topic */}
          <Section>
            <Card title="Knowledge Check Questions" padding="large">
              <Grid cols={1} gap="large">
                {content.topics.map(topic => (
                  <Card 
                    key={topic.id}
                    className="enhanced-padding"
                  >
                    <h4 style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: COLORS.text,
                      margin: '0 0 1rem 0'
                    }}>
                      {topic.title}
                    </h4>
                    
                    {topic.knowledgeCheck && topic.knowledgeCheck.questions && topic.knowledgeCheck.questions.length > 0 ? (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        {topic.knowledgeCheck.questions.map((question, qIndex) => (
                          <Card 
                            key={question.id} 
                            className="enhanced-padding" 
                            data-testid={`question-card-${question.id}`}
                          >
                            <Flex justify="space-between" align="start" style={{ marginBottom: '0.75rem' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{
                                  color: COLORS.text,
                                  fontWeight: 500,
                                  margin: '0 0 0.5rem 0',
                                  fontSize: '1rem'
                                }}
                                  dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(
                                      question.type === 'fill-in-the-blank' && question.blank
                                        ? question.blank
                                        : question.question,
                                      {
                                        ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'p', 'span'],
                                        ALLOWED_ATTR: [],
                                        KEEP_CONTENT: true
                                      }
                                    )
                                  }}
                                />
                                <QuestionTypeBadge type={question.type} />
                              </div>
                              <ButtonGroup gap="small">
                                <Button
                                  onClick={() => setEditingKnowledgeCheck({ 
                                    topicId: topic.id, 
                                    questionId: question.id, 
                                    question: { ...question }
                                  })}
                                  variant="primary"
                                  size="small"
                                  data-testid="edit-question-button"
                                  className="question-edit-button"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => {
                                    setItemToRemove({ type: 'knowledgeCheck', topicId: topic.id, questionIndex: qIndex })
                                    setShowRemoveConfirm(true)
                                  }}
                                  variant="danger"
                                  size="small"
                                >
                                  Remove
                                </Button>
                              </ButtonGroup>
                            </Flex>
                            
                            {/* Show question details */}
                            {question.type === 'multiple-choice' && question.options && (
                              <ul style={{
                                margin: '0.5rem 0 0 0',
                                paddingLeft: '1.5rem',
                                color: '#a1a1aa'
                              }}>
                                {question.options.map((opt, idx) => (
                                  <li key={idx} style={{ marginBottom: '0.25rem' }}>
                                    <span dangerouslySetInnerHTML={{
                                      __html: DOMPurify.sanitize(opt, {
                                        ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                        ALLOWED_ATTR: [],
                                        KEEP_CONTENT: true
                                      })
                                    }} />
                                    {opt === question.correctAnswer && (
                                      <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {question.type === 'fill-in-the-blank' && question.blank && (
                              <p 
                                style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0' }}
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(
                                    question.blank.replace(/_____/g, `[${question.correctAnswer}]`),
                                    {
                                      ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                      ALLOWED_ATTR: [],
                                      KEEP_CONTENT: true
                                    }
                                  )
                                }}
                              />
                            )}
                            {question.type === 'true-false' && (
                              <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0' }}>
                                Correct Answer: <span style={{ color: '#16a34a' }}>{question.correctAnswer}</span>
                              </p>
                            )}
                            
                            {/* Feedback */}
                            {question.feedback && (
                              <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <span style={{ color: '#71717a' }}>Correct Feedback: </span>
                                  <span 
                                    style={{ color: '#a1a1aa' }}
                                    dangerouslySetInnerHTML={{
                                      __html: DOMPurify.sanitize(question.feedback.correct || 'No feedback provided', {
                                        ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                        ALLOWED_ATTR: [],
                                        KEEP_CONTENT: true
                                      })
                                    }}
                                  />
                                </div>
                                <div>
                                  <span style={{ color: '#71717a' }}>Incorrect Feedback: </span>
                                  <span 
                                    style={{ color: '#a1a1aa' }}
                                    dangerouslySetInnerHTML={{
                                      __html: DOMPurify.sanitize(question.feedback.incorrect || 'No feedback provided', {
                                        ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                        ALLOWED_ATTR: [],
                                        KEEP_CONTENT: true
                                      })
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        color: '#a1a1aa',
                        fontStyle: 'italic',
                        marginBottom: '1rem'
                      }}>
                        No knowledge check questions
                      </div>
                    )}
                    
                    <div style={{ marginTop: '1rem' }}>
                      <Button
                        onClick={() => setIsAddingKnowledgeCheck(topic.id)}
                        variant="success"
                        size="small"
                        data-testid="add-knowledge-check-question"
                      >
                        Add Question
                      </Button>
                    </div>
                  </Card>
                ))}
              </Grid>
            </Card>
          </Section>

          {/* Assessment Questions */}
          <Section>
            <Card title="Assessment Questions" padding="large">
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  onClick={() => setIsAddingAssessment(true)}
                  variant="success"
                  size="medium"
                  data-testid="add-assessment-question"
                >
                  Add Question
                </Button>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                {isEditingPassMark ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Input
                      type="number"
                      value={tempPassMark}
                      onChange={(e) => setTempPassMark(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      min="0"
                      max="100"
                      style={{ width: '100px' }}
                      data-testid="pass-mark-input"
                    />
                    <span>%</span>
                    <Button
                      onClick={() => {
                        setContent(prev => {
                          if (!isNewFormat(prev)) return prev
                          return {
                            ...prev,
                            assessment: {
                              ...prev.assessment,
                              passMark: tempPassMark,
                              questions: prev.assessment?.questions || []
                            }
                          }
                        })
                        setIsEditingPassMark(false)
                      }}
                      variant="primary"
                      size="small"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setTempPassMark(content.assessment?.passMark || 80)
                        setIsEditingPassMark(false)
                      }}
                      variant="secondary"
                      size="small"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Alert type="info">
                    Pass Mark: {content.assessment?.passMark || 80}%
                    <Button
                      onClick={() => {
                        setTempPassMark(content.assessment?.passMark || 80)
                        setIsEditingPassMark(true)
                      }}
                      variant="secondary"
                      size="small"
                      style={{ marginLeft: '1rem' }}
                      data-testid="pass-mark-edit"
                    >
                      Edit
                    </Button>
                  </Alert>
                )}
              </div>
              <Grid cols={1} gap="medium">
                {content.assessment?.questions?.map(question => (
                  <Card 
                    key={question.id} 
                    className="enhanced-padding" 
                    data-testid={`assessment-question-${question.id}`}
                  >
                    <Flex justify="space-between" align="start" style={{ marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          color: COLORS.text,
                          fontWeight: 500,
                          margin: '0 0 0.5rem 0',
                          fontSize: '1rem'
                        }}
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(question.question, {
                              ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'p', 'span'],
                              ALLOWED_ATTR: [],
                              KEEP_CONTENT: true
                            })
                          }}
                        />
                        <QuestionTypeBadge type={question.type} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          onClick={() => setEditingAssessment({ 
                            questionId: question.id, 
                            question: { ...question }
                          })}
                          variant="primary"
                          size="small"
                          className="question-edit-button"
                          data-testid="assessment-edit-button"
                        >
                          Edit
                        </Button>
                        {/* FIX: Add Remove button for assessment questions */}
                        <Button
                          onClick={() => {
                            const questionIndex = content.assessment?.questions?.findIndex(q => q.id === question.id) ?? -1
                            if (questionIndex >= 0) {
                              setItemToRemove({ type: 'assessment', topicId: '', questionIndex })
                              setShowRemoveConfirm(true)
                            }
                          }}
                          variant="danger"
                          size="small"
                          data-testid="assessment-remove-button"
                        >
                          Remove
                        </Button>
                      </div>
                    </Flex>
                    
                    {/* Show question details */}
                    {question.type === 'multiple-choice' && question.options && (
                      <ul style={{
                        margin: '0.5rem 0 0 0',
                        paddingLeft: '1.5rem',
                        color: '#a1a1aa'
                      }}>
                        {question.options.map((opt, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>
                            <span dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(opt, {
                                ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                ALLOWED_ATTR: [],
                                KEEP_CONTENT: true
                              })
                            }} />
                            {opt === question.correctAnswer && (
                              <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {question.type === 'true-false' && (
                      <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0' }}>
                        Correct Answer: <span style={{ color: '#16a34a' }}>{question.correctAnswer}</span>
                      </p>
                    )}
                    
                    {/* Feedback */}
                    {question.feedback && (
                      <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <span style={{ color: '#71717a' }}>Correct Feedback: </span>
                          <span 
                            style={{ color: '#a1a1aa' }}
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(question.feedback.correct || 'No feedback provided', {
                                ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                ALLOWED_ATTR: [],
                                KEEP_CONTENT: true
                              })
                            }}
                          />
                        </div>
                        <div>
                          <span style={{ color: '#71717a' }}>Incorrect Feedback: </span>
                          <span 
                            style={{ color: '#a1a1aa' }}
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(question.feedback.incorrect || 'No feedback provided', {
                                ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                ALLOWED_ATTR: [],
                                KEEP_CONTENT: true
                              })
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </Grid>
            </Card>
          </Section>
                
          {/* Add Knowledge Check Question Modal */}
          <QuestionEditorModal
            isOpen={!!isAddingKnowledgeCheck}
            onClose={() => setIsAddingKnowledgeCheck(null)}
            question={null}
            title="Add Knowledge Check Question"
            onSave={(newQuestion) => {
              if (isAddingKnowledgeCheck) {
                setContent(prev => {
                  if (!isNewFormat(prev)) return prev
                  return {
                    ...prev,
                    topics: prev.topics.map(topic => {
                      if (topic.id === isAddingKnowledgeCheck) {
                        const updatedKnowledgeCheck = topic.knowledgeCheck || { questions: [] }
                        return {
                          ...topic,
                          knowledgeCheck: {
                            ...updatedKnowledgeCheck,
                            questions: [
                              ...updatedKnowledgeCheck.questions,
                              {
                                ...newQuestion,
                                id: `kc-${Date.now()}`
                              } as KnowledgeCheckQuestion
                            ]
                          }
                        }
                      }
                      return topic
                    })
                  }
                })
                setIsAddingKnowledgeCheck(null)
              }
            }}
          />
          
          {/* Add Assessment Question Modal */}
          <QuestionEditorModal
            isOpen={isAddingAssessment}
            onClose={() => setIsAddingAssessment(false)}
            question={null}
            title="Add Assessment Question"
            onSave={(newQuestion) => {
              setContent(prev => {
                if (!isNewFormat(prev)) return prev
                const currentQuestions = prev.assessment?.questions || []
                return {
                  ...prev,
                  assessment: {
                    ...prev.assessment,
                    passMark: prev.assessment?.passMark || 80,
                    questions: [
                      ...currentQuestions,
                      {
                        ...newQuestion,
                        id: `assess-${Date.now()}`
                      } as AssessmentQuestion
                    ]
                  }
                }
              })
              setIsAddingAssessment(false)
            }}
          />
          
          {/* Edit Knowledge Check Question Modal */}
          <QuestionEditorModal
            isOpen={!!editingKnowledgeCheck}
            onClose={() => setEditingKnowledgeCheck(null)}
            question={editingKnowledgeCheck?.question || null}
            title="Edit Knowledge Check Question"
            onSave={(updatedQuestion) => {
              if (editingKnowledgeCheck) {
                setContent(prev => {
                  if (!isNewFormat(prev)) return prev;
                  return {
                    ...prev,
                    topics: prev.topics.map(topic => 
                      topic.id === editingKnowledgeCheck.topicId
                        ? {
                            ...topic,
                            knowledgeCheck: {
                              ...topic.knowledgeCheck!,
                              questions: topic.knowledgeCheck!.questions.map(q =>
                                q.id === editingKnowledgeCheck.questionId
                                  ? updatedQuestion as KnowledgeCheckQuestion
                                  : q
                              )
                            }
                          }
                        : topic
                    )
                  };
                });
                setEditingKnowledgeCheck(null);
              }
            }}
          />
          
          {/* Edit Assessment Question Modal */}
          <QuestionEditorModal
            isOpen={!!editingAssessment}
            onClose={() => setEditingAssessment(null)}
            question={editingAssessment?.question || null}
            title="Edit Assessment Question"
            onSave={(updatedQuestion) => {
              if (editingAssessment) {
                setContent(prev => {
                  if (!isNewFormat(prev)) return prev;
                  return {
                    ...prev,
                    assessment: {
                      ...prev.assessment,
                      questions: prev.assessment?.questions?.map(q =>
                        q.id === editingAssessment.questionId
                          ? updatedQuestion as AssessmentQuestion
                          : q
                      ) || []
                    }
                  };
                });
                setEditingAssessment(null);
              }
            }}
          />
        </>
      ) : (
        // Old format: Activities & Quiz Editor
        <>
          <Section>
            <Card title="Activities" padding="large">
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '1.5rem'
              }}>
                <Button 
                  onClick={addActivity}
                  variant="success"
                  size="medium"
                >
                  Add Activity
                </Button>
              </div>
              
              <Grid cols={1} gap="medium">
                {isOldFormat(content) && content.activities.map(activity => (
                  <Card 
                    key={activity.id}
                    className="enhanced-padding"
                  >
                    {editingActivity === activity.id ? (
                      <>
                        <Input
                          type="text"
                          value={editText.title}
                          onChange={(e) => setEditText(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Activity title"
                          fullWidth
                          style={{ marginBottom: '0.75rem' }}
                        />
                        <Input
                          multiline
                          rows={8}
                          value={editText.instructions}
                          onChange={(e) => setEditText(prev => ({ ...prev, instructions: e.target.value }))}
                          placeholder="Activity instructions"
                          fullWidth
                          style={{ marginBottom: '0.75rem', minHeight: '200px' }}
                        />
                        <ButtonGroup gap="small">
                          <Button
                            onClick={() => handleSaveActivity(activity.id)}
                            variant="primary"
                            size="small"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={() => setEditingActivity(null)}
                            variant="secondary"
                            size="small"
                          >
                            Cancel
                          </Button>
                        </ButtonGroup>
                      </>
                    ) : (
                      <>
                        <h4 style={{
                          fontSize: '1.125rem',
                          fontWeight: 600,
                          color: COLORS.text,
                          margin: '0 0 0.5rem 0'
                        }}>
                          {activity.title}
                        </h4>
                        <p style={{
                          color: '#a1a1aa',
                          margin: '0 0 0.75rem 0'
                        }}>
                          {activity.instructions || 'No instructions provided'}
                        </p>
                        <Flex justify="space-between" align="center">
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            borderRadius: '0.25rem'
                          }}>
                            {activity.type}
                          </span>
                          <Button
                            onClick={() => handleEditActivity(activity)}
                            variant="primary"
                            size="small"
                          >
                            Edit
                          </Button>
                        </Flex>
                      </>
                    )}
                  </Card>
                ))}
              </Grid>
            </Card>
          </Section>

          {/* Quiz Section */}
          <Section>
            <Card title="Quiz Questions" padding="large">
              <Grid cols={1} gap="medium">
                {isOldFormat(content) && content.quiz.questions.map(question => (
                  <Card
                    key={question.id}
                    className="enhanced-padding"
                  >
                    <p style={{
                      color: COLORS.text,
                      fontWeight: 500,
                      margin: '0 0 0.75rem 0'
                    }}>
                      {question.question}
                    </p>
                    {question.options && (
                      <ul style={{
                        margin: '0 0 0.75rem 0',
                        paddingLeft: '1.5rem',
                        color: '#a1a1aa'
                      }}>
                        {question.options.map((opt, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>
                            {opt} {opt === question.correctAnswer && (
                              <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button 
                      onClick={() => {
                        // Edit logic for old format
                      }}
                      variant="primary"
                      size="small"
                    >
                      Edit Question
                    </Button>
                  </Card>
                ))}
              </Grid>
            </Card>
          </Section>
        </>
      )}
      
      {/* Remove Question Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title="Remove Question"
        message="Are you sure you want to remove this question?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
      />
    </PageLayout>
  )
}

export default ActivitiesEditor;