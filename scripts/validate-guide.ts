import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { GuideSchema, getGuideSections, type Guide, type GuideBlock, type QuizQuestionBlock } from '../src/schemas/guide.js';

interface ValidationResult {
  file: string;
  success: boolean;
  errors: string[];
  warnings: string[];
}

const DEFAULT_LOCAL_KROKI = process.env.KROKI_ENDPOINT || 'http://localhost:8000';
const FALLBACK_KROKI = 'https://kroki.io';

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

async function validateGuideFile(filePath: string, krokiUrl: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    file: filePath,
    success: true,
    errors: [],
    warnings: [],
  };

  // 1. Read and parse JSON
  let rawJson: unknown;
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    rawJson = JSON.parse(fileContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.success = false;
    result.errors.push(`Invalid JSON file: ${message}`);
    return result;
  }

  // 2. Schema compliance
  const parseResult = GuideSchema.safeParse(rawJson);
  if (!parseResult.success) {
    result.success = false;
    for (const issue of parseResult.error.issues) {
      const pathStr = issue.path.join('.');
      result.errors.push(`Schema Error at [${pathStr}]: ${issue.message}`);
    }
    return result;
  }

  const guide = parseResult.data as Guide;
  const sections = getGuideSections(guide);

  if (sections.length === 0) {
    result.errors.push('Guide must contain at least one section or phase with content blocks.');
    result.success = false;
    return result;
  }

  // 3. Block ID collection & reference integrity
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

  // Check quiz related_block_id references
  for (const quizBlock of quizBlocks) {
    if (!blockIds.has(quizBlock.related_block_id)) {
      result.errors.push(
        `[Block '${quizBlock.id}'] Quiz question relates to '${quizBlock.related_block_id}', which does not exist in any section.`
      );
    }
  }

  // Check sources citations if present
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

  // 4. Kroki Dry-Run Check
  const krokiBlocks = allBlocks.filter((b) => b.block_type === 'kroki');
  for (const b of krokiBlocks) {
    if (b.block_type === 'kroki') {
      const check = await validateKrokiDiagram(krokiUrl, b.diagram_type, b.source, b.id);
      if (!check.ok && check.error) {
        result.errors.push(check.error);
      }
    }
  }

  // 5. Media & YouTube Verification
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
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      list.push(full);
    }
  }
  return list;
}

async function main() {
  const args = process.argv.slice(2);
  let filesToValidate: string[] = [];

  if (args.length > 0) {
    filesToValidate = args;
  } else {
    const guidesDir = path.resolve('guides');
    filesToValidate = collectGuideFiles(guidesDir);
  }

  if (filesToValidate.length === 0) {
    console.log('No guide JSON files found to validate.');
    process.exit(0);
  }

  const krokiUrl = await resolveKrokiEndpoint();
  console.log(`Using Kroki endpoint: ${krokiUrl}\n`);

  let totalErrors = 0;

  for (const file of filesToValidate) {
    console.log(`Validating: ${file}...`);
    const res = await validateGuideFile(file, krokiUrl);

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

  if (totalErrors > 0) {
    console.error(`Total validation errors: ${totalErrors}`);
    process.exit(1);
  } else {
    console.log('All validated guides passed successfully.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unexpected error running validation:', err);
  process.exit(1);
});
