import { useMemo, useCallback } from 'react';

const PAD = { l: 48, r: 20, t: 20, b: 44 };
const VB_W = 640;
const VB_H = 280;

function formatWcss(v) {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1e6 || (a > 0 && a < 0.01)) return v.toExponential(2);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

export default function ElbowChart({ curve, selectedK, onPickK }) {
  const layout = useMemo(() => {
    if (!curve?.length) return null;
    const ks = curve.map((p) => p.k);
    const ws = curve.map((p) => p.wcss);
    const kMin = Math.min(...ks);
    const kMax = Math.max(...ks);
    let wMin = Math.min(...ws);
    let wMax = Math.max(...ws);
    if (!Number.isFinite(wMin) || !Number.isFinite(wMax)) return null;
    if (wMax === wMin) {
      wMin *= 0.95;
      wMax *= 1.05 + 1e-9;
    }
    const innerW = VB_W - PAD.l - PAD.r;
    const innerH = VB_H - PAD.t - PAD.b;
    const xScale = (k) => PAD.l + ((k - kMin) / (kMax - kMin || 1)) * innerW;
    const yScale = (w) => PAD.t + innerH - ((w - wMin) / (wMax - wMin)) * innerH;
    const points = curve.map((p) => ({ k: p.k, w: p.wcss, x: xScale(p.k), y: yScale(p.wcss) }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return { points, pathD, kMin, kMax, wMin, wMax, innerW, innerH, xScale, yScale };
  }, [curve]);

  const onSvgClick = useCallback(
    (e) => {
      if (!layout || !onPickK || !curve?.length) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const vx = ((e.clientX - rect.left) / rect.width) * VB_W;
      const { kMin, kMax, innerW } = layout;
      const t = (vx - PAD.l) / innerW;
      const kFloat = kMin + t * (kMax - kMin);
      let best = curve[0].k;
      let bestD = Infinity;
      for (let i = 0; i < curve.length; i++) {
        const d = Math.abs(curve[i].k - kFloat);
        if (d < bestD) {
          bestD = d;
          best = curve[i].k;
        }
      }
      onPickK(best);
    },
    [layout, onPickK, curve],
  );

  if (!curve?.length || !layout) {
    return (
      <section className="kv-elbow-card">
        <h2 className="kv-elbow-title">Elbow curve (WCSS vs k)</h2>
        <p className="kv-elbow-empty">
          After choosing clustering columns, compute the elbow curve. Then click the chart or set k and run
          K-means.
        </p>
      </section>
    );
  }

  const { points, pathD, wMin, wMax } = layout;

  return (
    <section className="kv-elbow-card">
      <div className="kv-elbow-head">
        <div>
          <h2 className="kv-elbow-title">Elbow curve (WCSS vs k)</h2>
          <p className="kv-elbow-desc">
            Lower inertia means tighter clusters. Look for an &quot;elbow&quot; where adding clusters helps
            less. Click a point to set <strong>k</strong> for the run below.
          </p>
        </div>
        <span className="kv-elbow-kpill">k = {selectedK}</span>
      </div>

      <svg
        className="kv-elbow-svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="Elbow curve: within-cluster sum of squares versus number of clusters"
        onClick={onSvgClick}
      >
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="#fafbff" rx={8} />

        {[0, 1, 2, 3, 4, 5].map((i) => {
          const ty = PAD.t + (i / 5) * (VB_H - PAD.t - PAD.b);
          return (
            <line
              key={`h-${i}`}
              x1={PAD.l}
              y1={ty}
              x2={VB_W - PAD.r}
              y2={ty}
              stroke="rgba(15, 23, 42, 0.06)"
              strokeWidth={1}
            />
          );
        })}

        <line
          x1={PAD.l}
          y1={PAD.t}
          x2={PAD.l}
          y2={VB_H - PAD.b}
          stroke="rgba(15, 23, 42, 0.14)"
          strokeWidth={1.2}
        />
        <line
          x1={PAD.l}
          y1={VB_H - PAD.b}
          x2={VB_W - PAD.r}
          y2={VB_H - PAD.b}
          stroke="rgba(15, 23, 42, 0.14)"
          strokeWidth={1.2}
        />

        {points.map((p) => (
          <text
            key={`kx-${p.k}`}
            x={p.x}
            y={VB_H - 12}
            textAnchor="middle"
            fontSize={11}
            fill="#64748b"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
          >
            {p.k}
          </text>
        ))}

        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const w = wMin + t * (wMax - wMin);
          const y = layout.yScale(w);
          return (
            <text
              key={`wy-${i}`}
              x={PAD.l - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="#64748b"
              fontFamily="IBM Plex Mono, ui-monospace, monospace"
            >
              {formatWcss(w)}
            </text>
          );
        })}

        <text
          x={VB_W / 2}
          y={VB_H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="#475569"
          fontWeight={600}
        >
          k (clusters)
        </text>
        <text
          x={14}
          y={VB_H / 2}
          textAnchor="middle"
          fontSize={11}
          fill="#475569"
          fontWeight={600}
          transform={`rotate(-90, 14, ${VB_H / 2})`}
        >
          WCSS
        </text>

        <path d={pathD} fill="none" stroke="#3b5bdb" strokeWidth={2.25} strokeLinecap="round" />

        {points.map((p) => {
          const active = p.k === selectedK;
          return (
            <g key={p.k}>
              <circle
                cx={p.x}
                cy={p.y}
                r={active ? 9 : 6}
                fill={active ? '#3b5bdb' : '#fff'}
                stroke={active ? '#1e3a8a' : '#3b5bdb'}
                strokeWidth={active ? 2.5 : 1.8}
                style={{ cursor: 'pointer' }}
              />
            </g>
          );
        })}
      </svg>
    </section>
  );
}
