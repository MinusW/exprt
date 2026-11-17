#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Token-Efficient PDF Reader CLI
 * Extracts, cleans, slices, and chunks PDF text to minimize LLM token consumption.
 */

interface PdfMetadata {
  title?: string;
  author?: string;
  creator?: string;
  pages: number;
  fileSize: number;
}

interface SectionHeading {
  title: string;
  page: number;
  level: number;
  byteOffset?: number;
}

interface ExtractedPage {
  pageNumber: number;
  rawText: string;
  cleanedText: string;
  estimatedTokens: number;
}

interface CliOptions {
  filePath: string;
  inspect: boolean;
  toc: boolean;
  pages?: string; // e.g. "1-5", "2,4", "3-"
  section?: string; // e.g. "Method" or "2.1"
  query?: string; // search term
  contextLines: number;
  stripRefs: boolean;
  stripHeadersFooters: boolean;
  chunkSize?: number; // max tokens per chunk
  chunkIndex?: number; // extract single chunk
  format: 'md' | 'json' | 'text';
  outputPath?: string;
  quiet: boolean;
}

// Rough estimation of token count (~4 characters per token for English text/code)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().length / 4);
}

// 1. Extract PDF Metadata using `pdfinfo`
export function getPdfMetadata(pdfPath: string): PdfMetadata {
  try {
    const stdout = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf-8' });
    const lines = stdout.split('\n');
    let pages = 1;
    let title: string | undefined;
    let author: string | undefined;
    let creator: string | undefined;
    let fileSize = 0;

    for (const line of lines) {
      const [key, ...vals] = line.split(':');
      if (!key || vals.length === 0) continue;
      const val = vals.join(':').trim();
      const lowerKey = key.trim().toLowerCase();

      if (lowerKey === 'pages') pages = parseInt(val, 10) || 1;
      else if (lowerKey === 'title') title = val || undefined;
      else if (lowerKey === 'author') author = val || undefined;
      else if (lowerKey === 'creator') creator = val || undefined;
      else if (lowerKey === 'file size') {
        const match = val.match(/^(\d+)/);
        if (match) fileSize = parseInt(match[1], 10);
      }
    }

    if (!fileSize && fs.existsSync(pdfPath)) {
      fileSize = fs.statSync(pdfPath).size;
    }

    return { title, author, creator, pages, fileSize };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read PDF metadata with pdfinfo: ${msg}`);
  }
}

// 2. Extract Raw Pages using `pdftotext`
export function extractRawPages(
  pdfPath: string,
  startPage?: number,
  endPage?: number
): { pageNumber: number; text: string }[] {
  const args = ['-layout', '-enc', 'UTF-8'];
  if (startPage) args.push('-f', String(startPage));
  if (endPage) args.push('-l', String(endPage));
  args.push(pdfPath, '-');

  try {
    const rawStdout = execFileSync('pdftotext', args, {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });

    // Form feed character (\x0c or \f) separates pages in pdftotext output
    const rawPageStrings = rawStdout.split(/\x0c/);
    const pages: { pageNumber: number; text: string }[] = [];
    const basePage = startPage || 1;

    for (let i = 0; i < rawPageStrings.length; i++) {
      const pageText = rawPageStrings[i];
      // Skip empty trailing split
      if (i === rawPageStrings.length - 1 && !pageText.trim()) continue;
      pages.push({
        pageNumber: basePage + i,
        text: pageText,
      });
    }

    return pages;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to extract text from PDF: ${msg}`);
  }
}

