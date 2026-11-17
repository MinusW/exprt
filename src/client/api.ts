import type { Guide } from './types.js';

export const API_BASE = '/api';

// Bundle all guides at build/dev time so the app runs 100% statically on GitHub Pages
const GUIDE_MODULES = import.meta.glob<Guide>('../../guides/**/*.json', {
  eager: true,
  import: 'default',
});

const BUNDLED_GUIDES: Guide[] = Object.entries(GUIDE_MODULES).map(([modPath, guide]) => {
  // modPath looks like "../../guides/dai/dai-ch01-introduction-setup.json"
  const rel = modPath.replace(/^.*\/guides\//, '');
  const parts = rel.split('/');
  const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  return {
    ...guide,
    folder: guide.folder || folder || undefined,
  };
});

// Detect whether the optional local Express backend is running (skip on static hosts like github.io)
let backendProbePromise: Promise<boolean> | null = null;

export function hasLocalBackend(): Promise<boolean> {
  if (backendProbePromise) return backendProbePromise;

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (!isLocalhost) {
    backendProbePromise = Promise.resolve(false);
    return backendProbePromise;
  }

  backendProbePromise = fetch(`${API_BASE}/guides`, { method: 'GET' })
    .then((res) => {
      const ct = res.headers.get('content-type') || '';
      return res.ok && ct.includes('application/json');
    })
    .catch(() => false);

  return backendProbePromise;
}

export async function fetchGuides(): Promise<Guide[]> {
  if (await hasLocalBackend()) {
    try {
      const res = await fetch(`${API_BASE}/guides`);
      if (res.ok) return res.json();
    } catch {
      // Fallback to bundled guides
    }
  }
  return BUNDLED_GUIDES;
}

export async function fetchGuide(id: string): Promise<Guide> {
  const all = await fetchGuides();
  const match = all.find((g) => g.id === id);
  if (!match) throw new Error(`Failed to find guide '${id}'`);
  return match;
}

const krokiSvgCache = new Map<string, string>();

export async function renderKroki(diagramType: string, source: string): Promise<string> {
  const cacheKey = `${diagramType}\0${source}`;
  const cached = krokiSvgCache.get(cacheKey);
  if (cached) return cached;

  if (await hasLocalBackend()) {
    try {
      const res = await fetch(`${API_BASE}/kroki/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagram_type: diagramType, source }),
      });
      const data = await res.json();
      if (res.ok && data.svg) {
        krokiSvgCache.set(cacheKey, data.svg);
        return data.svg;
      }
    } catch {
      // Fallback directly to public kroki.io
    }
  }

  // Direct browser-to-Kroki rendering (works on GitHub Pages with zero backend)
  const krokiRes = await fetch(`https://kroki.io/${encodeURIComponent(diagramType)}/svg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diagram_source: source }),
  });

  if (!krokiRes.ok) {
    const errText = await krokiRes.text().catch(() => krokiRes.statusText);
    throw new Error(errText || `Kroki rendering failed (${krokiRes.status})`);
  }

  const svg = await krokiRes.text();
  krokiSvgCache.set(cacheKey, svg);
  return svg;
}

export async function getUserData<T>(
  file: 'progress' | 'bookmarks' | 'srs-queue' | 'remediation-request'
): Promise<T | null> {
  if (!(await hasLocalBackend())) return null;
  try {
    const res = await fetch(`${API_BASE}/user-data/${file}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveUserData<T>(
  file: 'progress' | 'bookmarks' | 'srs-queue' | 'remediation-request',
  data: T
): Promise<boolean> {
  if (!(await hasLocalBackend())) return true;
  try {
    const res = await fetch(`${API_BASE}/user-data/${file}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.error(`Failed to save user-data ${file}:`, err);
    return false;
  }
}

export function subscribeToGuideUpdates(
  onUpdate: (event: { event: string; file: string }) => void
): () => void {
  let eventSource: EventSource | null = null;
  let cancelled = false;

  hasLocalBackend().then((available) => {
    if (!available || cancelled) return;
    eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'guide_change') {
          onUpdate(data);
        }
      } catch (err) {
        console.error('SSE parsing error:', err);
      }
    };

    eventSource.onerror = () => {
      // EventSource will automatically reconnect
    };
  });

  return () => {
    cancelled = true;
    eventSource?.close();
  };
}

export interface SandboxCapabilitiesResponse {
  engine: 'docker' | 'podman' | null;
  version?: string;
  images: string[];
  recommendedImages: Record<string, string | null>;
}

export interface DockerRunResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  engine: 'docker' | 'podman' | null;
  image: string | null;
  error?: string;
}

export async function fetchSandboxCapabilities(): Promise<SandboxCapabilitiesResponse | null> {
  if (!(await hasLocalBackend())) return null;
  try {
    const res = await fetch(`${API_BASE}/sandbox/capabilities`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function runDockerSandbox(payload: {
  runtime: string;
  code: string;
  image?: string;
  timeoutMs?: number;
}): Promise<DockerRunResponse> {
  if (!(await hasLocalBackend())) {
    throw new Error(
      'Container execution (C/C++/Java/Bash/Rust/Go) requires running exprt locally with the backend server (npm run server).'
    );
  }

  const res = await fetch(`${API_BASE}/sandbox/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to execute code in container');
  }
  return data;
}
