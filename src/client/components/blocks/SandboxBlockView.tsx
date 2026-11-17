import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Code,
  Eye,
  EyeOff,
  Loader2,
  Lightbulb,
  Maximize2,
  Minimize2,
  Columns,
  Rows,
  Container,
  Globe,
} from 'lucide-react';
import type { SandboxBlock } from '../../types.js';
import { MathText } from '../MathText.js';
import {
  fetchSandboxCapabilities,
  runDockerSandbox,
  type SandboxCapabilitiesResponse,
} from '../../api.js';

interface Props {
  block: SandboxBlock;
}

declare global {
  interface Window {
    loadPyodide?: any;
    __pyodideInstance?: any;
  }
}

async function getPyodideInstance(onStatus?: (msg: string) => void) {
  if (window.__pyodideInstance) return window.__pyodideInstance;
  if (!window.loadPyodide) {
    if (onStatus) onStatus('Loading Pyodide WebAssembly runtime (~6MB)...');
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Pyodide WebAssembly from CDN'));
      document.head.appendChild(script);
    });
  }
  if (onStatus) onStatus('Initializing Python WebAssembly environment...');
  const pyodide = await window.loadPyodide();
  window.__pyodideInstance = pyodide;
  return pyodide;
}

const DOCKER_ONLY_RUNTIMES = new Set(['c', 'cpp', 'java', 'bash', 'rust', 'go']);

