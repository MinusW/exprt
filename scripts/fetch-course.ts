#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Token-Efficient Course Web Page Fetcher CLI
 * Fetches Quarto, GitHub Pages, MkDocs, or HTML course pages and converts them
 * to clean, stripped Markdown (removing nav, scripts, sidebars, and slide chrome).
 */

interface CliOptions {
  url: string;
  inspect: boolean;
  section?: string;
  outputPath?: string;
  maxTokens?: number;
  quiet: boolean;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().length / 4);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripNoiseTags(html: string): string {
  let cleaned = html;
  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  // Remove script, style, noscript, svg, template, iframe, nav, header, footer, aside
  const stripTags = ['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'nav', 'header', 'footer', 'aside'];
  for (const tag of stripTags) {
    cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
  }
  // Strip Quarto / MkDocs / RevealJS sidebar & navigation wrappers by common id/class
  cleaned = cleaned.replace(
    /<div\b[^>]*(?:id|class)=["'][^"']*(?:quarto-sidebar|quarto-margin-sidebar|nav-page|sidebar|toc-active|breadcrumb|pagination|reveal)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    ''
  );
  return cleaned;
}

function extractMainContent(html: string): string {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];

  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];

  return html;
}

function htmlTableToMarkdown(tableHtml: string): string {
  const rows: string[][] = [];
  const trMatches = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trMatches) {
    const cells: string[] = [];
    const cellMatches = tr.match(/<(?:th|td)\b[^>]*>[\s\S]*?<\/(?:th|td)>/gi) || [];
    for (const cell of cellMatches) {
      const inner = decodeHtmlEntities(cell.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\|/g, '\\|');
      cells.push(inner);
    }
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return '';
  const colCount = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => {
    const out = [...r];
    while (out.length < colCount) out.push('');
    return `| ${out.join(' | ')} |`;
  };

  const header = pad(rows[0]);
  const sep = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const body = rows.slice(1).map(pad);
  return `\n\n${[header, sep, ...body].join('\n')}\n\n`;
}

function htmlToMarkdown(html: string, baseUrl: string): string {
  const codePlaceholders: string[] = [];

  // 1. Protect <pre><code> blocks first
  let work = html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_, preAttrs, inner) => {
    const langMatch =
      (preAttrs + ' ' + inner).match(/(?:language-|sourceCode\s+)([a-zA-Z0-9_+-]+)/i);
    const lang = langMatch ? langMatch[1] : '';
    const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '')).replace(/^\n+|\n+$/g, '');
    const idx = codePlaceholders.length;
    codePlaceholders.push(`\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`);
    return `%%%CODE_BLOCK_${idx}%%%`;
  });

  // 2. Convert tables
  work = work.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tbl) => htmlTableToMarkdown(tbl));

  // 3. Headings
  for (let level = 1; level <= 6; level++) {
    const hashes = '#'.repeat(level);
    work = work.replace(
      new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'),
      (_, content) => `\n\n${hashes} ${decodeHtmlEntities(content.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()}\n\n`
    );
  }

  // 4. Inline formatting
  work = work.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  work = work.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  work = work.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${decodeHtmlEntities(c.replace(/<[^>]+>/g, '')).trim()}\``);

  // 5. Links (resolve relative URLs against baseUrl)
  work = work.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const cleanLabel = decodeHtmlEntities(label.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!cleanLabel) return '';
    if (href.startsWith('#') || href.startsWith('javascript:')) return cleanLabel;
    try {
      const abs = new URL(href, baseUrl).toString();
      return `[${cleanLabel}](${abs})`;
    } catch {
      return cleanLabel;
    }
  });

  // 6. Blockquotes, lists, paragraphs, line breaks
  work = work.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const lines = decodeHtmlEntities(inner.replace(/<[^>]+>/g, ' '))
      .trim()
      .split('\n')
      .map((l) => `> ${l.trim()}`);
    return `\n\n${lines.join('\n')}\n\n`;
  });
  work = work.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    return text ? `\n- ${text}` : '';
  });
  work = work.replace(/<br\s*\/?>/gi, '\n');
  work = work.replace(/<\/(?:p|div|section|ul|ol|dl|dt|dd)>/gi, '\n\n');

  // 7. Strip remaining tags & decode entities
  work = decodeHtmlEntities(work.replace(/<[^>]+>/g, ''));

  // 8. Normalize whitespace
  work = work
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 9. Restore fenced code blocks
  work = work.replace(/%%%CODE_BLOCK_(\d+)%%%/g, (_, idxStr) => codePlaceholders[parseInt(idxStr, 10)] || '');
  work = work.replace(/\n{3,}/g, '\n\n').trim();

  return work;
}

