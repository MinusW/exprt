export type TokenType =
  | 'comment'
  | 'string'
  | 'preprocessor'
  | 'keyword'
  | 'type'
  | 'number'
  | 'function'
  | 'plain';

export interface CodeToken {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  // C / C++ / Java / JS / TS / Rust / Go / Python / Bash / SQL
  'auto', 'break', 'case', 'catch', 'class', 'const', 'constexpr', 'continue',
  'default', 'delete', 'do', 'else', 'enum', 'explicit', 'export', 'extends',
  'extern', 'final', 'finally', 'for', 'friend', 'from', 'fn', 'func', 'function',
  'goto', 'if', 'impl', 'import', 'in', 'inline', 'interface', 'is', 'let',
  'match', 'mod', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'nullptr',
  'operator', 'or', 'override', 'package', 'private', 'protected', 'pub', 'public',
  'raise', 'register', 'return', 'select', 'sizeof', 'static', 'struct', 'super',
  'switch', 'template', 'this', 'throw', 'throws', 'trait', 'try', 'typedef',
  'typename', 'typeof', 'union', 'unsafe', 'use', 'using', 'var', 'virtual',
  'volatile', 'where', 'while', 'with', 'yield', 'async', 'await', 'def', 'elif',
  'except', 'lambda', 'pass', 'and', 'as', 'assert', 'del', 'global', 'nonlocal',
  'true', 'false', 'True', 'False', 'None', 'null', 'undefined', 'NULL',
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'JOIN', 'ON', 'GROUP', 'BY',
  'ORDER', 'HAVING', 'LIMIT', 'AS', 'AND', 'OR', 'NOT', 'PRIMARY', 'KEY',
  'FOREIGN', 'REFERENCES', 'CASCADE',
]);

const TYPES = new Set([
  'void', 'bool', 'boolean', 'char', 'short', 'int', 'long', 'float', 'double',
  'signed', 'unsigned', 'size_t', 'ssize_t', 'pid_t', 'pthread_t', 'uint8_t',
  'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'string', 'String', 'std', 'vector', 'map', 'set', 'unique_ptr', 'shared_ptr',
  'PcoThread', 'PcoMutex', 'PcoSemaphore', 'Node', 'List', 'Array', 'Promise',
  'number', 'object', 'any', 'unknown', 'never', 'str', 'list', 'dict', 'tuple',
  'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'usize', 'f32', 'f64',
  'Vec', 'Option', 'Result', 'Some', 'Ok', 'Err',
]);

function isHashCommentLang(lang?: string): boolean {
  if (!lang) return false;
  const l = lang.toLowerCase();
  return ['py', 'python', 'bash', 'sh', 'zsh', 'yaml', 'yml', 'toml', 'ruby', 'rb'].includes(l);
}

/**
 * Single-pass tokenizer for a line of code.
 * Preserves every character verbatim so whitespace and indentation never shift.
 */
export function tokenizeCodeLine(line: string, language?: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const hashComment = isHashCommentLang(language);
  let i = 0;

  const push = (type: TokenType, value: string) => {
    if (!value) return;
    const prev = tokens[tokens.length - 1];
    if (prev && prev.type === type) {
      prev.value += value;
    } else {
      tokens.push({ type, value });
    }
  };

  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];

    // Line comments: // ... or -- ... (SQL) or # ... (Python/Bash) or ; ... (asm)
    if (
      (ch === '/' && next === '/') ||
      (ch === '-' && next === '-' && language?.toLowerCase() === 'sql') ||
      (ch === '#' && hashComment) ||
      (ch === ';' && language?.toLowerCase() === 'asm')
    ) {
      push('comment', line.slice(i));
      break;
    }

    // Block comment fragment /* ... */ on same line
    if (ch === '/' && next === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end !== -1) {
        push('comment', line.slice(i, end + 2));
        i = end + 2;
        continue;
      } else {
        push('comment', line.slice(i));
        break;
      }
    }

    // C/C++ Preprocessor directive (#include, #define, etc.)
    if (ch === '#' && !hashComment && line.slice(0, i).trim() === '') {
      push('preprocessor', line.slice(i));
      break;
    }

    // Strings: "...", '...', `...`
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      push('string', line.slice(i, j));
      i = j;
      continue;
    }

    // Numbers (hex, binary, float, int)
    if (/[0-9]/.test(ch) && (i === 0 || !/[a-zA-Z0-9_]/.test(line[i - 1]))) {
      const numMatch = line.slice(i).match(/^(?:0[xXbB][0-9a-fA-F_]+|[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?[uUlLfF]*)/);
      if (numMatch) {
        push('number', numMatch[0]);
        i += numMatch[0].length;
        continue;
      }
    }

    // Identifiers, keywords, types, function calls
    if (/[a-zA-Z_]/.test(ch)) {
      const idMatch = line.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (idMatch) {
        const word = idMatch[0];
        const afterIdx = i + word.length;
        const restTrimmed = line.slice(afterIdx).trimStart();

        if (KEYWORDS.has(word)) {
          push('keyword', word);
        } else if (TYPES.has(word)) {
          push('type', word);
        } else if (restTrimmed.startsWith('(')) {
          push('function', word);
        } else {
          push('plain', word);
        }
        i += word.length;
        continue;
      }
    }

    push('plain', ch);
    i++;
  }

  return tokens;
}

export const DARK_TOKEN_CLASSES: Record<TokenType, string> = {
  comment: 'text-slate-400 italic',
  string: 'text-emerald-300',
  preprocessor: 'text-rose-300',
  keyword: 'text-violet-300 font-medium',
  type: 'text-cyan-300',
  number: 'text-amber-300',
  function: 'text-sky-300',
  plain: 'text-slate-100',
};

export const LIGHT_TOKEN_CLASSES: Record<TokenType, string> = {
  comment: 'text-slate-500 italic',
  string: 'text-emerald-700',
  preprocessor: 'text-rose-700',
  keyword: 'text-violet-700 font-semibold',
  type: 'text-teal-700',
  number: 'text-amber-700',
  function: 'text-sky-700',
  plain: 'text-slate-900',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts a multi-line code snippet into syntax-highlighted HTML using Tailwind classes.
 */
export function highlightCodeToHtml(code: string, language?: string): string {
  return code
    .split('\n')
    .map((line) => {
      const tokens = tokenizeCodeLine(line, language);
      if (tokens.length === 0) return '';
      return tokens
        .map((tok) => {
          const escaped = escapeHtml(tok.value);
          if (tok.type === 'plain') return escaped;
          return `<span class="${DARK_TOKEN_CLASSES[tok.type]}">${escaped}</span>`;
        })
        .join('');
    })
    .join('\n');
}
