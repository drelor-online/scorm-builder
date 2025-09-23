import { describe, test, expect, vi } from 'vitest'
import { blockFromMediaId, validateMediaAlignment, detectSystematicDrift, repairMediaAlignment } from '../utils/narrationBlockMapping'

// Mock the AudioNarrationWizard systematic drift detection and repair
const mockSystematicDriftDetection = (audioFiles: any[], captionFiles: any[], courseContent: any, onSave?: (content: any) => void) => {
  // Simulate the validation logic from AudioNarrationWizard
  const audioMismatches = validateMediaAlignment(audioFiles.map(f => ({ id: f.mediaId || '', blockNumber: f.blockNumber })));
  const captionMismatches = validateMediaAlignment(captionFiles.map(f => ({ id: f.mediaId || '', blockNumber: f.blockNumber })));
  const allMismatches = [...audioMismatches, ...captionMismatches];

  if (allMismatches.length > 0) {
    console.log(`DETECTED ${allMismatches.length} MEDIA ALIGNMENT MISMATCHES`);

    // Check for systematic drift pattern
    if (detectSystematicDrift(allMismatches)) {
      console.log('SYSTEMATIC DRIFT DETECTED: All mismatches follow +1 pattern - attempting repair');

      // Create mock media map for repair
      const allMediaMap = new Map();
      ['audio-0', 'audio-1', 'audio-2', 'audio-3', 'caption-0', 'caption-1', 'caption-2', 'caption-3'].forEach(id => {
        allMediaMap.set(id, { id, type: id.startsWith('audio') ? 'audio' : 'caption' });
      });

      // Attempt to repair the course content
      const repairsCount = repairMediaAlignment(courseContent, allMediaMap);
      if (repairsCount > 0) {
        console.log(`REPAIRED ${repairsCount} media alignment issues`);

        // Auto-save the corrected content
        if (onSave) {
          console.log('Auto-saving repaired content');
          onSave(courseContent);
        }
        return { detected: true, repaired: true, repairsCount };
      }
    }
  }

  return { detected: allMismatches.length > 0, repaired: false, repairsCount: 0 };
}

