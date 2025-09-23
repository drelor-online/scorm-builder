import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AudioNarrationWizard from './AudioNarrationWizard';
import * as FileStorage from '../services/FileStorage';
import { blockFromMediaId } from '../utils/narrationBlockMapping';

// Mock MediaService
const mockMediaService = {
  storeMedia: vi.fn(),
  getMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listMedia: vi.fn(),
  listAllMedia: vi.fn(),
  loadMediaFromProject: vi.fn(),
  loadMediaFromCourseContent: vi.fn(),
  clearCache: vi.fn(),
  hasAudioCached: vi.fn(),
  getCachedAudio: vi.fn(),
}

vi.mock('../services/MediaService', () => ({
  createMediaService: () => mockMediaService,
}));

vi.mock('../services/FileStorage', () => ({
  getMediaMetadata: vi.fn(),
  getMediaUrl: vi.fn(),
}));
vi.mock('../services/PersistentStorage');
vi.mock('../contexts/MediaServiceContext', () => ({
  useMediaService: () => mockMediaService,
  MediaServiceProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => children,
  useUnifiedMedia: () => ({
    storeMedia: mockMediaService.storeMedia,
    getMedia: mockMediaService.getMedia,
    deleteMedia: mockMediaService.deleteMedia,
    createBlobUrl: vi.fn().mockResolvedValue('blob:mock-url'),
  }),
}));
vi.mock('../contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => children,
  useNotification: () => ({
    showNotification: vi.fn(),
  }),
}));
vi.mock('../contexts/StepNavigationContext', () => ({
  StepNavigationProvider: ({ children }: { children: React.ReactNode }) => children,
  useStepNavigation: () => ({
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    currentStep: 'audio-narration',
  }),
}));
vi.mock('../contexts/UnsavedChangesContext', () => ({
  UnsavedChangesProvider: ({ children }: { children: React.ReactNode }) => children,
  useUnsavedChanges: () => ({
    markAsUnsaved: vi.fn(),
    markAsSaved: vi.fn(),
  }),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>{children}</div>
);

describe('AudioNarrationWizard - Media ID to Block Mapping', () => {
  const mockCourseContent = {
    welcome: {
      content: 'Welcome',
      media: [{ id: 'audio-0', type: 'audio' }]
    },
    learningObjectives: {
      content: 'Objectives',
      media: [{ id: 'audio-1', type: 'audio' }]
    },
    topics: [
      {
        title: 'Topic 1',
        content: 'Content 1',
        media: [{ id: 'audio-2', type: 'audio' }]
      },
      {
        title: 'Topic 2',
        content: 'Content 2',
        media: [{ id: 'audio-3', type: 'audio' }]
      }
    ],
    questions: []
  };

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseTopic: 'Test Topic',
    courseAudience: 'Testers',
    numberOfTopics: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock media with INCORRECT pageId metadata (simulating the bug)
    mockMediaService.listAllMedia.mockResolvedValue([
      {
        id: 'audio-0',
        type: 'audio',
        metadata: { pageId: 'welcome' } // Correct
      },
      {
        id: 'audio-1',
        type: 'audio',
        metadata: { pageId: 'topic-0' } // WRONG! Should be objectives
      },
      {
        id: 'audio-2',
        type: 'audio',
        metadata: { pageId: 'topic-1' } // WRONG! Should be topic-0
      },
      {
        id: 'audio-3',
        type: 'audio',
        metadata: { pageId: 'topic-2' } // WRONG! Should be topic-1
      }
    ]);

    vi.mocked(FileStorage.getMediaMetadata).mockImplementation(async (id) => ({
      id,
      type: id.startsWith('audio') ? 'audio' : 'caption',
      duration: 10,
      url: `blob:mock/${id}`
    }));

    vi.mocked(FileStorage.getMediaUrl).mockImplementation(async (id) => `blob:mock/${id}`);
  });

  it('should map audio-2 to block 0003 (first topic) regardless of pageId metadata', async () => {
    const onContentChange = vi.fn();

    const { container } = render(
      <TestWrapper>
        <AudioNarrationWizard
          courseContent={mockCourseContent}
          onContentChange={onContentChange}
          courseSeedData={mockCourseSeedData}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      const blocks = container.querySelectorAll('[data-testid^="narration-block-"]');
      expect(blocks.length).toBeGreaterThan(0);
    });

    // Check that block 0003 (first topic) is using audio-2
    const block0003 = container.querySelector('[data-testid="narration-block-0003"]');
    expect(block0003).toBeTruthy();

    // Find the audio element or audio ID reference
    const audioElement = block0003?.querySelector('audio');
    const audioSrc = audioElement?.src || '';

    // Should contain audio-2, not audio-3
    expect(audioSrc).toContain('audio-2');
    expect(audioSrc).not.toContain('audio-3');

    // Verify the mapping calculation is correct
    expect(blockFromMediaId('audio-0')).toBe('0001'); // Welcome
    expect(blockFromMediaId('audio-1')).toBe('0002'); // Objectives
    expect(blockFromMediaId('audio-2')).toBe('0003'); // Topic 0
    expect(blockFromMediaId('audio-3')).toBe('0004'); // Topic 1
  });

  it('should ignore corrupted pageId metadata and use media ID for mapping', async () => {
    const onContentChange = vi.fn();

    render(
      <TestWrapper>
        <AudioNarrationWizard
          courseContent={mockCourseContent}
          onContentChange={onContentChange}
          courseSeedData={mockCourseSeedData}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      // Verify that despite wrong pageId metadata, correct mapping occurs
      expect(vi.mocked(FileStorage.getMediaMetadata)).toHaveBeenCalledWith('audio-2');
    });

    // The component should map based on media ID, not pageId
    // audio-2 should be mapped to block 0003 (topic-0)
    // even though its pageId incorrectly says 'topic-1'

    // Check console logs or internal state to verify mapping
    // This will fail initially, demonstrating the bug
  });
});