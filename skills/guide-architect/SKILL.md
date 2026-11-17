---
name: guide-architect
description: Master skill explaining how learning happens cognitively and how to author study guides that naturally cultivate deep understanding without artificial software constraints.
---

# Guide Architect: The Cognitive Science of Learning

The `guide-architect` skill guides the creation of high-impact, interactive study guides formatted as JSON files compliant with `schemas/guide.schema.json`.

> [!IMPORTANT]
> **Pedagogical Independence & User Autonomy Principle:**
> 1. **No Artificial Conveyor Belts:** The software intentionally does **not** force the learner through rigid gates or lockouts. The student is an autonomous, curious human. Learning happens through how you craft the journey—weaving orientation, kinesthetic experimentation, metacognitive reflection, and retrieval into the content itself.
> 2. **Bidirectional Progress Sovereignty:** Learning is **not** a unidirectional ratchet. Human memory decays (Ebbinghaus) and mental schemas require ongoing recalibration.
>    * **Checking & Unchecking:** Any section or milestone checked by a user can be **unchecked** whenever they want. If a student reviews a topic a week later and realizes their grasp is rusty, they must be able to mark the section incomplete without software friction.
>    * **Reversible Checklists:** Self-assessment rubrics and self-check criteria can be checked, unchecked, or cleared at will.
>    * **Re-attemptable Diagnostics:** Quizzes allow learners to clear prior answers, re-attempt questions, and update their mastery status.
>    * **Metacognitive Calibration (Dunlosky & Metcalfe):** Genuine self-regulated learning requires empowering the learner to adjust their progress indicators downward when discovering gaps, and upward when solidifying understanding.

---

## 1. How Human Learning Actually Happens

To design an effective study guide, you must understand the cognitive architecture of the human mind:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. MENTAL SCHEMA INGESTION (Orientation & Conceptual Foundations)     │
│    • Cognitive Load Management (Sweller): Working memory is bounded.   │
│    • Dual Coding (Paivio): Verbal prose paired with visual Kroki.       │
│    • Analogical Scaffolding: Anchor new concepts to known intuitions.  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. KINESTHETIC GROUNDING & PREDICTION (Active Exploration)             │
│    • Shatter the "Illusion of Explanatory Depth" (Rozenblit & Keil).   │
│    • Hypothesis -> Manipulation -> Observation feedback loops.        │
│    • Dynamic parameter sliders (simulation) & runnable code (sandbox). │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. METACOGNITIVE ARTICULATION (Synthesis & Reflection)                 │
│    • The Feynman Technique: Translating jargon into plain language.    │
│    • Self-Explanation Effect (Chi): Articulating mechanisms.          │
│    • Calibration via self-check rubrics & unlocked model answers.      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. EFFORTFUL RETRIEVAL & CONSOLIDATION (Diagnostic Assessment & SRS)  │
│    • The Testing Effect (Roediger & Karpicke): Retrieval builds memory.│
│    • Distractor Engineering: Targeting specific, known misconceptions. │
│    • Spaced Repetition (FSRS): Long-term synaptic consolidation.       │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Step 1: Mental Schema Ingestion (Building the Mental Model)
* **The Cognitive Bottleneck:** The human working memory can hold only 4 to 7 discrete items simultaneously. Unbroken walls of dense text trigger cognitive overload, causing the brain to skim and discard information.
* **How Learning Happens Here:**
  1. **Chunking:** Present one coherent sub-concept at a time.
  2. **Concrete before Abstract:** Give the concrete physical intuition or motivation *before* formal mathematical derivations.
  3. **Dual Coding:** The brain processes verbal/textual channels and visual channels in parallel. Pairing a KaTeX derivation with a visual diagram (via `kroki`) doubles cognitive encoding pathways without overloading either channel.
  4. **Explicit Non-Examples:** Show not just what the concept is, but what it is *not* and where naive intuition fails.

### Step 2: Kinesthetic Grounding (Shattering Passive Illusions)
* **The Cognitive Bottleneck:** Passive reading or watching a video creates the **Illusion of Explanatory Depth**—learners nod along and believe they understand because the explanation makes sense in the moment, but they cannot independently generate or apply the knowledge.
* **How Learning Happens Here:**
  1. **The Prediction Loop:** Before running a simulation or code snippet, the learner's brain forms an implicit prediction ("If I increase learning rate $\alpha$, loss will drop faster").
  2. **Active Friction:** When the slider moves and the quadratic loss explodes into divergence ($\alpha k > 2$), the cognitive discrepancy forces the brain to revise its internal model.
  3. **Interactive Sandboxes (`sandbox`):** Coding exercises should test core logic, not boilerplate typing. Provide clear task instructions and verify assertions.
  4. **Dynamic Simulations (`simulation`):** Provide parameterized models (`variables`) where sliders update live KaTeX formulas and dynamic SVG curves or gauges.

