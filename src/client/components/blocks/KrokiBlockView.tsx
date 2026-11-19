import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Maximize2, X, Download, Move } from 'lucide-react';
import type { KrokiBlock } from '../../types.js';
import { renderKroki } from '../../api.js';
import { MathText } from '../MathText.js';

interface Props {
  block: KrokiBlock;
  onNodeClick?: (nodeId: string, label: string) => void;
}

export const KrokiBlockView: React.FC<Props> = ({ block, onNodeClick }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pan state (shared for inline and fullscreen inspection)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pointerMovedRef = useRef(false);
  const inlineCanvasRef = useRef<HTMLDivElement | null>(null);
  const modalCanvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError(null);

    renderKroki(block.diagram_type, block.source)
      .then((svg) => {
        if (isCurrent) {
          setSvgContent(svg);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isCurrent) {
          setError(err.message || 'Failed to render diagram');
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [block.diagram_type, block.source]);

  const handleZoomIn = () => setZoom((z) => Math.min(5.0, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Drag-to-pan handlers (works at any zoom level, inline and fullscreen)
  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsPanning(true);
    pointerMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        pointerMovedRef.current = true;
      }
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    };

    const onUp = () => {
      setIsPanning(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!onNodeClick || pointerMovedRef.current) return;
    const target = e.target as HTMLElement | null;
    const nodeEl = target?.closest('.node') as HTMLElement | null;
    if (!nodeEl) return;

    const rawId = nodeEl.id || '';
    const match = rawId.match(/^flowchart-(.+)-\d+$/);
    const extractedId = match ? match[1] : rawId;
    const label = (nodeEl.textContent || '').trim();
    if (extractedId || label) {
      setIsFullscreen(false);
      onNodeClick(extractedId, label);
    }
  };

  // Attach non-passive wheel listeners so Ctrl+Wheel / trackpad pinch zooms ONLY the diagram, not the browser
  useEffect(() => {
    const inlineEl = inlineCanvasRef.current;
    if (!inlineEl) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom((z) => Math.min(5.0, Math.max(0.25, +(z + delta).toFixed(2))));
    };

    inlineEl.addEventListener('wheel', onWheel, { passive: false });
    return () => inlineEl.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const modalEl = modalCanvasRef.current;
    if (!modalEl || !isFullscreen) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom((z) => Math.min(5.0, Math.max(0.25, +(z + delta).toFixed(2))));
    };

    modalEl.addEventListener('wheel', onWheel, { passive: false });
    return () => modalEl.removeEventListener('wheel', onWheel);
  }, [isFullscreen, svgContent]);

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${block.id || 'diagram'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="my-6 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-800">
            {block.title || `${block.diagram_type.toUpperCase()} Diagram`}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-semibold uppercase">
            {block.diagram_type}
          </span>
          <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] text-slate-400">
            <Move className="w-3 h-3" />
            <span>Drag to pan · Ctrl+Scroll to zoom</span>
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition ml-0.5"
            title="Reset Zoom & Pan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {svgContent && (
            <button
              onClick={handleDownloadSvg}
              className="p-1 rounded hover:bg-slate-200 text-slate-600 transition ml-1"
              title="Download Diagram SVG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsFullscreen(true)}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition ml-1 border-l pl-2"
            title="Inspect Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Diagram Canvas with Drag-to-Pan & Ctrl+Wheel Zoom */}
      <div
        ref={inlineCanvasRef}
        onPointerDown={startPan}
        className={`p-4 bg-slate-50/50 flex items-center justify-center min-h-[180px] overflow-hidden ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {loading && (
          <div className="flex items-center space-x-2 text-slate-500 text-xs py-8">
            <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
            <span>Rendering diagram via Kroki...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs max-w-xl">
            <div className="flex items-center space-x-2 font-medium mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Diagram Rendering Error</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] mt-2 overflow-x-auto text-rose-800">
              {error}
            </pre>
          </div>
        )}

        {!loading && !error && svgContent && (
          <div
            onClick={handleSvgClick}
            className={`flex items-center justify-center [&>svg]:max-w-none ${
              onNodeClick ? '[&_.node]:cursor-pointer [&_.node:hover]:opacity-80' : ''
            }`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>

      {block.caption && (
        <MathText
          text={block.caption}
          className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 italic text-center"
        />
      )}

      {/* Fullscreen Interactive Inspector Modal */}
      {isFullscreen && svgContent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-800 text-sm">
                  {block.title || 'Diagram Inspector'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-mono uppercase">
                  {block.diagram_type}
                </span>
                <span className="hidden sm:inline text-[11px] text-slate-400 ml-2">
                  Drag to pan · Scroll to zoom
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-600 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                  title="Reset View"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownloadSvg}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 text-xs flex items-center space-x-1 ml-1"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download</span>
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 ml-1"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div
              ref={modalCanvasRef}
              onPointerDown={startPan}
              className={`flex-1 overflow-hidden flex items-center justify-center bg-slate-50/40 ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <div
                onClick={handleSvgClick}
                className={`[&>svg]:max-w-none ${
                  onNodeClick ? '[&_.node]:cursor-pointer [&_.node:hover]:opacity-80' : ''
                }`}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
