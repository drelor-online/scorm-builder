/**
 * @fileoverview Unit test for AudioNarrationWizard's overwrite prevention logic
 *
 * This test validates the specific logic that prevents/allows overwriting media assignments
 * when mismatches are detected. This is a focused unit test that isolates the bug.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blockFromMediaId } from '../utils/narrationBlockMapping';

describe('AudioNarrationWizard Overwrite Prevention Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should identify incorrect audio assignments correctly', () => {
    // Arrange: Test the core logic used in overwrite prevention
    const existingAudioFiles = [
      { blockNumber: '0002', mediaId: 'audio-1' }, // objectives block with objectives audio - CORRECT
      { blockNumber: '0003', mediaId: 'audio-1' }, // topic-0 block with objectives audio - INCORRECT
      { blockNumber: '0004', mediaId: 'audio-2' }  // topic-1 block with topic-0 audio - INCORRECT
    ];

    const validationResults = existingAudioFiles.map(f => {
      const expectedBlock = blockFromMediaId(f.mediaId || '');
      const isCorrect = expectedBlock === f.blockNumber;
      return {
        blockNumber: f.blockNumber,
        mediaId: f.mediaId,
        expectedBlock,
        isCorrect
      };
    });

    // Assert: The logic should correctly identify which assignments are wrong
    expect(validationResults[0].isCorrect).toBe(true);  // audio-1 in block 0002 (objectives) is correct
    expect(validationResults[1].isCorrect).toBe(false); // audio-1 in block 0003 (topic-0) is incorrect
    expect(validationResults[2].isCorrect).toBe(false); // audio-2 in block 0004 (topic-1) is incorrect
  });

  it('should identify what the correct assignments should be', () => {
    // Arrange: Set up the scenario from user logs
    const incorrectAssignments = [
      { blockNumber: '0003', mediaId: 'audio-1' }, // Should be audio-2
      { blockNumber: '0004', mediaId: 'audio-2' }  // Should be audio-3
    ];

    // Act: Determine what the correct media IDs should be for each block
    const corrections = incorrectAssignments.map(assignment => {
      const blockNum = parseInt(assignment.blockNumber, 10);
      const expectedMediaSuffix = blockNum - 1; // 0003 → 2, 0004 → 3
      const correctMediaId = `audio-${expectedMediaSuffix}`;

      return {
        blockNumber: assignment.blockNumber,
        currentWrongId: assignment.mediaId,
        correctId: correctMediaId
      };
    });

    // Assert: The corrections should be what we expect
    expect(corrections[0]).toEqual({
      blockNumber: '0003',
      currentWrongId: 'audio-1',
      correctId: 'audio-2'
    });

    expect(corrections[1]).toEqual({
      blockNumber: '0004',
      currentWrongId: 'audio-2',
      correctId: 'audio-3'
    });
  });

  it('should demonstrate the current bug: overwrite prevention keeps wrong assignments', () => {
    // Arrange: Simulate the overwrite prevention logic (current buggy behavior)
    const existingFiles = [
      { blockNumber: '0003', mediaId: 'audio-1' }, // WRONG assignment
      { blockNumber: '0004', mediaId: 'audio-2' }  // WRONG assignment
    ];

    const correctFiles = [
      { blockNumber: '0003', mediaId: 'audio-2' }, // CORRECT assignment
      { blockNumber: '0004', mediaId: 'audio-3' }  // CORRECT assignment
    ];

    // Current buggy logic: if existing file exists, keep it even if wrong
    const filteredCorrectFiles = correctFiles.filter(correctFile => {
      const existingFile = existingFiles.find(e => e.blockNumber === correctFile.blockNumber);
      if (existingFile) {
        // Check if existing assignment is correct
        const expectedBlock = blockFromMediaId(existingFile.mediaId || '');
        const isCorrect = expectedBlock === correctFile.blockNumber;

        if (!isCorrect) {
          console.log(`🛡️ OVERWRITE PREVENTION: Block ${correctFile.blockNumber} has INCORRECT audio (${existingFile.mediaId}), but keeping content assignment over fallback ${correctFile.mediaId}`);
        }

        // Current bug: return false even for incorrect assignments
        return false; // This is the bug - should return !isCorrect to allow corrections
      }
      return true;
    });

    // Assert: This demonstrates the bug - no corrections are applied
    expect(filteredCorrectFiles).toHaveLength(0); // Bug: even wrong assignments are protected
    expect(existingFiles).toEqual([
      { blockNumber: '0003', mediaId: 'audio-1' }, // Still wrong
      { blockNumber: '0004', mediaId: 'audio-2' }  // Still wrong
    ]);
  });

  it('should demonstrate the correct behavior: overwrite prevention allows corrections', () => {
    // Arrange: Same scenario but with corrected logic
    const existingFiles = [
      { blockNumber: '0003', mediaId: 'audio-1' }, // WRONG assignment
      { blockNumber: '0004', mediaId: 'audio-2' }  // WRONG assignment
    ];

    const correctFiles = [
      { blockNumber: '0003', mediaId: 'audio-2' }, // CORRECT assignment
      { blockNumber: '0004', mediaId: 'audio-3' }  // CORRECT assignment
    ];

    // Fixed logic: only keep existing files if they are correct
    const newFilesToAdd = correctFiles.filter(correctFile => {
      const existingFile = existingFiles.find(e => e.blockNumber === correctFile.blockNumber);
      if (existingFile) {
        // Check if existing assignment is correct
        const expectedBlock = blockFromMediaId(existingFile.mediaId || '');
        const isCorrect = expectedBlock === correctFile.blockNumber;

        if (isCorrect) {
          console.log(`🛡️ OVERWRITE PREVENTION: Block ${correctFile.blockNumber} has correct audio (${existingFile.mediaId}), skipping fallback ${correctFile.mediaId}`);
          return false; // Keep existing correct assignment
        } else {
          console.log(`🔧 CORRECTION: Block ${correctFile.blockNumber} has INCORRECT audio (${existingFile.mediaId}), replacing with correct ${correctFile.mediaId}`);
          return true; // Allow correction of incorrect assignment
        }
      }
      return true; // Add new files where no existing assignment exists
    });

    // Act: Apply the corrections by removing wrong files and adding correct ones
    const correctedFiles = existingFiles.filter(existing => {
      const expectedBlock = blockFromMediaId(existing.mediaId || '');
      return expectedBlock === existing.blockNumber; // Keep only correct assignments
    }).concat(newFilesToAdd);

    // Assert: The corrections should be applied
    expect(newFilesToAdd).toHaveLength(2); // Both corrections should be allowed
    expect(correctedFiles).toEqual([
      { blockNumber: '0003', mediaId: 'audio-2' }, // Corrected
      { blockNumber: '0004', mediaId: 'audio-3' }  // Corrected
    ]);
  });

  it('should preserve correct assignments while fixing incorrect ones', () => {
    // Arrange: Mix of correct and incorrect assignments
    const existingFiles = [
      { blockNumber: '0002', mediaId: 'audio-1' }, // CORRECT (objectives)
      { blockNumber: '0003', mediaId: 'audio-1' }, // WRONG (should be audio-2)
      { blockNumber: '0004', mediaId: 'audio-2' }  // WRONG (should be audio-3)
    ];

    const correctFiles = [
      { blockNumber: '0002', mediaId: 'audio-1' }, // CORRECT
      { blockNumber: '0003', mediaId: 'audio-2' }, // CORRECT
      { blockNumber: '0004', mediaId: 'audio-3' }  // CORRECT
    ];

    // Fixed logic: selective replacement
    const corrections = correctFiles.map(correctFile => {
      const existingFile = existingFiles.find(e => e.blockNumber === correctFile.blockNumber);
      if (existingFile) {
        const expectedBlock = blockFromMediaId(existingFile.mediaId || '');
        const isCorrect = expectedBlock === correctFile.blockNumber;

        return {
          blockNumber: correctFile.blockNumber,
          shouldReplace: !isCorrect,
          existing: existingFile.mediaId,
          correct: correctFile.mediaId
        };
      }
      return {
        blockNumber: correctFile.blockNumber,
        shouldReplace: false, // No existing file
        existing: null,
        correct: correctFile.mediaId
      };
    });

    // Assert: Only incorrect assignments should be marked for replacement
    expect(corrections[0].shouldReplace).toBe(false); // Keep correct audio-1 in objectives
    expect(corrections[1].shouldReplace).toBe(true);  // Replace wrong audio-1 in topic-0 with audio-2
    expect(corrections[2].shouldReplace).toBe(true);  // Replace wrong audio-2 in topic-1 with audio-3
  });
});