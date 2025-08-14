import React, { useState, useEffect, useCallback } from 'react'
import { CourseContent, LegacyCourseContent, CourseContentUnion, KnowledgeCheckQuestion, AssessmentQuestion, Activity } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import { PageLayout } from './PageLayout'
import { COLORS } from '../constants'
import { AutoSaveBadge } from './AutoSaveBadge'
import { ConfirmDialog } from './ConfirmDialog'
import QuestionEditorModal from './QuestionEditorModal'
import { 
  Button, 
  Card, 
  Input, 
  ButtonGroup,
  Section,
  Flex,
  Grid,
  Alert,
  QuestionTypeBadge,
  Icon
} from './DesignSystem'
import { Check } from 'lucide-react'
import './DesignSystem/designSystem.css'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import { generateActivityId } from '../utils/idGenerator'
import DOMPurify from 'dompurify'
import styles from './ActivitiesEditor.module.css'

interface ActivitiesEditorProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  onNext: (content: CourseContentUnion) => void
  onBack: () => void
  onUpdateContent?: (content: CourseContentUnion) => void  // FIX: Add callback to update parent
  onSettingsClick?: () => void
  onSave?: () => void
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

// QuestionTypeBadge already imported from DesignSystem above

// Modal component removed - using QuestionEditorModal instead

