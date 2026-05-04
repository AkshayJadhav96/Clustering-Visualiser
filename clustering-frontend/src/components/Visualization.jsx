import { useMemo, useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  clusterIdsForStep,
  computePlotBounds,
  clusterColorWithAlpha,
  colorForCluster,
} from '../utils/clusterViz';
import { useCentroidInterpolation } from '../hooks/useCentroidInterpolation';

function pickOtherIndex(preferred, avoid, n) {
  if (n < 2) return 0;
  if (preferred !== avoid) return preferred;
  return preferred === 0 ? 1 : 0;
}

const MARGIN = { top: 22, right: 26, bottom: 36, left: 54 };
const CHART_BG = '#fafbff';
const GRID_STROKE = 'rgba(15, 23, 42, 0.06)';
const AXIS_STROKE = 'rgba(15, 23, 42, 0.14)';
const TICK_FILL = '#64748b';

const POINT_RADIUS = 1.7;
const POINT_OPACITY = 0.72;
const LINE_ALPHA = 0.085;
const LINE_WIDTH = 0.45;
const CENTROID_HALO_RADIUS = 10;
const CENTROID_CORE_RADIUS = 6.25;
const CENTROID_HALO_ALPHA = 0.35;
const CENTROID_GLOW_BLUR = 16;
const CENTROID_WHITE_STROKE = 'rgba(255, 255, 255, 0.95)';
const HOVER_PX = 14;

function dataToPixel(x, y, bounds, plotW, plotH, margin) {
  const { minX, maxX, minY, maxY } = bounds;
  const nx = (x - minX) / (maxX - minX);
  const ny = (y - minY) / (maxY - minY);
  return [margin.left + nx * plotW, margin.top + (1 - ny) * plotH];
}

