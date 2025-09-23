import { describe, it, expect } from 'vitest';
import { blockFromMedia, blockFromMediaId } from './narrationBlockMapping';

describe('Audio Mapping Fix - User Issue Resolution', () => {
  it('should resolve the exact user complaint: Block 0003 should play audio-2, not audio-3', () => {
    // THE USER'S EXACT COMPLAINT:
    // "Block 0003 should be playing audio-2 but was still playing audio-3"
    // "I mean this should be a direct mapping. audio-0 and caption-0 should always be block 0001, and so on."

    // SOLUTION: Direct media ID to block mapping
    expect(blockFromMediaId('audio-0')).toBe('0001'); // Welcome
    expect(blockFromMediaId('audio-1')).toBe('0002'); // Objectives
    expect(blockFromMediaId('audio-2')).toBe('0003'); // Topic 0 - THE FIX!
    expect(blockFromMediaId('audio-3')).toBe('0004'); // Topic 1

    // VERIFY: Block 0003 gets audio-2, NOT audio-3
    expect(blockFromMediaId('audio-2')).toBe('0003'); // ✅ CORRECT
    expect(blockFromMediaId('audio-3')).not.toBe('0003'); // ✅ PREVENTED

    console.log('✅ USER ISSUE RESOLVED:');
    console.log('   Block 0003 now correctly maps to audio-2');
    console.log('   Block 0003 NO LONGER maps to audio-3');
  });

  it('should ignore corrupted pageId metadata and use media ID for mapping', () => {
    // SIMULATE: Media files with wrong pageId metadata (the root cause)
    const corruptedMediaFiles = [
      {
        id: 'audio-1',
        pageId: 'topic-0', // WRONG! Should be 'objectives'
        metadata: { pageId: 'topic-0' }
      },
      {
        id: 'audio-2',
        pageId: 'topic-1', // WRONG! Should be 'topic-0'
        metadata: { pageId: 'topic-1' }
      },
      {
        id: 'audio-3',
        pageId: 'topic-0', // WRONG! Should be 'topic-1'
        metadata: { pageId: 'topic-0' }
      }
    ];

    // THE FIX: Media ID takes precedence over corrupted pageId
    expect(blockFromMedia(corruptedMediaFiles[0])).toBe('0002'); // audio-1 → block 0002 (objectives)
    expect(blockFromMedia(corruptedMediaFiles[1])).toBe('0003'); // audio-2 → block 0003 (topic-0) ✅
    expect(blockFromMedia(corruptedMediaFiles[2])).toBe('0004'); // audio-3 → block 0004 (topic-1)

    // VERIFY: The user's mapping expectation is now met
    console.log('✅ CORRUPTED METADATA IGNORED:');
    console.log('   audio-1 → block 0002 (ignoring wrong pageId "topic-0")');
    console.log('   audio-2 → block 0003 (ignoring wrong pageId "topic-1")');
    console.log('   audio-3 → block 0004 (ignoring wrong pageId "topic-0")');
  });

  it('should implement the user\'s requested direct mapping pattern', () => {
    // USER QUOTE: "audio-0 and caption-0 should always be block 0001, and so on"

    // Test the exact pattern the user requested
    const expectedMappings = [
      { mediaId: 'audio-0', expectedBlock: '0001' },
      { mediaId: 'caption-0', expectedBlock: '0001' },
      { mediaId: 'audio-1', expectedBlock: '0002' },
      { mediaId: 'caption-1', expectedBlock: '0002' },
      { mediaId: 'audio-2', expectedBlock: '0003' }, // THE KEY MAPPING
      { mediaId: 'caption-2', expectedBlock: '0003' },
      { mediaId: 'audio-3', expectedBlock: '0004' },
      { mediaId: 'caption-3', expectedBlock: '0004' },
      { mediaId: 'audio-10', expectedBlock: '0011' }, // Extended pattern
      { mediaId: 'caption-10', expectedBlock: '0011' }
    ];

    expectedMappings.forEach(({ mediaId, expectedBlock }) => {
      expect(blockFromMediaId(mediaId)).toBe(expectedBlock);
    });

    console.log('✅ DIRECT MAPPING PATTERN IMPLEMENTED:');
    console.log('   Pattern: media-N → block (N+1) with 4-digit padding');
    console.log('   Example: audio-2 → block 0003, caption-2 → block 0003');
  });

  it('should demonstrate the fix prevents the audio playback bug', () => {
    // BEFORE THE FIX (bug scenario):
    // - Block 0003 would map to wrong audio because of corrupted pageId
    // - User would hear audio-3 instead of audio-2 for the first topic

    // AFTER THE FIX (correct behavior):
    const firstTopicBlock = '0003';
    const correctAudioId = 'audio-2'; // What should play for block 0003
    const wrongAudioId = 'audio-3';   // What was playing before (BUG)

    // Verify correct mapping
    expect(blockFromMediaId(correctAudioId)).toBe(firstTopicBlock);
    expect(blockFromMediaId(wrongAudioId)).not.toBe(firstTopicBlock);

    // Verify with corrupted metadata
    const corruptedMedia = {
      id: correctAudioId,
      pageId: 'wrong-page-id', // This would cause bug in old code
      metadata: { pageId: 'another-wrong-page-id' }
    };

    expect(blockFromMedia(corruptedMedia)).toBe(firstTopicBlock);

    console.log('✅ AUDIO PLAYBACK BUG FIXED:');
    console.log(`   Block ${firstTopicBlock} correctly maps to ${correctAudioId}`);
    console.log(`   Block ${firstTopicBlock} no longer maps to ${wrongAudioId}`);
    console.log('   Corrupted pageId metadata is ignored');
  });
});