export const ActivitiesEditor: React.FC<ActivitiesEditorProps> = ({ 
  courseContent,
  onNext, 
  onBack,
  onUpdateContent,  // FIX: Add onUpdateContent 
  onSettingsClick, 
  onSave, 
  onOpen, 
  onHelp,
  onStepClick 
}) => {
  const [content, setContent] = useState(courseContent)
  const { markDirty, resetDirty } = useUnsavedChanges()
  
  // Track user interactions to distinguish from loading/syncing operations
  const hasUserInteracted = React.useRef(false)
  
  // FIX: Use ref to track latest content and avoid stale closures
  const contentRef = React.useRef(content)
  React.useEffect(() => {
    contentRef.current = content
  }, [content])
  
  // Sync internal state with prop changes
  useEffect(() => {
    setContent(courseContent)
  }, [courseContent])
  
  // FIX: Update parent whenever content changes - include all dependencies to avoid stale closures
  useEffect(() => {
    // Skip initial mount and only update if content has actually changed
    if (onUpdateContent && content !== courseContent) {
      onUpdateContent(content)
      
      // Mark dirty only if this is a user-initiated change (not initial load or sync)
      if (hasUserInteracted.current) {
        markDirty('activities')
        hasUserInteracted.current = false // Reset flag after marking dirty
      }
    }
  }, [content, onUpdateContent, courseContent, markDirty])
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
  
  // EMERGENCY FIX: Disabled automatic save to stop infinite loop
  // Save content to storage whenever it changes
  // useEffect(() => {
  //   const saveActivitiesData = async () => {
  //     // Only save if storage is available and initialized
  //     if (!storage || !storage.isInitialized || !storage.currentProjectId) {
  //       return
  //     }
  //     
  //     try {
  //       await storage.saveContent('activities', content)
  //       // Also trigger the onSave callback for silent save
  //       if (onSave) {
  //         onSave() // Silent save already handled by localStorage
  //       }
  //     } catch (error) {
  //       console.error('Error saving activities data:', error)
  //     }
  //   }
  //   
  //   // Debounce saving to avoid too many writes
  //   const timeoutId = setTimeout(saveActivitiesData, 1000)
  //   return () => clearTimeout(timeoutId)
  // }, [content, storage, onSave])

  const addActivity = useCallback(() => {
    if (!isOldFormat(content)) return;
    const newActivity = { 
      id: generateActivityId(), 
      title: 'New Activity', 
      instructions: '', 
      type: 'multiple-choice' as const,
      content: {}
    }
    hasUserInteracted.current = true // Mark as user interaction
    setContent(prev => {
      if (!isOldFormat(prev)) return prev;
      return { ...prev, activities: [...prev.activities, newActivity] };
    });
  }, [])

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity.id)
    setEditText({ title: activity.title, instructions: activity.instructions })
  }

  const handleSaveActivity = (activityId: string) => {
    hasUserInteracted.current = true // Mark as user interaction
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
      hasUserInteracted.current = true // Mark as user interaction
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
      hasUserInteracted.current = true // Mark as user interaction
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
      autoSaveIndicator={<AutoSaveBadge />}
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
        try {
          await onNext(latestContent)
          // Reset activities dirty flag only on successful next
          resetDirty('activities')
        } catch (error) {
          // If onNext fails, don't reset dirty flag
          console.error('Failed to proceed to next step:', error)
          throw error // Re-throw to maintain error handling
        }
      }}
      onSave={onSave}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      {isLoading ? (
        <Section>
          <Card title="Loading" padding="large">
            <div className={styles.loadingContainer}>
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
                <Alert variant="info">
                  <strong>Total Questions:</strong> {stats.total}
                </Alert>
                <Alert variant="info">
                  <strong>Knowledge Check Questions:</strong> {stats.knowledgeCheck}
                </Alert>
                <Alert variant="info">
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
                    <h4 className={styles.topicTitle}>
                      {topic.title}
                    </h4>
                    
                    {topic.knowledgeCheck && topic.knowledgeCheck.questions && topic.knowledgeCheck.questions.length > 0 ? (
                      <div className={styles.questionGrid}>
                        {topic.knowledgeCheck.questions.map((question, qIndex) => (
                          <Card 
                            key={question.id} 
                            className="enhanced-padding" 
                            data-testid={`question-card-${question.id}`}
                          >
                            <Flex justify="space-between" align="start" className={styles.questionHeader}>
                              <div className={styles.questionContent}>
                                <p className={styles.questionText}
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
                              <ul className={styles.optionsList}>
                                {question.options.map((opt, idx) => (
                                  <li key={idx} className={styles.optionItem}>
                                    <span dangerouslySetInnerHTML={{
                                      __html: DOMPurify.sanitize(opt, {
                                        ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                        ALLOWED_ATTR: [],
                                        KEEP_CONTENT: true
                                      })
                                    }} />
                                    {opt === question.correctAnswer && (
                                      <Icon icon={Check} size="sm" color="var(--color-success)" className={styles.correctAnswer} />
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {question.type === 'fill-in-the-blank' && question.blank && (
                              <p className={styles.fillInBlankPreview}
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
                              <p className={styles.fillInBlankPreview}>
                                Correct Answer: <span className={styles.correctAnswer}>{question.correctAnswer}</span>
                              </p>
                            )}
                            
                            {/* Feedback */}
                            {question.feedback && (
                              <div className={styles.feedbackSection}>
                                <div className={styles.feedbackItem}>
                                  <span className={styles.feedbackLabel}>Correct Feedback: </span>
                                  <span className={styles.feedbackText}
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
                                  <span className={styles.feedbackLabel}>Incorrect Feedback: </span>
                                  <span 
                                    className={styles.feedbackText}
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
                      <div className={styles.emptyState}>
                        No knowledge check questions
                      </div>
                    )}
                    
                    <div className={styles.addButtonContainer}>
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
              <div className={styles.assessmentHeader}>
                <Button
                  onClick={() => setIsAddingAssessment(true)}
                  variant="success"
                  size="medium"
                  data-testid="add-assessment-question"
                >
                  Add Question
                </Button>
              </div>
              <div className={styles.passMarkContainer}>
                {isEditingPassMark ? (
                  <div className={styles.passMarkEditor}>
                    <Input
                      type="number"
                      value={tempPassMark}
                      onChange={(e) => setTempPassMark(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      min="0"
                      max="100"
                      className={styles.passMarkInput}
                      data-testid="pass-mark-input"
                    />
                    <span>%</span>
                    <Button
                      onClick={() => {
                        hasUserInteracted.current = true // Mark as user interaction
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
                  <Alert variant="info">
                    Pass Mark: {content.assessment?.passMark || 80}%
                    <Button
                      onClick={() => {
                        setTempPassMark(content.assessment?.passMark || 80)
                        setIsEditingPassMark(true)
                      }}
                      variant="secondary"
                      size="small"
                      className={styles.passMarkEditButton}
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
                    <Flex justify="space-between" align="start" className={styles.assessmentQuestionHeader}>
                      <div className={styles.questionContent}>
                        <p className={styles.assessmentQuestionText}
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
                      <div className={styles.questionActions}>
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
                      <ul className={styles.optionsList}>
                        {question.options.map((opt, idx) => (
                          <li key={idx} className={styles.optionItem}>
                            <span dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(opt, {
                                ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'span'],
                                ALLOWED_ATTR: [],
                                KEEP_CONTENT: true
                              })
                            }} />
                            {opt === question.correctAnswer && (
                              <Icon icon={Check} size="sm" color="var(--color-success)" className={styles.correctMark} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {question.type === 'true-false' && (
                      <p className={styles.answerDisplay}>
                        Correct Answer: <span className={styles.correctAnswerText}>{question.correctAnswer}</span>
                      </p>
                    )}
                    
                    {/* Feedback */}
                    {question.feedback && (
                      <div className={styles.feedbackSection}>
                        <div className={styles.feedbackItem}>
                          <span className={styles.feedbackLabel}>Correct Feedback: </span>
                          <span 
                            className={styles.feedbackText}
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
                          <span className={styles.feedbackLabel}>Incorrect Feedback: </span>
                          <span 
                            className={styles.feedbackText}
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
                hasUserInteracted.current = true // Mark as user interaction
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
              hasUserInteracted.current = true // Mark as user interaction
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
                hasUserInteracted.current = true // Mark as user interaction
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
                hasUserInteracted.current = true // Mark as user interaction
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
              <div className={styles.addActivityContainer}>
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
                          className={styles.editInput}
                        />
                        <Input
                          multiline
                          rows={8}
                          value={editText.instructions}
                          onChange={(e) => setEditText(prev => ({ ...prev, instructions: e.target.value }))}
                          placeholder="Activity instructions"
                          fullWidth
                          className={styles.editTextarea}
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
                        <h4 className={styles.activityTitle}>
                          {activity.title}
                        </h4>
                        <p className={styles.activityInstructions}>
                          {activity.instructions || 'No instructions provided'}
                        </p>
                        <Flex justify="space-between" align="center">
                          <span className={styles.activityTypeBadge}>
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
                    <p className={styles.questionText}>
                      {question.question}
                    </p>
                    {question.options && (
                      <ul className={styles.optionsList}>
                        {question.options.map((opt, idx) => (
                          <li key={idx} className={styles.optionItem}>
                            {opt} {opt === question.correctAnswer && (
                              <Icon icon={Check} size="sm" color="var(--color-success)" className={styles.correctMark} />
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