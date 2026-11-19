#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';
import type { Guide } from '../src/schemas/guide.js';

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (entry.isFile() && /\.(json|ya?ml)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function main() {
  const args = process.argv.slice(2);
  const id = getArg(args, '--id');
  const title = getArg(args, '--title');
  const category = getArg(args, '--category') || 'General';
  const track = getArg(args, '--track') || category;
  const folder = getArg(args, '--folder') || slugify(category);
  const isMock = args.includes('--mock');
  const asJson = args.includes('--json');

  if (!id || !title) {
    console.error(
      'Usage: npm run new-guide -- --id <guide-id> --title "<Title>" [--category "<Cat>"] [--track "<Track>"] [--folder <dir>] [--mock] [--json]'
    );
    process.exit(1);
  }

  // Scan existing guides in the same track to compute next track_order and previous prerequisite
  const guidesDir = path.resolve('guides');
  let maxOrder = 0;
  let lastGuideIdInTrack: string | null = null;

  for (const f of collectFiles(guidesDir)) {
    try {
      const raw = fs.readFileSync(f, 'utf-8');
      const g = (f.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw)) as Partial<Guide>;
      if (g.id === id) {
        console.error(`Error: A guide with id '${id}' already exists at ${path.relative(process.cwd(), f)}.`);
        process.exit(1);
      }
      if ((g.track || '').toLowerCase() === track.toLowerCase()) {
        const ord = typeof g.track_order === 'number' ? g.track_order : 0;
        if (ord >= maxOrder) {
          maxOrder = ord;
          if (g.id) lastGuideIdInTrack = g.id;
        }
      }
    } catch {
      // ignore unparseable files
    }
  }

  const nextOrder = maxOrder + 1;
  const starterGuide = {
    id,
    title,
    description: `Study guide covering ${title}.`,
    category,
    track,
    track_order: nextOrder,
    estimated_minutes: isMock ? 60 : 35,
    difficulty_level: 'intermediate',
    tags: isMock ? [slugify(category), 'mock-exam', 'practice-test'] : [slugify(category)],
    prerequisites: lastGuideIdInTrack ? [lastGuideIdInTrack] : [],
    sources: [],
    sections: [
      {
        id: 'sec-1-foundations',
        title: '1. Core Concepts',
        blocks: [
          {
            id: 'th-core-overview',
            block_type: 'markdown',
            title: 'Key Mental Model',
            content: 'Replace with concise explanation, concrete intuition, and LaTeX math ($x^2$).',
          },
          {
            id: 'qz-core-check',
            block_type: 'quiz_question',
            question_type: 'multiple_choice',
            title: 'Diagnostic Check',
            question: 'Replace with an application-level diagnostic question.',
            options: ['Correct answer text', 'Realistic misconception 1', 'Realistic misconception 2'],
            correct_answer: 'Correct answer text',
            explanation: 'Explain why the right answer holds and dissect each distractor.',
            hints: [
              'Hint 1: Activate the governing principle.',
              'Hint 2: Apply it to the given parameters.',
            ],
            difficulty: 3,
            related_block_id: 'th-core-overview',
          },
        ],
      },
    ],
  };

  const targetDir = path.join(guidesDir, folder);
  fs.mkdirSync(targetDir, { recursive: true });
  const ext = asJson ? '.json' : '.yaml';
  const outPath = path.join(targetDir, `${id}${ext}`);

  const serialized = asJson
    ? JSON.stringify(starterGuide, null, 2) + '\n'
    : YAML.stringify(starterGuide, { blockQuote: 'literal', lineWidth: 0 });

  fs.writeFileSync(outPath, serialized, 'utf-8');
  console.log(`Created ${path.relative(process.cwd(), outPath)} (track_order: ${nextOrder}, prerequisites: [${starterGuide.prerequisites.join(', ')}])`);
}

main();
