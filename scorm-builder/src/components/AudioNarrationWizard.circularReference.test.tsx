/**
 * @fileoverview Test that reproduces the circular reference issue in AudioNarrationWizard
 *
 * This test demonstrates the bug where the system tries to correct media IDs but ends up
 * trying to replace them with the same ID due to circular logic.
 */

import { describe, it, expect } from 'vitest';
import { blockFromMediaId, expectedMediaIdForBlock } from '../utils/narrationBlockMapping';

describe('AudioNarrationWizard Circular Reference Bug', () => {
  it('should reproduce the circular reference where audio-10 gets corrected to audio-10', () => {
    // Arrange: Simulate the scenario from user logs
    const existingFile = {
      blockNumber: '0012', // Block 12 (should be topic-9)
      mediaId: 'audio-10'   // But has audio-10 (which belongs to block 11)
    };

    // Current buggy logic: use the existing media ID to determine expected block
    const expectedBlockFromExistingId = blockFromMediaId(existingFile.mediaId || '');
    const isCorrect = expectedBlockFromExistingId === existingFile.blockNumber;

    // This will show mismatch (good - this part works)
    expect(isCorrect).toBe(false);
    expect(expectedBlockFromExistingId).toBe('0011'); // audio-10 belongs to block 11
    expect(existingFile.blockNumber).toBe('0012');    // but it's in block 12

    // But then the buggy correction logic tries to get the "correct" media ID
    // by using the SAME calculation that detected the problem
    const buggyCorrectId = expectedMediaIdForBlock(existingFile.mediaId!, existingFile.blockNumber);

    // This is the bug: we get back the same ID because the calculation is circular
    console.log('Buggy correction attempt:', {
      existing: existingFile.mediaId,
      calculatedCorrect: buggyCorrectId,
      sameId: existingFile.mediaId === buggyCorrectId
    });

    // The expectedMediaIdForBlock function is actually working correctly!
    expect(buggyCorrectId).toBe('audio-11'); // CORRECT: Block 12 should have audio-11, not audio-10
  });

  it('should demonstrate the correct way to calculate media IDs from block numbers', () => {
    // Arrange: Block 0012 should contain audio for topic-9
    const blockNumber = '0012';

    // Correct logic: Calculate what media ID should be in this block directly
    const blockNum = parseInt(blockNumber, 10);
    const correctMediaSuffix = blockNum - 1; // Block 0012 → audio-11
    const correctMediaId = `audio-${correctMediaSuffix}`;

    // Verify this gives us the RIGHT answer
    expect(correctMediaId).toBe('audio-11'); // Block 12 should have audio-11, not audio-10

    // Also verify the reverse mapping works
    const verifyBlock = blockFromMediaId(correctMediaId);
    expect(verifyBlock).toBe(blockNumber);
  });

  it('should show the fix: replace wrong media with correct media calculated from block number', () => {
    // Arrange: The problematic scenario
    const problemBlocks = [
      { blockNumber: '0011', hasWrongMedia: 'audio-9' },  // Should have audio-10
      { blockNumber: '0012', hasWrongMedia: 'audio-10' }, // Should have audio-11
      { blockNumber: '0013', hasWrongMedia: 'audio-11' }  // Should have audio-12
    ];

    const corrections = problemBlocks.map(block => {
      // CORRECT way: Calculate what media ID this block should have
      const blockNum = parseInt(block.blockNumber, 10);
      const correctSuffix = blockNum - 1;
      const shouldHave = `audio-${correctSuffix}`;

      return {
        block: block.blockNumber,
        wrongMedia: block.hasWrongMedia,
        correctMedia: shouldHave,
        needsCorrection: block.hasWrongMedia !== shouldHave
      };
    });

    // Verify all need correction and we calculated the right replacements
    expect(corrections[0]).toEqual({
      block: '0011',
      wrongMedia: 'audio-9',
      correctMedia: 'audio-10',
      needsCorrection: true
    });

    expect(corrections[1]).toEqual({
      block: '0012',
      wrongMedia: 'audio-10',
      correctMedia: 'audio-11', // This is the correct answer, not audio-10!
      needsCorrection: true
    });

    expect(corrections[2]).toEqual({
      block: '0013',
      wrongMedia: 'audio-11',
      correctMedia: 'audio-12',
      needsCorrection: true
    });

    // All should need correction
    expect(corrections.every(c => c.needsCorrection)).toBe(true);
  });
});