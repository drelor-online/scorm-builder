import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CourseSeedInput } from './CourseSeedInput';
import { StepNavigationProvider } from '../contexts/StepNavigationContext';
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext';
import { NotificationProvider } from '../contexts/NotificationContext';

// Mock the UnifiedMediaContext
const mockUnifiedMediaContext = {
  getMediaForPage: vi.fn().mockReturnValue([]),
  createBlobUrl: vi.fn(),
  mediaLoaded: true,
  loadMedia: vi.fn(),
  storeMedia: vi.fn(),
  mediaItems: [],
  deleteMedia: vi.fn(),
  error: null,
  clearError: vi.fn()
};

vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => mockUnifiedMediaContext
}));

// Mock the storage context
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
  listProjects: vi.fn(),
};

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage,
}));

// Mock other dependencies
vi.mock('../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        {children}
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </NotificationProvider>
);

describe('CourseSeedInput Button Spacing', () => {
  const mockProps = {
    onSave: vi.fn(),
    onNext: vi.fn(),
    initialData: {
      projectTitle: 'Test Project',
      difficulty: 'Medium' as const,
      template: 'Safety' as const,
      topics: ['Topic 1', 'Topic 2']
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getContent.mockResolvedValue(null);
    mockStorage.saveContent.mockResolvedValue(undefined);
    mockStorage.listProjects.mockResolvedValue([]);
  });

  it('should have proper spacing between template dropdown and Add Template Topics button', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    );
    
    const templateSelect = screen.getByTestId('template-select');
    const addTopicsButton = screen.getByTestId('add-template-topics');
    
    // Both elements should be present
    expect(templateSelect).toBeInTheDocument();
    expect(addTopicsButton).toBeInTheDocument();
    
    // Verify the spacing class is applied - in real environment this provides margin-top: var(--space-md)
    expect(addTopicsButton.className).toContain('templateButtonSpacing');
    
    // Verify elements are positioned correctly (button below select)
    const selectRect = templateSelect.getBoundingClientRect();
    const buttonRect = addTopicsButton.getBoundingClientRect();
    expect(buttonRect.top).toBeGreaterThanOrEqual(selectRect.bottom);
  });

  it('should apply spacing CSS class to Add Template Topics button', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    );
    
    const addTopicsButton = screen.getByTestId('add-template-topics');
    
    // The button should have margin-top or similar spacing class
    expect(addTopicsButton.className).toMatch(/margin|spacing|gap/i);
  });

  it('should not have template dropdown and button visually overlapping', () => {
    render(
      <TestWrapper>
        <CourseSeedInput {...mockProps} />
      </TestWrapper>
    );
    
    const templateSelect = screen.getByTestId('template-select');
    const addTopicsButton = screen.getByTestId('add-template-topics');
    
    const selectRect = templateSelect.getBoundingClientRect();
    const buttonRect = addTopicsButton.getBoundingClientRect();
    
    // Elements should not overlap - button should be completely below select
    expect(buttonRect.top).toBeGreaterThanOrEqual(selectRect.bottom);
  });
});