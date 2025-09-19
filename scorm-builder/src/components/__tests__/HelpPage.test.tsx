import React from 'react'
import { render, screen } from "../../test/testProviders"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, beforeAll, vi } from "vitest"
import { HelpPage } from "../HelpPage"

const scrollIntoViewMock = vi.fn();

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    value: scrollIntoViewMock,
    configurable: true,
  });
});

describe("HelpPage guidance", () => {
  const renderHelp = (props?: Partial<React.ComponentProps<typeof HelpPage>>) =>
    render(<HelpPage onBack={() => undefined} {...props} />)

  it("lists categories and filters topics by type", async () => {
    const user = userEvent.setup()
    renderHelp()

    const workflowButton = screen.getByRole("button", { name: /workflow steps/i })
    const featuresButton = screen.getByRole("button", { name: /features/i })
    const faqButton = screen.getByRole("button", { name: /faqs/i })

    expect(workflowButton).toBeInTheDocument()
    expect(featuresButton).toBeInTheDocument()
    expect(faqButton).toBeInTheDocument()

    await user.click(featuresButton)

    expect(
      screen.getByRole("heading", { name: /prompt tuning controls/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: /Step 1:/i })
    ).not.toBeInTheDocument()
  })

  it("supports keyword search across all topics", async () => {
    const user = userEvent.setup()
    renderHelp()

    const searchInput = screen.getByPlaceholderText(/search help topics/i)

    await user.clear(searchInput)
    await user.type(searchInput, "portable")

    expect(
      screen.getByRole("heading", { name: /portable runtime & distribution/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/No help topics found/i)
    ).not.toBeInTheDocument()
  })

  it("auto-expands the topic mapped to the current wizard step", () => {
    renderHelp({ currentStep: 7 })

    const scormHeading = screen.getByRole('heading', { name: /Step 8: Generate SCORM Package/i })
    const scormToggle = scormHeading.closest('button')
    expect(scormToggle).toHaveAttribute('aria-expanded', 'true')
  })
})
