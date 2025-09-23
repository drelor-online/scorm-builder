import { describe, it, expect } from 'vitest';
import {
  blockFromMediaId,
  blockFromPageId,
  blockFromMedia,
  validateMediaAlignment,
  detectSystematicDrift,
  repairMediaAlignment,
  expectedMediaIdForBlock,
  topicIndexFromBlock,
  createBlockMediaMapping,
  mergeFallbackMedia
} from './narrationBlockMapping';

describe('narrationBlockMapping', () => {
  describe('blockFromMediaId', () => {
    it('should map media IDs to correct block numbers', () => {
      // Welcome page
      expect(blockFromMediaId('audio-0')).toBe('0001');
      expect(blockFromMediaId('caption-0')).toBe('0001');

      // Learning objectives
      expect(blockFromMediaId('audio-1')).toBe('0002');
      expect(blockFromMediaId('caption-1')).toBe('0002');

      // Topics
      expect(blockFromMediaId('audio-2')).toBe('0003'); // topic-0
      expect(blockFromMediaId('caption-2')).toBe('0003');
      expect(blockFromMediaId('audio-3')).toBe('0004'); // topic-1
      expect(blockFromMediaId('caption-3')).toBe('0004');
      expect(blockFromMediaId('audio-10')).toBe('0011'); // topic-8
    });

    it('should handle invalid media IDs', () => {
      expect(blockFromMediaId('invalid')).toBe(null);
      expect(blockFromMediaId('audio-invalid')).toBe(null);
      expect(blockFromMediaId('audio-')).toBe(null);
      expect(blockFromMediaId('')).toBe(null);
      expect(blockFromMediaId('video-1')).toBe(null);
    });

    it('should be case insensitive', () => {
      expect(blockFromMediaId('AUDIO-1')).toBe('0002');
      expect(blockFromMediaId('Caption-2')).toBe('0003');
    });
  });

  describe('blockFromPageId', () => {
    it('should map page IDs to correct block numbers', () => {
      expect(blockFromPageId('welcome')).toBe('0001');
      expect(blockFromPageId('objectives')).toBe('0002');
      expect(blockFromPageId('learningObjectives')).toBe('0002');
      expect(blockFromPageId('learning-objectives')).toBe('0002');
      expect(blockFromPageId('topic-0')).toBe('0003');
      expect(blockFromPageId('topic-1')).toBe('0004');
      expect(blockFromPageId('topic-8')).toBe('0011');
    });

    it('should handle invalid page IDs', () => {
      expect(blockFromPageId('invalid')).toBe(null);
      expect(blockFromPageId('topic-invalid')).toBe(null);
      expect(blockFromPageId('topic-')).toBe(null);
      expect(blockFromPageId('')).toBe(null);
    });

    it('should be case insensitive for topics', () => {
      expect(blockFromPageId('TOPIC-1')).toBe('0004');
      expect(blockFromPageId('Topic-2')).toBe('0005');
    });
  });

  describe('blockFromMedia', () => {
    it('should prefer media ID over pageId (fix for audio mapping bug)', () => {
      const media = {
        id: 'audio-5', // Should map to block 0006 (media ID wins)
        pageId: 'topic-0' // Would map to block 0003, but ignored
      };
      expect(blockFromMedia(media)).toBe('0006'); // Media ID takes precedence
    });

    it('should use media ID even when pageId is present', () => {
      const media = {
        id: 'audio-2', // Should map to block 0003 (media ID wins)
        pageId: 'invalid-page' // Invalid pageId, but doesn't matter
      };
      expect(blockFromMedia(media)).toBe('0003');
    });

    it('should use media ID over metadata pageId', () => {
      const media = {
        id: 'audio-5', // Should map to block 0006 (media ID wins)
        metadata: { pageId: 'topic-1' } // Would map to block 0004, but ignored
      };
      expect(blockFromMedia(media)).toBe('0006');
    });

    it('should use media ID over both direct and metadata pageId', () => {
      const media = {
        id: 'audio-5', // Should map to block 0006 (media ID wins)
        pageId: 'topic-0', // Would map to block 0003, but ignored
        metadata: { pageId: 'topic-1' } // Would map to block 0004, but ignored
      };
      expect(blockFromMedia(media)).toBe('0006');
    });

    it('should fallback to pageId only when media ID is invalid', () => {
      const media = {
        id: 'invalid-media-id', // Invalid, so fallback to pageId
        pageId: 'topic-0' // Should map to block 0003
      };
      expect(blockFromMedia(media)).toBe('0003');
    });
  });

  describe('validateMediaAlignment', () => {
    it('should detect misaligned media', () => {
      const media = [
        { id: 'audio-2', blockNumber: '0004', mediaId: 'audio-2' }, // Should be 0003
        { id: 'caption-1', blockNumber: '0003', mediaId: 'caption-1' }, // Should be 0002
        { id: 'audio-0', blockNumber: '0001', mediaId: 'audio-0' } // Correct
      ];

      const mismatches = validateMediaAlignment(media);
      expect(mismatches).toHaveLength(2);
      expect(mismatches[0]).toEqual({
        mediaId: 'audio-2',
        assignedBlock: '0004',
        expectedBlock: '0003',
        severity: 'error'
      });
      expect(mismatches[1]).toEqual({
        mediaId: 'caption-1',
        assignedBlock: '0003',
        expectedBlock: '0002',
        severity: 'error'
      });
    });

    it('should return empty array for correctly aligned media', () => {
      const media = [
        { id: 'audio-0', blockNumber: '0001', mediaId: 'audio-0' },
        { id: 'caption-1', blockNumber: '0002', mediaId: 'caption-1' },
        { id: 'audio-2', blockNumber: '0003', mediaId: 'audio-2' }
      ];

      const mismatches = validateMediaAlignment(media);
      expect(mismatches).toHaveLength(0);
    });
  });

  describe('detectSystematicDrift', () => {
    it('should detect +1 systematic drift', () => {
      const mismatches = [
        { assignedBlock: '0004', expectedBlock: '0003' },
        { assignedBlock: '0005', expectedBlock: '0004' },
        { assignedBlock: '0006', expectedBlock: '0005' }
      ];

      expect(detectSystematicDrift(mismatches)).toBe(true);
    });

    it('should not detect drift for random mismatches', () => {
      const mismatches = [
        { assignedBlock: '0004', expectedBlock: '0003' },
        { assignedBlock: '0007', expectedBlock: '0004' }, // Not +1
        { assignedBlock: '0006', expectedBlock: '0005' }
      ];

      expect(detectSystematicDrift(mismatches)).toBe(false);
    });

    it('should handle empty mismatches', () => {
      expect(detectSystematicDrift([])).toBe(false);
    });

    it('should handle single mismatch', () => {
      const mismatches = [{ assignedBlock: '0004', expectedBlock: '0003' }];
      expect(detectSystematicDrift(mismatches)).toBe(false);
    });
  });

  describe('repairMediaAlignment', () => {
    it('should repair topic media alignment', () => {
      const courseContent = {
        topics: [
          {
            id: 'topic-0',
            media: [
              { id: 'audio-3', type: 'audio' }, // Wrong - should be audio-2
              { id: 'caption-3', type: 'caption' } // Wrong - should be caption-2
            ]
          },
          {
            id: 'topic-1',
            media: [] // Missing media
          }
        ]
      };

      const allMedia = new Map([
        ['audio-2', { id: 'audio-2', type: 'audio' }],
        ['caption-2', { id: 'caption-2', type: 'caption' }],
        ['audio-3', { id: 'audio-3', type: 'audio' }],
        ['caption-3', { id: 'caption-3', type: 'caption' }]
      ]);

      const repairs = repairMediaAlignment(courseContent, allMedia);

      expect(repairs).toBe(4); // 2 corrections + 2 additions
      expect(courseContent.topics[0].media[0].id).toBe('audio-2');
      expect(courseContent.topics[0].media[1].id).toBe('caption-2');
      expect(courseContent.topics[1].media).toHaveLength(2);
      expect(courseContent.topics[1].media[0].id).toBe('audio-3');
      expect(courseContent.topics[1].media[1].id).toBe('caption-3');
    });

    it('should not repair when correct media is not available', () => {
      const courseContent = {
        topics: [{ id: 'topic-0', media: [] }]
      };

      const allMedia = new Map([
        ['audio-5', { id: 'audio-5', type: 'audio' }] // Not the expected audio-2
      ]);

      const repairs = repairMediaAlignment(courseContent, allMedia);
      expect(repairs).toBe(0);
      expect(courseContent.topics[0].media).toHaveLength(0);
    });
  });

  describe('expectedMediaIdForBlock', () => {
    it('should calculate expected media ID for block', () => {
      expect(expectedMediaIdForBlock('audio-5', '0003')).toBe('audio-2');
      expect(expectedMediaIdForBlock('caption-10', '0004')).toBe('caption-3');
      expect(expectedMediaIdForBlock('audio-0', '0001')).toBe('audio-0');
    });

    it('should handle invalid inputs', () => {
      expect(expectedMediaIdForBlock('invalid', '0003')).toBe(null);
      expect(expectedMediaIdForBlock('audio-2', 'invalid')).toBe(null);
    });
  });

  describe('topicIndexFromBlock', () => {
    it('should map block numbers to topic indices', () => {
      expect(topicIndexFromBlock('0003')).toBe(0); // topic-0
      expect(topicIndexFromBlock('0004')).toBe(1); // topic-1
      expect(topicIndexFromBlock('0011')).toBe(8); // topic-8
    });

    it('should return null for non-topic blocks', () => {
      expect(topicIndexFromBlock('0001')).toBe(null); // welcome
      expect(topicIndexFromBlock('0002')).toBe(null); // objectives
      expect(topicIndexFromBlock('invalid')).toBe(null);
    });
  });

  describe('createBlockMediaMapping', () => {
    it('should create correct mapping preferring media ID', () => {
      const media = [
        { id: 'audio-5', pageId: 'topic-0' }, // Should map to 0006 via media ID (pageId ignored)
        { id: 'audio-1', pageId: 'invalid' }, // Should map to 0002 via media ID
        { id: 'audio-0' } // Should map to 0001 via media ID
      ];

      const mapping = createBlockMediaMapping(media, true);

      expect(mapping.get('0006')).toEqual(media[0]); // audio-5 → block 0006
      expect(mapping.get('0002')).toEqual(media[1]); // audio-1 → block 0002
      expect(mapping.get('0001')).toEqual(media[2]); // audio-0 → block 0001
    });

    it('should handle conflicts by keeping first entry', () => {
      const media = [
        { id: 'audio-0', pageId: 'welcome' }, // Maps to 0001 via media ID
        { id: 'audio-1', pageId: 'welcome' } // Maps to 0002 via media ID (no conflict)
      ];

      const mapping = createBlockMediaMapping(media, true);

      expect(mapping.get('0001')).toEqual(media[0]); // audio-0 → block 0001
      expect(mapping.get('0002')).toEqual(media[1]); // audio-1 → block 0002
      expect(mapping.size).toBe(2); // Both are mapped since no conflict
    });
  });

  describe('mergeFallbackMedia', () => {
    it('should add fallback media to empty blocks', () => {
      const existing = new Map([
        ['0001', { id: 'audio-0', pageId: 'welcome' }]
      ]);

      const fallback = [
        { id: 'audio-1', pageId: 'objectives' },
        { id: 'audio-0', pageId: 'welcome' }, // Should not overwrite
        { id: 'audio-2', pageId: 'topic-0' }
      ];

      const added = mergeFallbackMedia(existing, fallback);

      expect(added).toBe(2); // audio-1 and audio-2 added
      expect(existing.size).toBe(3);
      expect(existing.get('0002')?.id).toBe('audio-1');
      expect(existing.get('0003')?.id).toBe('audio-2');
      expect(existing.get('0001')?.id).toBe('audio-0'); // Original preserved
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical import duplication scenario', () => {
      // Simulate the exact issue from user logs
      const courseContent = {
        topics: [
          {
            id: 'topic-0',
            media: [
              { id: 'caption-2', type: 'caption' } // Correct
            ]
          },
          {
            id: 'topic-1',
            media: [
              { id: 'caption-2', type: 'caption' } // Wrong - duplicated from topic-0
            ]
          }
        ]
      };

      // Validate the issue
      const allFiles = [
        { id: 'caption-2', blockNumber: '0003', mediaId: 'caption-2' }, // topic-0 (correct)
        { id: 'caption-2', blockNumber: '0004', mediaId: 'caption-2' }  // topic-1 (wrong)
      ];

      const mismatches = validateMediaAlignment(allFiles);
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0].mediaId).toBe('caption-2');
      expect(mismatches[0].assignedBlock).toBe('0004');
      expect(mismatches[0].expectedBlock).toBe('0003');

      // Repair it
      const allMedia = new Map([
        ['caption-2', { id: 'caption-2', type: 'caption' }],
        ['caption-3', { id: 'caption-3', type: 'caption' }]
      ]);

      const repairs = repairMediaAlignment(courseContent, allMedia);
      expect(repairs).toBe(1); // Fixed topic-1 to have caption-3
      expect(courseContent.topics[1].media[0].id).toBe('caption-3');
    });
  });
});