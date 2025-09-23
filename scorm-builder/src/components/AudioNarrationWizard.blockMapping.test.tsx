import { describe, it, expect } from 'vitest';

// Helper function to calculate block number from media ID (extracted from AudioNarrationWizard logic)
function getBlockNumberFromMediaId(mediaId: string): string | null {
  const match = mediaId.match(/^(audio|caption)-(\d+)$/i);
  if (!match) return null;
  const n = parseInt(match[2], 10);
  if (!Number.isFinite(n)) return null;
  // 0 -> 0001 (welcome), 1 -> 0002 (objectives), 2 -> 0003 (topic-0), etc.
  return String(n + 1).padStart(4, '0');
}

// Helper function to check if media belongs to objectives
function isObjectivesMedia(mediaId: string, courseContent: any): boolean {
  if (!courseContent || !('learningObjectives' in courseContent)) {
    return false;
  }

  const objectivesAudio = courseContent.learningObjectives?.audioId;
  const objectivesCaption = courseContent.learningObjectives?.captionId;

  return mediaId === objectivesAudio || mediaId === objectivesCaption;
}

describe('AudioNarrationWizard Block Mapping Logic', () => {

  describe('Block Number Calculation', () => {
    it('should calculate correct block numbers from media IDs', () => {
      // Test audio IDs
      expect(getBlockNumberFromMediaId('audio-0')).toBe('0001');  // welcome
      expect(getBlockNumberFromMediaId('audio-1')).toBe('0002');  // objectives
      expect(getBlockNumberFromMediaId('audio-2')).toBe('0003');  // topic-0
      expect(getBlockNumberFromMediaId('audio-3')).toBe('0004');  // topic-1
      expect(getBlockNumberFromMediaId('audio-4')).toBe('0005');  // topic-2

      // Test caption IDs
      expect(getBlockNumberFromMediaId('caption-0')).toBe('0001');  // welcome
      expect(getBlockNumberFromMediaId('caption-1')).toBe('0002');  // objectives
      expect(getBlockNumberFromMediaId('caption-2')).toBe('0003');  // topic-0
      expect(getBlockNumberFromMediaId('caption-3')).toBe('0004');  // topic-1
      expect(getBlockNumberFromMediaId('caption-4')).toBe('0005');  // topic-2
    });

    it('should handle invalid media IDs', () => {
      expect(getBlockNumberFromMediaId('invalid')).toBe(null);
      expect(getBlockNumberFromMediaId('audio-invalid')).toBe(null);
      expect(getBlockNumberFromMediaId('caption-')).toBe(null);
      expect(getBlockNumberFromMediaId('')).toBe(null);
    });
  });

  describe('Objectives Media Detection', () => {
    it('should correctly identify objectives media', () => {
      const courseContent = {
        learningObjectives: {
          audioId: 'audio-1',
          captionId: 'caption-1'
        }
      };

      expect(isObjectivesMedia('audio-1', courseContent)).toBe(true);
      expect(isObjectivesMedia('caption-1', courseContent)).toBe(true);
      expect(isObjectivesMedia('audio-0', courseContent)).toBe(false);
      expect(isObjectivesMedia('caption-0', courseContent)).toBe(false);
      expect(isObjectivesMedia('audio-2', courseContent)).toBe(false);
    });

    it('should handle missing objectives data', () => {
      expect(isObjectivesMedia('audio-1', {})).toBe(false);
      expect(isObjectivesMedia('audio-1', null)).toBe(false);
      expect(isObjectivesMedia('audio-1', undefined)).toBe(false);
    });
  });

  describe('Mismatch Detection Logic', () => {
    it('should detect when block assignment does not match media ID', () => {
      // These are examples of mismatches that should be detected
      const testCases = [
        { mediaId: 'audio-2', assignedBlock: '0004', expectedBlock: '0003' },
        { mediaId: 'caption-1', assignedBlock: '0003', expectedBlock: '0002' },
        { mediaId: 'audio-0', assignedBlock: '0002', expectedBlock: '0001' },
      ];

      testCases.forEach(({ mediaId, assignedBlock, expectedBlock }) => {
        const calculatedBlock = getBlockNumberFromMediaId(mediaId);
        expect(calculatedBlock).toBe(expectedBlock);
        expect(calculatedBlock).not.toBe(assignedBlock);
      });
    });

    it('should verify correct assignments have no mismatches', () => {
      // These should all be correct
      const testCases = [
        { mediaId: 'audio-0', assignedBlock: '0001' },
        { mediaId: 'audio-1', assignedBlock: '0002' },
        { mediaId: 'audio-2', assignedBlock: '0003' },
        { mediaId: 'caption-0', assignedBlock: '0001' },
        { mediaId: 'caption-1', assignedBlock: '0002' },
        { mediaId: 'caption-2', assignedBlock: '0003' },
      ];

      testCases.forEach(({ mediaId, assignedBlock }) => {
        const calculatedBlock = getBlockNumberFromMediaId(mediaId);
        expect(calculatedBlock).toBe(assignedBlock);
      });
    });
  });
});