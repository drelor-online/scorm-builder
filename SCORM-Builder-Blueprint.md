## SCORM Course Blueprint & Generation Workflow

*Reference document for Claude‑Code to create CBT‑style SCORM packages*

---

### 1  End‑Product Specifications (What to Build)

| Aspect               | Required Outcome                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Standard**         | SCORM 1.2 single‑SCO ZIP                                                                         |
| **Launch File**      | `index.html` in ZIP root, declared in `imsmanifest.xml`                                          |
| **Folder Layout**    | `/pages`, `/media`, `/scripts`, `/styles`, `/assets`                                             |
| **Runtime Length**   | 15 – 45 min total (5–25 topics)                                                                  |
| **Completion Logic** | All required pages viewed **and** final assessment ≥ pass mark → `lesson_status = passed/failed` |
| **Accessibility**    | WCAG AA: captions on, keyboard‑friendly, alt text, colour contrast                               |

---

### 2  Learner Journey (Storyboard)

1. **Launch & Welcome** – title, length, “Start” button
2. **Objectives** – 3–6 bullet outcomes, narrated
3. **Topic Screens** – 5‑25 × ≈2 min each (text + optional image/video + narration)\
      • Knowledge check every 2‑3 topics
4. **Mid‑Course Activity** – richer drag‑drop / scenario
5. **Summary** – key takeaways
6. **Final Assessment** – 5‑15 questions, pass mark 80 % (default)
7. **Completion Page** – score, badge, “Exit Course” (triggers `Finish`)

---

### 3  Screen Template

```
┌──────────────────────────────────────────────┐
│  Title Bar   |  Progress %                   │
├──────────────┬───────────────────────────────┤
│  TOC Drawer   │  <H1> Topic Title            │
│               │  ──────────────────────────  │
│               │  Media Area 16:9            │
│               │  Structured Text            │
│               │  Knowledge‑Check (optional) │
│               │  ◀Prev  Next▶  CC  Mute      │
└───────────────┴──────────────────────────────┘
```

*Responsive layout, captions toggle persists, full keyboard access. Ensure ****all images in the Media Area include descriptive ****``**** text****, and apply meaningful **``** attributes to the navigation buttons, captions toggle, mute control, and any interactive knowledge‑check elements. Resize images to fit as necessary into media area.*

---

### 4  File & Asset Organisation (Example)

```
/                                           
├─ imsmanifest.xml                          
├─ index.html                               
├─ pages/        (HTML partials)            
├─ media/        (audio, images, video)     
├─ scripts/      (player, scorm wrapper)    
├─ styles/       (player.css)               
└─ assets/       (summary.pdf, extras)      
```

---

### 5  Behaviour & Tracking Rules

| Event                    | SCORM Calls                                          |
| ------------------------ | ---------------------------------------------------- |
| Launch                   | `LMSInitialize`, `lesson_status = incomplete`        |
| Page Viewed              | update `suspend_data` bookmark                       |
| Knowledge‑Check          | write `cmi.interactions.n`                           |
| Mid‑Course Activity pass | flag in `suspend_data`                               |
| Final Quiz Submit        | set `score.raw/max`, `lesson_status = passed/failed` |
| Exit                     | `LMSCommit`, `LMSFinish`                             |

---

### 6  Visual & Tone Guidelines

- Conversational‑professional copy (avoid jargon unless defined).
- Max 65 ch line‑length, REM units for text.
- Brand colors limited to buttons/progress; high‑contrast palette compliant.
- Images: clean diagrams/photos, minimal embedded text.

---

### 7  Configuration Variables

| Key               | Example                   |
| ----------------- | ------------------------- |
| `courseTitle`     | "Arc‑Flash Hazard Basics" |
| `durationMinutes` | 30                        |
| `topicCount`      | 12                        |
| `passMark`        | 80                        |
| `navigationMode`  | "linear" / "free"         |
| `allowRetake`     | true                      |

---

## 8  Program Workflow (How the Package Is Generated)

IMPORTANT!!!!! YOU SHALL FOLLOW TDD PRINCIPLES THROUGHOUT THE DEVELOPMENT OF THIS PROGRAM.  YOU WILL BE CONTROLLED BY A HOOK TO ENFORCE COMPLIANCE WITH TDD PRINCIPLES THAT ENSURES YOU ARE WRITING TESTS FIRST.  THIS APPLICATION SHALL HAVE A REACT/TYPESCRIPT FRONTEND WITH A RUST/TAURI FRAMEWORK BACKEND.  IT SHALL BE OPERATED AS A DESKTOP APPLICATION.  STYLING AND BRANDING ARE BASED ON THE COMPANY STYLE FOUND AT www.entrustsol.com  IMPORTANT!!!!

### Step 0  Prerequisites

- User has entered API keys in **Settings page**:
  - **Google Image Search API Key** and **Google Custom Search Engine (CSE) ID** for image searching
  - **YouTube Data API Key** for video searching
