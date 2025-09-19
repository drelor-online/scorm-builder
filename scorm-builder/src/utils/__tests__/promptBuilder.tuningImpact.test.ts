import { describe, it, expect } from 'vitest'
import { buildAIPrompt } from '../../utils/promptBuilder'
import { DEFAULT_PROMPT_TUNING_SETTINGS, PromptTuningSettings } from '../../types/promptTuning'
import type { CourseSeedData } from '../../types/course'

const seedCourse: CourseSeedData = {
  courseTitle: 'Prompt Impact Verification',
  difficulty: 3,
  customTopics: ['Topic Alpha', 'Topic Beta'],
  template: 'Safety',
  templateTopics: []
}

function buildPrompt(overrides: Partial<PromptTuningSettings>) {
  const settings: PromptTuningSettings = { ...DEFAULT_PROMPT_TUNING_SETTINGS, ...overrides }
  return buildAIPrompt(seedCourse, settings)
}

describe('promptBuilder prompt tuning impact', () => {
  it('annotates image keywords with the configured image search specificity', () => {
    const prompt = buildPrompt({ imageSearchSpecificity: 'very-specific' })

    expect(prompt).toContain('Use highly targeted, niche image terms appropriate for specialized content')
    expect(prompt).toContain('["keyword1", "keyword2"] // Use highly targeted, niche image terms')
  })

  it('reflects the configured narration character limit when enforcement is enabled', () => {
    const prompt = buildPrompt({ characterLimit: 1500, narrationLength: 'short' })

    expect(prompt).toContain('maximum 800 characters (hard limit 1500 characters)')
  })

  it('informs the model when the character limit is advisory only', () => {
    const prompt = buildPrompt({ enforceCharacterLimit: false })

    expect(prompt).toContain('Use character limits as guidance; do not enforce a hard cap.')
    expect(prompt).not.toContain('hard limit')
  })
})
