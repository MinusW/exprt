# AGENTS.md — `exprt` Study Guide Platform

`exprt` is a local + static GitHub Pages study guide platform. Guides live in `guides/` (`.yaml` preferred, `.json` supported) and are validated before shipping.

## Quick Commands

| Task | Command |
| :--- | :--- |
| Inventory all existing guides, IDs, tracks & `track_order` | `npm run list-guides` (or `-- --json`) |
| Scaffold a new YAML guide (auto-fills `track_order` & `prerequisites`) | `npm run new-guide -- --id <id> --title "<Title>" --category "<Cat>" --track "<Track>"` |
| Convert a legacy `.json` guide to readable `.yaml` before editing | `npm run convert-guide -- guides/<path>.json [--replace]` |
| Read a source PDF token-efficiently (inspect / slice / search) | `npm run read-pdf -- sources/<file>.pdf --inspect` (`-s`, `-p`, `-q`) |
| Fetch a Quarto / GitHub Pages course page as clean Markdown | `npm run fetch-course -- <url> --inspect` (`-s`, `-o`) |
| Validate guide(s) (schema, KaTeX, Kroki, quiz, sim, code lines, tracks) | `npm run validate [guides/<file>.yaml]` |
| Validate + execute sandbox solutions & check for leaked starter code | `npm run validate -- --run-sandboxes [guides/<file>.yaml]` |
| Fast offline validation (skip Kroki/YouTube network calls) | `npm run validate -- --skip-network` |
| Build & typecheck frontend (static GitHub Pages bundle in `dist/`) | `npm run build` |
| Run local dev server + Vite client | `npm run dev` |

## Skills (Single Source of Truth in `skills/`, symlinked at `.agent/skills/`)

Read the relevant skill before authoring:
* [`skills/guide-architect/SKILL.md`](skills/guide-architect/SKILL.md) — Cognitive architecture, 10 block types, **Exam-ROI / Anti-Bloat rules**, YAML authoring, and Docker/loopback sandboxes.
* [`skills/diagram-specialist/SKILL.md`](skills/diagram-specialist/SKILL.md) — Kroki diagram syntax (Mermaid, PlantUML, Graphviz DOT, D2, Vega-Lite).
* [`skills/quiz-remediation/SKILL.md`](skills/quiz-remediation/SKILL.md) — Bloom's calibration, realistic distractors, Socratic hints, and remediation flow.
* [`skills/media-curator/SKILL.md`](skills/media-curator/SKILL.md) — YouTube oEmbed verification and local asset rules.

## Key Conventions

* **Prefer `.yaml` over `.json`** for new guides: use `|` literal block scalars for Markdown, KaTeX, code, and Mermaid so you never fight `\n` or `\"` escaping.
* **Mock Tests vs. Guides:** Include `"mock-exam"`, `"practice-test"`, or `"exam"` in `tags` (or end `id` with `-exam` / `-mock-exam`) so mock exams render distinctly on the dashboard and dependency graph.
* **Sources:** `sources[*].url_or_path` accepts both local `sources/...` files and external `https://...` links.
* **Quiz options are randomized locally:** Never prefix options with `"A) "` / `"B) "`.
* **Sandboxes:** Browser runtimes (`javascript`, `html`, `python`) run everywhere including GitHub Pages. Local Docker/Podman runtimes (`c`, `cpp`, `java`, `bash`, `rust`, `go`) require `npm run server`. Java sandboxes must declare `public class Main` (loopback `127.0.0.1` works inside `--network none`). Bash sandboxes run in `/tmp/playground` with `git` pre-installed.
* **Always verify before finishing:** Run `npm run validate` (plus `--run-sandboxes` when touching sandboxes) and `npm run build` if modifying `src/`.

## Proposing Platform Improvements (`FEATURE_REQUESTS.md`)

* **Content-authoring agents (actively encouraged!):** Whenever you finish authoring a guide—or hit any friction, awkward workaround, missing input/answer format, sandbox limitation, validator gap, or CLI annoyance—**log a `proposed` entry in [`FEATURE_REQUESTS.md`](FEATURE_REQUESTS.md)** before wrapping up. Don't stay silent or assume something is too small: if it would make future guides cleaner or more effective, propose it! Still finish your guide using existing blocks and do not modify `src/` during guide-authoring tasks.
* **Developer agents:** Review `proposed` entries in [`FEATURE_REQUESTS.md`](FEATURE_REQUESTS.md) critically — proposals are **possibilities, not automatic approvals**. Evaluate cross-course ROI, UI simplicity, and GitHub Pages compatibility, then mark each entry `accepted`, `implemented`, or `declined` with a brief rationale.
