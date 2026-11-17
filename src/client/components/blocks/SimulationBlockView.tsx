import React, { useState, useMemo } from 'react';
import katex from 'katex';
import { Sliders, Activity, TrendingUp, Gauge, BarChart3 } from 'lucide-react';
import type { SimulationBlock } from '../../types.js';
import { MathText } from '../MathText.js';

interface Props {
  block: SimulationBlock;
}

export const SimulationBlockView: React.FC<Props> = ({ block }) => {
  // Initialize slider values with defaults
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const v of block.variables) {
      initial[v.id] = v.default;
    }
    return initial;
  });

  const handleSliderChange = (id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  // Safe compute helper
  const evalWithValues = (scope: Record<string, number>): number => {
    try {
      const keys = Object.keys(scope);
      const args = Object.values(scope);
      const fn = new Function(...keys, `return (${block.compute_expression});`);
      const res = fn(...args);
      return typeof res === 'number' && !isNaN(res) ? res : 0;
    } catch {
      return 0;
    }
  };

  // Compute live current output
  const computedValue = useMemo(() => {
    try {
      const result = evalWithValues(values);
      return Math.round(result * 1000) / 1000;
    } catch {
      return 0;
    }
  }, [values, block.compute_expression]);

  const renderedFormula = useMemo(() => {
    if (!block.formula) return null;
    try {
      return katex.renderToString(block.formula, { displayMode: true, throwOnError: false });
    } catch {
      return block.formula;
    }
  }, [block.formula]);

  // Dynamic SVG curve generation for 'line' chart type
  const lineCurveData = useMemo(() => {
    if (block.chart_type !== 'line' || block.variables.length === 0) return null;
    const primaryVar = block.variables[0];
    const steps = 30;
    const stepSize = (primaryVar.max - primaryVar.min) / steps;
    const points: { xVal: number; yVal: number }[] = [];

    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i <= steps; i++) {
      const currentX = primaryVar.min + i * stepSize;
      const testScope = { ...values, [primaryVar.id]: currentX };
      const y = evalWithValues(testScope);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      points.push({ xVal: currentX, yVal: y });
    }

    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    // Map to SVG coordinates: 360 x 120
    const svgWidth = 360;
    const svgHeight = 110;
    const padding = 15;

    const mapX = (x: number) =>
      padding + ((x - primaryVar.min) / (primaryVar.max - primaryVar.min || 1)) * (svgWidth - 2 * padding);
    const mapY = (y: number) =>
      svgHeight - padding - ((y - minY) / (maxY - minY || 1)) * (svgHeight - 2 * padding);

    const pathD = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.xVal).toFixed(1)} ${mapY(p.yVal).toFixed(1)}`)
      .join(' ');

    const currentXPos = mapX(values[primaryVar.id] ?? primaryVar.default);
    const currentYPos = mapY(computedValue);

    return { pathD, currentXPos, currentYPos, svgWidth, svgHeight, minY, maxY };
  }, [block.chart_type, block.variables, values, computedValue]);

  // Gauge percentage calculation
  const gaugePercent = useMemo(() => {
    if (block.chart_type !== 'gauge') return 0;
    const clamped = Math.max(0, Math.min(100, Math.abs(computedValue) <= 1 ? computedValue * 100 : computedValue));
    return Math.round(clamped);
  }, [block.chart_type, computedValue]);

  return (
    <div className="my-6 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/70 border-b border-blue-100">
        <div className="flex items-center space-x-2">
          {block.chart_type === 'line' ? (
            <TrendingUp className="w-4 h-4 text-blue-600" />
          ) : block.chart_type === 'gauge' ? (
            <Gauge className="w-4 h-4 text-blue-600" />
          ) : block.chart_type === 'bar' ? (
            <BarChart3 className="w-4 h-4 text-blue-600" />
          ) : (
            <Sliders className="w-4 h-4 text-blue-600" />
          )}
          <span className="font-semibold text-slate-800 text-xs sm:text-sm">
            {block.title || 'Interactive Model Simulation'}
          </span>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
          {block.chart_type || 'simulation'}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {/* Description & Formula */}
        <MathText text={block.description} className="text-xs text-slate-700 leading-relaxed mb-3" />

        {renderedFormula && (
          <div
            className="my-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: renderedFormula }}
          />
        )}

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          {block.variables.map((variable) => {
            const currentVal = values[variable.id] ?? variable.default;
            return (
              <div key={variable.id} className="flex flex-col space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700">{variable.name}</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900 font-semibold text-[11px]">
                    {currentVal} {variable.unit || ''}
                  </span>
                </div>
                <input
                  type="range"
                  min={variable.min}
                  max={variable.max}
                  step={variable.step}
                  value={currentVal}
                  onChange={(e) => handleSliderChange(variable.id, parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{variable.min}</span>
                  <span>{variable.max}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual Dynamic Simulation Outputs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center bg-gradient-to-br from-slate-900 to-indigo-950 p-4 sm:p-5 rounded-2xl text-white shadow-sm">
          {/* Main Numeric Metric */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center space-x-2 mb-1">
              <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">
                {block.output_label}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {computedValue} {block.output_unit || ''}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-sans">
              Reactive live computation
            </span>
          </div>

          {/* Interactive Chart Visualizer */}
          <div className="lg:col-span-2 flex items-center justify-center bg-white/5 rounded-xl p-3 border border-white/10">
            {/* 1. Line Chart Type */}
            {lineCurveData && block.chart_type === 'line' && (
              <div className="w-full flex flex-col items-center">
                <svg
                  viewBox={`0 0 ${lineCurveData.svgWidth} ${lineCurveData.svgHeight}`}
                  className="w-full h-28 overflow-visible"
                >
                  {/* Subtle Gridlines */}
                  <line
                    x1="15"
                    y1={lineCurveData.svgHeight - 15}
                    x2={lineCurveData.svgWidth - 15}
                    y2={lineCurveData.svgHeight - 15}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1"
                  />
                  {/* Dynamic Curve */}
                  <path
                    d={lineCurveData.pathD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Active Point Marker */}
                  <circle
                    cx={lineCurveData.currentXPos}
                    cy={lineCurveData.currentYPos}
                    r="5"
                    fill="#60a5fa"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="drop-shadow-md"
                  />
                </svg>
                <div className="flex justify-between w-full text-[10px] text-slate-400 font-mono px-2 mt-1">
                  <span>Min: {lineCurveData.minY.toFixed(2)}</span>
                  <span className="text-sky-300 font-semibold">Active State</span>
                  <span>Max: {lineCurveData.maxY.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* 2. Gauge Type */}
            {block.chart_type === 'gauge' && (
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-16 overflow-hidden">
                  <div className="w-32 h-32 rounded-full border-8 border-white/10 border-t-blue-500 border-r-blue-400 transform -rotate-45" />
                  <div className="absolute inset-0 flex items-end justify-center pb-1">
                    <span className="text-lg font-bold font-mono text-white">{gaugePercent}%</span>
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-150"
                    style={{ width: `${gaugePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* 3. Bar Chart Type or Value fallback */}
            {(block.chart_type === 'bar' || block.chart_type === 'value' || !block.chart_type) && (
              <div className="w-full space-y-2 py-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Parameter Response Index</span>
                  <span className="font-mono text-sky-400 font-semibold">
                    {Math.round(computedValue * 100) / 100}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-400 rounded-full transition-all duration-100"
                    style={{
                      width: `${Math.min(100, Math.max(5, (Math.abs(computedValue) % 100)))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