export const SandboxBlockView: React.FC<Props> = ({ block }) => {
  const isDockerOnly = DOCKER_ONLY_RUNTIMES.has(block.runtime);
  const [runnerMode, setRunnerMode] = useState<'browser' | 'docker'>(
    block.runner === 'docker' || isDockerOnly ? 'docker' : 'browser'
  );
  const [capabilities, setCapabilities] = useState<SandboxCapabilitiesResponse | null>(null);
  const [code, setCode] = useState(block.starter_code);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [passed, setPassed] = useState<boolean | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [revealedHintsCount, setRevealedHintsCount] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'stacked' | 'split'>('stacked');
  const [splitPercent, setSplitPercent] = useState<number>(55);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const startSplitDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const rect = splitContainerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.max(25, Math.min(75, Math.round(pct))));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    let cancelled = false;
    fetchSandboxCapabilities().then((caps) => {
      if (!cancelled && caps) setCapabilities(caps);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canToggleRunner =
    !isDockerOnly &&
    block.runtime !== 'html' &&
    Boolean(capabilities?.engine);

  const handleRun = async () => {
    setIsRunning(true);
    setPassed(null);
    setOutput('');
    setStatusMessage('');

    if (runnerMode === 'docker' && block.runtime !== 'html') {
      const engineLabel = capabilities?.engine || 'Docker';
      setStatusMessage(`Running ${block.runtime.toUpperCase()} in isolated ${engineLabel} container...`);
      try {
        const res = await runDockerSandbox({
          runtime: block.runtime,
          code,
          image: block.docker_image,
        });

        const parts: string[] = [];
        if (res.stdout.trimEnd()) parts.push(res.stdout.trimEnd());
        if (res.stderr.trimEnd()) {
          parts.push(parts.length > 0 ? `[stderr]\n${res.stderr.trimEnd()}` : res.stderr.trimEnd());
        }
        if (res.error) {
          parts.push(`⚠️ ${res.error}`);
        }

        const combinedOutput =
          parts.join('\n\n') ||
          (res.success
            ? `(Executed cleanly in ${res.durationMs}ms via ${res.engine || 'container'} [${res.image}])`
            : `(Exited with code ${res.exitCode})`);

        setOutput(combinedOutput);

        if (block.expected_output !== undefined) {
          const cleanActual = (res.stdout || combinedOutput).trim();
          const cleanExpected = block.expected_output.trim();
          setPassed(res.success && (cleanActual === cleanExpected || cleanActual.includes(cleanExpected)));
        } else {
          setPassed(res.success);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setOutput(`Container Execution Error:\n${message}`);
        setPassed(false);
      } finally {
        setIsRunning(false);
        setStatusMessage('');
      }
      return;
    }

    if (block.runtime === 'javascript') {
      // Create an inline Web Worker with a 3-second watchdog timer
      // This guarantees infinite loops (e.g. while(true)) will NEVER freeze the UI!
      const workerScript = `
        self.onmessage = function(e) {
          const userCode = e.data;
          const logs = [];
          const customConsole = {
            log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
            warn: (...args) => logs.push('[Warn] ' + args.map(a => String(a)).join(' ')),
            error: (...args) => logs.push('[Error] ' + args.map(a => String(a)).join(' '))
          };

          try {
            const runner = new Function('console', '"use strict"; ' + userCode);
            const result = runner(customConsole);
            Promise.resolve(result).then(() => {
              self.postMessage({ success: true, logs });
            }).catch(err => {
              self.postMessage({ success: false, error: err.message, logs });
            });
          } catch(err) {
            self.postMessage({ success: false, error: err.message, logs });
          }
        };
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      workerRef.current = worker;

      let hasFinished = false;

      // 3.0 second watchdog timer
      const timeoutId = setTimeout(() => {
        if (!hasFinished) {
          hasFinished = true;
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          setIsRunning(false);
          setOutput('⚠️ Execution timed out (3.0s limit reached). Please check for infinite loops or non-terminating recursion.');
          setPassed(false);
        }
      }, 3000);

      worker.onmessage = (event) => {
        if (hasFinished) return;
        hasFinished = true;
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        setIsRunning(false);

        const { success, error, logs } = event.data;
        let executionOutput = (logs || []).join('\n');

        if (!success && error) {
          executionOutput = executionOutput
            ? `${executionOutput}\nRuntime Error: ${error}`
            : `Runtime Error: ${error}`;
        }

        const finalOutput = executionOutput || '(Executed successfully with no console output)';
        setOutput(finalOutput);

        if (block.expected_output !== undefined) {
          const cleanActual = finalOutput.trim();
          const cleanExpected = block.expected_output.trim();
          setPassed(cleanActual === cleanExpected || cleanActual.includes(cleanExpected));
        } else {
          setPassed(success);
        }
      };

      worker.onerror = (err) => {
        if (hasFinished) return;
        hasFinished = true;
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        setIsRunning(false);
        setOutput(`Execution syntax error: ${err.message}`);
        setPassed(false);
      };

      worker.postMessage(code);
    } else if (block.runtime === 'python') {
      try {
        const pyodide = await getPyodideInstance((msg) => setStatusMessage(msg));
        setStatusMessage('Executing Python code...');
        const logs: string[] = [];
        pyodide.setStdout({ batched: (str: string) => logs.push(str) });
        pyodide.setStderr({ batched: (str: string) => logs.push(`[Error] ${str}`) });

        await pyodide.runPythonAsync(code);

        const finalOutput = logs.join('\n') || '(Python executed with no print output)';
        setOutput(finalOutput);

        if (block.expected_output !== undefined) {
          const cleanActual = finalOutput.trim();
          const cleanExpected = block.expected_output.trim();
          setPassed(cleanActual === cleanExpected || cleanActual.includes(cleanExpected));
        } else {
          setPassed(true);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setOutput(`Python Error:\n${message}`);
        setPassed(false);
      } finally {
        setIsRunning(false);
        setStatusMessage('');
      }
    } else if (block.runtime === 'html') {
      setIsRunning(false);
      setOutput('HTML code preview updated in live frame below.');
    } else {
      setIsRunning(false);
      setOutput(`Runtime '${block.runtime}' ready.`);
    }
  };

  const handleReset = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    setCode(block.starter_code);
    setOutput('');
    setPassed(null);
    setIsRunning(false);
  };

  return (
    <div className="my-6 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-emerald-50/70 border-b border-emerald-100">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <Code className="w-4 h-4 text-emerald-700" />
          <span className="font-semibold text-slate-800 text-xs sm:text-sm">
            {block.title || 'Interactive Code Sandbox'}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-mono uppercase font-semibold inline-flex items-center space-x-1">
            {runnerMode === 'docker' ? (
              <Container className="w-3 h-3 text-sky-700" />
            ) : (
              <Globe className="w-3 h-3 text-emerald-700" />
            )}
            <span>
              {block.runtime} ({runnerMode === 'docker' ? capabilities?.engine || 'docker' : 'browser'})
            </span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
          {/* Browser / Docker Runner Toggle (when runtime supports both) */}
          {canToggleRunner && (
            <div className="flex items-center bg-slate-200/80 rounded-lg p-0.5 mr-1 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setRunnerMode('browser')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition ${
                  runnerMode === 'browser' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Run in Browser Sandbox"
              >
                <Globe className="w-3 h-3" />
                <span>Browser</span>
              </button>
              <button
                type="button"
                onClick={() => setRunnerMode('docker')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition ${
                  runnerMode === 'docker' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Run in ${capabilities?.engine || 'Docker'} Container`}
              >
                <Container className="w-3 h-3" />
                <span className="capitalize">{capabilities?.engine || 'Docker'}</span>
              </button>
            </div>
          )}
          {/* Split / Stacked toggle */}
          <div className="hidden sm:flex items-center bg-slate-200/80 rounded-lg p-0.5 mr-1">
            <button
              type="button"
              onClick={() => setLayoutMode('stacked')}
              className={`p-1 rounded ${layoutMode === 'stacked' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              title="Stacked View (Editor over Output)"
            >
              <Rows className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`p-1 rounded ${layoutMode === 'split' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              title="Side-by-Side Split View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expand Height Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 px-2 py-1 text-xs rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title={isExpanded ? 'Contract Window Size' : 'Enlarge Window Size'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isExpanded ? 'Contract' : 'Enlarge'}</span>
          </button>

          {block.solution && (
            <button
              onClick={() => setShowSolution(!showSolution)}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              {showSolution ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showSolution ? 'Hide Solution' : 'Solution'}</span>
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Reset Starter Code"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center space-x-1.5 px-3.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white shadow-sm transition"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Task Instructions & Hints */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-200 text-xs text-slate-700 space-y-3">
        <div>
          <span className="font-semibold text-slate-900 block mb-1">Task Instructions:</span>
          <MathText text={block.instructions} className="leading-relaxed" />
        </div>

        {/* Socratic Hint Ladder for Sandbox */}
        {block.hints && block.hints.length > 0 && (
          <div className="pt-2 border-t border-slate-200/80">
            {revealedHintsCount < block.hints.length && (
              <button
                type="button"
                onClick={() => setRevealedHintsCount((prev) => prev + 1)}
                className="inline-flex items-center space-x-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {revealedHintsCount === 0
                    ? `Need a hint? (Reveal 1 of ${block.hints.length})`
                    : `Reveal next hint (${revealedHintsCount + 1} of ${block.hints.length})`}
                </span>
              </button>
            )}

            {revealedHintsCount > 0 && (
              <div className="mt-2.5 space-y-2">
                {block.hints.slice(0, revealedHintsCount).map((hint, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-950"
                  >
                    <div className="font-semibold text-amber-900 mb-0.5 flex items-center space-x-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span>Socratic Hint {idx + 1}:</span>
                    </div>
                    <MathText text={hint} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code Editor and Output Container (Supports Stacked and Split layouts) */}
      <div
        ref={splitContainerRef}
        className={layoutMode === 'split' ? 'flex flex-col lg:flex-row' : ''}
      >
        {/* Code Editor */}
        <div
          style={layoutMode === 'split' ? { flexBasis: `${splitPercent}%` } : undefined}
          className={`p-3 bg-slate-900 flex flex-col justify-between ${
            layoutMode === 'split' ? 'lg:flex-shrink-0 min-w-0' : ''
          }`}
        >
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={isExpanded ? 24 : layoutMode === 'split' ? 16 : Math.max(7, Math.min(18, code.split('\n').length + 2))}
            className="w-full bg-slate-900 text-emerald-300 font-mono text-xs sm:text-sm p-2 outline-none resize-y selection:bg-emerald-900/50 leading-normal"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        {/* Draggable Split Divider */}
        {layoutMode === 'split' && (
          <div
            onPointerDown={startSplitDrag}
            title="Drag to resize editor and output panes"
            className="hidden lg:flex w-2 bg-slate-800 hover:bg-emerald-500/70 cursor-col-resize items-center justify-center flex-shrink-0 transition-colors"
          >
            <div className="w-0.5 h-10 bg-slate-500 rounded-full" />
          </div>
        )}

        {/* Dynamic Status Banner, Solution & Outputs (in right column if split, bottom if stacked) */}
        <div className={`flex flex-col bg-slate-950 ${layoutMode === 'split' ? 'flex-1 min-w-0' : ''}`}>
          {/* Dynamic Status Banner */}
          {statusMessage && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center space-x-2 text-xs text-indigo-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Solution drawer */}
          {showSolution && block.solution && (
            <div className="p-4 bg-indigo-950/70 border-b border-indigo-900 text-xs">
              <span className="font-semibold text-indigo-300 block mb-1">Model Solution:</span>
              <pre className="font-mono text-xs bg-slate-900 text-indigo-200 p-3 rounded-xl overflow-x-auto border border-indigo-800/50">
                {block.solution}
              </pre>
            </div>
          )}

          {/* HTML Sandbox preview */}
          {block.runtime === 'html' && (
            <div className="p-4 border-b border-slate-800 bg-slate-900">
              <span className="text-xs font-semibold text-slate-300 block mb-2">Live Preview:</span>
              <iframe
                srcDoc={code}
                title="HTML preview"
                sandbox="allow-scripts"
                className={`w-full border border-slate-700 rounded-lg bg-white ${isExpanded ? 'h-96' : 'h-48'}`}
              />
            </div>
          )}

          {/* Terminal Output */}
          <div className={`p-3.5 bg-slate-950 text-slate-200 text-xs font-mono flex-1 overflow-auto ${isExpanded ? 'min-h-[220px]' : 'min-h-[140px]'}`}>
            <div className="flex items-center justify-between text-slate-400 mb-1.5 pb-1 border-b border-slate-800">
              <span>Terminal Output:</span>
              {passed === true && (
                <span className="flex items-center space-x-1 text-emerald-400 font-sans font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Assertion Passed!</span>
                </span>
              )}
              {passed === false && (
                <span className="flex items-center space-x-1 text-rose-400 font-sans font-semibold text-xs">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Output did not match assertion</span>
                </span>
              )}
            </div>
            {output ? (
              <pre className="whitespace-pre-wrap">{output}</pre>
            ) : (
              <span className="text-slate-600 italic">Click "Run Code" above to execute...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