### Step 3: Metacognitive Articulation (Synthesis & The Feynman Technique)
* **The Cognitive Bottleneck:** When learners consume good explanations, they confuse familiarity with mastery. They cannot identify the boundaries of their own comprehension.
* **How Learning Happens Here:**
  1. **The Feynman Technique (`feynman_prompt`):** Forcing the learner to explain the concept in plain English for a specified audience (e.g., "a 12-year-old" or "a junior product manager") strips away borrowed jargon. The moment a learner struggles to find a simple analogy, their true knowledge gaps are exposed.
  2. **Calibration Rubrics (`reflection_rubric`):** When the learner writes a draft, provide a structured checklist of essential criteria and an exemplary model answer so they can objectively measure their explanation against expert thinking.

### Step 4: Effortful Retrieval & Consolidation (Assessment & SRS)
* **The Cognitive Bottleneck:** Human memory rapidly decays following an exponential forgetting curve unless reinforced through active recall.
* **How Learning Happens Here:**
  1. **The Testing Effect:** Testing is not an evaluation of learning; testing is the *engine* of learning. Effortful retrieval triggers memory consolidation far more effectively than re-reading notes.
  2. **Realistic Distractor Analysis:** Quiz questions (`quiz_question`) must not have silly throwaway options. Distractors must embody real, predictable errors (e.g., sign flips, confusing variance with standard deviation, forgetting bias terms). The explanation must clarify *why* each distractor is mistaken.
  3. **Spaced Consolidation:** Questions connect to `related_block_id`s, feeding into the app's FSRS spaced repetition queue to surface cards at optimal review intervals.

---

## 2. Guide Structural Anatomy (`schemas/guide.schema.json`)

