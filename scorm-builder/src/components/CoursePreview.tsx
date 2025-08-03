import React from 'react'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'
import { CoursePreviewAccurate } from './CoursePreviewAccurate'

interface CoursePreviewProps {
  courseContent?: CourseContent | null
  courseSeedData: CourseSeedData | Partial<CourseSeedData>
  currentStep?: string
}

export const CoursePreview: React.FC<CoursePreviewProps> = ({
  courseContent,
  courseSeedData,
  currentStep
}) => {
  // Delegate to the accurate preview component
  return (
    <CoursePreviewAccurate
      courseContent={courseContent}
      courseSeedData={courseSeedData}
      currentStep={currentStep}
    />
  )
}

export default CoursePreview;