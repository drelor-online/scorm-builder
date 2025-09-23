// CAPTION DUPLICATION FIX - New caption loading logic
// This file contains the fixed version of the caption loading logic

export const loadCaptionIdsWithValidation = (courseContent: any, logger: any, debugLogger: any) => {
  const captionIdsInContent: (string | null)[] = []

  // Check welcome page - should be caption-0
  if ('welcomePage' in courseContent) {
    const welcomeCaption = courseContent.welcomePage.media?.find((m: any) => m.type === 'caption')
    captionIdsInContent.push(welcomeCaption?.id || null)
  }

  // Check objectives page - should be caption-1
  if ('learningObjectivesPage' in courseContent) {
    const objCaption = courseContent.learningObjectivesPage.media?.find((m: any) => m.type === 'caption')
    captionIdsInContent.push(objCaption?.id || null)
  }

  // Check topics with validation - topic-0 should be caption-2, topic-1 should be caption-3, etc.
  if ('topics' in courseContent && Array.isArray(courseContent.topics)) {
    courseContent.topics.forEach((topic: any, topicIndex: number) => {
      const topicCaption = topic.media?.find((m: any) => m.type === 'caption')

      // CAPTION DUPLICATION FIX: Validate that caption IDs follow expected pattern
      // Expected pattern: welcome=caption-0, objectives=caption-1, topic-0=caption-2, topic-1=caption-3, etc.
      const expectedCaptionId = `caption-${topicIndex + 2}` // +2 because welcome=0, objectives=1

      if (topicCaption?.id && topicCaption.id !== expectedCaptionId) {
        logger.warn(`[AudioNarrationWizard] 🚨 CAPTION MISMATCH DETECTED: Topic ${topicIndex} (${topic.id}) has caption ID "${topicCaption.id}" but expected "${expectedCaptionId}". Ignoring misaligned caption to prevent duplication.`)
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

  // Log the results
  logger.log('[AudioNarrationWizard] FIXED caption loading - found caption IDs:', captionIdsInContent)

  // Verify no duplicates
  const nonNullCaptions = captionIdsInContent.filter(id => id !== null)
  const uniqueCaptions = new Set(nonNullCaptions)
  if (nonNullCaptions.length !== uniqueCaptions.size) {
    logger.error('[AudioNarrationWizard] 🚨 STILL FOUND DUPLICATES after fix:', nonNullCaptions)
  } else {
    logger.log('[AudioNarrationWizard] ✅ No duplicates detected after fix')
  }

  return captionIdsInContent
}

// Audio loading logic (unchanged)
export const loadAudioIdsFromContent = (courseContent: any) => {
  const audioIdsInContent: (string | null)[] = []

  // Check welcome page
  if ('welcomePage' in courseContent) {
    const welcomeAudio = courseContent.welcomePage.media?.find((m: any) => m.type === 'audio')
    audioIdsInContent.push(welcomeAudio?.id || null)
  }

  // Check objectives page
  if ('learningObjectivesPage' in courseContent) {
    const objAudio = courseContent.learningObjectivesPage.media?.find((m: any) => m.type === 'audio')
    audioIdsInContent.push(objAudio?.id || null)
  }

  // Check topics
  if ('topics' in courseContent && Array.isArray(courseContent.topics)) {
    courseContent.topics.forEach((topic: any) => {
      const topicAudio = topic.media?.find((m: any) => m.type === 'audio')
      audioIdsInContent.push(topicAudio?.id || null)
    })
  }

  return audioIdsInContent
}