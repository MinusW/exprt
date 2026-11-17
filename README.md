# Antigravity Local AI-Driven Study Guidance Webapp

A local, self-hosted web application for structured study guidance alongside a suite of AI Agent Skills and validation scripts.

Renders interactive learning guides structured around the **Theory → Experience → Reflection → Quiz** cycle using strict JSON templates. Content is authored locally by Antigravity using specialized skills, validated via CLI scripts, and rendered dynamically in the browser with dual-layer local persistence.

---

## 🏗️ Architecture & Core Principles

* **Strictly Local & Self-Hosted:** No cloud accounts or databases. Flat JSON files in `/guides`, `/sources`, `/assets`, and `/user-data`.
* **Live Hot-Reloading:** Express server watches `/guides` with `chokidar` and streams Server-Sent Events (SSE) to Vite/React frontend so edits update immediately without losing UI state.
* **Configurable Kroki Integration:** Auto-detects local Kroki (`http://localhost:8000`) with fallback to `https://kroki.io` for rendering diagrams (Mermaid, PlantUML, Graphviz DOT, Vega-Lite, D2, etc.).
* **Dual-Layer Persistence:** Reconciles browser `localStorage` with `/user-data/*.json` on startup via timestamps.

---

## 📁 Repository Structure

```text
/
├── skills/ (and .agent/skills/)   # Antigravity Skills & reference examples
│   ├── guide-architect/           # Master skill for Theory -> Experience -> Reflection -> Quiz
│   ├── diagram-specialist/        # Kroki diagram generation & syntax standards
│   ├── media-curator/             # YouTube search, oEmbed verification & asset caching
│   └── quiz-remediation/          # Assessment design & weak-spot remediation guides
├── schemas/
│   └── guide.schema.json          # Strict JSON Schema exported from Zod
├── scripts/
│   ├── validate-guide.ts          # CLI linter: JSON schema + Kroki dry-run + YouTube oEmbed check
│   ├── generate-schema.ts         # Generates guide.schema.json from TypeScript Zod definitions
│   ├── read-pdf.ts                # Token-efficient PDF reader CLI (TypeScript)
│   └── read_pdf.py                # Token-efficient PDF reader CLI (Python companion)
├── sources/                       # User reference notes, PDFs, or docs for source grounding
├── guides/                        # Organized JSON study guides (supports nested subdirectories)
│   ├── machine-learning/          # Track / Category subfolders
│   │   ├── neural-network-foundations.json
│   │   └── gradient-descent-optimization.json
│   └── algorithms/
│       └── dynamic-programming-memoization.json
├── assets/                        # Locally cached images, audio, and video files
├── user-data/                     # Local disk persistence (auto-synced with browser storage)
│   ├── progress.json              # Completed sections, quiz history, and reflection notes
│   ├── bookmarks.json             # Pinned building blocks for Quick Reference
│   ├── srs-queue.json             # Spaced repetition (FSRS) review state
│   └── remediation-request.json   # Weak spots exported for Antigravity follow-up
└── src/
    ├── schemas/guide.ts           # Strict Zod schema for guides & building blocks
    ├── server/index.ts            # Local Express API, Kroki proxy, user-data CRUD & SSE watcher
    └── client/                    # Vite + React + TypeScript + Tailwind frontend
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Validation on Study Guides
```bash
npm run validate
# Or validate a specific guide:
npm run validate guides/neural-network-foundations.json
```

### 3. Start Development Server
```bash
npm run dev
```
* **Frontend:** [http://localhost:5173](http://localhost:5173)
* **Backend API & SSE Watcher:** [http://localhost:3001](http://localhost:3001)

### 4. Build for Production & Serve
```bash
npm run build
npm run server
```

---

## 🧩 The 10 Building Block Types

1. **`markdown`**: Rich text with inline `$..$` and block `$$..$$` KaTeX LaTeX math support.
2. **`code`**: Syntax-highlighted code block with line numbering, line highlighting, and clickable annotations.
3. **`kroki`**: Diagrams (Mermaid, PlantUML, Graphviz, D2, Vega-Lite) with zoom/pan and fullscreen modal.
4. **`media`**: Embedded YouTube videos (oEmbed verified), local video/audio/images, with `why_watch` pedagogical rationale.
5. **`sandbox`**: Client-side runnable JavaScript code editor with console interception and expected output assertion.
6. **`simulation`**: Parameterized mathematical model with sliders dynamically computing live values and formulas.
7. **`reflection_rubric`**: Metacognitive prompt with persistent scratchpad that unlocks self-check criteria and model answers.
8. **`feynman_prompt`**: Plain-language prompt with 1-click **"Copy Critique Prompt for Antigravity"** button.
9. **`quiz_question`**: Multiple choice, multi-select, fill-in-the-blank, code output, and short answer with explanations, progressive hints, and links to upstream blocks.
10. **`flashcard`**: Interactive 3D flip card for formulas, definitions, and mental models with FSRS integration.

---

## 🧭 Learner Autonomy & Bidirectional Progress

Learning is not a unidirectional ratchet. Human memory decays (Ebbinghaus) and mental schemas require ongoing recalibration.
* **Full Check / Uncheck Control:** Any section or milestone checked by a user can be unchecked at any time. When reviewing a topic later, learners can mark sections incomplete without friction.
* **Batch Section Controls:** Quick "Check All", "Uncheck All", and "Reset Guide" controls directly in the top navigation bar and dashboard guide cards.
* **Reversible Checklists & Rubrics:** Reflection rubrics support checking, unchecking, or clearing criteria items at will.
* **Re-attemptable Diagnostics:** Quizzes include a re-attempt button ($\circlearrowleft$) to reset previous answers, clear inputs, and update mastery state.

---

## 📄 Token-Efficient PDF Reader CLI

When authoring study guides grounded in academic papers or documentation stored in `/sources/`, raw PDF text dumps waste 50% to 85% of LLM context tokens on repeated running headers, footers, page numbers, and bibliographies.

Use the built-in CLI tool before feeding source text to agents:

```bash
# 1. Inspect metadata, section headings, and estimated tokens
npm run read-pdf -- sources/sample-paper.pdf --inspect