Study guides are authored as JSON files in [`guides/<id>.json`](file:///var/home/minus/exprt/guides/).

The schema is **flexible**: you can organize guides into modular `sections`, or use traditional phase keys, without being trapped in a rigid format.

```json
{
  "id": "quantum-superposition-basics",
  "title": "Quantum Superposition & State Measurement",
  "description": "An interactive exploration of quantum states, Bloch spheres, and state collapse.",
  "estimated_minutes": 35,
  "tags": ["physics", "quantum-computing"],
  "prerequisites": [],
  "layout_mode": "single-page",
  "sources": [
    {
      "title": "Nielsen & Chuang - Quantum Computation",
      "url_or_path": "sources/quantum-notes.md",
      "notes": "Chapter 1: Quantum Bits"
    }
  ],
  "sections": [
    {
      "id": "sec-classical-vs-quantum",
      "title": "1. Classical Bits vs Qubits",
      "blocks": [ ... ]
    },
    {
      "id": "sec-bloch-sphere-sim",
      "title": "2. Interactive Bloch Sphere Dynamics",
      "blocks": [ ... ]
    },
    {
      "id": "sec-measurement-collapse",
      "title": "3. Measurement & Synthesis",
      "blocks": [ ... ]
    },
    {
      "id": "sec-retrieval-check",
      "title": "4. Knowledge Retrieval & Check",
      "blocks": [ ... ]
    }
  ]
}
```

---

## 3. The 9 Building Block Types

Every block defines:
* `id` (`string`, required): Unique identifier within the guide (e.g., `th-qubit-state`, `exp-slider-theta`).
* `title` (`string`, optional): Human-readable header.
* `bookmarkable` (`boolean`, default: `true`): Allows pinning to the student's Quick Reference Pinboard.

### 1. `markdown`
Rich text with full inline ($...$) and block ($$...$$) KaTeX math, tables, callouts, and lists:
```json
{
  "id": "th-qubit-math",
  "block_type": "markdown",
  "title": "Superposition State Vector",
  "content": "A qubit state $|\\psi\\rangle$ is a linear combination of orthonormal basis states $|0\\rangle$ and $|1\\rangle$:\n\n$$|\\psi\\rangle = \\alpha |0\\rangle + \\beta |1\\rangle$$\n\nWhere $\\alpha, \\beta \\in \\mathbb{C}$ satisfy the normalization condition:\n\n$$|\\alpha|^2 + |\\beta|^2 = 1$$"
}
```

### 2. `code`
Syntax-highlighted code block with line numbering, line highlighting, and explanatory annotations:
```json
{
  "id": "exp-qubit-qiskit",
  "block_type": "code",
  "language": "python",
  "filename": "superposition.py",
  "code": "from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(1, 1)\nqc.h(0)\nqc.measure(0, 0)",
  "highlight_lines": [4, 5],
  "annotations": [
    { "line": 4, "note": "Hadamard gate maps |0> to (|0> + |1>) / sqrt(2)." },
    { "line": 5, "note": "Measurement collapses the superposition with 50/50 probability." }
  ]
}
```

### 3. `kroki`
Visual diagrams (Mermaid, PlantUML, Graphviz DOT, D2, Vega-Lite) with mouse drag-to-pan, zoom, and fullscreen:
```json
{
  "id": "diag-measurement-flow",
  "block_type": "kroki",
  "diagram_type": "mermaid",
  "title": "State Evolution and Collapse",
  "source": "graph LR\n  Init[\"|0⟩ Initial State\"] --> H[\"Hadamard Gate\"]\n  H --> Super[\"(|0⟩ + |1⟩) / √2\"]\n  Super --> Meas{\"Measurement\"}\n  Meas -->|50%| Zero[\"|0⟩ (Collapsed)\"]\n  Meas -->|50%| One[\"|1⟩ (Collapsed)\"]",
  "caption": "Measurement irreversibly collapses the quantum state into a classical outcome."
}
```

### 4. `media`
Targeted multimedia (YouTube, local video/audio/image) with verified oEmbed URL and explicit pedagogical note:
```json
{
  "id": "med-bloch-sphere-3b1b",
  "block_type": "media",
  "media_type": "youtube",
  "title": "Visualizing the Bloch Sphere",
  "url": "https://www.youtube.com/watch?v=aircAruvnKk",
  "start_time": 60,
  "why_watch": "Observe how the state vector rotates on the unit sphere under unitary operations."
}
```

### 5. `sandbox`
Runnable code environment with console capture, assertions, optional Socratic `hints`, and timeout protection.
* **Browser runtimes:** `javascript` (Web Worker), `html` (sandboxed iframe), `python` (Pyodide WebAssembly).
* **Local Docker/Podman container runtimes:** `c`, `cpp`, `java`, `bash`, `rust`, `go` (and optionally `python` or `javascript` when `"runner": "docker"` is set, with optional `"docker_image"` override). Runs in an ephemeral `--network none`, memory- and PID-limited container via the local server:
```json
{
  "id": "exp-sandbox-state",
  "block_type": "sandbox",
  "runtime": "javascript",
  "title": "Compute Measurement Probabilities",
  "instructions": "Given amplitude alpha = 0.6, compute the probability of measuring state |0> (i.e. |alpha|^2).",
  "starter_code": "const alpha = 0.6;\nconst p0 = Math.pow(alpha, 2);\nconsole.log(p0.toFixed(2));",
  "expected_output": "0.36",
  "hints": [
    "Recall that the Born rule states probability $P = |\\alpha|^2$.",
    "Use `Math.pow(alpha, 2)` or `alpha ** 2`."
  ]
}
```

### 6. `simulation`
Parameterized mathematical model where sliders update dynamic KaTeX formulas and SVG curves/gauges:
```json
{
  "id": "exp-sim-bloch",
  "block_type": "simulation",
  "title": "Superposition Probability Distribution",
  "description": "Adjust angle theta from 0 to pi to observe probability P(|0>) = cos^2(theta / 2).",
  "formula": "P(|0\\rangle) = \\cos^2(\\theta / 2)",
  "variables": [
    { "id": "theta", "name": "Angle θ (radians)", "min": 0, "max": 3.1415, "step": 0.05, "default": 1.5708 }
  ],
  "compute_expression": "Math.pow(Math.cos(theta / 2), 2)",
  "chart_type": "line",
  "output_label": "Probability P(|0>)"
}
```

### 7. `reflection_rubric`
Synthesis prompt where the student drafts a response before viewing self-check criteria and a model answer:
```json
{
  "id": "ref-collapse-rubric",
  "block_type": "reflection_rubric",
  "title": "Synthesis: The Measurement Postulate",
  "prompt": "Why can an observer never directly measure the complex amplitudes alpha and beta of a single isolated qubit?",
  "self_check_criteria": [
    "Mentioned that measurement is fundamentally projective and destroys superposition.",
    "Explained that a single measurement yields only 0 or 1, not probabilities.",
    "Noted that determining probabilities requires preparing and measuring an ensemble of identical states."
  ],
  "model_answer": "Measurement irreversibly collapses the superposition into an eigenstate (|0> or |1>). A single outcome provides only one classical bit. Estimating |alpha|^2 and |beta|^2 requires tomography across an ensemble of identically prepared qubits."
}
```

### 8. `feynman_prompt`
Plain-language articulation with 1-click prompt packaging for AI critique:
```json
{
  "id": "ref-feynman-superposition",
  "block_type": "feynman_prompt",
  "concept": "Quantum Superposition",
  "target_audience": "a middle school student",
  "prompt": "Explain what superposition means without saying 'it is both 0 and 1 at the same time', using an analogy like a spinning coin.",
  "key_points_to_cover": [
    "Spinning coin analogy (definite state only when caught)",
    "Deterministic state vector vs probabilistic measurement"
  ]
}
```

### 9. `quiz_question`
Diagnostic assessment item testing application and misconceptions, linked to upstream blocks for SRS, with optional step-by-step Socratic `hints`:
```json
{
  "id": "qz-superposition-calc",
  "block_type": "quiz_question",
  "question_type": "multiple_choice",
  "difficulty": 3,
  "related_block_id": "th-qubit-math",
  "question": "If a qubit is in state $|\\psi\\rangle = \\frac{1}{2}|0\\rangle + \\frac{\\sqrt{3}}{2}|1\\rangle$, what is the probability of measuring state $|1\\rangle$?",
  "options": [
    "1/2 (50%)",
    "3/4 (75%)",
    "sqrt(3)/2 (~86.6%)",
    "1/4 (25%)"
  ],
  "correct_answer": "3/4 (75%)",
  "explanation": "By Born's rule, P(|1>) = |beta|^2 = (sqrt(3)/2)^2 = 3/4 = 0.75. Option 'sqrt(3)/2' mistakenly omits the squaring step; '1/2' confuses the coefficient of |0> with probability; '1/4' is P(|0>).",
  "hints": [
    "Recall that the state vector is written $|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$. What is the value of $\\beta$ here?",
    "Apply Born's probability rule $P(|1\\rangle) = |\\beta|^2$ by squaring the fraction $\\frac{\\sqrt{3}}{2}$."
  ]
}
```

### 10. `flashcard`
Dedicated interactive 3D flip card for high-frequency mental models, definitions, and formulas, fully integrated into the FSRS Spaced Repetition queue:
```json
{
  "id": "fc-born-rule",
  "block_type": "flashcard",
  "title": "Born's Rule & Probability Postulate",
  "front": "What does **Born's Rule** state regarding the probability of measuring state $|i\\rangle$ from state $|\\psi\\rangle = \\sum_i c_i |i\\rangle$?",
  "back": "The probability is given by the squared modulus of the complex probability amplitude:\n\n$$P(|i\\rangle) = |c_i|^2$$\n\nBecause probabilities must sum to 1 across all outcomes, the state vector must satisfy the normalization constraint $\\sum_i |c_i|^2 = 1$.",
  "hint": "Think of the relationship between complex amplitude and real probability.",
  "tags": ["quantum-mechanics", "linear-algebra", "postulates"]
}
```

---

## 4. Mandatory Quality Verification

Before finalizing any guide, run the validator:
```bash
npm run validate guides/<guide-id>.json
```
The validator checks:
* JSON schema compliance.
* Kroki diagram compilation via live dry run.
* YouTube oEmbed verification (ensuring video exists and is embeddable).
* Disk existence of local `/assets/` and `/sources/`.
* `related_block_id` links pointing to valid blocks within the guide.

---

## 5. Primary Source Grounding & Token-Efficient PDF Reading

When authoring study guides grounded in primary literature (stored in `/sources/`), **never** ingest raw, uncleaned PDF text directly into your context window. Academic papers contain 50% to 85% token waste (repeated running headers, page numbers, repetitive copyright strings, and massive bibliographies).

Always use the project's token-optimized PDF CLI tool:

### 1. Inspect Document Structure & Headings First
```bash
npm run read-pdf -- sources/<paper>.pdf --inspect
# or python companion:
python3 scripts/read_pdf.py sources/<paper>.pdf --inspect
```
Quickly scans metadata, detects document outline/headings, and estimates total tokens without dumping full text.

### 2. Extract Specific Key Sections
```bash
# Slices directly to the requested chapter/section and stops at the next major heading:
npm run read-pdf -- sources/<paper>.pdf -s "Activation Regimes"
```

### 3. Extract Targeted Page Ranges
```bash
# Extract only relevant pages with recurring headers and footers automatically stripped:
npm run read-pdf -- sources/<paper>.pdf -p 2-5
```

### 4. Search for Precise Theoretical Concepts
```bash
# Returns targeted excerpts with surrounding context lines:
npm run read-pdf -- sources/<paper>.pdf -q "non-convex manifolds" -c 3
```

### 5. Semantic Chunking for Large References
```bash
# Divides long documents into bounded token budgets (e.g., 1000 tokens) at paragraph boundaries:
npm run read-pdf -- sources/<paper>.pdf --chunk-size 1000
```
* **References Stripped by Default:** The tool automatically trims `References` / `Bibliography` sections (often 200–500+ tokens per paper) unless explicitly preserved with `--keep-refs`.
* **Cleaned Text:** Automatically resolves unicode ligatures (`fi`, `fl`, `ff`), unwraps soft-hyphens across line breaks, and collapses extraneous vertical whitespace.
