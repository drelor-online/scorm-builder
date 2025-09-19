import React from "react"
import { render, screen, fireEvent } from "../../test/testProviders"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeAll } from "vitest"
import { CourseSettingsWizard, DEFAULT_COURSE_SETTINGS, CourseSettings } from "../CourseSettingsWizard"
import { CourseContent } from "../../types/aiPrompt"
import { CourseSeedData } from "../../types/course"

const minimalCourseContent: CourseContent = {
  welcomePage: {
    id: "welcome",
    title: "Welcome",
    content: "<p>Welcome</p>",
    narration: "Welcome narration",
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 1,
  },
  learningObjectivesPage: {
    id: "learning-objectives",
    title: "Objectives",
    content: "<p>Objectives</p>",
    narration: "Objectives narration",
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 1,
  },
  topics: [],
  assessment: {
    questions: [],
    passMark: 80,
    narration: null,
  },
}

const seedData: CourseSeedData = {
  courseTitle: "Safety Orientation",
  difficulty: 3,
  customTopics: [],
  template: "Safety",
  templateTopics: [],
}

const renderWizard = (overrides?: Partial<React.ComponentProps<typeof CourseSettingsWizard>>) => {
  const props: React.ComponentProps<typeof CourseSettingsWizard> = {
    courseContent: minimalCourseContent,
    courseSeedData: seedData,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onHelp: vi.fn(),
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onStepClick: vi.fn(),
    ...overrides,
  }

  const view = render(<CourseSettingsWizard {...props} />)
  return { ...view, props }
}

const scrollIntoViewMock = vi.fn();

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    value: scrollIntoViewMock,
    configurable: true,
  });
});

describe("CourseSettingsWizard", () => {
  it("submits default settings when unchanged", async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    renderWizard({ onNext })

    await user.click(screen.getByTestId("next-button"))

    expect(onNext).toHaveBeenCalledWith(DEFAULT_COURSE_SETTINGS)
  })

  it("applies user adjustments before proceeding", async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    renderWizard({ onNext })

    await user.click(screen.getByLabelText(/Require audio completion/i))
    await user.click(screen.getByLabelText(/Free/i))
    await user.click(screen.getByLabelText(/Auto-advance after knowledge checks/i))

    const passMarkLabel = screen.getByText(/Pass Mark/i)
    const passMarkInput = passMarkLabel.nextElementSibling as HTMLInputElement
    fireEvent.change(passMarkInput, { target: { value: '92' } })

    const completionLabel = screen.getByText(/Completion Criteria/i)
    const completionSelect = completionLabel.nextElementSibling as HTMLSelectElement
    fireEvent.change(completionSelect, { target: { value: 'pass_assessment' } })

    const timeLimitLabel = screen.getByText(/Time Limit \(min\)/i)
    const timeLimitInput = timeLimitLabel.nextElementSibling as HTMLInputElement
    fireEvent.change(timeLimitInput, { target: { value: '45' } })

    await user.click(screen.getByLabelText(/Enable keyboard navigation/i))
    await user.click(screen.getByLabelText(/Allow content printing/i))

    await user.click(screen.getByTestId("next-button"))

    expect(onNext).toHaveBeenCalledTimes(1)
    const submitted: CourseSettings = onNext.mock.calls[0][0]

    expect(submitted.requireAudioCompletion).toBe(true)
    expect(submitted.navigationMode).toBe("free")
    expect(submitted.autoAdvance).toBe(true)
    expect(submitted.passMark).toBe(92)
    expect(submitted.completionCriteria).toBe("pass_assessment")
    expect(submitted.timeLimit).toBe(45)
    expect(submitted.keyboardNavigation).toBe(false)
    expect(submitted.printable).toBe(true)
  })
})
