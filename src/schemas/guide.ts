import { z } from 'zod';

export const SourceCitationSchema = z.object({
  title: z.string(),
  url_or_path: z.string(),
  notes: z.string().optional(),
});

export const BaseBlockSchema = z.object({
  id: z.string().min(1, 'Block ID is required'),
  title: z.string().optional(),
  bookmarkable: z.boolean().default(true),
});

// 1. Markdown Block
export const MarkdownBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('markdown'),
  content: z.string().min(1, 'Markdown content cannot be empty'),
});

// 2. Code Block
export const CodeAnnotationSchema = z.object({
  line: z.number().int().positive(),
  note: z.string(),
});

export const CodeBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('code'),
  code: z.string(),
  language: z.string().default('typescript'),
  filename: z.string().optional(),
  highlight_lines: z.array(z.number().int().positive()).optional(),
  annotations: z.array(CodeAnnotationSchema).optional(),
});

// 3. Kroki Diagram Block
export const KrokiDiagramTypeSchema = z.enum([
  'mermaid',
  'plantuml',
  'graphviz',
  'dot',
  'excalidraw',
  'd2',
  'vega',
  'vega-lite',
  'blockdiag',
  'c4plantuml',
  'bpmn',
  'bytefield',
  'seqdiag',
  'actdiag',
  'nwdiag',
  'packetdiag',
  'rackdiag',
  'erd',
  'nomnoml',
  'svgbob',
  'umlet',
  'wavedrom',
  'pikchr',
]);

export const KrokiBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('kroki'),
  diagram_type: KrokiDiagramTypeSchema,
  source: z.string().min(1, 'Diagram source code cannot be empty'),
  caption: z.string().optional(),
});

// 4. Media Block
export const MediaTypeSchema = z.enum(['image', 'audio', 'video', 'youtube']);

export const MediaBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('media'),
  media_type: MediaTypeSchema,
  url: z.string().min(1, 'Media URL or local asset path is required'),
  caption: z.string().optional(),
  start_time: z.number().nonnegative().optional(),
  why_watch: z.string().optional(),
});

// 5. Sandbox Block
export const SandboxRuntimeSchema = z.enum([
  'javascript',
  'html',
  'python',
  'c',
  'cpp',
  'bash',
  'java',
  'rust',
  'go',
]);

export const SandboxBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('sandbox'),
  runtime: SandboxRuntimeSchema.default('javascript'),
  runner: z.enum(['browser', 'docker']).optional(),
  docker_image: z.string().optional(),
  instructions: z.string().min(1, 'Sandbox instructions are required'),
  starter_code: z.string(),
  expected_output: z.string().optional(),
  solution: z.string().optional(),
  hints: z.array(z.string()).optional(),
});

// 6. Simulation Block
export const SimulationVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  default: z.number(),
  unit: z.string().optional(),
});

export const SimulationBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('simulation'),
  description: z.string(),
  formula: z.string().optional(),
  variables: z.array(SimulationVariableSchema).min(1, 'At least one simulation variable is required'),
  compute_expression: z.string().min(1, 'Compute expression is required'),
  chart_type: z.enum(['line', 'bar', 'gauge', 'value']).default('value'),
  output_label: z.string(),
  output_unit: z.string().optional(),
});

// 7. Reflection Rubric Block
export const ReflectionRubricBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('reflection_rubric'),
  prompt: z.string().min(1, 'Reflection prompt is required'),
  self_check_criteria: z.array(z.string()).min(1, 'At least one self-check criterion is required'),
  model_answer: z.string().min(1, 'Model answer is required'),
});

// 8. Feynman Prompt Block
export const FeynmanPromptBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('feynman_prompt'),
  concept: z.string().min(1, 'Concept name is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  target_audience: z.string().default('a high school student with no background in this topic'),
  key_points_to_cover: z.array(z.string()).optional(),
});

// 9. Quiz Question Block
export const QuizQuestionTypeSchema = z.enum([
  'multiple_choice',
  'multi_select',
  'fill_in_the_blank',
  'code_output',
  'short_answer',
]);

