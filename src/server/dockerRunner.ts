import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ContainerEngine = 'docker' | 'podman';

export type DockerLanguage =
  | 'c'
  | 'cpp'
  | 'python'
  | 'javascript'
  | 'java'
  | 'bash'
  | 'rust'
  | 'go';

interface RuntimeSpec {
  filename: string;
  command: string;
  preferredImages: string[];
  installHint: string;
}

const RUNTIME_SPECS: Record<DockerLanguage, RuntimeSpec> = {
  c: {
    filename: 'main.c',
    command: 'gcc -O2 -Wall -Wextra /work/main.c -o /tmp/a.out -lm && /tmp/a.out',
    preferredImages: ['sye-build:1.0', 'gcc:latest', 'gcc:14', 'gcc:13', 'ubuntu:24.04', 'ubuntu:22.04'],
    installHint: 'docker pull gcc:latest',
  },
  cpp: {
    filename: 'main.cpp',
    command: 'g++ -std=c++20 -O2 -Wall -Wextra -pthread /work/main.cpp -o /tmp/a.out && /tmp/a.out',
    preferredImages: ['sye-build:1.0', 'gcc:latest', 'gcc:14', 'gcc:13', 'ubuntu:24.04', 'ubuntu:22.04'],
    installHint: 'docker pull gcc:latest',
  },
  python: {
    filename: 'main.py',
    command: 'python3 /work/main.py',
    preferredImages: ['python:3.12-slim', 'python:3.11-slim', 'python:latest', 'sye-build:1.0', 'ubuntu:24.04'],
    installHint: 'docker pull python:3.12-slim',
  },
  javascript: {
    filename: 'main.mjs',
    command: 'node /work/main.mjs',
    preferredImages: ['node:22-alpine', 'node:20-alpine', 'node:lts', 'node:latest'],
    installHint: 'docker pull node:22-alpine',
  },
  java: {
    filename: 'Main.java',
    command: 'javac -d /tmp /work/Main.java && java -cp /tmp Main',
    preferredImages: ['eclipse-temurin:25-jdk', 'eclipse-temurin:21-jdk', 'eclipse-temurin:17-jdk', 'openjdk:21'],
    installHint: 'docker pull eclipse-temurin:21-jdk',
  },
  bash: {
    filename: 'script.sh',
    command:
      'mkdir -p /tmp/playground && cd /tmp/playground && HOME=/tmp/playground GIT_AUTHOR_NAME="Student" GIT_AUTHOR_EMAIL="student@exprt.local" GIT_COMMITTER_NAME="Student" GIT_COMMITTER_EMAIL="student@exprt.local" sh -c "if command -v bash >/dev/null 2>&1; then exec bash /work/script.sh; else exec sh /work/script.sh; fi"',
    preferredImages: ['sye-build:1.0', 'alpine/git:latest', 'ubuntu:24.04', 'alpine:latest'],
    installHint: 'docker pull alpine/git:latest',
  },
  rust: {
    filename: 'main.rs',
    command: 'rustc -O /work/main.rs -o /tmp/a.out && /tmp/a.out',
    preferredImages: ['rust:slim', 'rust:latest'],
    installHint: 'docker pull rust:slim',
  },
  go: {
    filename: 'main.go',
    command: 'GOCACHE=/tmp/gocache GOPATH=/tmp/gopath go run /work/main.go',
    preferredImages: ['golang:alpine', 'golang:latest'],
    installHint: 'docker pull golang:alpine',
  },
};

export interface SandboxCapabilities {
  engine: ContainerEngine | null;
  version?: string;
  images: string[];
  recommendedImages: Record<DockerLanguage, string | null>;
}

export interface DockerRunRequest {
  runtime: DockerLanguage;
  code: string;
  image?: string;
  timeoutMs?: number;
}

export interface DockerRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  engine: ContainerEngine | null;
  image: string | null;
  error?: string;
}

function matchImage(installedImages: string[], preferred: string): string | null {
  for (const img of installedImages) {
    if (img === preferred || img.endsWith(`/${preferred}`)) {
      return img;
    }
  }
  return null;
}

async function detectEngine(): Promise<{ engine: ContainerEngine; version: string } | null> {
  try {
    const { stdout } = await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}'], {
      timeout: 2500,
    });
    return { engine: 'docker', version: stdout.trim() };
  } catch {
    // Fallback to podman if docker daemon isn't running or available
  }

  try {
    const { stdout } = await execFileAsync('podman', ['info', '--format', '{{.Version.Version}}'], {
      timeout: 2500,
    });
    return { engine: 'podman', version: stdout.trim() };
  } catch {
    return null;
  }
}

