import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import chokidar from 'chokidar';
import dotenv from 'dotenv';
import { GuideSchema, type Guide } from '../schemas/guide.js';
import { getSandboxCapabilities, runInDocker, type DockerLanguage } from './dockerRunner.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const GUIDES_DIR = path.resolve('guides');
const ASSETS_DIR = path.resolve('assets');
const SOURCES_DIR = path.resolve('sources');
const USER_DATA_DIR = path.resolve('user-data');

// Ensure base directories exist
for (const dir of [GUIDES_DIR, ASSETS_DIR, SOURCES_DIR, USER_DATA_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static assets and sources
app.use('/assets', express.static(ASSETS_DIR));
app.use('/sources', express.static(SOURCES_DIR));

app.get('/api/sources', (_req: Request, res: Response): void => {
  try {
    const files = fs.readdirSync(SOURCES_DIR);
    const sources = files.map((f) => ({
      name: f,
      size: fs.statSync(path.join(SOURCES_DIR, f)).size,
      path: `sources/${f}`,
    }));
    res.json(sources);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Recursive file scanner for organized guide directories
interface DiscoveredGuideFile {
  fullPath: string;
  relPath: string;
  folder: string;
}

function findGuideFiles(dir: string, baseDir: string = dir): DiscoveredGuideFile[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: DiscoveredGuideFile[] = [];

  for (const entry of entries) {
    const resPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findGuideFiles(resPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const relPath = path.relative(baseDir, resPath);
      const folder = path.dirname(relPath) === '.' ? '' : path.dirname(relPath);
      files.push({ fullPath: resPath, relPath, folder });
    }
  }
  return files;
}

// SSE Clients for live guide reloading
const sseClients = new Set<Response>();

app.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

function broadcastGuideChange(eventType: string, filename: string) {
  const payload = JSON.stringify({
    type: 'guide_change',
    event: eventType,
    file: filename,
    timestamp: Date.now(),
  });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Watch guides directory recursively with chokidar
const guideWatcher = chokidar.watch(GUIDES_DIR, {
  ignoreInitial: true,
  depth: 10,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100,
  },
});

guideWatcher.on('all', (event, filePath) => {
  if (filePath.endsWith('.json')) {
    const rel = path.relative(GUIDES_DIR, filePath);
    console.log(`[Watcher] Guide file ${event}: ${rel}`);
    broadcastGuideChange(event, rel);
  }
});

// Kroki resolution and proxy
const DEFAULT_LOCAL_KROKI = process.env.KROKI_ENDPOINT || 'http://localhost:8000';
const FALLBACK_KROKI = 'https://kroki.io';

async function getAvailableKrokiUrl(): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
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

// Kroki diagram render proxy
app.post('/api/kroki/render', async (req: Request, res: Response): Promise<void> => {
  const { diagram_type, source } = req.body;
  if (!diagram_type || !source) {
    res.status(400).json({ error: 'diagram_type and source are required' });
    return;
  }

  const krokiBase = await getAvailableKrokiUrl();
  const url = `${krokiBase.replace(/\/$/, '')}/${encodeURIComponent(diagram_type)}/svg`;

  try {
    const krokiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagram_source: source }),
    });

    if (!krokiRes.ok) {
      const errorMsg = await krokiRes.text();
      res.status(400).json({
        error: `Kroki compile error (HTTP ${krokiRes.status}): ${errorMsg}`,
      });
      return;
    }

    const svg = await krokiRes.text();
    res.json({ svg, endpoint: krokiBase });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to communicate with Kroki: ${message}` });
  }
});

// Guide CRUD with subfolder support
app.get('/api/guides', (_req: Request, res: Response): void => {
  try {
    const discovered = findGuideFiles(GUIDES_DIR);
    const guides: (Guide & { folder?: string; relPath?: string })[] = [];

    for (const item of discovered) {
      try {
        const content = fs.readFileSync(item.fullPath, 'utf-8');
        const parsed = JSON.parse(content);

        // Auto-assign folder and infer category from folder if omitted
        if (!parsed.folder && item.folder) {
          parsed.folder = item.folder;
        }
        if (!parsed.category && item.folder) {
          // Format folder name into nice category (e.g. "machine-learning" -> "Machine Learning")
          parsed.category = item.folder
            .split('/')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/[-_]/g, ' '))
            .join(' / ');
        }

        const validated = GuideSchema.safeParse(parsed);
        if (validated.success) {
          guides.push({
            ...validated.data,
            folder: item.folder,
            relPath: item.relPath,
          });
        } else {
          console.warn(`[API] Guide file ${item.relPath} failed schema validation:`, validated.error.issues);
        }
      } catch (err) {
        console.warn(`[API] Failed to parse guide ${item.relPath}:`, err);
      }
    }

    res.json(guides);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Taxonomy & category overview endpoint
app.get('/api/categories', (_req: Request, res: Response): void => {
  try {
    const discovered = findGuideFiles(GUIDES_DIR);
    const categoriesMap: Record<
      string,
      { category: string; tracks: Record<string, { track: string; count: number; estimated_minutes: number; guides: string[] }>; count: number; estimated_minutes: number; guides: string[] }
    > = {};

    for (const item of discovered) {
      try {
        const content = fs.readFileSync(item.fullPath, 'utf-8');
        const parsed = JSON.parse(content);
        const cat = parsed.category || (item.folder ? item.folder.replace(/[-_]/g, ' ') : 'General');
        const trk = parsed.track || 'Core Curriculum';
        const est = parsed.estimated_minutes || 30;

        if (!categoriesMap[cat]) {
          categoriesMap[cat] = {
            category: cat,
            tracks: {},
            count: 0,
            estimated_minutes: 0,
            guides: [],
          };
        }

        categoriesMap[cat].count += 1;
        categoriesMap[cat].estimated_minutes += est;
        categoriesMap[cat].guides.push(parsed.id || path.basename(item.fullPath, '.json'));

        if (!categoriesMap[cat].tracks[trk]) {
          categoriesMap[cat].tracks[trk] = {
            track: trk,
            count: 0,
            estimated_minutes: 0,
            guides: [],
          };
        }
        categoriesMap[cat].tracks[trk].count += 1;
        categoriesMap[cat].tracks[trk].estimated_minutes += est;
        categoriesMap[cat].tracks[trk].guides.push(parsed.id);
      } catch {
        // ignore invalid for category roll-up
      }
    }

    res.json(Object.values(categoriesMap));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.get('/api/guides/:id', (req: Request, res: Response): void => {
  const guideId = req.params.id;
  const discovered = findGuideFiles(GUIDES_DIR);

  // Match by id or filename
  const match = discovered.find((item) => {
    if (path.basename(item.fullPath, '.json') === guideId) return true;
    try {
      const content = fs.readFileSync(item.fullPath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.id === guideId;
    } catch {
      return false;
    }
  });

  if (!match) {
    res.status(404).json({ error: `Guide '${guideId}' not found in any folder` });
    return;
  }

  try {
    const content = fs.readFileSync(match.fullPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.folder && match.folder) parsed.folder = match.folder;
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/guides', (req: Request, res: Response): void => {
  const parseResult = GuideSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.issues });
    return;
  }

  const guide = parseResult.data;
  // If a folder or category is specified, store in subfolder
  const targetSubfolder = guide.folder || (guide.category ? guide.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '');
  const targetDir = targetSubfolder ? path.join(GUIDES_DIR, targetSubfolder) : GUIDES_DIR;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, `${guide.id}.json`);

  try {
    fs.writeFileSync(filePath, JSON.stringify(guide, null, 2), 'utf-8');
    res.json({ success: true, guide, filePath: path.relative(GUIDES_DIR, filePath) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// User data persistence endpoints
const ALLOWED_USER_DATA_FILES = ['progress.json', 'bookmarks.json', 'srs-queue.json', 'remediation-request.json'];

app.get('/api/user-data/:file', (req: Request, res: Response): void => {
  const param = String(req.params.file || '');
  const fileName = param.endsWith('.json') ? param : `${param}.json`;
  if (!ALLOWED_USER_DATA_FILES.includes(fileName)) {
    res.status(400).json({ error: 'Invalid user data file' });
    return;
  }

  const filePath = path.join(USER_DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    res.json(null);
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/user-data/:file', (req: Request, res: Response): void => {
  const param = String(req.params.file || '');
  const fileName = param.endsWith('.json') ? param : `${param}.json`;
  if (!ALLOWED_USER_DATA_FILES.includes(fileName)) {
    res.status(400).json({ error: 'Invalid user data file' });
    return;
  }

  const filePath = path.join(USER_DATA_DIR, fileName);
  try {
    const dataWithTimestamp = {
      ...req.body,
      last_updated: req.body.last_updated || Date.now(),
    };
    fs.writeFileSync(filePath, JSON.stringify(dataWithTimestamp, null, 2), 'utf-8');
    res.json({ success: true, saved: dataWithTimestamp });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Docker/Podman Sandbox Runner Endpoints
const ALLOWED_DOCKER_RUNTIMES: DockerLanguage[] = [
  'c',
  'cpp',
  'python',
  'javascript',
  'java',
  'bash',
  'rust',
  'go',
];

app.get('/api/sandbox/capabilities', async (_req: Request, res: Response): Promise<void> => {
  try {
    const capabilities = await getSandboxCapabilities();
    res.json(capabilities);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/sandbox/run', async (req: Request, res: Response): Promise<void> => {
  const { runtime, code, image, timeoutMs } = req.body || {};

  if (!runtime || !ALLOWED_DOCKER_RUNTIMES.includes(runtime)) {
    res.status(400).json({
      error: `Invalid or unsupported runtime "${runtime}". Allowed: ${ALLOWED_DOCKER_RUNTIMES.join(', ')}`,
    });
    return;
  }

  if (typeof code !== 'string') {
    res.status(400).json({ error: 'Code must be a string.' });
    return;
  }

  try {
    const result = await runInDocker({
      runtime,
      code,
      image: typeof image === 'string' ? image : undefined,
      timeoutMs: typeof timeoutMs === 'number' ? timeoutMs : undefined,
    });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// In production, serve the frontend dist
const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 exprt Backend running on http://localhost:${PORT}`);
  console.log(`📁 Watching guides recursively in: ${GUIDES_DIR}`);
});