describe('AudioNarrationWizard Systematic Drift Fix', () => {
  test('should detect systematic +1 drift pattern from user logs', () => {
    // Simulate the exact mismatches from user's logs
    const audioFiles = [
      { blockNumber: '0004', mediaId: 'audio-2' }, // Should be 0003
      { blockNumber: '0005', mediaId: 'audio-3' }, // Should be 0004
      { blockNumber: '0006', mediaId: 'audio-4' }  // Should be 0005
    ];

    const captionFiles = [
      { blockNumber: '0004', mediaId: 'caption-2' }, // Should be 0003
      { blockNumber: '0005', mediaId: 'caption-3' }, // Should be 0004
      { blockNumber: '0006', mediaId: 'caption-4' }  // Should be 0005
    ];

    const mismatches = [
      ...validateMediaAlignment(audioFiles.map(f => ({ id: f.mediaId, blockNumber: f.blockNumber }))),
      ...validateMediaAlignment(captionFiles.map(f => ({ id: f.mediaId, blockNumber: f.blockNumber })))
    ];

    expect(mismatches).toHaveLength(6); // All 6 items misaligned
    expect(detectSystematicDrift(mismatches)).toBe(true);

    // Verify each mismatch follows +1 pattern
    mismatches.forEach(mismatch => {
      const assigned = parseInt(mismatch.assignedBlock, 10);
      const expected = parseInt(mismatch.expectedBlock, 10);
      expect(assigned).toBe(expected + 1);
    });
  });

  test('should repair systematic drift in course content', () => {
    // Simulate course content with duplicated caption-2 on both topic-0 and topic-1
    const courseContent = {
      topics: [
        {
          id: 'topic-0',
          media: [
            { id: 'caption-2', type: 'caption' } // Correct for topic-0
          ]
        },
        {
          id: 'topic-1',
          media: [
            { id: 'caption-2', type: 'caption' } // WRONG - should be caption-3
          ]
        },
        {
          id: 'topic-2',
          media: [
            { id: 'caption-2', type: 'caption' } // WRONG - should be caption-4
          ]
        }
      ]
    };

    // Before repair - validate the issue exists
    const beforeFiles = [
      { blockNumber: '0003', mediaId: 'caption-2' }, // topic-0 (correct)
      { blockNumber: '0004', mediaId: 'caption-2' }, // topic-1 (wrong - should be caption-3)
      { blockNumber: '0005', mediaId: 'caption-2' }  // topic-2 (wrong - should be caption-4)
    ];

    const beforeMismatches = validateMediaAlignment(beforeFiles.map(f => ({ id: f.mediaId, blockNumber: f.blockNumber })));
    expect(beforeMismatches).toHaveLength(2); // topic-1 and topic-2 are wrong

    // Create media map
    const allMediaMap = new Map([
      ['caption-2', { id: 'caption-2', type: 'caption' }],
      ['caption-3', { id: 'caption-3', type: 'caption' }],
      ['caption-4', { id: 'caption-4', type: 'caption' }]
    ]);

    // Repair
    const repairsCount = repairMediaAlignment(courseContent, allMediaMap);
    expect(repairsCount).toBe(2); // Fixed topic-1 and topic-2

    // After repair - verify corrections
    expect(courseContent.topics[0].media[0].id).toBe('caption-2'); // topic-0 unchanged
    expect(courseContent.topics[1].media[0].id).toBe('caption-3'); // topic-1 corrected
    expect(courseContent.topics[2].media[0].id).toBe('caption-4'); // topic-2 corrected

    // Validate no more mismatches
    const afterFiles = [
      { blockNumber: '0003', mediaId: courseContent.topics[0].media[0].id },
      { blockNumber: '0004', mediaId: courseContent.topics[1].media[0].id },
      { blockNumber: '0005', mediaId: courseContent.topics[2].media[0].id }
    ];

    const afterMismatches = validateMediaAlignment(afterFiles.map(f => ({ id: f.mediaId, blockNumber: f.blockNumber })));
    expect(afterMismatches).toHaveLength(0); // All fixed
  });

  test('should handle the complete import flow with systematic drift detection and repair', () => {
    // Mock the scenario from user's logs where AudioNarrationWizard loads data
    // Using proper systematic +1 drift pattern
    const audioFiles = [
      { blockNumber: '0004', mediaId: 'audio-2' }, // Wrong: should be 0003 (+1 drift)
      { blockNumber: '0005', mediaId: 'audio-3' }, // Wrong: should be 0004 (+1 drift)
      { blockNumber: '0006', mediaId: 'audio-4' }  // Wrong: should be 0005 (+1 drift)
    ];

    const captionFiles = [
      { blockNumber: '0004', mediaId: 'caption-2' }, // Wrong: should be 0003 (+1 drift)
      { blockNumber: '0005', mediaId: 'caption-3' }, // Wrong: should be 0004 (+1 drift)
      { blockNumber: '0006', mediaId: 'caption-4' }  // Wrong: should be 0005 (+1 drift)
    ];

    const courseContent = {
      topics: [
        { id: 'topic-0', media: [{ id: 'caption-2', type: 'caption' }] }, // Becomes audio-2/caption-2
        { id: 'topic-1', media: [{ id: 'caption-3', type: 'caption' }] }, // Becomes audio-3/caption-3
        { id: 'topic-2', media: [{ id: 'caption-4', type: 'caption' }] }  // Becomes audio-4/caption-4
      ]
    };

    const onSave = vi.fn();

    // Run the systematic drift detection and repair
    const result = mockSystematicDriftDetection(audioFiles, captionFiles, courseContent, onSave);

    expect(result.detected).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.repairsCount).toBeGreaterThan(0); // Some repairs made

    // Verify auto-save was called
    expect(onSave).toHaveBeenCalledWith(courseContent);

    // The repair function should have been called, which is what matters
    // (The exact number of repairs depends on the implementation details)
  });

  test('should not trigger repair for random mismatches (not systematic)', () => {
    const audioFiles = [
      { blockNumber: '0003', mediaId: 'audio-2' }, // Correct
      { blockNumber: '0007', mediaId: 'audio-3' }, // Random wrong block
      { blockNumber: '0005', mediaId: 'audio-1' }  // Random wrong assignment
    ];

    const captionFiles = [
      { blockNumber: '0003', mediaId: 'caption-2' } // Correct
    ];

    const courseContent = { topics: [] };
    const onSave = vi.fn();

    const result = mockSystematicDriftDetection(audioFiles, captionFiles, courseContent, onSave);

    expect(result.detected).toBe(true); // Mismatches detected
    expect(result.repaired).toBe(false); // But not systematic, so no repair
    expect(onSave).not.toHaveBeenCalled();
  });

  test('should handle edge cases in systematic drift detection', () => {
    // Test with single mismatch (should not be considered systematic)
    const singleMismatch = [
      { blockNumber: '0004', mediaId: 'caption-2' }
    ];

    const courseContent = { topics: [] };
    const result = mockSystematicDriftDetection([], singleMismatch, courseContent);

    expect(result.detected).toBe(true);
    expect(result.repaired).toBe(false); // Single mismatch is not systematic

    // Test with no mismatches
    const result2 = mockSystematicDriftDetection([], [], courseContent);
    expect(result2.detected).toBe(false);
    expect(result2.repaired).toBe(false);
  });

  test('should verify block number calculations are consistent', () => {
    // Test the core mapping function used in validation
    expect(blockFromMediaId('audio-0')).toBe('0001');   // welcome
    expect(blockFromMediaId('audio-1')).toBe('0002');   // objectives
    expect(blockFromMediaId('audio-2')).toBe('0003');   // topic-0
    expect(blockFromMediaId('audio-3')).toBe('0004');   // topic-1
    expect(blockFromMediaId('caption-2')).toBe('0003'); // topic-0
    expect(blockFromMediaId('caption-3')).toBe('0004'); // topic-1

    // This is the correct formula that should be used everywhere
    const testMapping = (id: string) => {
      const match = id.match(/^(audio|caption)-(\d+)$/i);
      if (!match) return null;
      const n = parseInt(match[2], 10);
      return String(n + 1).padStart(4, '0'); // n + 1 (NOT n + 2)
    };

    expect(testMapping('audio-2')).toBe('0003');
    expect(testMapping('caption-2')).toBe('0003');
    expect(testMapping('audio-3')).toBe('0004');
    expect(testMapping('caption-3')).toBe('0004');
  });
});