import { useReducer, useCallback } from 'react';
import { CourseSeedData } from '../types/course';
import { CourseContent } from '../types/aiPrompt';

interface AppState {
  currentStep: string;
  courseSeedData: CourseSeedData | null;
  courseContent: CourseContent | null;
  showSettings: boolean;
  showHelp: boolean;
  showTestChecklist: boolean;
  showDeleteDialog: boolean;
  showUnsavedDialog: boolean;
  projectToDelete: { id: string; name: string } | null;
  toast: { message: string; type: 'success' | 'error' } | null;
  hasUnsavedChanges: boolean;
  apiKeys: {
    googleImageApiKey: string;
    googleCseId: string;
    youtubeApiKey: string;
  };
}

type AppAction =
  | { type: 'SET_STEP'; payload: string }
  | { type: 'SET_COURSE_SEED_DATA'; payload: CourseSeedData | null }
  | { type: 'SET_COURSE_CONTENT'; payload: CourseContent | null }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_HELP' }
  | { type: 'TOGGLE_TEST_CHECKLIST' }
  | { type: 'SHOW_DELETE_DIALOG'; payload: { id: string; name: string } | null }
  | { type: 'SHOW_UNSAVED_DIALOG'; payload: boolean }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' } | null }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'SET_API_KEYS'; payload: Partial<AppState['apiKeys']> }
  | { type: 'RESET_STATE' };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_COURSE_SEED_DATA':
      return { ...state, courseSeedData: action.payload };
    case 'SET_COURSE_CONTENT':
      return { ...state, courseContent: action.payload };
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };
    case 'TOGGLE_HELP':
      return { ...state, showHelp: !state.showHelp };
    case 'TOGGLE_TEST_CHECKLIST':
      return { ...state, showTestChecklist: !state.showTestChecklist };
    case 'SHOW_DELETE_DIALOG':
      return { ...state, showDeleteDialog: !!action.payload, projectToDelete: action.payload };
    case 'SHOW_UNSAVED_DIALOG':
      return { ...state, showUnsavedDialog: action.payload };
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.payload };
    case 'SET_API_KEYS':
      return { ...state, apiKeys: { ...state.apiKeys, ...action.payload } };
    case 'RESET_STATE':
      return {
        ...state,
        currentStep: 'seed',
        courseSeedData: null,
        courseContent: null,
        hasUnsavedChanges: false,
        projectToDelete: null
      };
    default:
      return state;
  }
}

export function useAppState(initialApiKeys: AppState['apiKeys']) {
  const [state, dispatch] = useReducer(appReducer, {
    currentStep: 'seed',
    courseSeedData: null,
    courseContent: null,
    showSettings: false,
    showHelp: false,
    showTestChecklist: false,
    showDeleteDialog: false,
    showUnsavedDialog: false,
    projectToDelete: null,
    toast: null,
    hasUnsavedChanges: false,
    apiKeys: initialApiKeys
  });

  // Action creators
  const actions = {
    setStep: useCallback((step: string) => 
      dispatch({ type: 'SET_STEP', payload: step }), []),
    setCourseSeedData: useCallback((data: CourseSeedData | null) => 
      dispatch({ type: 'SET_COURSE_SEED_DATA', payload: data }), []),
    setCourseContent: useCallback((content: CourseContent | null) => 
      dispatch({ type: 'SET_COURSE_CONTENT', payload: content }), []),
    toggleSettings: useCallback(() => 
      dispatch({ type: 'TOGGLE_SETTINGS' }), []),
    toggleHelp: useCallback(() => 
      dispatch({ type: 'TOGGLE_HELP' }), []),
    toggleTestChecklist: useCallback(() => 
      dispatch({ type: 'TOGGLE_TEST_CHECKLIST' }), []),
    showDeleteDialog: useCallback((project: { id: string; name: string } | null) => 
      dispatch({ type: 'SHOW_DELETE_DIALOG', payload: project }), []),
    showUnsavedDialog: useCallback((show: boolean) => 
      dispatch({ type: 'SHOW_UNSAVED_DIALOG', payload: show }), []),
    showToast: useCallback((toast: { message: string; type: 'success' | 'error' } | null) => 
      dispatch({ type: 'SHOW_TOAST', payload: toast }), []),
    setUnsavedChanges: useCallback((hasChanges: boolean) => 
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: hasChanges }), []),
    setApiKeys: useCallback((keys: Partial<AppState['apiKeys']>) => 
      dispatch({ type: 'SET_API_KEYS', payload: keys }), []),
    resetState: useCallback(() => 
      dispatch({ type: 'RESET_STATE' }), [])
  };

  return { state, actions };
}