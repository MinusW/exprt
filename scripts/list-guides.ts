#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';
import { getGuideSections, type Guide } from '../src/schemas/guide.js';

interface GuideSummary {
  id: string;
  title: string;
  category: string;
  track: string;
  track_order: number | null;
  type: 'mock-test' | 'guide';
  sections: number;
  quizzes: number;
  sandboxes: number;
  prerequisites: string[];
  file: string;
}

function isGuideFile(name: string): boolean {
  return name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml');
}

function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (entry.isFile() && isGuideFile(entry.name)) out.push(full);
  }
  return out;
}

function isMockTest(g: Partial<Guide>): boolean {
  const tags = g.tags || [];
  return (
    tags.some((t) => ['mock-exam', 'practice-test', 'exam'].includes(t.toLowerCase())) ||
    /(-mock-exam|-exam)$/i.test(g.id || '')
  );
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const catIdx = args.indexOf('--category');
  const filterCategory = catIdx >= 0 ? (args[catIdx + 1] || '').toLowerCase() : null;

  const guidesDir = path.resolve('guides');
  const files = collectFiles(guidesDir);
  const summaries: GuideSummary[] = [];

  for (const fullPath of files) {
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = (
        fullPath.endsWith('.yaml') || fullPath.endsWith('.yml') ? YAML.parse(raw) : JSON.parse(raw)
      ) as Guide;

      const rel = path.relative(process.cwd(), fullPath);
      const folder = path.dirname(path.relative(guidesDir, fullPath));
      const category = parsed.category || (folder !== '.' ? folder : 'General');

      if (filterCategory && !category.toLowerCase().includes(filterCategory)) {
        continue;
      }

      const sections = getGuideSections(parsed);
      const allBlocks = sections.flatMap((s) => s.blocks || []);

      summaries.push({
        id: parsed.id,
        title: parsed.title,
        category,
        track: parsed.track || '-',
        track_order: typeof parsed.track_order === 'number' ? parsed.track_order : null,
        type: isMockTest(parsed) ? 'mock-test' : 'guide',
        sections: sections.length,
        quizzes: allBlocks.filter((b) => b.block_type === 'quiz_question').length,
        sandboxes: allBlocks.filter((b) => b.block_type === 'sandbox').length,
        prerequisites: parsed.prerequisites || [],
        file: rel,
      });
    } catch (err) {
      console.error(`⚠️ Failed to parse ${fullPath}:`, err instanceof Error ? err.message : String(err));
    }
  }

  summaries.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) return catCmp;
    const trkCmp = a.track.localeCompare(b.track);
    if (trkCmp !== 0) return trkCmp;
    const ordA = a.track_order ?? 999;
    const ordB = b.track_order ?? 999;
    if (ordA !== ordB) return ordA - ordB;
    return a.id.localeCompare(b.id);
  });

  if (asJson) {
    console.log(JSON.stringify(summaries, null, 2));
    return;
  }

  let currentCat = '';
  for (const s of summaries) {
    if (s.category !== currentCat) {
      currentCat = s.category;
      console.log(`\n=== ${currentCat} ===`);
    }
    const ord = s.track_order !== null ? `#${s.track_order}` : '#-';
    const kind = s.type === 'mock-test' ? '[TEST] ' : '[GUIDE]';
    const prereqs = s.prerequisites.length > 0 ? ` <- [${s.prerequisites.join(', ')}]` : '';
    console.log(
      `  ${kind} ${ord.padEnd(3)} ${s.id} (${s.sections}s/${s.quizzes}q/${s.sandboxes}sbx) | track: ${s.track}${prereqs}`
    );
  }
  console.log(`\nTotal: ${summaries.length} guides.`);
}

main();
