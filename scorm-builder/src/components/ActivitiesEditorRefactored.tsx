import React, { useState, useEffect } from 'react'
import { CourseContent, LegacyCourseContent, CourseContentUnion, KnowledgeCheckQuestion, AssessmentQuestion, Activity } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import { PageLayout } from './PageLayout'
import { CoursePreview } from './CoursePreview'
import { COLORS } from '../constants'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
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

interface ActivitiesEditorProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  onNext: (content: CourseContentUnion) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

// Type guard to check if content is new format
function isNewFormat(content: CourseContentUnion): content is CourseContent {
  return 'welcomePage' in content && 'learningObjectivesPage' in content && 'assessment' in content
}

// Type guard to check if content is old format
function isOldFormat(content: CourseContentUnion): content is LegacyCourseContent {
  return 'activities' in content && 'quiz' in content
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
      backgroundColor: colors[type].bg,
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

// Modal component
const Modal: React.FC<{
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}> = ({ isOpen, title, children }) => {
  if (!isOpen) return null
  
  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div className="modal" style={{
        backgroundColor: COLORS.backgroundLight,
        borderRadius: '0.5rem',
        padding: '2rem',
        maxWidth: '40rem',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        border: `1px solid ${COLORS.border}`
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: COLORS.text,
          margin: '0 0 1.5rem 0'
        }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}

export const ActivitiesEditor: React.FC<ActivitiesEditorProps> = ({ 
  courseContent,
  courseSeedData, 
  onNext, 
  onBack, 
  onSettingsClick, 
  onSave, 
  onSaveAs,
  onOpen, 
  onHelp,
  onStepClick 
}) => {
  const [content, setContent] = useState(courseContent)
  const [editingKnowledgeCheck, setEditingKnowledgeCheck] = useState<EditingKnowledgeCheck | null>(null)
  const [editingAssessment, setEditingAssessment] = useState<EditingAssessment | null>(null)
  const [editingActivity, setEditingActivity] = useState<string | null>(null)
  const [editText, setEditText] = useState({ title: '', instructions: '' })
  const [isLoading, setIsLoading] = useState(false)
  
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
      } catch (error) {
        console.error('Error saving activities data:', error)
      }
    }
    
    // Debounce saving to avoid too many writes
    const timeoutId = setTimeout(saveActivitiesData, 1000)
    return () => clearTimeout(timeoutId)
  }, [content, storage])

  const addActivity = () => {
    if (!isOldFormat(content)) return;
    const newActivity = { 
      id: Date.now().toString(), 
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

  // Course preview element for PageLayout
  const coursePreviewElement = courseSeedData && isNewFormat(content) ? (
    <CoursePreview 
      courseContent={content as CourseContent}
      courseSeedData={courseSeedData}
    />
  ) : null

  return (
    <PageLayout
      currentStep={5}
      title={isNewFormat(content) ? 'Questions & Assessment Editor' : 'Activities & Quiz Editor'}
      description={isNewFormat(content) 
        ? 'Review and edit all questions in your course'
        : 'Create engaging activities and assessments for your course'}
      coursePreview={coursePreviewElement}
      autoSaveIndicator={<AutoSaveIndicatorConnected />}
      onSettingsClick={onSettingsClick}
      onBack={onBack}
      onNext={async () => {
        // Save final state before navigating
        if (storage && storage.isInitialized && storage.currentProjectId) {
          try {
            await storage.saveContent('activities', content)
          } catch (error) {
            console.error('Error saving activities data before navigation:', error)
          }
        }
        onNext(content)
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
                  <div key={topic.id} style={{
                    backgroundColor: COLORS.background,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '0.5rem',
                    padding: '1.5rem'
                  }}>
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
                        {topic.knowledgeCheck.questions.map(question => (
                          <div key={question.id} className="card enhanced-padding" style={{
                            backgroundColor: COLORS.background
                          }}>
                            <Flex justify="space-between" align="start" style={{ marginBottom: '0.75rem' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{
                                  color: COLORS.text,
                                  fontWeight: 500,
                                  margin: '0 0 0.5rem 0',
                                  fontSize: '1rem'
                                }}>
                                  {question.type === 'fill-in-the-blank' && question.blank
                                    ? question.blank
                                    : question.question}
                                </p>
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
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to remove this question?')) {
                                      // Remove question logic
                                    }
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
                                    {opt} {opt === question.correctAnswer && (
                                      <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {question.type === 'fill-in-the-blank' && question.blank && (
                              <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0' }}>
                                {question.blank.replace('_____', `[${question.correctAnswer}]`)}
                              </p>
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
                                  <span style={{ color: '#a1a1aa' }}>{question.feedback.correct || 'No feedback provided'}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#71717a' }}>Incorrect Feedback: </span>
                                  <span style={{ color: '#a1a1aa' }}>{question.feedback.incorrect || 'No feedback provided'}</span>
                                </div>
                              </div>
                            )}
                          </div>
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
                    
                    {/* Add Knowledge Check functionality removed */}
                  </div>
                ))}
              </Grid>
            </Card>
          </Section>

          {/* Assessment Questions */}
          <Section>
            <Card title="Assessment Questions" padding="large">
              <div style={{ marginBottom: '1rem' }}>
                <Alert type="info">
                  Pass Mark: {content.assessment?.passMark || 80}%
                </Alert>
              </div>
              <Grid cols={1} gap="medium">
                {content.assessment?.questions?.map(question => (
                  <div key={question.id} className="card enhanced-padding" style={{
                    backgroundColor: COLORS.background
                  }}>
                    <Flex justify="space-between" align="start" style={{ marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          color: COLORS.text,
                          fontWeight: 500,
                          margin: '0 0 0.5rem 0',
                          fontSize: '1rem'
                        }}>
                          {question.question}
                        </p>
                        <QuestionTypeBadge type={question.type} />
                      </div>
                      <Button
                        onClick={() => setEditingAssessment({ 
                          questionId: question.id, 
                          question: { ...question }
                        })}
                        variant="primary"
                        size="small"
                      >
                        Edit
                      </Button>
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
                            {opt} {opt === question.correctAnswer && (
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
                          <span style={{ color: '#a1a1aa' }}>{question.feedback.correct || 'No feedback provided'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#71717a' }}>Incorrect Feedback: </span>
                          <span style={{ color: '#a1a1aa' }}>{question.feedback.incorrect || 'No feedback provided'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </Grid>
            </Card>
          </Section>
                
          {/* Edit Knowledge Check Question Modal */}
          <Modal
            isOpen={!!editingKnowledgeCheck}
            onClose={() => setEditingKnowledgeCheck(null)}
            title="Edit Question"
          >
            {editingKnowledgeCheck && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="question-text" style={{
                    display: 'block',
                    color: '#a1a1aa',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem'
                  }}>
                    Question Text
                  </label>
                  <Input
                    id="question-text"
                    type="text"
                    value={editingKnowledgeCheck.question.question}
                    onChange={(e) => setEditingKnowledgeCheck({
                      ...editingKnowledgeCheck,
                      question: { ...editingKnowledgeCheck.question, question: e.target.value }
                    })}
                    fullWidth
                  />
                </div>
                
                {/* Options for multiple choice */}
                {editingKnowledgeCheck.question.type === 'multiple-choice' && (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{
                        display: 'block',
                        color: '#a1a1aa',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem'
                      }}>
                        Answer Options
                      </label>
                      {editingKnowledgeCheck.question.options?.map((option, idx) => (
                        <div key={idx} style={{ marginBottom: '0.5rem' }}>
                          <Input
                            label={`Option ${idx + 1}`}
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...(editingKnowledgeCheck.question.options || [])]
                              newOptions[idx] = e.target.value
                              setEditingKnowledgeCheck({
                                ...editingKnowledgeCheck,
                                question: { ...editingKnowledgeCheck.question, options: newOptions }
                              })
                            }}
                            fullWidth
                          />
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label htmlFor="correct-answer" style={{
                        display: 'block',
                        color: '#a1a1aa',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem'
                      }}>
                        Correct Answer
                      </label>
                      <select
                        id="correct-answer"
                        value={editingKnowledgeCheck.question.correctAnswer}
                        onChange={(e) => setEditingKnowledgeCheck({
                          ...editingKnowledgeCheck,
                          question: { ...editingKnowledgeCheck.question, correctAnswer: e.target.value }
                        })}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          backgroundColor: COLORS.background,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: '0.25rem',
                          color: '#e4e4e7',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select correct answer</option>
                        {editingKnowledgeCheck.question.options?.map((option, idx) => (
                          <option key={idx} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                {/* True/False options */}
                {editingKnowledgeCheck.question.type === 'true-false' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      color: '#a1a1aa',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      Correct Answer
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="radio"
                          name="trueFalse"
                          value="True"
                          checked={editingKnowledgeCheck.question.correctAnswer === 'True'}
                          onChange={(e) => setEditingKnowledgeCheck({
                            ...editingKnowledgeCheck,
                            question: { ...editingKnowledgeCheck.question, correctAnswer: e.target.value }
                          })}
                        />
                        <span style={{ color: '#e4e4e7' }}>True</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="radio"
                          name="trueFalse"
                          value="False"
                          checked={editingKnowledgeCheck.question.correctAnswer === 'False'}
                          onChange={(e) => setEditingKnowledgeCheck({
                            ...editingKnowledgeCheck,
                            question: { ...editingKnowledgeCheck.question, correctAnswer: e.target.value }
                          })}
                        />
                        <span style={{ color: '#e4e4e7' }}>False</span>
                      </label>
                    </div>
                  </div>
                )}
                
                {/* Feedback */}
                <div style={{ marginBottom: '1rem' }}>
                  <Input
                    label="Correct Feedback"
                    value={editingKnowledgeCheck.question.feedback?.correct || ''}
                    onChange={(e) => setEditingKnowledgeCheck({
                      ...editingKnowledgeCheck,
                      question: {
                        ...editingKnowledgeCheck.question,
                        feedback: {
                          ...editingKnowledgeCheck.question.feedback || { correct: '', incorrect: '' },
                          correct: e.target.value
                        }
                      }
                    })}
                    fullWidth
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Input
                    label="Incorrect Feedback"
                    value={editingKnowledgeCheck.question.feedback?.incorrect || ''}
                    onChange={(e) => setEditingKnowledgeCheck({
                      ...editingKnowledgeCheck,
                      question: {
                        ...editingKnowledgeCheck.question,
                        feedback: {
                          ...editingKnowledgeCheck.question.feedback || { correct: '', incorrect: '' },
                          incorrect: e.target.value
                        }
                      }
                    })}
                    fullWidth
                  />
                </div>
                
                <Flex gap="medium" justify="end">
                  <Button
                    onClick={() => {
                      // Save logic here
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
                                        ? editingKnowledgeCheck.question
                                        : q
                                    )
                                  }
                                }
                              : topic
                          )
                        };
                      });
                      setEditingKnowledgeCheck(null);
                    }}
                    variant="primary"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={() => setEditingKnowledgeCheck(null)}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </Flex>
              </>
            )}
          </Modal>
          
          {/* Edit Assessment Question Modal */}
          <Modal
            isOpen={!!editingAssessment}
            onClose={() => setEditingAssessment(null)}
            title="Edit Assessment Question"
          >
            {editingAssessment && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="assessment-question-text" style={{
                    display: 'block',
                    color: '#a1a1aa',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem'
                  }}>
                    Question Text
                  </label>
                  <Input
                    id="assessment-question-text"
                    type="text"
                    value={editingAssessment.question.question}
                    onChange={(e) => setEditingAssessment({
                      ...editingAssessment,
                      question: { ...editingAssessment.question, question: e.target.value }
                    })}
                    fullWidth
                  />
                </div>
                
                {/* Options for multiple choice */}
                {editingAssessment.question.type === 'multiple-choice' && (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{
                        display: 'block',
                        color: '#a1a1aa',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem'
                      }}>
                        Answer Options
                      </label>
                      {editingAssessment.question.options?.map((option, idx) => (
                        <div key={idx} style={{ marginBottom: '0.5rem' }}>
                          <Input
                            label={`Option ${idx + 1}`}
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...(editingAssessment.question.options || [])]
                              newOptions[idx] = e.target.value
                              setEditingAssessment({
                                ...editingAssessment,
                                question: { ...editingAssessment.question, options: newOptions }
                              })
                            }}
                            fullWidth
                          />
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label htmlFor="assessment-correct-answer" style={{
                        display: 'block',
                        color: '#a1a1aa',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem'
                      }}>
                        Correct Answer
                      </label>
                      <select
                        id="assessment-correct-answer"
                        value={editingAssessment.question.correctAnswer}
                        onChange={(e) => setEditingAssessment({
                          ...editingAssessment,
                          question: { ...editingAssessment.question, correctAnswer: e.target.value }
                        })}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          backgroundColor: COLORS.background,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: '0.25rem',
                          color: '#e4e4e7',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select correct answer</option>
                        {editingAssessment.question.options?.map((option, idx) => (
                          <option key={idx} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                {/* True/False options */}
                {editingAssessment.question.type === 'true-false' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      color: '#a1a1aa',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      Correct Answer
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="radio"
                          name="assessmentTrueFalse"
                          value="True"
                          checked={editingAssessment.question.correctAnswer === 'True'}
                          onChange={(e) => setEditingAssessment({
                            ...editingAssessment,
                            question: { ...editingAssessment.question, correctAnswer: e.target.value }
                          })}
                        />
                        <span style={{ color: '#e4e4e7' }}>True</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="radio"
                          name="assessmentTrueFalse"
                          value="False"
                          checked={editingAssessment.question.correctAnswer === 'False'}
                          onChange={(e) => setEditingAssessment({
                            ...editingAssessment,
                            question: { ...editingAssessment.question, correctAnswer: e.target.value }
                          })}
                        />
                        <span style={{ color: '#e4e4e7' }}>False</span>
                      </label>
                    </div>
                  </div>
                )}
                
                {/* Feedback */}
                <div style={{ marginBottom: '1rem' }}>
                  <Input
                    label="Correct Feedback"
                    value={editingAssessment.question.feedback?.correct || ''}
                    onChange={(e) => setEditingAssessment({
                      ...editingAssessment,
                      question: {
                        ...editingAssessment.question,
                        feedback: {
                          ...editingAssessment.question.feedback || { correct: '', incorrect: '' },
                          correct: e.target.value
                        }
                      }
                    })}
                    fullWidth
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Input
                    label="Incorrect Feedback"
                    value={editingAssessment.question.feedback?.incorrect || ''}
                    onChange={(e) => setEditingAssessment({
                      ...editingAssessment,
                      question: {
                        ...editingAssessment.question,
                        feedback: {
                          ...editingAssessment.question.feedback || { correct: '', incorrect: '' },
                          incorrect: e.target.value
                        }
                      }
                    })}
                    fullWidth
                  />
                </div>
                
                <Flex gap="medium" justify="end">
                  <Button
                    onClick={() => {
                      // Save logic here
                      setContent(prev => {
                        if (!isNewFormat(prev)) return prev;
                        return {
                          ...prev,
                          assessment: {
                            ...prev.assessment,
                            questions: prev.assessment?.questions?.map(q =>
                              q.id === editingAssessment.questionId
                                ? editingAssessment.question
                                : q
                            ) || []
                          }
                        };
                      });
                      setEditingAssessment(null);
                    }}
                    variant="primary"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={() => setEditingAssessment(null)}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </Flex>
              </>
            )}
          </Modal>
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
                  <div key={activity.id} style={{
                    backgroundColor: COLORS.background,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '0.5rem',
                    padding: '1rem'
                  }}>
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
                          rows={3}
                          value={editText.instructions}
                          onChange={(e) => setEditText(prev => ({ ...prev, instructions: e.target.value }))}
                          placeholder="Activity instructions"
                          fullWidth
                          style={{ marginBottom: '0.75rem' }}
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
                  </div>
                ))}
              </Grid>
            </Card>
          </Section>

          {/* Quiz Section */}
          <Section>
            <Card title="Quiz Questions" padding="large">
              <Grid cols={1} gap="medium">
                {isOldFormat(content) && content.quiz.questions.map(question => (
                  <div key={question.id} style={{
                    backgroundColor: COLORS.background,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '0.5rem',
                    padding: '1rem'
                  }}>
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
                  </div>
                ))}
              </Grid>
            </Card>
          </Section>
        </>
      )}
    </PageLayout>
  )
}