# 2. Extract a specific section or chapter (stops at next major heading)
npm run read-pdf -- sources/sample-paper.pdf -s "Activation Regimes"

# 3. Extract targeted page ranges (automatically strips recurring headers & footers)
npm run read-pdf -- sources/sample-paper.pdf -p 1-3

# 4. Search for key concepts and return excerpts with surrounding context
npm run read-pdf -- sources/sample-paper.pdf -q "gradient flow" -c 3

# 5. Semantic chunking for large references
npm run read-pdf -- sources/sample-paper.pdf --chunk-size 1000 --format md

# Python companion CLI also available:
python3 scripts/read_pdf.py sources/sample-paper.pdf --inspect
```

* **Automatic Header & Footer Stripping:** Samples document pages to identify and prune recurring running headers, footers, page numbers, and copyright text.
* **Automatic Reference Stripping:** Automatically removes `References` / `Bibliography` sections (often saving 200–500+ tokens per paper). Use `--keep-refs` to retain them.
* **Ligature & Hyphenation Normalization:** Converts unicode ligatures (`fi`, `fl`, `ff`), soft-hyphens across line breaks, and excessive blank lines.

---

## 🧠 Spaced Repetition (FSRS) & Remediation

* **Daily Review Queue:** Quiz attempts automatically register into a local FSRS spaced repetition queue. Surfaces questions due for review with Again / Hard / Good / Easy ratings.
* **Export to Anki:** One-click export of your study deck to Anki-compatible TSV format.
* **Weak-Spot Exporter:** At the end of a quiz, click "Export Weak Spots for Antigravity" to save `/user-data/remediation-request.json` and copy a prompt to have Antigravity generate a targeted mini-guide.
