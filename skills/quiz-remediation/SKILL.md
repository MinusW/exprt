---
name: quiz-remediation
description: Specialist skill for crafting diagnostic assessments, realistic distractor engineering, Bloom's taxonomy calibration, and automated remediation workflows from weak-spot reports.
---

# Quiz Remediation Skill

The `quiz-remediation` skill governs the creation of diagnostic assessment items and the automated generation of targeted remediation guides based on student performance data.

Quizzes in this platform are not passive scorekeeping mechanisms—they are **diagnostic instruments** designed to detect cognitive bugs, reinforce memory traces via retrieval practice, and drive targeted remediation.

---

## 1. Principles of Diagnostic Assessment Design

### A. Cognitive Calibration (Bloom's Revised Taxonomy)
Every quiz should contain a balanced mix of cognitive challenge levels:

| Level | Cognitive Action | Example Task |
| :--- | :--- | :--- |
| **Level 1–2 (Remember / Understand)** | Identify, recognize, explain definitions | Explain why stacking linear activation functions produces a single linear transformation. |
| **Level 3 (Apply)** | Compute, calculate, predict outputs | Compute the updated parameter $\theta_1$ given initial $\theta_0=2$, $\alpha=0.1$, and gradient $\nabla J=3$. |
| **Level 4–5 (Analyze / Evaluate)** | Diagnose faults, compare trade-offs, troubleshoot | Diagnose whether a model is suffering from vanishing gradients versus dying ReLUs based on activation variance. |

