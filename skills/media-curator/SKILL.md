---
name: media-curator
description: Specialist skill for curating, verifying, timestamping, and pedagogically scaffolding high-signal multimedia assets (YouTube, video, audio, image) in study guides.
---

# Media Curator Skill

The `media-curator` skill governs the selection, verification, and integration of multimedia resources into Antigravity study guides. Embedded media is never meant to replace rigorous study; it serves to provide dynamic visual intuition for spatial, geometric, or temporal concepts that text alone struggles to convey.

---

## 1. Pedagogical Principles for Media Curation

1. **High Signal-to-Noise Ratio (Micro-Content):**
   * Prefer concise, mathematically focused animations (e.g., 3Blue1Brown, StatQuest, Stanford CS231n visual explainers) over 60-minute recorded lecture halls.
   * Target specific 2-to-5 minute segments rather than embedding entire unclipped playlists.
2. **Pedagogical Framing via `why_watch`:**
   * Every media block **must** include an explicit `why_watch` attribute.
   * Frame exactly what the learner must observe. For example: *"Pay attention to how the decision boundary line rotates around the origin between 2:15 and 3:10 as synaptic weights adjust."*
3. **Temporal Precision via `start_time`:**
   * Always set `start_time` (in seconds) to jump directly over channel intros, sponsor segments, or prerequisite recaps.
4. **Integration with Surrounding Text:**
   * Place the media block immediately adjacent to the theoretical derivation or right before an interactive simulation where the learner puts that visual intuition into practice.

---

## 2. Mandatory Verification Protocol

To prevent 404s, broken embeds, and invalid assets from degrading the student experience, all media blocks must pass automated validation before committing.

### A. YouTube oEmbed Verification
Never guess or hallucinate a YouTube URL. Every YouTube URL must return HTTP 200 from the public oEmbed endpoint:

```bash
curl -s -f "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<VIDEO_ID>&format=json"
```

If this returns HTTP 404, 401, or 403:
* The video is private, deleted, or restricted from external iframe embedding.
* **Do not use it.** Find an alternative verified video or replace the block with an interactive Kroki diagram or simulation.

### B. Local Asset Disk Verification
When referencing local assets (`assets/...` or `/assets/...`):
* The file must physically reside in the project's `assets/` directory.
* Supported formats: `.png`, `.jpg`, `.svg`, `.mp4`, `.webm`, `.mp3`.
* Verify existence on disk:
  ```bash
  ls -lh assets/<asset_filename>
  ```
  Missing local assets will cause `npm run validate` to fail immediately.

---

## 3. Supported Media Block Types & Configurations

| Media Type | Description | Key Attributes |
| :--- | :--- | :--- |
| `youtube` | High-definition streaming video hosted on YouTube | `url`, `start_time`, `why_watch`, `caption` |
| `video` | Locally hosted or direct HTML5 MP4/WebM video stream | `url`, `caption`, `why_watch` |
| `audio` | Spoken explanations, podcasts, or audio walk-throughs | `url`, `caption`, `why_watch` |
| `image` | Static infographics, architectural schematics, or reference tables | `url`, `caption` |

---

## 4. Gold-Standard JSON Media Snippets

### Example 1: Precision-Scaffolded YouTube Video
Focusing learner attention on geometric hyperplanes in neural networks.

```json
{
  "id": "th-media-3b1b-neural-nets",
  "block_type": "media",
  "media_type": "youtube",
  "title": "Geometric Intuition of High-Dimensional Neurons",
  "url": "https://www.youtube.com/watch?v=aircAruvnKk",
  "start_time": 142,
  "why_watch": "Observe how individual neurons act as biological switches that compute affine transformations followed by a continuous activation squashing. Focus on the visual representation of the layer-by-layer activation cascade.",
  "caption": "3Blue1Brown - Chapter 1: But what is a neural network? (Watch from 2:22 to 5:40)",
  "bookmarkable": true
}
```

### Example 2: YouTube Embed for Loss Landscapes and Optimization
Demonstrating gradient descent navigating a 2D non-convex surface.

```json
{
  "id": "th-media-3b1b-gradient-descent",
  "block_type": "media",
  "media_type": "youtube",
  "title": "Visualizing Gradient Descent on Loss Landscapes",
  "url": "https://www.youtube.com/watch?v=IHZwWFHWa-w",
  "start_time": 180,
  "why_watch": "Notice how the gradient vector always points in the direction of steepest ascent, meaning our parameter update must step in the exact opposite direction. Observe the behavior of the step size as the gradient flattens near the minimum.",
  "caption": "3Blue1Brown - Chapter 2: Gradient descent, how neural networks learn",
  "bookmarkable": true
}
```

### Example 3: Local Image Asset with Pedagogical Caption
Embedding an architectural schematic from the project assets folder.

```json
{
  "id": "th-media-activation-curves",
  "block_type": "media",
  "media_type": "image",
  "title": "Comparison of Activation Function Derivative Profiles",
  "url": "/assets/activation-derivatives.png",
  "caption": "Derivative curves of Sigmoid, Tanh, and ReLU. Notice how Sigmoid's maximum derivative is 0.25, which leads to exponential vanishing of gradients across deep layers.",
  "why_watch": "Compare the saturation zones where the derivative approaches zero with ReLU's constant derivative of 1.0 for positive inputs.",
  "bookmarkable": true
}
```

---

## 5. Media Curator Anti-Patterns to Avoid

* ❌ **Vague `why_watch`:** `"Watch this video to learn more about AI."` (Provides zero cognitive guidance).
* ✅ **Targeted `why_watch`:** `"Watch from 03:15 to 04:30. Notice how the loss oscillates when the learning rate exceeds 1.2."`
* ❌ **Missing `start_time`:** Forcing the learner to sit through channel sponsorship pitches or boilerplate channel intros.
* ❌ **Unchecked YouTube IDs:** Copy-pasting random links from memory without testing `https://www.youtube.com/oembed`.
* ❌ **Passive Media Dumps:** Dropping 4 consecutive video blocks without surrounding theoretical context, diagrams, or reflection checkpoints.