function extractLinks(html: string, baseUrl: string): Array<{ text: string; url: string }> {
  const seen = new Set<string>();
  const links: Array<{ text: string; url: string }> = [];
  const baseOrigin = new URL(baseUrl).origin;
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    const text = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.origin !== baseOrigin) continue;
      abs.hash = '';
      const urlStr = abs.toString();
      if (!seen.has(urlStr)) {
        seen.add(urlStr);
        links.push({ text, url: urlStr });
      }
    } catch {
      // ignore invalid URLs
    }
  }
  return links;
}

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    url: '',
    inspect: false,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-i' || arg === '--inspect') opts.inspect = true;
    else if (arg === '-s' || arg === '--section') opts.section = argv[++i];
    else if (arg === '-o' || arg === '--output') opts.outputPath = argv[++i];
    else if (arg === '--max-tokens') opts.maxTokens = parseInt(argv[++i], 10);
    else if (arg === '--quiet') opts.quiet = true;
    else if (!arg.startsWith('-') && !opts.url) opts.url = arg;
  }

  return opts;
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (!opts.url) {
    console.error('Usage: npm run fetch-course -- <url> [--inspect] [-s "Section"] [-o out.md] [--max-tokens 4000]');
    process.exit(1);
  }

  const res = await fetch(opts.url, {
    headers: { 'User-Agent': 'exprt-course-fetcher/1.0' },
  });
  if (!res.ok) {
    console.error(`Failed to fetch ${opts.url}: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const rawHtml = await res.text();
  const titleMatch = rawHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : opts.url;

  const strippedHtml = stripNoiseTags(rawHtml);
  const mainHtml = extractMainContent(strippedHtml);
  let markdown = htmlToMarkdown(mainHtml, opts.url);

  if (opts.inspect) {
    const headings = markdown
      .split('\n')
      .filter((l) => /^#{1,3}\s+/.test(l))
      .slice(0, 40);
    const sameOriginLinks = extractLinks(rawHtml, opts.url).slice(0, 30);

    console.log(`======================================================`);
    console.log(`🌐 Course Page Inspection: ${pageTitle}`);
    console.log(`======================================================`);
    console.log(`• URL:              ${opts.url}`);
    console.log(`• Raw HTML Tokens:  ~${estimateTokens(rawHtml).toLocaleString()}`);
    console.log(`• Clean MD Tokens:  ~${estimateTokens(markdown).toLocaleString()}`);
    console.log(`\nDetected Headings:`);
    for (const h of headings) console.log(`  ${h}`);
    if (sameOriginLinks.length > 0) {
      console.log(`\nSame-Site Links (First ${sameOriginLinks.length}):`);
      for (const l of sameOriginLinks) console.log(`  • ${l.text}: ${l.url}`);
    }
    return;
  }

  if (opts.section) {
    const secRegex = new RegExp(`(?:^|\\n)(#{1,6})\\s+([^\\n]*${opts.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*)`, 'i');
    const match = markdown.match(secRegex);
    if (match && match.index !== undefined) {
      const level = match[1].length;
      const start = match.index;
      const rest = markdown.slice(start + match[0].length);
      const nextHeading = rest.search(new RegExp(`\\n#{1,${level}}\\s+`));
      markdown = (nextHeading >= 0 ? markdown.slice(start, start + match[0].length + nextHeading) : markdown.slice(start)).trim();
    } else {
      console.warn(`⚠️ Warning: Section matching '${opts.section}' not found.`);
    }
  }

  if (opts.maxTokens && opts.maxTokens > 0) {
    const maxChars = opts.maxTokens * 4;
    if (markdown.length > maxChars) {
      markdown = `${markdown.slice(0, maxChars).trim()}\n\n...[truncated at ~${opts.maxTokens} tokens]`;
    }
  }

  if (opts.outputPath) {
    const dest = path.resolve(opts.outputPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, markdown + '\n', 'utf-8');
    console.log(`Saved clean Markdown to ${dest} (~${estimateTokens(markdown).toLocaleString()} tokens)`);
  } else {
    process.stdout.write(markdown + '\n');
  }

  if (!opts.quiet && !opts.outputPath) {
    const rawTokens = estimateTokens(rawHtml);
    const cleanTokens = estimateTokens(markdown);
    const saved = Math.max(0, rawTokens - cleanTokens);
    const pct = rawTokens > 0 ? Math.round((saved / rawTokens) * 100) : 0;
    process.stderr.write(`\n--------------------------------------------------\n`);
    process.stderr.write(`📊 Token Optimization Summary (${pageTitle}):\n`);
    process.stderr.write(`• Raw HTML Tokens:   ~${rawTokens.toLocaleString()}\n`);
    process.stderr.write(`• Clean MD Tokens:   ~${cleanTokens.toLocaleString()}\n`);
    process.stderr.write(`• Context Saved:     ${pct}% (${saved.toLocaleString()} tokens prevented)\n`);
    process.stderr.write(`--------------------------------------------------\n`);
  }
}

main().catch((err) => {
  console.error('Error fetching course page:', err);
  process.exit(1);
});