// 3. Detect & Strip Repeating Running Headers and Footers
export function stripRunningHeadersFooters(
  pages: { pageNumber: number; text: string }[],
  samplePages: { pageNumber: number; text: string }[] = pages
): { pageNumber: number; text: string }[] {
  // Sample top 3 lines and bottom 3 lines of each page
  const topLinesMap: Record<string, number> = {};
  const bottomLinesMap: Record<string, number> = {};

  const samplePageLines = samplePages.map((p) => {
    const lines = p.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines;
  });

  for (const lines of samplePageLines) {
    const top3 = lines.slice(0, 3);
    const bottom3 = lines.slice(-3);

    for (const line of top3) {
      const normalized = line.replace(/\d+/g, '#').toLowerCase();
      topLinesMap[normalized] = (topLinesMap[normalized] || 0) + 1;
    }
    for (const line of bottom3) {
      const normalized = line.replace(/\d+/g, '#').toLowerCase();
      bottomLinesMap[normalized] = (bottomLinesMap[normalized] || 0) + 1;
    }
  }

  const threshold = Math.max(2, Math.floor(samplePages.length * 0.4)); // Appears in >= 40% of sampled pages

  const repetitiveHeaders = new Set<string>();
  const repetitiveFooters = new Set<string>();

  if (samplePages.length > 1) {
    for (const [norm, count] of Object.entries(topLinesMap)) {
      if (count >= threshold) repetitiveHeaders.add(norm);
    }
    for (const [norm, count] of Object.entries(bottomLinesMap)) {
      if (count >= threshold) repetitiveFooters.add(norm);
    }
  }

  // Filter out running headers and footers from target pages
  return pages.map((p) => {
    const lines = p.text.split('\n');
    const filteredLines = lines.filter((rawLine, idx) => {
      const line = rawLine.trim();
      if (!line) return true; // keep blank line spacing
      const norm = line.replace(/\d+/g, '#').toLowerCase();

      // Check if top line matches detected repetitive header
      if (idx < 5 && repetitiveHeaders.has(norm)) return false;
      // Check if bottom line matches detected repetitive footer
      if (idx >= lines.length - 5 && repetitiveFooters.has(norm)) return false;
      // Generic page number regex: "Page X", "Page X of Y", "- X -", compound page/copyright footers
      if (
        (idx < 3 || idx >= lines.length - 3) &&
        /^(page\s+\d+(\s+of\s+\d+)?([•|\-–—/].*)?|-?\s*\d+\s*-?|copyright\s*\(c\).*|.*all rights reserved.*)$/i.test(line)
      ) {
        return false;
      }

      return true;
    });

    return {
      pageNumber: p.pageNumber,
      text: filteredLines.join('\n'),
    };
  });
}

// 4. Clean & Normalize Whitespace, Ligatures, and Hyphenation
export function cleanText(text: string): string {
  let cleaned = text;

  // Fix common unicode ligatures
  cleaned = cleaned
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-');

  // Fix soft hyphens across line breaks: "transfor-\nmation" -> "transformation"
  cleaned = cleaned.replace(/(\w+)-\s*\n\s*(\w+)/g, (_, w1, w2) => `${w1}${w2}`);

  // Re-join sentences split across newlines within paragraphs
  // (Line ends without punctuation, followed by lowercase word on next line)
  cleaned = cleaned.replace(/([^\.\?\!\:\n])\n([a-z0-9])/g, '$1 $2');

  // Collapse multiple empty lines to maximum 2 newlines (paragraph boundary)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Collapse excessive inline spaces (except indentations)
  cleaned = cleaned.replace(/[ \t]{3,}/g, '  ');

  return cleaned.trim();
}

