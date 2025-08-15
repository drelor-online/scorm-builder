import { useMemo } from 'react';
import { CourseSeedData } from '../types/course';
import { CourseContent } from '../types/aiPrompt';
import { ProjectData } from '../types/project';

interface UseProjectDataParams {
  courseSeedData: CourseSeedData | null;
  courseContent: CourseContent | null;
  currentStep: string;
}

const DEFAULT_PROJECT_DATA: ProjectData = {
  courseTitle: '',
  courseSeedData: {
    courseTitle: '',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  },
  currentStep: 'seed',
  lastModified: new Date().toISOString(),
  mediaFiles: {},
  audioFiles: {}
};

const STEP_NUMBERS = {
  seed: 0,
  prompt: 1,
  json: 2,
  media: 3,
  audio: 4,
  activities: 5,
  scorm: 6
} as const;

export function useProjectData({ 
  courseSeedData, 
  courseContent, 
  currentStep 
}: UseProjectDataParams): ProjectData {
  return useMemo(() => {
    if (!courseSeedData) return DEFAULT_PROJECT_DATA;
    
    return {
      courseTitle: courseSeedData.courseTitle,
      courseSeedData: courseSeedData,
      courseContent: courseContent || undefined,
      currentStep: currentStep,
      lastModified: new Date().toISOString(),
      mediaFiles: {},
      audioFiles: {}
    };
  }, [courseSeedData, courseContent, currentStep]);
}