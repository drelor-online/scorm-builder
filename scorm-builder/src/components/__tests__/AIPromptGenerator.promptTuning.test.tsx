import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render, screen } from "../../test/testProviders"
import { AIPromptGenerator } from "../AIPromptGenerator"
import { CourseSeedData } from "../../types/course"
import { DEFAULT_PROMPT_TUNING_SETTINGS, PromptTuningSettings } from "../../types/promptTuning"

const courseSeed: CourseSeedData = {
  courseTitle: "Safety Orientation",
  difficulty: 3,
  customTopics: ["Emergency procedures"],
  template: "Safety",
  templateTopics: []
}

const mockSettings: PromptTuningSettings = {
  ...DEFAULT_PROMPT_TUNING_SETTINGS,
  narrationLength: "short",
  imageKeywordsCount: 2
}

let mockIsDefault = true
const mockUpdateSettings = vi.fn()
const mockResetToDefaults = vi.fn()
const mockSave = vi.fn()

const mockSuccess = vi.fn()
const mockError = vi.fn()

let mockSummary: string[] = ["Narration length"]

const navigatorClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined)
}
Object.defineProperty(navigator, "clipboard", {
  value: navigatorClipboard,
  configurable: true
})

vi.mock("../../hooks/usePromptTuning", () => ({
  usePromptTuning: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    resetToDefaults: mockResetToDefaults,
    isDefault: mockIsDefault,
    isDirty: false,
    save: mockSave
  })
}))

vi.mock("../../utils/promptBuilder", () => ({
  buildAIPrompt: vi.fn(() => "Generated prompt"),
  getSettingsChangeSummary: vi.fn(() => mockSummary)
}))

vi.mock("../../contexts/NotificationContext", async () => {
  const actual = await vi.importActual<typeof import('../../contexts/NotificationContext')>("../../contexts/NotificationContext")
  return {
    ...actual,
    useNotifications: () => ({
      success: mockSuccess,
      error: mockError
    })
  }
})

const MOCK_MODAL_SETTINGS = { ...mockSettings }

vi.mock("../PromptTuningModal", () => ({
  PromptTuningModal: ({ isOpen, onApply, onClose }: { isOpen: boolean; onApply: (settings: PromptTuningSettings) => void; onClose: () => void }) => {
    if (!isOpen) {
      return null
    }
    return (
      <div data-testid="mock-prompt-tuning-modal">
        <button type="button" data-testid="mock-apply" onClick={() => onApply(MOCK_MODAL_SETTINGS)}>
          Apply
        </button>
        <button type="button" data-testid="mock-close" onClick={onClose}>
          Close
        </button>
      </div>
    )
  }
}))

describe("AIPromptGenerator Prompt Tuning integration", () => {
  const defaultProps = {
    courseSeedData: courseSeed,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  beforeEach(() => {
    mockIsDefault = true
    mockSummary = ["Narration length"]
    mockSuccess.mockReset()
    mockError.mockReset()
    navigatorClipboard.writeText.mockReset()
  })

  it("shows prompt tuning controls and guidance", () => {
    render(<AIPromptGenerator {...defaultProps} />)

    expect(screen.getByTestId("prompt-tuning-button")).toBeInTheDocument()
    expect(
      screen.getByText(/Review your Prompt Tuning presets so the AI response matches the narration/i)
    ).toBeInTheDocument()
  })

  it("opens and closes the prompt tuning modal", async () => {
    const user = userEvent.setup()
    render(<AIPromptGenerator {...defaultProps} />)

    await user.click(screen.getByTestId("prompt-tuning-button"))
    expect(screen.getByTestId("mock-prompt-tuning-modal")).toBeInTheDocument()

    await user.click(screen.getByTestId("mock-close"))
    expect(screen.queryByTestId("mock-prompt-tuning-modal")).not.toBeInTheDocument()
  })

  it("applies prompt tuning changes and announces summary", async () => {
    const user = userEvent.setup()
    render(<AIPromptGenerator {...defaultProps} />)

    await user.click(screen.getByTestId("prompt-tuning-button"))
    await user.click(screen.getByTestId("mock-apply"))

    expect(mockSuccess).toHaveBeenCalledWith("Prompt settings updated: Narration length")
  })
})
