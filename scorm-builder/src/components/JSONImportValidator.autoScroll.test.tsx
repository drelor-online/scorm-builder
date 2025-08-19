import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { JSONImportValidator } from './JSONImportValidator';
import { NotificationProvider } from '../contexts/NotificationContext';
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext';
import { StepNavigationProvider } from '../contexts/StepNavigationContext';
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext';

// Mock media context
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

// Mock other dependencies
vi.mock('../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn()
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <PersistentStorageProvider storage={mockStorage as any}>
      <StepNavigationProvider>
        <UnsavedChangesProvider>
          {children}
        </UnsavedChangesProvider>
      </StepNavigationProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
);

describe('JSONImportValidator Auto-Scroll Fix (Already Implemented)', () => {
  const mockProps = {
    jsonInput: JSON.stringify({
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content'
      },
      learningObjectives: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Objectives content'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic 1 content'
        }
      ]
    }, null, 2),
    onValidationResult: vi.fn(),
    onNext: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock scroll behavior
    Element.prototype.scrollIntoView = vi.fn();
    window.scrollTo = vi.fn();
  });

  it('should not auto-scroll when tree nodes are expanded', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator {...mockProps} />
      </TestWrapper>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument();
    });

    // Click to expand a tree node
    const welcomeNode = screen.getByTestId('json-tree-node-welcome');
    fireEvent.click(welcomeNode);

    // Verify scrollIntoView was not called for auto-scroll
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('should not auto-scroll when tree nodes are collapsed', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator {...mockProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument();
    });

    // First expand, then collapse a node
    const welcomeNode = screen.getByTestId('json-tree-node-welcome');
    fireEvent.click(welcomeNode); // expand
    
    // Clear previous calls
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    window.scrollTo = vi.fn();
    
    fireEvent.click(welcomeNode); // collapse

    // Verify no auto-scroll occurred during collapse
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('should preserve user scroll position during tree interactions', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator {...mockProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument();
    });

    // Simulate user scrolling
    const treeView = screen.getByTestId('json-tree-view');
    const initialScrollTop = 100;
    Object.defineProperty(treeView, 'scrollTop', {
      value: initialScrollTop,
      writable: true
    });

    // Interact with tree nodes
    const welcomeNode = screen.getByTestId('json-tree-node-welcome');
    fireEvent.click(welcomeNode);

    // Scroll position should be preserved (not reset by auto-scroll)
    expect(treeView.scrollTop).toBe(initialScrollTop);
  });

  it('should handle multiple rapid node expansions without scrolling', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator {...mockProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument();
    });

    // Rapidly expand multiple nodes
    const welcomeNode = screen.getByTestId('json-tree-node-welcome');
    const objectivesNode = screen.getByTestId('json-tree-node-objectives');
    
    fireEvent.click(welcomeNode);
    fireEvent.click(objectivesNode);
    fireEvent.click(welcomeNode); // collapse
    fireEvent.click(objectivesNode); // collapse

    // No auto-scroll should have occurred
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});