- Application uses **Tailwind CSS** framework for professional styling matching Entrust Solutions branding.

### Step 1  Course Seed Input

1. **Prompt Form** – User enters:
   - **Course Title**
   - **Difficulty** (1–5)
   - **Custom Topic List** (each entered on a separate line in text box)
2. **Template Selector** – Optional drop-down:
   - How‑to Guide · Corporate · Technical · Safety · Business Development · Human Resources
3. If a template is chosen, program displays 6‑10 generic template topics with check‑boxes (user can include/exclude).

### Step 2  Generate AI‑Prompt

- Program composes a **single copy‑ready prompt** instructing an external AI chatbot to return **pure JSON** defining:
  - Topic titles, bullet text, page HTML snippets
  - Suggested image keywords (these should be short and simple - long search terms narrow options and include multiple options that the user can select from later when doing image searches)
  - **Suggested YouTube search terms** for finding relevant educational videos
  - Draft audio narration (block‑segmented)
  - Draft activities/quizzes (with placeholder IDs)
- UI presents "Copy Prompt" button + guidance.
- **Note**: Removed "Generate AI Image" functionality - users should use external AI image generators with the provided prompts.

### Step 3  Import & Validate JSON

1. User pastes chatbot response into a text box (JSON format only).
2. Program **validates the response**; auto‑fixes minor issues (e.g., missing commas, extra keys) and shows summary (topic count, activities, media counts).
3. If errors are found, prompts user to re‑generate or edit, lines with issues should be highlighted.
4. Uses simple, non-technical language throughout (e.g., "AI Response" instead of "AI-generated content", "Import Content" instead of "Parse Content").

### Step 4  Media Enhancement Wizard *(API‑powered search and manual entry)*

- **Tabbed Interface** with Images and Videos tabs for organized media management
- **Image Tab** – For each page with an image placeholder:
  - Pre‑populate Google Image search using suggested keywords from AI prompt.
  - User selects preferred image (or uploads own).
  - "Add New Prompt" functionality to add additional image prompts to topics.
- **Video Tab** – For each video placeholder:
  - **YouTube search integration** using YouTube Data API v3
  - Search using suggested terms from AI prompt or custom searches
  - User picks video clips from search results with thumbnail previews
  - Manual URL entry option for specific videos
- **Bulk options** – Allow "Skip" (leave placeholder) or "Same image for all" when appropriate.

### Step 5  Audio Narration Wizard

1. Program bundles narration blocks into a downloadable ``.
2. Instructions displayed:
   - Upload to **Murf.ai**
   - Use *Voice only · Split by blocks · MP3 · High quality · Stereo*.
   - Export **VTT captions** with identical block numbering.
3. User uploads returned **ZIP of MP3s** and **ZIP of VTTs** (files named `0001*.mp3`, `0001*.vtt`, etc.).
4. Program validates equal counts & sequencing; flags gaps.

### Step 6  Activities & Quizzes Editor

- UI lists each parsed activity/quiz:
  - Display question, answers, correct flag.
  - For visual activities (e.g., image hotspot), prompt user to assign selected image and define hotspot coords.
- Changes auto‑saved to internal data model.

### Step 7  Build & Export

1. Program compiles pages, media, narration, captions, scripts, styles, and manifest.
2. **Validation checkpoint:** if any required asset is missing (e.g., unresolved image placeholder, mismatched MP3/VTT counts, absent caption file), the build pauses and a modal report lists each issue with a “Go Fix” link back to the relevant wizard step.
3. Generates **SCORM ZIP** matching *Sections 1‑6* specs once all validations pass.
4. Displays final report: duration, page count, media count, SCORM size.
5. "Download Package" button completes workflow.

---

### 9  User Guidance Hooks

- Every step page contains **inline helper text** and a "Help" link to docs.
- Guardrails: disabling "Next" until required information is present.
- Persistent breadcrumb: *Input → AI Prompt → Import → Media → Audio → Activities → Export*.

---

### 10  Change Log (for future edits)

| Version | Date       | Change                                   |
| ------- | ---------- | ---------------------------------------- |
| 1.1     | 2025-07-16 | Added Tailwind CSS for professional styling |
| 1.2     | 2025-07-16 | Created Settings page with API key management (Google Image Search API, CSE ID, YouTube Data API) |
| 1.3     | 2025-07-16 | Removed Generate AI Image button, users now use external AI generators |
| 1.4     | 2025-07-16 | Added YouTube video search integration with API v3 |
| 1.5     | 2025-07-16 | Updated AI prompts to include YouTube search terms |
| 1.6     | 2025-07-16 | Added Playwright for visual regression testing |
| 1.7     | 2025-07-16 | Enhanced Media Enhancement Wizard with tabbed interface and improved functionality |


> **End of Blueprint** – Claude‑Code should implement all UI, validation, and build logic required to deliver the End‑Product (Sections 1–7) via the Program Workflow (Section 8).