async function listLocalImages(engine: ContainerEngine): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(engine, ['images', '--format', '{{.Repository}}:{{.Tag}}'], {
      timeout: 2500,
    });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.includes('<none>'));
  } catch {
    return [];
  }
}

export async function getSandboxCapabilities(): Promise<SandboxCapabilities> {
  const detected = await detectEngine();
  if (!detected) {
    return {
      engine: null,
      images: [],
      recommendedImages: {
        c: null,
        cpp: null,
        python: null,
        javascript: null,
        java: null,
        bash: null,
        rust: null,
        go: null,
      },
    };
  }

  const images = await listLocalImages(detected.engine);
  const recommendedImages = {} as Record<DockerLanguage, string | null>;

  (Object.keys(RUNTIME_SPECS) as DockerLanguage[]).forEach((lang) => {
    let found: string | null = null;
    for (const pref of RUNTIME_SPECS[lang].preferredImages) {
      const matched = matchImage(images, pref);
      if (matched) {
        found = matched;
        break;
      }
    }
    recommendedImages[lang] = found;
  });

  return {
    engine: detected.engine,
    version: detected.version,
    images,
    recommendedImages,
  };
}

export async function runInDocker(req: DockerRunRequest): Promise<DockerRunResult> {
  const start = Date.now();
  const spec = RUNTIME_SPECS[req.runtime];
  if (!spec) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      durationMs: Date.now() - start,
      engine: null,
      image: null,
      error: `Unsupported Docker runtime: ${req.runtime}`,
    };
  }

  const capabilities = await getSandboxCapabilities();
  if (!capabilities.engine) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      durationMs: Date.now() - start,
      engine: null,
      image: null,
      error: 'Neither Docker nor Podman is available or running on this machine.',
    };
  }

  const engine = capabilities.engine;
  let selectedImage: string | null = null;

  if (req.image && req.image.trim()) {
    const cleanImg = req.image.trim();
    if (!/^[a-zA-Z0-9._/:@-]+$/.test(cleanImg)) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        durationMs: Date.now() - start,
        engine,
        image: null,
        error: `Invalid Docker image name: ${cleanImg}`,
      };
    }
    selectedImage = cleanImg;
  } else {
    selectedImage = capabilities.recommendedImages[req.runtime];
  }

  if (!selectedImage) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      durationMs: Date.now() - start,
      engine,
      image: null,
      error: `No local container image found for "${req.runtime}". Pull an image first (e.g., \`${spec.installHint}\`).`,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exprt-sandbox-'));
  const filePath = path.join(tempDir, spec.filename);
  fs.writeFileSync(filePath, req.code, 'utf-8');

  const containerName = `exprt-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timeoutMs = Math.min(20000, Math.max(1000, req.timeoutMs ?? 10000));
  const MAX_OUTPUT_BYTES = 64 * 1024;

  const args = [
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    '--name',
    containerName,
    '--network',
    'none',
    '--memory',
    '256m',
    '--cpus',
    '1',
    '--pids-limit',
    '64',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,exec,nosuid,size=64m',
    '-v',
    `${tempDir}:/work:ro`,
    selectedImage,
    '-c',
    spec.command,
  ];

  return new Promise<DockerRunResult>((resolve) => {
    const child = spawn(engine, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let outputTruncated = false;
    let timedOut = false;
    let finished = false;

    const appendChunk = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      const str = chunk.toString('utf-8');
      if (target === 'stdout') {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += str.slice(0, MAX_OUTPUT_BYTES - stdout.length);
        } else {
          outputTruncated = true;
        }
      } else {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += str.slice(0, MAX_OUTPUT_BYTES - stderr.length);
        } else {
          outputTruncated = true;
        }
      }
    };

    child.stdout.on('data', (chunk: Buffer) => appendChunk('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => appendChunk('stderr', chunk));

    const timer = setTimeout(() => {
      if (finished) return;
      timedOut = true;
      execFile(engine, ['kill', containerName], () => {
        // ignore kill errors if container already exited
      });
      child.kill('SIGKILL');
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    };

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve({
        success: false,
        stdout,
        stderr,
        exitCode: null,
        timedOut,
        durationMs: Date.now() - start,
        engine,
        image: selectedImage,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (outputTruncated) {
        stderr += '\n[Output truncated at 64KB limit]';
      }
      resolve({
        success: !timedOut && code === 0,
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        durationMs: Date.now() - start,
        engine,
        image: selectedImage,
        error: timedOut ? `Execution timed out after ${(timeoutMs / 1000).toFixed(1)}s.` : undefined,
      });
    });
  });
}
