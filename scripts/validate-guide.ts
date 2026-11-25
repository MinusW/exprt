import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import katex from 'katex';
import YAML from 'yaml';
import {
  GuideSchema,
  getGuideSections,
  type Guide,
  type GuideBlock,
  type QuizQuestionBlock,
  type SandboxBlock,
  type SimulationBlock,
} from '../src/schemas/guide.js';
import { runInDocker, type DockerLanguage } from '../src/server/dockerRunner.js';

const execFileAsync = promisify(execFile);
const CACHE_PATH = path.resolve('.validate-cache.json');

interface ValidationResult {
  file: string;
  guide?: Guide;
  success: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidateOptions {
  krokiUrl: string;
  runSandboxes: boolean;
  skipNetwork: boolean;
  useCache: boolean;
  krokiCache: Record<string, boolean>;
  knownGuideIds: Set<string>;
}

const DEFAULT_LOCAL_KROKI = process.env.KROKI_ENDPOINT || 'http://localhost:8000';
const FALLBACK_KROKI = 'https://kroki.io';
const DOCKER_RUNTIMES = new Set<DockerLanguage>(['c', 'cpp', 'java', 'bash', 'rust', 'go']);

function isGuideFile(filename: string): boolean {
  return filename.endsWith('.json') || filename.endsWith('.yaml') || filename.endsWith('.yml');
}

function parseGuideRaw(filePath: string): unknown {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return YAML.parse(fileContent);
  }
  return JSON.parse(fileContent);
}

async function resolveKrokiEndpoint(): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(DEFAULT_LOCAL_KROKI, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok || res.status === 404 || res.status === 200) {
      return DEFAULT_LOCAL_KROKI;
    }
  } catch {
    // Local failed, fallback
  }
  return FALLBACK_KROKI;
}