### B. Realistic Distractor Engineering
Never include frivolous or nonsensical distractors. Every wrong answer must represent a **real, predictable misconception**:
* **Sign Error Distractor:** Updating $\theta \leftarrow \theta + \alpha \nabla J$ (gradient ascent) instead of $\theta \leftarrow \theta - \alpha \nabla J$ (gradient descent).
* **Bias Omission Distractor:** Forgetting the additive bias $b$ when calculating $z = \mathbf{w}^T \mathbf{x} + b$.
* **Shape / Dimensionality Distractor:** Confusing inner product dimension with outer product dimension.
* **Derivative Maximum Distractor:** Believing Sigmoid derivative reaches 1.0 rather than $\max(\sigma'(z)) = 0.25$.

### C. Exhaustive Explanation Architecture
The `explanation` string must never be a terse `"Option B is correct"`. It must:
1. State the fundamental governing principle.
2. Walk through the exact calculation or logic that produces the correct answer.
3. Explicitly dissect why each wrong option is tempting but incorrect.

### D. Traceability via `related_block_id`
Every quiz question **must** define a `related_block_id` pointing to an existing block in the guide (within `sections`, `phases.theory`, or `phases.experience`).
* If a learner misses question `qz-learning-rate`, the app links directly to `th-learning-rate-regimes`.
* The weak-spot remediation pipeline uses this ID to pull foundational context into the remediation package.

### E. Bidirectional Mastery & Re-attempt Sovereignty
Quizzes are diagnostic instruments, not high-stakes examinations:
* **Never Lock Learners Out:** Once a question has been answered, the learner is always free to click `"Re-attempt Question"` or `"Try Again"` to clear their recorded response and try fresh.
* **Recalibration Over Permanence:** When a student returns to a guide to refresh their knowledge, they must be able to clear or re-evaluate questions, update their progress, and generate updated weak-spot reports without artificial barriers.
* **Automatic Option Randomization:** `multiple_choice` and `multi_select` options are automatically shuffled locally in both the Quiz UI and SRS Review Queue (preserving canonical `True`/`False` or `Yes`/`No` order and pinning `All/None of the above` at the end), so authors should never rely on option letter labels like `"A) ..."` or positional order.

### F. Progressive Socratic Hint Scaffolding (`hints`)
Every diagnostic quiz question should incorporate an array of 2 to 3 step-by-step Socratic `hints`:
* **Hint 1 (Conceptual Activation):** Guides the learner to recall the relevant physical/mathematical law or definition without revealing numbers.
* **Hint 2 (Intermediate Formulation):** Outlines the mathematical operation or algebraic substitution required.
* **Hint 3 (Sanity Check / Verification):** Provides a bounds check or sanity test that helps the student self-correct without giving away the final answer.

### G. Rich Formatting & Diagrams in Explanations
`question` supports LaTeX math (`$...$` / `$$...$$`) and fenced code blocks. `explanation` renders full Rich Markdown (GFM headings, bullet/numbered lists, tables, blockquotes, syntax-highlighted fenced code blocks, and KaTeX math) so answers never collapse into flat walls of text. When a visual trace, state machine, or architecture diagram clarifies why an answer is right, include an optional `explanation_diagram` (`{ diagram_type, source, title?, caption? }`), which is validated against Kroki and rendered in both the Quiz and SRS review drawers.

---

## 2. Supported Question Types & JSON Schemas

### Type 1: `multiple_choice` (Single correct option)
```json
{
  "id": "qz-gradient-update-calc",
  "block_type": "quiz_question",
  "question_type": "multiple_choice",
  "title": "Single-Step Gradient Descent Calculation",
  "question": "Given a parameter $\\theta = 4.0$, a learning rate $\\alpha = 0.05$, and an objective function $J(\\theta) = \\theta^2$, what is the updated value of $\\theta$ after one gradient descent step?",
  "options": [
    "3.6",
    "4.4",
    "3.2",
    "0.4"
  ],
  "correct_answer": "3.6",
  "explanation": "The gradient of $J(\\theta) = \\theta^2$ is $\\nabla J(\\theta) = 2\\theta$. At $\\theta = 4.0$, $\\nabla J = 2(4.0) = 8.0$. The gradient descent update rule is $\\theta^{(1)} = \\theta^{(0)} - \\alpha \\nabla J(\\theta) = 4.0 - (0.05 \\times 8.0) = 4.0 - 0.4 = 3.6$.\n\n* '4.4' is a sign error (gradient ascent: adding instead of subtracting).\n* '3.2' mistakenly uses $\\nabla J = 4\\theta$.\n* '0.4' is only the step size $\\Delta \\theta$, forgetting to subtract it from initial $\\theta$.",
  "difficulty": 2,
  "related_block_id": "th-gd-update-math",
  "bookmarkable": true
}
```

### Type 2: `multi_select` (Array of correct options)
```json
{
  "id": "qz-relu-properties",
  "block_type": "quiz_question",
  "question_type": "multi_select",
  "title": "Properties of the Rectified Linear Unit (ReLU)",
  "question": "Which of the following statements regarding the Rectified Linear Unit ($f(z) = \\max(0, z)$) are correct? (Select all that apply)",
  "options": [
    "It mitigates the vanishing gradient problem for positive inputs because its derivative is identically 1.0 when $z > 0$.",
    "It is computationally cheaper than Sigmoid and Tanh because it requires no exponential function evaluations.",
    "Its output is zero-centered with a mean of 0.0 across standard normal inputs.",
    "Neurons can permanently 'die' if large negative gradients cause them to never activate for any dataset sample."
  ],
  "correct_answer": [
    "It mitigates the vanishing gradient problem for positive inputs because its derivative is identically 1.0 when $z > 0$.",
    "It is computationally cheaper than Sigmoid and Tanh because it requires no exponential function evaluations.",
    "Neurons can permanently 'die' if large negative gradients cause them to never activate for any dataset sample."
  ],
  "explanation": "ReLU has a derivative of 1.0 for $z > 0$, preventing vanishing gradients, and consists of a simple threshold check (max(0,z)), making it extremely efficient. It can suffer from the 'dying ReLU' phenomenon when large weight updates shift pre-activations into the permanent negative regime. However, ReLU is strictly non-negative ($f(z) \\ge 0$), meaning its outputs are NEVER zero-centered (unlike Tanh).",
  "difficulty": 3,
  "related_block_id": "th-activation-functions",
  "bookmarkable": true
}
```

### Type 3: `code_output` (Predict code console output)
```json
{
  "id": "qz-sandbox-output-check",
  "block_type": "quiz_question",
  "question_type": "code_output",
  "title": "Predict Output: Forward Pass Dot Product",
  "question": "Consider the following JavaScript forward pass execution:\n\n```javascript\nconst x = [1, 2];\nconst w = [0.5, -0.5];\nconst b = 1.0;\nconst z = x[0]*w[0] + x[1]*w[1] + b;\nconst relu = Math.max(0, z);\nconsole.log(relu);\n```\n\nWhat value is logged to the console?",
  "options": [
    "0.5",
    "0",
    "1.5",
    "-0.5"
  ],
  "correct_answer": "0.5",
  "explanation": "Compute $z$: $x_0 \\cdot w_0 + x_1 \\cdot w_1 + b = (1 \\times 0.5) + (2 \\times -0.5) + 1.0 = 0.5 - 1.0 + 1.0 = 0.5$. Then apply ReLU: $\\max(0, 0.5) = 0.5$. Because $z$ is positive, ReLU leaves it unchanged.",
  "difficulty": 2,
  "related_block_id": "exp-sandbox-forward-pass",
  "bookmarkable": true
}
```

### Type 4: `fill_in_the_blank`
```json
{
  "id": "qz-sgd-batch-blank",
  "block_type": "quiz_question",
  "question_type": "fill_in_the_blank",
  "title": "Stochastic Gradient Descent Batch Size",
  "question": "In pure Stochastic Gradient Descent (SGD), the parameter update is computed using a batch size of exactly ___ training sample(s) per step.",
  "correct_answer": "1",
  "explanation": "Pure SGD computes the gradient $\\nabla J_i(\\theta)$ using a batch size of exactly 1 training example per step. Mini-batch gradient descent uses a batch size between 16 and 512, while Batch Gradient Descent uses the entire training dataset ($m$).",
  "difficulty": 1,
  "related_block_id": "th-batch-vs-sgd",
  "bookmarkable": true
}
```

---

## 3. Automated Remediation Workflow

When a learner struggles with a guide, `exprt` collects missed questions, user choices, and self-reflection notes, allowing the student to click **"Export Weak Spots"**. This writes a structured remediation report to:

```text
user-data/remediation-request.json
```

### Structure of `remediation-request.json`:
```json
{
  "guide_id": "gradient-descent-optimization",
  "guide_title": "Gradient Descent and Optimization: Navigating the Loss Landscape",
  "timestamp": 1709500000000,
  "summary": {
    "total_questions": 5,
    "correct_count": 3,
    "missed_count": 2,
    "accuracy_percentage": 60
  },
  "missed_questions": [
    {
      "question_id": "qz-learning-rate-divergence",
      "question": "What causes gradient descent to oscillate wildly...",
      "selected_answer": "Learning rate is too small",
      "correct_answer": "Learning rate exceeds 2 / lambda_max",
      "related_block_id": "th-learning-rate-regimes",
      "explanation": "..."
    }
  ],
  "reflection_notes": {
    "ref-curvature-prompt": "I was confused about why curvature in one dimension affects the step in another dimension."
  }
}
```

### Step-by-Step Remediation Mini-Guide Generation:
1. **Ingest Report:** Read `/user-data/remediation-request.json`.
2. **Isolate Misconceptions:** Identify the root cognitive misconception behind each `selected_answer` vs `correct_answer`.
3. **Trace upstream context:** Read the block specified in `related_block_id`.
4. **Author Targeted Mini-Guide (`guides/remediation-<guide-id>.json`):**
   * **Targeted Theory Block:** Re-explains the specific sticking point using an alternative analogy or visual model.
   * **Targeted Simulation / Sandbox Block:** Provides a focused parameter configuration isolating the exact error case (e.g., slider showing divergent oscillations when $\alpha > 1.0$).
   * **Isomorphic Diagnostic Question:** Tests whether the misconception has been eliminated using a new scenario with different numbers.
5. **Validate & Deliver:** Run `npm run validate guides/remediation-<guide-id>.json` and alert the learner that their personalized remediation module is ready.
