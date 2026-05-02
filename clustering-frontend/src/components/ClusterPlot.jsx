import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { clusterIdsForStep } from '../utils/clusterViz';

const PALETTE = [
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#ca8a04',
  '#16a34a',
  '#ea580c',
  '#6366f1',
  '#0d9488',
];

function colorForCluster(id) {
  return PALETTE[Math.abs(id) % PALETTE.length];
}

const tooltipStyles = {
  background: 'var(--surface-solid)',
  border: '1px solid var(--border-strong)',
  borderRadius: '10px',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  boxShadow: 'var(--shadow-md)',
  color: 'var(--text-h)',
};

export default function ClusterPlot({ basePoints, history, currentStep, finalClusters }) {
  const scatterPoints = useMemo(() => {
    if (!basePoints.length || !history.length) return [];
    const ids = clusterIdsForStep(basePoints, history, currentStep, finalClusters);
    return basePoints.map((p, i) => ({
      x: p.x,
      y: p.y,
      cluster: ids[i],
    }));
  }, [basePoints, history, currentStep, finalClusters]);

  const centroidMarkers = useMemo(() => {
    const centroids = history[currentStep]?.centroids ?? [];
    return centroids.map((c, i) => ({ x: c[0], y: c[1], label: `C${i}` }));
  }, [history, currentStep]);

  if (!scatterPoints.length) {
    return (
      <div className="chart-card">
        <div className="chart-card__head">
          <h3 className="chart-card__title">Scatter view</h3>
        </div>
        <p className="plot-empty">Run clustering to see points and centroids come alive.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-card__head">
        <h3 className="chart-card__title">Scatter view</h3>
        <span className="chart-card__badge">Dim 1 × Dim 2</span>
      </div>
      <div className="cluster-plot-wrap">
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 12, right: 28, bottom: 20, left: 4 }}>
            <CartesianGrid strokeDasharray="4 8" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              name="X"
              tick={{ fill: 'var(--chart-axis)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-strong)' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Y"
              tick={{ fill: 'var(--chart-axis)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-strong)' }}
            />
            <ZAxis type="number" range={[56, 56]} />
            <Tooltip
              cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={tooltipStyles}
              formatter={(value, name) => [value, name]}
            />
            <Legend
              wrapperStyle={{ fontFamily: 'var(--font-ui)', fontSize: '12px', paddingTop: '8px' }}
            />
            <Scatter name="Points" data={scatterPoints} isAnimationActive={false}>
              {scatterPoints.map((entry, index) => (
                <Cell key={index} fill={colorForCluster(entry.cluster)} />
              ))}
            </Scatter>
            <Scatter
              name="Centroids"
              data={centroidMarkers}
              shape="cross"
              isAnimationActive={false}
              fill="#f97316"
              stroke="#9a3412"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