async function validateKrokiDiagram(
  krokiBaseUrl: string,
  diagramType: string,
  source: string,
  blockId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${krokiBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(diagramType)}/svg`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagram_source: source }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        ok: false,
        error: `[Block '${blockId}'] Kroki ${diagramType} compilation failed (HTTP ${res.status}):\n${errorText.trim()}`,
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `[Block '${blockId}'] Failed to reach Kroki at ${krokiBaseUrl}: ${message}`,
    };
  }
}

async function validateYouTubeOembed(url: string, blockId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      return {
        ok: false,
        error: `[Block '${blockId}'] YouTube video is invalid, private, or not embeddable (HTTP ${res.status}): ${url}`,
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `[Block '${blockId}'] YouTube oEmbed check failed: ${message}`,
    };
  }
}

function loadKrokiCache(): Record<string, boolean> {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    }
  } catch {
    // ignore corrupt cache
  }
  return {};
}

function saveKrokiCache(cache: Record<string, boolean>): void {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // ignore write failures
  }
}

function krokiCacheKey(diagramType: string, source: string): string {
  return crypto.createHash('sha256').update(`${diagramType}\0${source}`).digest('hex');
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function validateLatexInText(
  text: string | undefined,
  blockId: string,
  fieldName: string,
  errors: string[]
): void {
  if (!text) return;
  // Strip fenced code blocks and inline code ticks so `$VAR` in code isn't parsed as math
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');

  const withoutDisplay = stripped.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr: string) => {
    const clean = expr.trim();
    if (!clean) return '';
    try {
      katex.renderToString(clean, { displayMode: true, throwOnError: true, strict: 'ignore' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[Block '${blockId}'] KaTeX error in ${fieldName} ($$...$$): ${msg}`);
    }
    return '';
  });

  withoutDisplay.replace(/\$([^\$\n]+?)\$/g, (_, expr: string) => {
    const clean = expr.trim();
    if (!clean) return '';
    try {
      katex.renderToString(clean, { displayMode: false, throwOnError: true, strict: 'ignore' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[Block '${blockId}'] KaTeX error in ${fieldName} ($...$): ${msg}`);
    }
    return '';
  });
}

function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function jaccardOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (b.has(w)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

function validateSimulationBlock(block: SimulationBlock, errors: string[], warnings: string[]): void {
  const varIds = block.variables.map((v) => v.id);
  let evaluator: (...args: number[]) => unknown;

  try {
    evaluator = new Function(...varIds, `return (${block.compute_expression});`) as (...args: number[]) => unknown;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[Block '${block.id}'] Simulation compute_expression syntax error: ${msg}`);
    return;
  }

  const testCases: Array<{ label: string; values: number[] }> = [
    { label: 'min', values: block.variables.map((v) => v.min) },
    { label: 'default', values: block.variables.map((v) => v.default) },
    { label: 'max', values: block.variables.map((v) => v.max) },
  ];

  for (const tc of testCases) {
    try {
      const raw = evaluator(...tc.values);
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(num)) {
        errors.push(
          `[Block '${block.id}'] Simulation compute_expression returned non-finite value (${String(raw)}) at ${tc.label} inputs (${tc.values.join(', ')}).`
        );
      } else if (/\.\d*(00000|99999)\d*$/.test(String(num))) {
        warnings.push(
          `[Block '${block.id}'] Simulation returns unrounded float (${num}) at ${tc.label} inputs. Consider wrapping with Number((...).toFixed(2)) or Math.round.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[Block '${block.id}'] Simulation threw at ${tc.label} inputs: ${msg}`);
    }
  }
}

async function executeSandboxCode(
  block: SandboxBlock,
  code: string
): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  if (block.runtime === 'html') {
    return { success: true, stdout: '', stderr: '' };
  }

  if (block.runtime === 'javascript') {
    try {
      const { stdout, stderr } = await execFileAsync('node', ['-e', code], { timeout: 5000 });
      return { success: true, stdout, stderr };
    } catch (err: any) {
      return {
        success: false,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        error: err.message,
      };
    }
  }

  if (block.runtime === 'python') {
    try {
      const { stdout, stderr } = await execFileAsync('python3', ['-c', code], { timeout: 5000 });
      return { success: true, stdout, stderr };
    } catch (err: any) {
      return {
        success: false,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        error: err.message,
      };
    }
  }

  if (DOCKER_RUNTIMES.has(block.runtime as DockerLanguage)) {
    const res = await runInDocker({
      runtime: block.runtime as DockerLanguage,
      code,
      image: block.docker_image,
      timeoutMs: 12000,
    });
    return {
      success: res.success,
      stdout: res.stdout,
      stderr: res.stderr,
      error: res.error,
    };
  }

  return { success: false, stdout: '', stderr: '', error: `Unsupported runtime: ${block.runtime}` };
}

function outputMatchesExpected(actualStdout: string, expectedOutput: string): boolean {
  const cleanActual = actualStdout.trim();
  const cleanExpected = expectedOutput.trim();
  return cleanActual === cleanExpected || cleanActual.includes(cleanExpected);
}

async function validateGuideFile(filePath: string, opts: ValidateOptions): Promise<ValidationResult> {
  const result: ValidationResult = {
    file: filePath,
    success: true,
    errors: [],
    warnings: [],
  };

  // 1. Read and parse JSON or YAML
  let rawData: unknown;
  try {
    rawData = parseGuideRaw(filePath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.success = false;
    result.errors.push(`Invalid JSON/YAML file: ${message}`);
    return result;
  }

  // 2. Schema compliance
  const parseResult = GuideSchema.safeParse(rawData);
  if (!parseResult.success) {
    result.success = false;
    for (const issue of parseResult.error.issues) {
      const pathStr = issue.path.join('.');
      result.errors.push(`Schema Error at [${pathStr}]: ${issue.message}`);
    }
    return result;
  }

  const guide = parseResult.data as Guide;
  result.guide = guide;
  const sections = getGuideSections(guide);

  if (sections.length === 0) {
    result.errors.push('Guide must contain at least one section or phase with content blocks.');
    result.success = false;
    return result;
  }

  // 3. Cross-guide prerequisite integrity
  if (guide.prerequisites && guide.prerequisites.length > 0 && opts.knownGuideIds.size > 0) {
    for (const prereqId of guide.prerequisites) {
      if (!opts.knownGuideIds.has(prereqId)) {
        result.errors.push(
          `Prerequisite guide ID '${prereqId}' does not exist in guides/.`
        );
      }
    }
  }

  // 4. Block ID collection & reference integrity
  const blockIds = new Set<string>();
  const duplicateBlockIds = new Set<string>();
  const allBlocks: GuideBlock[] = [];
  const quizBlocks: QuizQuestionBlock[] = [];

  for (const section of sections) {
    if (!Array.isArray(section.blocks) || section.blocks.length === 0) {
      result.errors.push(`Section '${section.title}' (${section.id}) has no content blocks.`);
      continue;
    }

    for (const block of section.blocks) {
      if (blockIds.has(block.id)) {
        duplicateBlockIds.add(block.id);
      }
      blockIds.add(block.id);
      allBlocks.push(block);

      if (block.block_type === 'quiz_question') {
        quizBlocks.push(block);
      }
    }
  }

  if (duplicateBlockIds.size > 0) {
    result.errors.push(
      `Duplicate block IDs found: ${Array.from(duplicateBlockIds).map((id) => `'${id}'`).join(', ')}`
    );
  }

  // 5. Quiz integrity checks
  for (const q of quizBlocks) {
    if (!blockIds.has(q.related_block_id)) {
      result.errors.push(
        `[Block '${q.id}'] Quiz question relates to '${q.related_block_id}', which does not exist in any section.`
      );
    }

    if (q.question_type === 'multiple_choice' || q.question_type === 'multi_select') {
      if (!q.options || q.options.length < 2) {
        result.errors.push(`[Block '${q.id}'] ${q.question_type} must define at least 2 options.`);
      } else {
        // Forbid positional letter/number prefixes like "A) ", "B. ", "1) " because options are randomized
        for (const opt of q.options) {
          if (/^[A-Za-z][).]\s+/.test(opt.trim())) {
            result.errors.push(
              `[Block '${q.id}'] Option "${opt.slice(0, 32)}..." uses a positional prefix (e.g. "A) "). Remove letter prefixes since options are locally randomized.`
            );
          }
        }

        const expectedList = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
        for (const ans of expectedList) {
          if (!q.options.includes(ans)) {
            result.errors.push(
              `[Block '${q.id}'] correct_answer "${ans}" is not an exact match in options.`
            );
          }
        }
      }
    }

    if (!q.hints || q.hints.length < 2) {
      result.warnings.push(
        `[Block '${q.id}'] Quiz has ${q.hints?.length || 0} Socratic hint(s); recommend at least 2.`
      );
    }

    if (q.difficulty === 1) {
      result.warnings.push(
        `[Block '${q.id}'] Quiz has difficulty: 1 (potential giveaway); consider difficulty 2–5.`
      );
    }
  }

  // 6. Code block annotation & highlight_lines bounds + non-blank checks
  for (const b of allBlocks) {
    if (b.block_type === 'code') {
      const codeLines = b.code.split('\n');
      const totalLines = codeLines.length;

      if (b.highlight_lines) {
        for (const lineNum of b.highlight_lines) {
          if (lineNum < 1 || lineNum > totalLines) {
            result.errors.push(
              `[Block '${b.id}'] highlight_lines entry ${lineNum} is out of bounds (code has ${totalLines} lines).`
            );
          } else if (codeLines[lineNum - 1].trim() === '') {
            result.errors.push(
              `[Block '${b.id}'] highlight_lines entry ${lineNum} points to a blank line.`
            );
          }
        }
      }

      if (b.annotations) {
        for (const ann of b.annotations) {
          if (ann.line < 1 || ann.line > totalLines) {
            result.errors.push(
              `[Block '${b.id}'] Annotation line ${ann.line} is out of bounds (code has ${totalLines} lines).`
            );
          } else if (codeLines[ann.line - 1].trim() === '') {
            result.errors.push(
              `[Block '${b.id}'] Annotation line ${ann.line} points to a blank line.`
            );
          }
        }
      }
    }
  }

  // 7. Simulation dry-run checks
  for (const b of allBlocks) {
    if (b.block_type === 'simulation') {
      validateSimulationBlock(b, result.errors, result.warnings);
    }
  }

  // 8. Sandbox static & optional runtime (--run-sandboxes) verification
  for (const b of allBlocks) {
    if (b.block_type === 'sandbox') {
      if (b.runtime === 'java') {
        if (!/\bpublic\s+class\s+Main\b/.test(b.starter_code)) {
          result.errors.push(
            `[Block '${b.id}'] Java sandbox starter_code must declare \`public class Main\` (required by dockerRunner.ts).`
          );
        }
        if (b.solution && !/\bpublic\s+class\s+Main\b/.test(b.solution)) {
          result.errors.push(
            `[Block '${b.id}'] Java sandbox solution must declare \`public class Main\` (required by dockerRunner.ts).`
          );
        }
      }

      if (opts.runSandboxes && b.runtime !== 'html') {
        if (b.solution && b.expected_output !== undefined) {
          const solRes = await executeSandboxCode(b, b.solution);
          if (!solRes.success) {
            result.errors.push(
              `[Block '${b.id}'] Sandbox solution failed to run (${b.runtime}): ${solRes.error || solRes.stderr.trim()}`
            );
          } else if (!outputMatchesExpected(solRes.stdout, b.expected_output)) {
            result.errors.push(
              `[Block '${b.id}'] Sandbox solution output did not match expected_output.\n  Expected: ${JSON.stringify(b.expected_output.trim())}\n  Actual:   ${JSON.stringify(solRes.stdout.trim())}`
            );
          }
        }

        if (b.expected_output !== undefined) {
          const starterRes = await executeSandboxCode(b, b.starter_code);
          if (starterRes.success && outputMatchesExpected(starterRes.stdout, b.expected_output)) {
            result.errors.push(
              `[Block '${b.id}'] Sandbox starter_code ALREADY produces expected_output (leaked solution!).`
            );
          }
        }
      }
    }
  }

  // 9. Sources citations check
  if (guide.sources && guide.sources.length > 0) {
    for (const src of guide.sources) {
      if (/^https?:\/\//i.test(src.url_or_path)) {
        try {
          new URL(src.url_or_path);
        } catch {
          result.errors.push(`Invalid external source URL: ${src.url_or_path}`);
        }
      } else if (src.url_or_path.startsWith('/') || src.url_or_path.startsWith('sources/')) {
        const localSourcePath = path.resolve(src.url_or_path.replace(/^\//, ''));
        if (!fs.existsSync(localSourcePath)) {
          result.warnings.push(`Referenced local source file not found: ${src.url_or_path}`);
        }
      }
    }
  }

  // 9.5 KaTeX syntax dry-run & Anti-Bloat warnings
  for (const section of sections) {
    const hasFeynman = section.blocks.some((b) => b.block_type === 'feynman_prompt');
    const hasRubric = section.blocks.some((b) => b.block_type === 'reflection_rubric');
    if (hasFeynman && hasRubric) {
      result.warnings.push(
        `Section '${section.title}' (${section.id}) contains BOTH a feynman_prompt and a reflection_rubric. Consider keeping only the higher-ROI one.`
      );
    }
  }

  const quizWordSets = quizBlocks.map((q) => ({ id: q.id, words: wordSet(q.question) }));

  for (const b of allBlocks) {
    if (b.block_type === 'markdown') {
      validateLatexInText(b.content, b.id, 'content', result.errors);
    } else if (b.block_type === 'quiz_question') {
      validateLatexInText(b.question, b.id, 'question', result.errors);
      validateLatexInText(b.explanation, b.id, 'explanation', result.errors);
      b.options?.forEach((opt, i) => validateLatexInText(opt, b.id, `options[${i}]`, result.errors));
      b.hints?.forEach((h, i) => validateLatexInText(h, b.id, `hints[${i}]`, result.errors));
    } else if (b.block_type === 'flashcard') {
      validateLatexInText(b.front, b.id, 'front', result.errors);
      validateLatexInText(b.back, b.id, 'back', result.errors);
      const fcWords = wordSet(b.front);
      for (const q of quizWordSets) {
        if (jaccardOverlap(fcWords, q.words) >= 0.75) {
          result.warnings.push(
            `[Block '${b.id}'] Flashcard front closely duplicates quiz '${q.id}'. Consider keeping only one.`
          );
          break;
        }
      }
    } else if (b.block_type === 'simulation' && b.formula) {
      try {
        katex.renderToString(b.formula.replace(/^\$+|\$+$/g, '').trim(), {
          displayMode: true,
          throwOnError: true,
          strict: 'ignore',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`[Block '${b.id}'] KaTeX error in simulation formula: ${msg}`);
      }
    } else if (b.block_type === 'reflection_rubric') {
      validateLatexInText(b.prompt, b.id, 'prompt', result.errors);
      const hasModelAnswer =
        Boolean(b.model_answer && b.model_answer.trim().length > 0) ||
        Boolean(b.model_answer_diagram) ||
        Boolean(b.model_answer_blocks && b.model_answer_blocks.length > 0);
      if (!hasModelAnswer) {
        result.errors.push(
          `[Block '${b.id}'] reflection_rubric must provide at least one of model_answer, model_answer_diagram, or model_answer_blocks.`
        );
      }
      if (b.model_answer) {
        validateLatexInText(b.model_answer, b.id, 'model_answer', result.errors);
      }
      if (b.model_answer_blocks) {
        for (const sb of b.model_answer_blocks) {
          if (sb.block_type === 'markdown') {
            validateLatexInText(sb.content, b.id, `model_answer_blocks[${sb.id}].content`, result.errors);
          }
        }
      }
    } else if (b.block_type === 'feynman_prompt') {
      validateLatexInText(b.prompt, b.id, 'prompt', result.errors);
    }
  }

  // 10. Kroki Dry-Run Check (cached + bounded concurrency)
  if (!opts.skipNetwork) {
    const krokiChecks: Array<{ id: string; diagram_type: string; source: string }> = [];
    for (const b of allBlocks) {
      if (b.block_type === 'kroki') {
        krokiChecks.push({ id: b.id, diagram_type: b.diagram_type, source: b.source });
      } else if (b.block_type === 'quiz_question' && b.explanation_diagram) {
        krokiChecks.push({
          id: `${b.id}.explanation_diagram`,
          diagram_type: b.explanation_diagram.diagram_type,
          source: b.explanation_diagram.source,
        });
      } else if (b.block_type === 'reflection_rubric') {
        if (b.model_answer_diagram) {
          krokiChecks.push({
            id: `${b.id}.model_answer_diagram`,
            diagram_type: b.model_answer_diagram.diagram_type,
            source: b.model_answer_diagram.source,
          });
        }
        if (b.model_answer_blocks) {
          for (const sb of b.model_answer_blocks) {
            if (sb.block_type === 'kroki') {
              krokiChecks.push({
                id: `${b.id}.${sb.id}`,
                diagram_type: sb.diagram_type,
                source: sb.source,
              });
            }
          }
        }
      }
    }
    await runWithConcurrency(krokiChecks, 5, async (b) => {
      const key = krokiCacheKey(b.diagram_type, b.source);
      if (opts.useCache && opts.krokiCache[key]) {
        return;
      }
      const check = await validateKrokiDiagram(opts.krokiUrl, b.diagram_type, b.source, b.id);
      if (!check.ok && check.error) {
        result.errors.push(check.error);
      } else if (check.ok) {
        opts.krokiCache[key] = true;
      }
    });

    // 11. Media & YouTube Verification
    const mediaBlocks = allBlocks.filter((b) => b.block_type === 'media');
    for (const b of mediaBlocks) {
      if (b.block_type === 'media') {
        if (b.media_type === 'youtube') {
          const ytCheck = await validateYouTubeOembed(b.url, b.id);
          if (!ytCheck.ok && ytCheck.error) {
            result.errors.push(ytCheck.error);
          }
        } else if (b.url.startsWith('/assets/') || b.url.startsWith('assets/')) {
          const assetRelPath = b.url.replace(/^\//, '');
          const assetDiskPath = path.resolve(assetRelPath);
          if (!fs.existsSync(assetDiskPath)) {
            result.errors.push(
              `[Block '${b.id}'] Local asset file does not exist on disk: ${assetDiskPath}`
            );
          }
        }
      }
    }
  }

  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

function collectGuideFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let list: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list = list.concat(collectGuideFiles(full));
    } else if (entry.isFile() && isGuideFile(entry.name)) {
      list.push(full);
    }
  }
  return list;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  let runSandboxes = false;
  let skipNetwork = false;
  let useCache = true;
  const fileArgs: string[] = [];

  for (const arg of rawArgs) {
    if (arg === '--run-sandboxes') runSandboxes = true;
    else if (arg === '--skip-network') skipNetwork = true;
    else if (arg === '--no-cache') useCache = false;
    else fileArgs.push(arg);
  }

  const krokiCache = useCache ? loadKrokiCache() : {};

  const guidesDir = path.resolve('guides');
  const allRepoGuideFiles = collectGuideFiles(guidesDir);
  const filesToValidate = fileArgs.length > 0 ? fileArgs : allRepoGuideFiles;

  if (filesToValidate.length === 0) {
    console.log('No guide JSON/YAML files found to validate.');
    process.exit(0);
  }

  // Pre-scan all guides in guides/ for cross-guide prerequisite & track_order validation
  const knownGuideIds = new Set<string>();
  const trackOrderRegistry = new Map<string, Map<number, string[]>>();

  for (const f of allRepoGuideFiles) {
    try {
      const parsed = parseGuideRaw(f) as Partial<Guide>;
      if (parsed?.id) knownGuideIds.add(parsed.id);
      if (parsed?.track && typeof parsed.track_order === 'number') {
        const trackKey = `${parsed.category || ''}::${parsed.track}`;
        let orderMap = trackOrderRegistry.get(trackKey);
        if (!orderMap) {
          orderMap = new Map();
          trackOrderRegistry.set(trackKey, orderMap);
        }
        const existing = orderMap.get(parsed.track_order) || [];
        existing.push(parsed.id || path.basename(f));
        orderMap.set(parsed.track_order, existing);
      }
    } catch {
      // Syntax errors will be reported during individual validation
    }
  }

  const krokiUrl = skipNetwork ? FALLBACK_KROKI : await resolveKrokiEndpoint();
  if (!skipNetwork) {
    console.log(`Using Kroki endpoint: ${krokiUrl}`);
  } else {
    console.log('Skipping network checks (Kroki & YouTube oEmbed).');
  }
  if (runSandboxes) {
    console.log('Sandbox execution verification enabled (--run-sandboxes).');
  }
  console.log('');

  let totalErrors = 0;

  for (const file of filesToValidate) {
    console.log(`Validating: ${file}...`);
    const res = await validateGuideFile(file, {
      krokiUrl,
      runSandboxes,
      skipNetwork,
      useCache,
      krokiCache,
      knownGuideIds,
    });

    if (res.warnings.length > 0) {
      for (const w of res.warnings) {
        console.warn(`  ⚠️  Warning: ${w}`);
      }
    }

    if (res.success) {
      console.log(`  ✅ Passed validation! (${file})\n`);
    } else {
      totalErrors += res.errors.length;
      console.error(`  ❌ Validation failed with ${res.errors.length} error(s):`);
      for (const err of res.errors) {
        console.error(`     - ${err}`);
      }
      console.log('');
    }
  }

  // Cross-guide duplicate track_order check
  for (const [trackKey, orderMap] of trackOrderRegistry.entries()) {
    for (const [orderNum, ids] of orderMap.entries()) {
      if (ids.length > 1) {
        const [, trackName] = trackKey.split('::');
        console.error(
          `❌ Cross-guide error: Duplicate track_order ${orderNum} in track '${trackName}': ${ids.join(', ')}`
        );
        totalErrors++;
      }
    }
  }

  if (!skipNetwork && useCache) {
    saveKrokiCache(krokiCache);
  }

  if (totalErrors > 0) {
    console.error(`\nTotal validation errors: ${totalErrors}`);
    process.exit(1);
  } else {
    console.log('All validated guides passed successfully.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal validator error:', err);
  process.exit(1);
});