export const QuizQuestionBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('quiz_question'),
  question_type: QuizQuestionTypeSchema,
  question: z.string().min(1, 'Quiz question text is required'),
  options: z.array(z.string()).optional(),
  correct_answer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string().min(1, 'Explanation is required'),
  hints: z.array(z.string()).optional(),
  difficulty: z.number().int().min(1).max(5).default(3),
  related_block_id: z.string().min(1, 'Related block ID reference is required'),
});

// 10. Flashcard Block
export const FlashcardBlockSchema = BaseBlockSchema.extend({
  block_type: z.literal('flashcard'),
  front: z.string().min(1, 'Flashcard front prompt/question is required'),
  back: z.string().min(1, 'Flashcard back answer/explanation is required'),
  hint: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Discriminated Block Union
export const GuideBlockSchema = z.discriminatedUnion('block_type', [
  MarkdownBlockSchema,
  CodeBlockSchema,
  KrokiBlockSchema,
  MediaBlockSchema,
  SandboxBlockSchema,
  SimulationBlockSchema,
  ReflectionRubricBlockSchema,
  FeynmanPromptBlockSchema,
  QuizQuestionBlockSchema,
  FlashcardBlockSchema,
]);

// Flexible Section Schema
export const GuideSectionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  title: z.string().min(1, 'Section title is required'),
  description: z.string().optional(),
  blocks: z.array(GuideBlockSchema).min(1, 'Section must contain at least one block'),
});

// Flexible Phases Container (accepts custom phase names or traditional structure)
export const GuidePhasesSchema = z.record(z.string(), z.array(GuideBlockSchema));

// Main Guide Schema (flexible sections or phases, category, track, and organization)
export const GuideSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Guide ID must be a lowercase URL slug (kebab-case)'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  estimated_minutes: z.number().int().positive(),
  category: z.string().optional(),
  track: z.string().optional(),
  track_order: z.number().int().positive().optional(),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  tags: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  layout_mode: z.enum(['single-page', 'multi-page']).default('single-page'),
  sources: z.array(SourceCitationSchema).optional(),
  sections: z.array(GuideSectionSchema).optional(),
  phases: GuidePhasesSchema.optional(),
  folder: z.string().optional(),
}).refine(
  (data) => (data.sections && data.sections.length > 0) || (data.phases && Object.keys(data.phases).length > 0),
  { message: 'Guide must contain either sections or phases with content' }
);

// Helper to normalize any guide into an array of sections for rendering
export function getGuideSections(guide: Guide): GuideSection[] {
  if (guide.sections && guide.sections.length > 0) {
    return guide.sections;
  }
  if (guide.phases) {
    return Object.entries(guide.phases).map(([key, blocks]) => {
      const cleanTitle = key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' ');
      return {
        id: key,
        title: cleanTitle,
        blocks,
      };
    });
  }
  return [];
}

export type SourceCitation = z.infer<typeof SourceCitationSchema>;
export type BaseBlock = z.infer<typeof BaseBlockSchema>;
export type MarkdownBlock = z.infer<typeof MarkdownBlockSchema>;
export type CodeBlock = z.infer<typeof CodeBlockSchema>;
export type KrokiBlock = z.infer<typeof KrokiBlockSchema>;
export type MediaBlock = z.infer<typeof MediaBlockSchema>;
export type SandboxBlock = z.infer<typeof SandboxBlockSchema>;
export type SimulationBlock = z.infer<typeof SimulationBlockSchema>;
export type ReflectionRubricBlock = z.infer<typeof ReflectionRubricBlockSchema>;
export type FeynmanPromptBlock = z.infer<typeof FeynmanPromptBlockSchema>;
export type QuizQuestionBlock = z.infer<typeof QuizQuestionBlockSchema>;
export type FlashcardBlock = z.infer<typeof FlashcardBlockSchema>;
export type GuideBlock = z.infer<typeof GuideBlockSchema>;
export type GuideSection = z.infer<typeof GuideSectionSchema>;
export type GuidePhases = z.infer<typeof GuidePhasesSchema>;
export type Guide = z.infer<typeof GuideSchema>;
