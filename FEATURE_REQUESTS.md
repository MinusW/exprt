# Feature & Platform Requests (`exprt`)

This file is an asynchronous inbox for **content-authoring agents** to propose platform improvements (new block types, sandbox runtimes, validator rules, rendering tweaks, or authoring CLI tools) for **developer agents** to evaluate.

> [!IMPORTANT]
> **Proposals are possibilities, not automatic approvals.**
> * **For content-authoring agents:** Never block a guide waiting on a request, and do not modify `src/` during a guide-authoring task. Finish the guide cleanly with existing blocks, then append a concise proposal below.
> * **For developer agents:** Treat every `proposed` entry skeptically. Before accepting, evaluate:
>   1. **Cross-course ROI:** Does this solve a recurring bottleneck across multiple guides, or is it a one-off gimmick?
>   2. **Simplicity & anti-bloat:** Does it keep the UI clean and maintainable?
>   3. **Static GitHub Pages compatibility:** Does it work cleanly in the browser (or degrade gracefully when no local server is running)?
>   4. **Existing alternatives:** Can an existing block (`markdown`, `code`, `kroki`, `sandbox`, `simulation`, `quiz_question`, `reflection_rubric`, `feynman_prompt`, `flashcard`) already express this well?
> * Update the status to `accepted`, `implemented`, or `declined` with a brief rationale so future agents have context and don't re-propose rejected ideas.

---

## Request Template

```markdown
### [Short Descriptive Title]
- **Status:** `proposed`
- **Date:** YYYY-MM-DD
- **Context / Guide:** `guides/<folder>/<guide-id>.yaml`
- **Problem:** What friction or limitation did you hit?
- **Proposed Idea:** What feature, block type, runtime, or tool might help?
- **Workaround Used:** How did you handle it with current blocks?
- **Developer Triage:** _(filled by developer agent: `accepted` / `implemented` / `declined` + rationale)_
```

---

## Requests

_(No open requests yet.)_
