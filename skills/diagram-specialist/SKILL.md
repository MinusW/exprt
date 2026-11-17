---
name: diagram-specialist
description: Specialist skill for architecting Kroki-rendered diagrams (Mermaid, PlantUML, Graphviz DOT, Vega-Lite, D2) with cognitive visual hierarchy and JSON-safe syntax.
---

# Diagram Specialist Skill

The `diagram-specialist` skill governs the creation of clear, pedagogically illuminating Kroki diagrams within study guides. Visualizations in study guides do not exist for mere decoration—they act as cognitive scaffolds that bridge abstract mathematical formalism and concrete operational intuition (Paivio's Dual-Coding Hypothesis).

---

## 1. Diagram Engine Selection Matrix

Select the engine best aligned with the cognitive goal of the visual:

| Engine | Ideal Pedagogical Objective | Recommended Diagram Types |
| :--- | :--- | :--- |
| **`mermaid`** | State transitions, dataflow pipelines, step-by-step algorithms, sequence interactions | `flowchart LR`, `flowchart TD`, `sequenceDiagram`, `stateDiagram-v2` |
| **`plantuml`** | Object-oriented models, C4 component architectures, deep class relationships | Class diagrams, component diagrams, deployment topologies |
| **`graphviz` (`dot`)** | Computational graphs, automatic acyclic layout (DAGs), neural layer connectivity, AST trees | `digraph` with custom rankdir and node records |
| **`vega-lite`** | Quantitative function shapes, loss curves, distribution histograms, parameter sweeps | Declarative 2D Cartesian plots and distributions |
| **`d2`** | Modern cloud infrastructure, distributed microservices, network boundary diagrams | Structured architecture topologies |
| **`bytefield`** | Low-level memory layout, network protocol packet headers, binary struct byte offsets | Memory and protocol layout specs |

---

## 2. Visual Hierarchy, Cognitive Load & Aesthetics

To prevent visual clutter and maximize learning transfer:

1. **Information Density Cap:** Limit diagrams to **10–15 primary nodes** per diagram block. If a system is more complex, decompose it into progressive diagrams across successive guide sections.
2. **Explicit Flow Direction:**
   * Use **Left-to-Right (`LR`)** for computational data pipelines, forward propagation, and temporal progression.
   * Use **Top-to-Bottom (`TD`)** for hierarchical decompositions, ASTs, and taxomomies.
3. **Semantic Color Palette:**
   * **Input / Features:** Soft Slate or Sky (`#e2e8f0` / `#0284c7`).
   * **Processing / Transformations:** Indigo or Violet (`#e0e7ff` / `#4f46e5`).
   * **Success / Activated / Converged:** Emerald (`#d1fae5` / `#059669`).
   * **Loss / Error / Divergence:** Rose or Amber (`#ffe4e6` / `#e11d48`).
4. **Subgraphs as Conceptual Chunks:** Group logically related nodes into subgraphs or clusters with clear titles (e.g. `subgraph InputLayer`, `subgraph HiddenLayer`).

---

## 3. Strict JSON Escaping & Formatting Guardrails

When embedding diagram source code in a JSON block:

1. **Newline Escaping:** Replace every line break with literal `\n`.
2. **Quote Escaping:** Double quotes within the diagram text must be escaped as `\"`.
3. **Node Labels with Special Characters in Mermaid:**
   * Always wrap labels in double quotes inside brackets: `node1["Step 1: Compute z = w·x + b"]`.
   * Unquoted parentheses or math symbols (e.g. `node1[Step 1: Compute (w·x)]`) will cause Mermaid parser crashes.
4. **PlantUML Encapsulation:**
   * PlantUML source code **must** start with `@startuml\n` and end with `\n@enduml`.
   * Keep skins clean with `skinparam monochrome false` or minimal modern styles.
5. **Dry-Run Validation:**
   * Before committing, test diagrams against Kroki's HTTP endpoint:
     ```bash
     curl -s -X POST https://kroki.io/<engine>/svg \
       -H "Content-Type: application/json" \
       -d '{"diagram_source": "<escaped_source>"}'
     ```
   * If Kroki returns anything other than an SVG, resolve syntax errors immediately.

---

## 4. Gold-Standard JSON Diagram Snippets

### Example 1: Mermaid Forward Propagation Pipeline
A clean flowchart showing how signals flow through a single artificial neuron.

```json
{
  "id": "th-diagram-perceptron-flow",
  "block_type": "kroki",
  "diagram_type": "mermaid",
  "title": "Perceptron Computation Graph",
  "caption": "Inputs are weighted, accumulated with bias, and transformed by a non-linear activation function.",
  "source": "graph LR\n  subgraph Inputs [\"Feature Inputs\"]\n    x1[\"Feature x₁\"]\n    x2[\"Feature x₂\"]\n    xn[\"Feature xₙ\"]\n  end\n\n  subgraph Synapses [\"Synaptic Weights\"]\n    w1[\"Weight w₁\"]\n    w2[\"Weight w₂\"]\n    wn[\"Weight wₙ\"]\n  end\n\n  subgraph Neuron [\"Neuron Computation\"]\n    bias[\"Bias b\"]\n    sum((\"Σ\\nz = w·x + b\"))\n    act[\"Activation σ(z)\\n(e.g., ReLU, Sigmoid)\"]\n  end\n\n  out([\"Output Activation a\"])\n\n  x1 --> w1 --> sum\n  x2 --> w2 --> sum\n  xn --> wn --> sum\n  bias --> sum\n  sum --> act\n  act --> out\n\n  classDef input fill:#f0f9ff,stroke:#0284c7,stroke-width:1.5px;\n  classDef synapse fill:#f8fafc,stroke:#94a3b8,stroke-width:1px;\n  classDef neuron fill:#ede9fe,stroke:#6366f1,stroke-width:2px;\n  classDef output fill:#ecfdf5,stroke:#059669,stroke-width:2px;\n\n  class x1,x2,xn input;\n  class w1,w2,wn synapse;\n  class sum,act neuron;\n  class out output;",
  "bookmarkable": true
}
```

### Example 2: PlantUML Object-Oriented Architecture
Clean UML class diagram modeling a deep learning layer hierarchy.

```json
{
  "id": "th-diagram-layer-classes",
  "block_type": "kroki",
  "diagram_type": "plantuml",
  "title": "Neural Network Layer Class Hierarchy",
  "caption": "Object-oriented abstraction of trainable parameters and forward/backward computational passes.",
  "source": "@startuml\nskinparam classAttributeIconSize 0\nskinparam classBackgroundColor #f8fafc\nskinparam classBorderColor #475569\n\nabstract class Layer {\n  + forward(inputs: Tensor): Tensor\n  + backward(grad_output: Tensor): Tensor\n  + get_params(): List[Tensor]\n}\n\nclass DenseLayer {\n  - weights: Tensor\n  - biases: Tensor\n  + forward(inputs: Tensor): Tensor\n  + backward(grad_output: Tensor): Tensor\n}\n\nclass ActivationLayer {\n  - activation_fn: Callable\n  + forward(inputs: Tensor): Tensor\n  + backward(grad_output: Tensor): Tensor\n}\n\nclass SequentialModel {\n  - layers: List[Layer]\n  + add(layer: Layer): void\n  + forward(x: Tensor): Tensor\n  + backward(loss_grad: Tensor): void\n}\n\nLayer <|-- DenseLayer\nLayer <|-- ActivationLayer\nSequentialModel o-- Layer\n@enduml",
  "bookmarkable": true
}
```

### Example 3: Graphviz DOT Computational Backpropagation Graph
Explicit directed acyclic graph (DAG) modeling reverse automatic differentiation.

```json
{
  "id": "th-diagram-backprop-dag",
  "block_type": "kroki",
  "diagram_type": "graphviz",
  "title": "Computational Graph and Gradient Flow",
  "caption": "Forward pass computes intermediate activations (black arrows); backward pass propagates partial derivatives (dashed red arrows).",
  "source": "digraph Backprop {\n  rankdir=LR;\n  node [fontname=\"Helvetica\", shape=box, style=\"rounded,filled\", fillcolor=\"#f1f5f9\", color=\"#64748b\"];\n  edge [fontname=\"Helvetica\", fontsize=10];\n\n  X [label=\"Input: x\"];\n  W [label=\"Weight: w\"];\n  B [label=\"Bias: b\"];\n  Z [label=\"Linear: z = wx + b\", fillcolor=\"#e0e7ff\", color=\"#4f46e5\"];\n  A [label=\"Activation: a = σ(z)\", fillcolor=\"#ede9fe\", color=\"#7c3aed\"];\n  L [label=\"Loss: L(a, y)\", fillcolor=\"#ffe4e6\", color=\"#e11d48\"];\n\n  // Forward pass\n  X -> Z [label=\"forward\"];\n  W -> Z [label=\"forward\"];\n  B -> Z [label=\"forward\"];\n  Z -> A [label=\"forward\"];\n  A -> L [label=\"forward\"];\n\n  // Backward pass\n  L -> A [style=dashed, color=\"#e11d48\", label=\"∂L/∂a\"];\n  A -> Z [style=dashed, color=\"#e11d48\", label=\"∂L/∂z = (∂L/∂a)·σ'(z)\"];\n  Z -> W [style=dashed, color=\"#e11d48\", label=\"∂L/∂w = (∂L/∂z)·x\"];\n  Z -> B [style=dashed, color=\"#e11d48\", label=\"∂L/∂b = ∂L/∂z\"];\n}",
  "bookmarkable": true
}
```

### Example 4: Mermaid State Machine of Gradient Descent Iteration
Visualizing the iterative state loop of an optimizer.

```json
{
  "id": "th-diagram-gd-lifecycle",
  "block_type": "kroki",
  "diagram_type": "mermaid",
  "title": "Gradient Descent Optimization Lifecycle",
  "caption": "Continuous optimization loop with convergence condition check.",
  "source": "stateDiagram-v2\n  [*] --> InitializeParameters: Random weights θ₀, learning rate α\n  InitializeParameters --> ComputeLoss: Forward pass on mini-batch\n  ComputeLoss --> ComputeGradients: Backpropagate loss to calculate ∇J(θ)\n  ComputeGradients --> UpdateWeights: θ := θ - α·∇J(θ)\n  UpdateWeights --> CheckConvergence: Evaluate ||∇J(θ)|| < ε or epoch limit\n  CheckConvergence --> ComputeLoss: Not converged\n  CheckConvergence --> [*]: Converged (Optimal θ*)",
  "bookmarkable": true
}
```
