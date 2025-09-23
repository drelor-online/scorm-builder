/**
 * @fileoverview Test for AudioNarrationWizard's import correction behavior
 *
 * This test validates that when importing a project with incorrect media assignments,
 * the AudioNarrationWizard corrects them instead of maintaining the wrong mappings.
 *
 * Reproduces the issue: "the second topic is getting copied to the first topic audio/caption"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '../test/testProviders';
import React from 'react';
import { AudioNarrationWizard } from './AudioNarrationWizard';
import { createMediaService } from '../services/MediaService';
import { MockFileStorage } from '../services/MockFileStorage';

// Mock the dependencies
vi.mock('../context/AudioContext', () => ({
  useAudio: () => ({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn()
  })
}));

vi.mock('../hooks/useStepData', () => ({
  useStepData: () => ({
    stepData: null,
    setStepData: vi.fn(),
    clearStepData: vi.fn()
  })
}));

describe('AudioNarrationWizard Import Correction Behavior', () => {
  let mockFileStorage: MockFileStorage;
  let mediaService: any;
  let mockCourseContent: any;

  beforeEach(async () => {
    mockFileStorage = new MockFileStorage();
    await mockFileStorage.createProject('Test Project');
    const projectId = mockFileStorage.getCurrentProjectId()!;
    mediaService = createMediaService(projectId, mockFileStorage);

    // Create course content with 2 topics
    mockCourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        narration: 'Welcome narration text',
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        narration: 'Objectives narration text',
        media: []
      },
      topics: [
        {
          id: 'topic-0',
          title: 'First Topic',
          narration: 'First topic narration text',
          media: []
        },
        {
          id: 'topic-1',
          title: 'Second Topic',
          narration: 'Second topic narration text',
          media: []
        }
      ]
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should correct incorrect audio assignments during import', async () => {
    // Arrange: Set up incorrect media assignments (simulating old export)
    // audio-1 should be for objectives but is incorrectly assigned to topic-0
    // audio-2 should be for topic-0 but is incorrectly assigned to topic-1

    // Set up course content with incorrect media assignments (simulating imported project)
    const courseContentWithWrongAssignments = {
      ...mockCourseContent,
      learningObjectivesPage: {
        ...mockCourseContent.learningObjectivesPage,
        media: [
          { id: 'audio-1', type: 'audio', storageId: 'audio-1' } // This should stay with objectives
        ]
      },
      topics: [
        {
          ...mockCourseContent.topics[0],
          media: [
            { id: 'audio-1', type: 'audio', storageId: 'audio-1' } // WRONG! Should be audio-2
          ]
        },
        {
          ...mockCourseContent.topics[1],
          media: [
            { id: 'audio-2', type: 'audio', storageId: 'audio-2' } // WRONG! Should be audio-3 (or none)
          ]
        }
      ]
    };

    // Store media with INCORRECT page_id assignments
    await mockFileStorage.storeMedia('audio-1', new Blob(['objectives audio']), 'audio', {
      page_id: 'topic-0', // WRONG! Should be 'objectives'
      original_name: 'objectives.mp3',
      mime_type: 'audio/mp3'
    });

    await mockFileStorage.storeMedia('audio-2', new Blob(['topic-0 audio']), 'audio', {
      page_id: 'topic-1', // WRONG! Should be 'topic-0'
      original_name: 'topic-0.mp3',
      mime_type: 'audio/mp3'
    });

    // Store the course content with media assignments
    await mockFileStorage.saveContent('metadata', courseContentWithWrongAssignments);

    const mockOnSave = vi.fn();
    const mockOnUpdateContent = vi.fn();

    // Act: Render AudioNarrationWizard which should detect and correct the misalignments
    render(
      <AudioNarrationWizard
          courseContent={courseContentWithWrongAssignments}
          onSave={mockOnSave}
          onUpdateContent={mockOnUpdateContent}
          currentStep={4}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onNavigate={vi.fn()}
          narrationBlocks={[
            { blockNumber: '0001', text: 'Welcome narration text', pageId: 'welcome' },
            { blockNumber: '0002', text: 'Objectives narration text', pageId: 'objectives' },
            { blockNumber: '0003', text: 'First topic narration text', pageId: 'topic-0' },
            { blockNumber: '0004', text: 'Second topic narration text', pageId: 'topic-1' }
          ]}
        />
    );

    // Assert: Wait for the component to load and process the misalignments
    await waitFor(() => {
      // The component should detect mismatches and trigger corrections
      expect(mockOnSave).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Verify that corrections were made to the course content
    const savedContent = mockOnSave.mock.calls[0][0];

    // Objectives should keep audio-1 (this is correct)
    expect(savedContent.learningObjectivesPage.media).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'audio-1', type: 'audio' })
      ])
    );

    // First topic should get audio-2 (corrected from wrong audio-1)
    expect(savedContent.topics[0].media).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'audio-2', type: 'audio' })
      ])
    );

    // Second topic should not have audio-2 anymore (it belongs to first topic)
    const secondTopicAudio = savedContent.topics[1].media?.find((m: any) => m.type === 'audio');
    expect(secondTopicAudio?.id).not.toBe('audio-2');
  });

  it('should correct incorrect caption assignments during import', async () => {
    // Arrange: Set up incorrect caption assignments
    await mockFileStorage.storeMedia('caption-1', new Blob(['WEBVTT\n\nObjectives caption']), 'caption', {
      page_id: 'topic-0', // WRONG! Should be 'objectives'
      original_name: 'objectives.vtt',
      mime_type: 'text/vtt'
    });

    await mockFileStorage.storeMedia('caption-2', new Blob(['WEBVTT\n\nTopic 0 caption']), 'caption', {
      page_id: 'topic-1', // WRONG! Should be 'topic-0'
      original_name: 'topic-0.vtt',
      mime_type: 'text/vtt'
    });

    const courseContentWithWrongCaptions = {
      ...mockCourseContent,
      learningObjectivesPage: {
        ...mockCourseContent.learningObjectivesPage,
        media: [
          { id: 'caption-1', type: 'caption', storageId: 'caption-1' }
        ]
      },
      topics: [
        {
          ...mockCourseContent.topics[0],
          media: [
            { id: 'caption-1', type: 'caption', storageId: 'caption-1' } // WRONG! Should be caption-2
          ]
        },
        {
          ...mockCourseContent.topics[1],
          media: [
            { id: 'caption-2', type: 'caption', storageId: 'caption-2' } // WRONG!
          ]
        }
      ]
    };

    const mockOnSave = vi.fn();

    // Act: Render component which should correct caption misalignments
    render(
      <AudioNarrationWizard
          courseContent={courseContentWithWrongCaptions}
          onSave={mockOnSave}
          onUpdateContent={vi.fn()}
          currentStep={4}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onNavigate={vi.fn()}
          narrationBlocks={[
            { blockNumber: '0001', text: 'Welcome narration text', pageId: 'welcome' },
            { blockNumber: '0002', text: 'Objectives narration text', pageId: 'objectives' },
            { blockNumber: '0003', text: 'First topic narration text', pageId: 'topic-0' },
            { blockNumber: '0004', text: 'Second topic narration text', pageId: 'topic-1' }
          ]}
        />
    );

    // Assert: Verify caption corrections
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    }, { timeout: 5000 });

    const savedContent = mockOnSave.mock.calls[0][0];

    // Objectives should keep caption-1
    expect(savedContent.learningObjectivesPage.media).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'caption-1', type: 'caption' })
      ])
    );

    // First topic should get caption-2 (corrected)
    expect(savedContent.topics[0].media).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'caption-2', type: 'caption' })
      ])
    );
  });

  it('should log correction attempts when mismatches are detected', async () => {
    // Arrange: Set up scenario that will trigger mismatch detection
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await mockFileStorage.storeMedia('audio-1', new Blob(['audio content']), 'audio', {
      page_id: 'topic-0', // Wrong assignment
      original_name: 'test.mp3'
    });

    // Act: Render component
    render(
      <AudioNarrationWizard
          courseContent={mockCourseContent}
          onSave={vi.fn()}
          onUpdateContent={vi.fn()}
          currentStep={4}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onNavigate={vi.fn()}
          narrationBlocks={[
            { blockNumber: '0001', text: 'Welcome', pageId: 'welcome' },
            { blockNumber: '0002', text: 'Objectives', pageId: 'objectives' },
            { blockNumber: '0003', text: 'Topic 0', pageId: 'topic-0' },
            { blockNumber: '0004', text: 'Topic 1', pageId: 'topic-1' }
          ]}
        />
    );

    // Assert: Should log mismatch detection and correction attempts
    await waitFor(() => {
      // Look for mismatch detection logs
      expect(consoleLogSpy.mock.calls.some(call =>
        call[0]?.includes?.('MISMATCH') || call[0]?.includes?.('DETECTED')
      )).toBe(true);
    }, { timeout: 5000 });

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});