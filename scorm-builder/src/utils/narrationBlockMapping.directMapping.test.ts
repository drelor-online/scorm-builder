import { describe, it, expect } from 'vitest';
import {
  blockFromMediaId,
  blockFromPageId,
  blockFromMedia,
  validateMediaAlignment,
  detectSystematicDrift,
  repairMediaAlignment
} from './narrationBlockMapping';

describe('Narration Block Mapping - Direct Media ID Mapping', () => {
  describe('blockFromMediaId', () => {
    it('should correctly map audio IDs to block numbers', () => {
      // Core mapping: audio-N should map to block (N+1) with 4-digit padding
      expect(blockFromMediaId('audio-0')).toBe('0001'); // Welcome
      expect(blockFromMediaId('audio-1')).toBe('0002'); // Objectives
      expect(blockFromMediaId('audio-2')).toBe('0003'); // Topic 0
      expect(blockFromMediaId('audio-3')).toBe('0004'); // Topic 1
      expect(blockFromMediaId('audio-10')).toBe('0011'); // Topic 8
    });

    it('should correctly map caption IDs to block numbers', () => {
      // Same mapping for captions
      expect(blockFromMediaId('caption-0')).toBe('0001'); // Welcome
      expect(blockFromMediaId('caption-1')).toBe('0002'); // Objectives
      expect(blockFromMediaId('caption-2')).toBe('0003'); // Topic 0
      expect(blockFromMediaId('caption-3')).toBe('0004'); // Topic 1
    });

    it('should return null for invalid media IDs', () => {
      expect(blockFromMediaId('invalid-id')).toBe(null);
      expect(blockFromMediaId('audio-abc')).toBe(null);
      expect(blockFromMediaId('audio-')).toBe(null);
      expect(blockFromMediaId('')).toBe(null);
    });
  });

  describe('blockFromMedia with corrupted pageId', () => {
    it('should use media ID calculation when pageId is wrong', () => {
      // Simulate the bug: audio-1 has wrong pageId 'topic-0' instead of 'objectives'
      const mediaWithWrongPageId = {
        id: 'audio-1',
        pageId: 'topic-0', // WRONG! Should be objectives
        metadata: { pageId: 'topic-0' }
      };

      // Should fall back to media ID calculation
      const blockNumber = blockFromMedia(mediaWithWrongPageId);
      expect(blockNumber).toBe('0002'); // audio-1 → block 0002 (objectives)
    });

    it('should use media ID calculation when pageId is completely invalid', () => {
      const mediaWithInvalidPageId = {
        id: 'audio-2',
        pageId: 'totally-wrong-page', // WRONG!
        metadata: { pageId: 'totally-wrong-page' }
      };

      // Should fall back to media ID calculation
      const blockNumber = blockFromMedia(mediaWithInvalidPageId);
      expect(blockNumber).toBe('0003'); // audio-2 → block 0003 (topic-0)
    });

    it('should prefer valid pageId over media ID when pageId is correct', () => {
      const mediaWithCorrectPageId = {
        id: 'audio-2',
        pageId: 'topic-0', // CORRECT!
        metadata: { pageId: 'topic-0' }
      };

      // Should use pageId calculation
      const blockNumber = blockFromMedia(mediaWithCorrectPageId);
      expect(blockNumber).toBe('0003'); // topic-0 → block 0003
    });
  });

  describe('systematic drift detection and repair', () => {
    it('should detect systematic +1 drift pattern', () => {
      const mismatches = [
        { assignedBlock: '0004', expectedBlock: '0003' }, // +1 drift
        { assignedBlock: '0005', expectedBlock: '0004' }, // +1 drift
        { assignedBlock: '0006', expectedBlock: '0005' }, // +1 drift
      ];

      expect(detectSystematicDrift(mismatches)).toBe(true);
    });

    it('should not detect drift when pattern is inconsistent', () => {
      const mismatches = [
        { assignedBlock: '0004', expectedBlock: '0003' }, // +1
        { assignedBlock: '0006', expectedBlock: '0004' }, // +2
        { assignedBlock: '0007', expectedBlock: '0005' }, // +2
      ];

      expect(detectSystematicDrift(mismatches)).toBe(false);
    });

    it('should repair media alignment by moving items to correct blocks', () => {
      // Mock course content with wrong media assignments
      const courseContent = {
        topics: [
          {
            media: [
              { id: 'audio-3', type: 'audio', storageId: 'audio-3' } // WRONG! Should be audio-2
            ]
          },
          {
            media: [
              { id: 'audio-4', type: 'audio', storageId: 'audio-4' } // WRONG! Should be audio-3
            ]
          }
        ]
      };

      // Mock available media (what actually exists in storage)
      const allMedia = new Map([
        ['audio-2', { id: 'audio-2', type: 'audio' }], // Correct for topic-0
        ['audio-3', { id: 'audio-3', type: 'audio' }]  // Correct for topic-1
      ]);

      const repairsCount = repairMediaAlignment(courseContent, allMedia);

      expect(repairsCount).toBe(2); // Should repair both topics
      expect(courseContent.topics[0].media[0].id).toBe('audio-2'); // Fixed to correct audio
      expect(courseContent.topics[1].media[0].id).toBe('audio-3'); // Fixed to correct audio
    });
  });

  describe('real-world bug reproduction', () => {
    it('should reproduce the exact bug: block 0003 getting audio-3 instead of audio-2', () => {
      // The user's exact complaint: "Block 0003 should be playing audio-2 but was still playing audio-3"

      // Step 1: Verify correct mapping calculation
      expect(blockFromMediaId('audio-2')).toBe('0003'); // This is correct
      expect(blockFromMediaId('audio-3')).toBe('0004'); // This should NOT be for block 0003

      // Step 2: Simulate corrupted media with wrong pageId
      const corruptedMedia = [
        { id: 'audio-2', pageId: 'topic-1', metadata: { pageId: 'topic-1' } }, // WRONG! Should be topic-0
        { id: 'audio-3', pageId: 'topic-0', metadata: { pageId: 'topic-0' } }  // WRONG! Should be topic-1
      ];

      // Step 3: Verify that blockFromMedia correctly handles this corruption
      expect(blockFromMedia(corruptedMedia[0])).toBe('0003'); // audio-2 → block 0003 (ignoring wrong pageId)
      expect(blockFromMedia(corruptedMedia[1])).toBe('0004'); // audio-3 → block 0004 (ignoring wrong pageId)

      // Step 4: Validate that the misalignment would be detected
      const mediaWithWrongBlocks = [
        { id: 'audio-2', blockNumber: '0004', mediaId: 'audio-2' }, // WRONG assignment
        { id: 'audio-3', blockNumber: '0003', mediaId: 'audio-3' }  // WRONG assignment
      ];

      const mismatches = validateMediaAlignment(mediaWithWrongBlocks);
      expect(mismatches).toHaveLength(2);
      expect(mismatches[0]).toEqual({
        mediaId: 'audio-2',
        assignedBlock: '0004',
        expectedBlock: '0003',
        severity: 'error'
      });
      expect(mismatches[1]).toEqual({
        mediaId: 'audio-3',
        assignedBlock: '0003',
        expectedBlock: '0004',
        severity: 'error'
      });
    });
  });
});