// 5. Detect Section Headings & Table of Contents
export function detectSections(text: string, basePage = 1): SectionHeading[] {
  const lines = text.split('\n');
  const headings: SectionHeading[] = [];

  // Patterns matching academic and technical headings:
  // e.g. "1. Introduction", "2.1 Background", "CHAPTER 3", "Section 4.2", "## Heading"
  const headingRegexes = [
    /^(?:(\d+(?:\.\d+)*)\.?\s+)([A-Z][A-Za-z0-9\s,\-–:]{2,60})$/, // 1. Introduction or 2.1 Deep Learning
    /^(?:Chapter|CHAPTER)\s+(\d+|[IVXLCDM]+)[\s:.-]+([A-Za-z0-9\s,\-–:]{2,60})$/, // Chapter 2: ...
    /^(?:Section|SECTION)\s+(\d+(?:\.\d+)*)[\s:.-]+([A-Za-z0-9\s,\-–:]{2,60})$/, // Section 2.1
    /^#{1,3}\s+([A-Za-z0-9\s,\-–:]{2,60})$/, // Markdown headings
    /^([A-Z\s]{4,40})$/, // ALL CAPS short headings (e.g. ABSTRACT, REFERENCES)
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length > 70) continue;

    for (const regex of headingRegexes) {
      const match = line.match(regex);
      if (match) {
        let level = 2;
        if (/^#\s/.test(line) || /^(?:Chapter|CHAPTER)/.test(line)) level = 1;
        else if (/^\d+\./.test(line)) {
          const parts = (match[1] || '').split('.');
          level = Math.min(4, parts.length);
        }

        headings.push({
          title: line.replace(/^#+\s*/, ''),
          page: basePage,
          level,
        });
        break;
      }
    }
  }

  return headings;
}

// 6. Strip References and Bibliography
export function stripReferences(text: string): { cleanedText: string; strippedCount: number } {
  // Common section headings for bibliography
  const refHeaderRegex = /\n(?:#+\s*)?(?:[0-9.]+\s*)?(References|Bibliography|Works Cited|Literature Cited)\b[^\n]*\n/i;
  const match = text.match(refHeaderRegex);

  if (match && match.index !== undefined) {
    const strippedIndex = match.index;
    const cleanedText = text.slice(0, strippedIndex).trim();
    const strippedCount = estimateTokens(text.slice(strippedIndex));
    return { cleanedText, strippedCount };
  }

  return { cleanedText: text, strippedCount: 0 };
}

// 7. Parse page range string (e.g. "1-5", "2,4,7", "3-")
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = startStr ? parseInt(startStr, 10) : 1;
      const end = endStr ? parseInt(endStr, 10) : totalPages;

      for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
        pages.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

// 8. Chunk Text with Max Token Budget
export function chunkText(text: string, maxTokens: number): { index: number; tokens: number; content: string }[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: { index: number; tokens: number; content: string }[] = [];

  let currentChunk: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 1;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens && currentChunk.length > 0) {
      const chunkStr = currentChunk.join('\n\n');
      chunks.push({
        index: chunkIndex++,
        tokens: estimateTokens(chunkStr),
        content: chunkStr,
      });
      currentChunk = [para];
      currentTokens = paraTokens;
    } else {
      currentChunk.push(para);
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.length > 0) {
    const chunkStr = currentChunk.join('\n\n');
    chunks.push({
      index: chunkIndex,
      tokens: estimateTokens(chunkStr),
      content: chunkStr,
    });
  }

  return chunks;
}

// 9. Query Search (Needle in Haystack)
export function searchInText(
  pages: ExtractedPage[],
  query: string,
  contextLines = 3
): { pageNumber: number; matchSnippet: string; line: number }[] {
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const results: { pageNumber: number; matchSnippet: string; line: number }[] = [];

  for (const page of pages) {
    const lines = page.cleanedText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        const snippet = lines.slice(start, end).join('\n');
        results.push({
          pageNumber: page.pageNumber,
          matchSnippet: snippet,
          line: i + 1,
        });
        i = end; // avoid overlapping excerpts
      }
    }
  }

  return results;
}