function formatTick(n) {
  if (!Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if (a >= 1000 || (a > 0 && a < 0.01)) return n.toExponential(1);
  return Number.isInteger(n) ? String(n) : n.toFixed(a < 1 ? 2 : 1);
}

export default function Visualization({
  dataRows,
  columnNames,
  result,
  currentStep,
  isPlaying,
  transitionMs,
}) {
  const history = useMemo(() => result?.history ?? [], [result]);
  const finalClusters = result?.final_clusters;
  const nFeatures = columnNames.length;

  const [vizX, setVizX] = useState(0);
  const [vizY, setVizY] = useState(1);

  useEffect(() => {
    if (nFeatures < 2) return;
    setVizX(0);
    setVizY(Math.min(1, nFeatures - 1));
  }, [nFeatures]);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const displayCentroidsRef = useRef([]);
  const drawRef = useRef(() => {});

  const clusterIds = useMemo(() => {
    if (!dataRows.length || !history.length) return [];
    return clusterIdsForStep(dataRows, history, currentStep, finalClusters);
  }, [dataRows, history, currentStep, finalClusters]);

  const bounds = useMemo(
    () => computePlotBounds(dataRows, history, vizX, vizY),
    [dataRows, history, vizX, vizY],
  );

  const xLabel = columnNames[vizX] ?? 'X';
  const yLabel = columnNames[vizY] ?? 'Y';

  const [hover, setHover] = useState(null);
  const hoverIndexRef = useRef(-1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataRows.length || !clusterIds.length) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    if (cssW < 2 || cssH < 2) return;

    const plotW = cssW - MARGIN.left - MARGIN.right;
    const plotH = cssH - MARGIN.top - MARGIN.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = CHART_BG;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const t = i / gridLines;
      const y = MARGIN.top + t * plotH;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y);
      ctx.lineTo(MARGIN.left + plotW, y);
      ctx.stroke();
    }
    for (let i = 0; i <= gridLines; i++) {
      const t = i / gridLines;
      const x = MARGIN.left + t * plotW;
      ctx.beginPath();
      ctx.moveTo(x, MARGIN.top);
      ctx.lineTo(x, MARGIN.top + plotH);
      ctx.stroke();
    }

    ctx.strokeStyle = AXIS_STROKE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, MARGIN.top + plotH);
    ctx.lineTo(MARGIN.left + plotW, MARGIN.top + plotH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, MARGIN.top);
    ctx.lineTo(MARGIN.left, MARGIN.top + plotH);
    ctx.stroke();

    ctx.font = '11px IBM Plex Mono, ui-monospace, monospace';
    ctx.fillStyle = TICK_FILL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= gridLines; i++) {
      const t = i / gridLines;
      const dataX = bounds.minX + t * (bounds.maxX - bounds.minX);
      const px = MARGIN.left + t * plotW;
      ctx.fillText(formatTick(dataX), px, MARGIN.top + plotH + 8);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridLines; i++) {
      const t = i / gridLines;
      const dataY = bounds.minY + (1 - t) * (bounds.maxY - bounds.minY);
      const py = MARGIN.top + t * plotH;
      ctx.fillText(formatTick(dataY), MARGIN.left - 10, py);
    }

    const cents = displayCentroidsRef.current;
    if (cents?.length) {
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = 'round';
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const pxVal = row[vizX];
        const pyVal = row[vizY];
        const cid = clusterIds[i];
        const c = cents[cid];
        if (!c) continue;
        const [px0, py0] = dataToPixel(pxVal, pyVal, bounds, plotW, plotH, MARGIN);
        const [px1, py1] = dataToPixel(c[0], c[1], bounds, plotW, plotH, MARGIN);
        ctx.strokeStyle = clusterColorWithAlpha(cid, LINE_ALPHA);
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px1, py1);
        ctx.stroke();
      }
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const cid = clusterIds[i];
      const [px, py] = dataToPixel(row[vizX], row[vizY], bounds, plotW, plotH, MARGIN);
      ctx.fillStyle = clusterColorWithAlpha(cid, POINT_OPACITY);
      ctx.beginPath();
      ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cents?.length) {
      for (let k = 0; k < cents.length; k++) {
        const c = cents[k];
        const [cx, cy] = dataToPixel(c[0], c[1], bounds, plotW, plotH, MARGIN);
        const fill = colorForCluster(k);

        ctx.fillStyle = clusterColorWithAlpha(k, CENTROID_HALO_ALPHA);
        ctx.beginPath();
        ctx.arc(cx, cy, CENTROID_HALO_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.shadowColor = fill;
        ctx.shadowBlur = CENTROID_GLOW_BLUR;
        ctx.beginPath();
        ctx.arc(cx, cy, CENTROID_CORE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, CENTROID_CORE_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = CENTROID_WHITE_STROKE;
        ctx.lineWidth = 2.25;
        ctx.stroke();
      }
    }
  }, [dataRows, vizX, vizY, clusterIds, bounds]);

  useLayoutEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useCentroidInterpolation({
    history,
    currentStep,
    isPlaying,
    transitionMs,
    displayCentroidsRef,
    drawRef,
    xFeatureIndex: vizX,
    yFeatureIndex: vizY,
  });

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      drawRef.current?.();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMouseMove = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas || !dataRows.length) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const plotW = rect.width - MARGIN.left - MARGIN.right;
      const plotH = rect.height - MARGIN.top - MARGIN.bottom;
      if (plotW <= 0 || plotH <= 0) return;

      let best = -1;
      let bestD = HOVER_PX * HOVER_PX;
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const [px, py] = dataToPixel(row[vizX], row[vizY], bounds, plotW, plotH, MARGIN);
        const dx = px - mx;
        const dy = py - my;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) {
        if (hoverIndexRef.current !== -1) {
          hoverIndexRef.current = -1;
          setHover(null);
        }
        return;
      }
      if (best === hoverIndexRef.current) {
        setHover((h) =>
          h ? { ...h, clientX: e.clientX, clientY: e.clientY } : h,
        );
        return;
      }
      hoverIndexRef.current = best;
      const row = dataRows[best];
      setHover({
        clientX: e.clientX,
        clientY: e.clientY,
        x: row[vizX],
        y: row[vizY],
        cluster: clusterIds[best],
      });
    },
    [dataRows, vizX, vizY, bounds, clusterIds],
  );

  const onMouseLeave = useCallback(() => {
    hoverIndexRef.current = -1;
    setHover(null);
  }, []);

  const iterations = result?.iterations ?? history.length;
  const nPoints = Array.isArray(finalClusters) ? finalClusters.length : null;
  const activeClusters = history[currentStep]?.centroids?.length ?? null;

  const showChart = result && history.length > 0 && dataRows.length > 0 && nFeatures >= 2;

  return (
    <section className="kv-viz-card">
      <div className="kv-viz-head">
        <div>
          <h2 className="kv-viz-title">Cluster map</h2>
          <p className="kv-viz-desc">
            Each dot follows its centroid through the run. Faint lines show assignment; bright rings mark
            centroids. Scrub or replay anytime — your last result stays in memory.
          </p>
        </div>
        {showChart ? (
          <span className="kv-step-pill">Iteration {currentStep + 1}</span>
        ) : null}
      </div>

      {showChart ? (
        <div className="kv-viz-features" aria-label="Plot axes">
          <label className="kv-viz-feature">
            <span className="kv-viz-feature__label">X axis</span>
            <select
              value={vizX}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVizX(next);
                if (next === vizY && nFeatures > 1) {
                  setVizY(pickOtherIndex(vizY, next, nFeatures));
                }
              }}
            >
              {columnNames.map((name, idx) => (
                <option key={`x-${name}-${idx}`} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="kv-viz-feature">
            <span className="kv-viz-feature__label">Y axis</span>
            <select
              value={vizY}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVizY(next);
                if (next === vizX && nFeatures > 1) {
                  setVizX(pickOtherIndex(vizX, next, nFeatures));
                }
              }}
            >
              {columnNames.map((name, idx) => (
                <option key={`y-${name}-${idx}`} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {showChart ? (
        <>
          <div className="kv-canvas-wrap" ref={wrapRef}>
            <canvas
              ref={canvasRef}
              className="kv-canvas"
              aria-label="K-means scatter plot"
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
            />
            {hover ? (
              <div
                className="kv-tooltip"
                style={{ left: hover.clientX, top: hover.clientY }}
                role="status"
              >
                <span>
                  {xLabel}: {hover.x.toFixed(3)} · {yLabel}: {hover.y.toFixed(3)}
                </span>
                <span>Cluster {hover.cluster}</span>
              </div>
            ) : null}
          </div>
          <div className="kv-metrics">
            <div className="kv-metric">
              <span className="kv-metric__label">Snapshots</span>
              <span className="kv-metric__value">{history.length}</span>
            </div>
            {iterations != null ? (
              <div className="kv-metric">
                <span className="kv-metric__label">Engine iterations</span>
                <span className="kv-metric__value">{iterations}</span>
              </div>
            ) : null}
            {nPoints != null ? (
              <div className="kv-metric">
                <span className="kv-metric__label">Points</span>
                <span className="kv-metric__value">{nPoints}</span>
              </div>
            ) : null}
            {activeClusters != null ? (
              <div className="kv-metric">
                <span className="kv-metric__label">Centroids (k)</span>
                <span className="kv-metric__value">{activeClusters}</span>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="kv-canvas-wrap">
          <p className="kv-viz-empty">
            {dataRows.length
              ? 'Run K-Means to render your dataset and animate how centroids settle.'
              : 'Upload a CSV in the control panel, then run K-Means to see the visualization here.'}
          </p>
        </div>
      )}
    </section>
  );
}
