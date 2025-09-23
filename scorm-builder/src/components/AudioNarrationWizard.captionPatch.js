// CAPTION DUPLICATION FIX PATCH
// This patch fixes the caption duplication issue in AudioNarrationWizard.tsx
// Replace the caption loading logic (around lines 855-864) with this code:

const CAPTION_FIX_PATCH = `
      // Check topics - push null if no media to maintain index alignment
      if ('topics' in courseContent && Array.isArray(courseContent.topics)) {
        courseContent.topics.forEach((topic: any, topicIndex: number) => {
          const topicAudio = topic.media?.find((m: Media) => m.type === 'audio')
          audioIdsInContent.push(topicAudio?.id || null)

          // Look for captions in media array too
          const topicCaption = topic.media?.find((m: Media) => (m as any).type === 'caption')

          // CAPTION DUPLICATION FIX: Validate that caption IDs follow expected pattern
          // Expected pattern: welcome=caption-0, objectives=caption-1, topic-0=caption-2, topic-1=caption-3, etc.
          const expectedCaptionId = \`caption-\${topicIndex + 2}\` // +2 because welcome=0, objectives=1

          if (topicCaption?.id && topicCaption.id !== expectedCaptionId) {
            logger.warn(\`[AudioNarrationWizard] 🚨 CAPTION MISMATCH DETECTED: Topic \${topicIndex} (\${topic.id}) has caption ID "\${topicCaption.id}" but expected "\${expectedCaptionId}". Ignoring misaligned caption to prevent duplication.\`)
            debugLogger.warn('CAPTION_FIX', 'Caption ID mismatch detected and corrected', {
              topicIndex,
              topicId: topic.id,
              foundCaptionId: topicCaption.id,
              expectedCaptionId,
              action: 'ignored_misaligned_caption'
            })
            // Push null instead of the misaligned caption to break the duplication chain
            captionIdsInContent.push(null)
          } else {
            captionIdsInContent.push(topicCaption?.id || null)
          }
        })
      }
`;

// ORIGINAL CODE TO REPLACE:
const ORIGINAL_CODE = `
      // Check topics - push null if no media to maintain index alignment
      if ('topics' in courseContent && Array.isArray(courseContent.topics)) {
        courseContent.topics.forEach((topic: any) => {
          const topicAudio = topic.media?.find((m: Media) => m.type === 'audio')
          audioIdsInContent.push(topicAudio?.id || null)
          // Look for captions in media array too
          const topicCaption = topic.media?.find((m: Media) => (m as any).type === 'caption')
          captionIdsInContent.push(topicCaption?.id || null)
        })
      }
`;

console.log('CAPTION DUPLICATION FIX PATCH');
console.log('Replace this code:');
console.log(ORIGINAL_CODE);
console.log('With this code:');
console.log(CAPTION_FIX_PATCH);

module.exports = { CAPTION_FIX_PATCH, ORIGINAL_CODE };