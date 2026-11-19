#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

/**
 * Converts a study guide between .json and .yaml (using clean | literal block scalars).
 * Usage:
 *   npm run convert-guide -- guides/dai/dai-ch02-git-github-markdown.json [--replace]
 */
function main() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const fileArg = args.find((a) => !a.startsWith('-'));

  if (!fileArg) {
    console.error('Usage: npm run convert-guide -- <path-to-guide.json|yaml> [--replace]');
    process.exit(1);
  }

  const inputPath = path.resolve(fileArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const isYaml = inputPath.endsWith('.yaml') || inputPath.endsWith('.yml');
  const parsed = isYaml ? YAML.parse(raw) : JSON.parse(raw);

  const outExt = isYaml ? '.json' : '.yaml';
  const outPath = inputPath.replace(/\.(json|ya?ml)$/i, outExt);

  const output = isYaml
    ? JSON.stringify(parsed, null, 2) + '\n'
    : YAML.stringify(parsed, {
        blockQuote: 'literal',
        lineWidth: 0,
      });

  fs.writeFileSync(outPath, output, 'utf-8');
  console.log(`Converted: ${path.relative(process.cwd(), inputPath)} -> ${path.relative(process.cwd(), outPath)}`);

  if (replace && outPath !== inputPath) {
    fs.unlinkSync(inputPath);
    console.log(`Removed original file: ${path.relative(process.cwd(), inputPath)}`);
  }
}

main();
