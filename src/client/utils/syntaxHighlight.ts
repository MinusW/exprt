import hljs from 'highlight.js/lib/common';

const LANG_ALIASES: Record<string, string> = {
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  h: 'c',
  hpp: 'cpp',
  java: 'java',
  js: 'javascript',
  javascript: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  py: 'python',
  python: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',
  sql: 'sql',
  json: 'json',
  xml: 'xml',
  html: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  docker: 'dockerfile',
  dockerfile: 'dockerfile',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  golang: 'go',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  makefile: 'makefile',
  make: 'makefile',
  text: 'plaintext',
  txt: 'plaintext',
  plaintext: 'plaintext',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const norm = language.trim().toLowerCase();
  const mapped = LANG_ALIASES[norm] || norm;
  return hljs.getLanguage(mapped) ? mapped : undefined;
}

/**
 * Highlights a full code snippet using highlight.js grammars.
 * Recognizes language syntax, PascalCase types/classes from any library,
 * multi-line comments, annotations, preprocessor directives, etc.
 */
export function highlightCodeToHtml(code: string, language?: string): string {
  if (!code) return '';
  const resolved = resolveLanguage(language);

  try {
    if (resolved) {
      return hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value;
    }
    if (language && language.trim().toLowerCase() === 'plaintext') {
      return escapeHtml(code);
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

/**
 * Splits highlight.js HTML output into per-line HTML strings while balancing
 * any multi-line <span class="hljs-..."> tags across line breaks.
 */
export function highlightCodeToLines(code: string, language?: string): string[] {
  const html = highlightCodeToHtml(code, language);
  const rawLines = html.split('\n');
  const openTags: string[] = [];

  return rawLines.map((line) => {
    const prefix = openTags.join('');
    // Track opening/closing <span ...> tags in this line
    const tagRegex = /<span\b[^>]*>|<\/span>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(line)) !== null) {
      if (match[0] === '</span>') {
        openTags.pop();
      } else {
        openTags.push(match[0]);
      }
    }
    const suffix = '</span>'.repeat(openTags.length);
    return `${prefix}${line}${suffix}`;
  });
}