// Main CLI Controller
export function runPdfReader(options: CliOptions): void {
  const resolvedPath = path.resolve(options.filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found at path: ${resolvedPath}`);
    process.exit(1);
  }

  const meta = getPdfMetadata(resolvedPath);

  // Mode: Inspect
  if (options.inspect) {
    console.log(`\n======================================================`);
    console.log(`📄 PDF Inspection: ${path.basename(resolvedPath)}`);
    console.log(`======================================================`);
    if (meta.title) console.log(`• Title:     ${meta.title}`);
    if (meta.author) console.log(`• Author:    ${meta.author}`);
    console.log(`• Pages:     ${meta.pages}`);
    console.log(`• File Size: ${(meta.fileSize / 1024).toFixed(1)} KB`);

    // Quick scan of headings across pages
    const rawPages = extractRawPages(resolvedPath, 1, Math.min(meta.pages, 10));
    const sampleText = rawPages.map((p) => p.text).join('\n');
    const sections = detectSections(sampleText);

    console.log(`\nDetected Outline / Headings (First ${rawPages.length} Pages):`);
    if (sections.length === 0) {
      console.log('  (No standard numbered or capitalized section headings detected)');
    } else {
      for (const s of sections) {
        const indent = '  '.repeat(s.level);
        console.log(`${indent}• ${s.title}`);
      }
    }

    const estimatedTotal = estimateTokens(sampleText) * Math.ceil(meta.pages / rawPages.length);
    console.log(`\nEstimated Document Tokens: ~${estimatedTotal.toLocaleString()}`);
    console.log(`\nToken Optimization Tip:`);
    console.log(`  Target specific pages with:   npm run read-pdf -- ${options.filePath} -p 2-5`);
    console.log(`  Extract a section with:       npm run read-pdf -- ${options.filePath} -s "Method"`);
    console.log(`  Search for concepts with:     npm run read-pdf -- ${options.filePath} -q "gradient"`);
    return;
  }

  // Determine page list
  let pageList: number[] = [];
  if (options.pages) {
    pageList = parsePageRange(options.pages, meta.pages);
  } else {
    for (let p = 1; p <= meta.pages; p++) pageList.push(p);
  }

  const startPage = pageList[0];
  const endPage = pageList[pageList.length - 1];

  // Extract raw pages
  const extractedRaw = extractRawPages(resolvedPath, startPage, endPage);
  const selectedRaw = extractedRaw.filter((p) => pageList.includes(p.pageNumber));

  // Clean headers/footers if requested
  // If extracting only 1 or 2 pages, sample first 4 pages to learn recurring headers/footers
  let headerSamplePages = selectedRaw;
  if (options.stripHeadersFooters && selectedRaw.length < 3 && meta.pages >= 2) {
    headerSamplePages = extractRawPages(resolvedPath, 1, Math.min(meta.pages, 4));
  }

  const processedPages = options.stripHeadersFooters
    ? stripRunningHeadersFooters(selectedRaw, headerSamplePages)
    : selectedRaw;

  // Clean text and estimate tokens
  const extractedPages: ExtractedPage[] = processedPages.map((p) => {
    const rawClean = cleanText(p.text);
    return {
      pageNumber: p.pageNumber,
      rawText: p.text,
      cleanedText: rawClean,
      estimatedTokens: estimateTokens(rawClean),
    };
  });

  // Full merged text
  let combinedText = extractedPages.map((p) => `\n## Page ${p.pageNumber}\n\n${p.cleanedText}`).join('\n');

  // Strip references if requested
  let strippedRefTokens = 0;
  if (options.stripRefs) {
    const res = stripReferences(combinedText);
    combinedText = res.cleanedText;
    strippedRefTokens = res.strippedCount;
  }

  // Section extraction if requested
  if (options.section) {
    const secRegex = new RegExp(
      `(?:^|\\n)(?:#+\\s*)?(?:\\d+(?:\\.\\d+)*\\.?\\s*)?(${options.section}[^\\n]*)`,
      'i'
    );
    const match = combinedText.match(secRegex);
    if (match && match.index !== undefined) {
      const sectionStart = match.index;
      // Find next major heading
      const nextHeadingRegex = /\n(?:#+\s*|\d+\.\s+)[A-Z]/g;
      nextHeadingRegex.lastIndex = sectionStart + match[0].length;
      const nextMatch = nextHeadingRegex.exec(combinedText);
      const sectionEnd = nextMatch ? nextMatch.index : combinedText.length;
      combinedText = combinedText.slice(sectionStart, sectionEnd).trim();
    } else {
      console.warn(`⚠️ Warning: Section matching '${options.section}' not found in specified pages.`);
    }
  }

  // Search query mode if requested
  if (options.query) {
    const searchResults = searchInText(extractedPages, options.query, options.contextLines);
    if (searchResults.length === 0) {
      console.log(`No occurrences of "${options.query}" found.`);
      return;
    }

    console.log(`Found ${searchResults.length} relevant excerpts for query: "${options.query}":\n`);
    for (const r of searchResults) {
      console.log(`--- [Page ${r.pageNumber}, line ~${r.line}] ---`);
      console.log(r.matchSnippet);
      console.log('');
    }
    return;
  }

  // Chunking if requested
  if (options.chunkSize && options.chunkSize > 0) {
    const chunks = chunkText(combinedText, options.chunkSize);

    if (options.chunkIndex) {
      const chunk = chunks.find((c) => c.index === options.chunkIndex);
      if (!chunk) {
        console.error(`Chunk index ${options.chunkIndex} out of bounds (1 to ${chunks.length}).`);
        process.exit(1);
      }
      outputResult(chunk.content, options);
      return;
    }

    if (options.format === 'json') {
      const jsonOutput = {
        file: path.basename(resolvedPath),
        totalPages: meta.pages,
        extractedPages: pageList,
        totalTokens: estimateTokens(combinedText),
        chunkCount: chunks.length,
        chunks,
      };
      outputResult(JSON.stringify(jsonOutput, null, 2), options);
      return;
    }
  }

  // Standard Output Formatting
  let outputPayload = '';
  if (options.format === 'json') {
    const jsonOutput = {
      file: path.basename(resolvedPath),
      title: meta.title,
      author: meta.author,
      totalPages: meta.pages,
      pagesExtracted: pageList,
      totalEstimatedTokens: estimateTokens(combinedText),
      strippedRefTokens,
      content: combinedText,
    };
    outputPayload = JSON.stringify(jsonOutput, null, 2);
  } else if (options.format === 'text') {
    outputPayload = combinedText.replace(/^#+.*$/gm, '').trim();
  } else {
    // Markdown
    outputPayload = combinedText.trim();
  }

  outputResult(outputPayload, options);

  // Print Token Economy Summary to stderr
  if (!options.quiet && !options.outputPath) {
    const rawTotalTokens = selectedRaw.reduce((acc, p) => acc + estimateTokens(p.text), 0);
    const finalTokens = estimateTokens(outputPayload);
    const saved = Math.max(0, rawTotalTokens - finalTokens);
    const savedPct = rawTotalTokens > 0 ? Math.round((saved / rawTotalTokens) * 100) : 0;

    process.stderr.write(`\n--------------------------------------------------\n`);
    process.stderr.write(`📊 Token Optimization Summary:\n`);
    process.stderr.write(`• Raw PDF Tokens:      ~${rawTotalTokens.toLocaleString()}\n`);
    process.stderr.write(`• Extracted Tokens:    ~${finalTokens.toLocaleString()}\n`);
    if (strippedRefTokens > 0) {
      process.stderr.write(`• References Stripped: ~${strippedRefTokens.toLocaleString()} tokens\n`);
    }
    process.stderr.write(`• Context Saved:       ${savedPct}% (${saved.toLocaleString()} tokens prevented)\n`);
    process.stderr.write(`--------------------------------------------------\n`);
  }
}

function outputResult(content: string, options: CliOptions): void {
  if (options.outputPath) {
    fs.writeFileSync(path.resolve(options.outputPath), content, 'utf-8');
    console.log(`Saved extracted content to: ${options.outputPath}`);
  } else {
    console.log(content);
  }
}

// Parse Command Line Arguments
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let filePath = '';
  let inspect = false;
  let toc = false;
  let pages: string | undefined;
  let section: string | undefined;
  let query: string | undefined;
  let contextLines = 3;
  let stripRefs = true;
  let stripHeadersFooters = true;
  let chunkSize: number | undefined;
  let chunkIndex: number | undefined;
  let format: 'md' | 'json' | 'text' = 'md';
  let outputPath: string | undefined;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--inspect' || arg === '-i') {
      inspect = true;
    } else if (arg === '--toc') {
      toc = true;
    } else if (arg === '--pages' || arg === '-p') {
      pages = args[++i];
    } else if (arg === '--section' || arg === '-s') {
      section = args[++i];
    } else if (arg === '--query' || arg === '-q') {
      query = args[++i];
    } else if (arg === '--context' || arg === '-c') {
      contextLines = parseInt(args[++i], 10) || 3;
    } else if (arg === '--keep-refs') {
      stripRefs = false;
    } else if (arg === '--keep-headers') {
      stripHeadersFooters = false;
    } else if (arg === '--chunk-size') {
      chunkSize = parseInt(args[++i], 10);
    } else if (arg === '--chunk') {
      chunkIndex = parseInt(args[++i], 10);
    } else if (arg === '--format' || arg === '-f') {
      const f = args[++i]?.toLowerCase();
      if (f === 'json' || f === 'text' || f === 'md') format = f;
    } else if (arg === '--output' || arg === '-o') {
      outputPath = args[++i];
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (!arg.startsWith('-') && !filePath) {
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error('Error: No PDF file path specified.');
    printHelp();
    process.exit(1);
  }

  return {
    filePath,
    inspect: inspect || toc,
    toc,
    pages,
    section,
    query,
    contextLines,
    stripRefs,
    stripHeadersFooters,
    chunkSize,
    chunkIndex,
    format,
    outputPath,
    quiet,
  };
}

function printHelp(): void {
  console.log(`
Token-Efficient PDF Reader CLI
Usage:
  npm run read-pdf -- <path-to-pdf> [options]
  tsx scripts/read-pdf.ts <path-to-pdf> [options]

Modes & Inspection:
  -i, --inspect             Inspect PDF metadata, total pages, section headings, and estimated tokens
      --toc                 Display document table of contents / outline

Targeted Slicing:
  -p, --pages <range>       Extract only specific pages (e.g. "1-5", "2,4,7", "10-")
  -s, --section <name>      Extract only a specific section or chapter matching <name>
  -q, --query <text>        Search for key concepts and output matching paragraphs with context
  -c, --context <lines>     Context lines surrounding search hits (default: 3)

Token Compression Controls:
      --keep-refs           Do not strip References/Bibliography (stripped by default)
      --keep-headers        Do not strip running headers and footers (stripped by default)
      --chunk-size <tokens> Chunk extracted text into blocks of max <tokens>
      --chunk <index>       Extract only chunk <index> (1-indexed)

Output Options:
  -f, --format <md|json|text>  Output format (default: md)
  -o, --output <file>          Save output to file instead of stdout
      --quiet                  Suppress token savings summary report
`);
}

// Run CLI
if (process.argv[1]?.endsWith('read-pdf.ts') || process.argv[1]?.endsWith('read-pdf.js')) {
  try {
    const opts = parseArgs();
    runPdfReader(opts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}
