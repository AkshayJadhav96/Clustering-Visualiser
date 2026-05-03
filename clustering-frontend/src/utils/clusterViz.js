/** Vibrant cluster colors: blue, purple, pink, cyan (+ distinct extras for k > 4) */
export const CLUSTER_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#c026d3',
  '#0d9488',
  '#ea580c',
];

export function colorForCluster(id) {
  return CLUSTER_PALETTE[Math.abs(id) % CLUSTER_PALETTE.length];
}

export function clusterColorWithAlpha(id, alpha) {
  const hex = colorForCluster(id).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Axis-aligned 2D projection: plot column xIdx vs yIdx (same units as k-means space).
 */
export function computePlotBounds(dataRows, history, xIdx, yIdx, padFraction = 0.07) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const bump = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    bump(row[xIdx], row[yIdx]);
  }

  for (let h = 0; h < history.length; h++) {
    const cents = history[h]?.centroids;
    if (!cents) continue;
    for (let j = 0; j < cents.length; j++) {
      bump(cents[j][xIdx], cents[j][yIdx]);
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }

  let dx = maxX - minX;
  let dy = maxY - minY;
  if (dx === 0) dx = 1;
  if (dy === 0) dy = 1;

  const px = dx * padFraction;
  const py = dy * padFraction;

  return {
    minX: minX - px,
    maxX: maxX + px,
    minY: minY - py,
    maxY: maxY + py,
  };
}

function nearestCentroidIdFull(pointRow, centroids) {
  const dim = centroids[0].length;
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j < centroids.length; j++) {
    const c = centroids[j];
    let sum = 0;
    for (let d = 0; d < dim; d++) {
      const t = pointRow[d] - c[d];
      sum += t * t;
    }
    if (sum < bestD) {
      bestD = sum;
      best = j;
    }
  }
  return best;
}

/**
 * Cluster assignment for each step: matches the backend (full-dimensional distance).
 * For the last step, uses backend labels when present.
 */
export function clusterIdsForStep(dataRows, history, step, finalClusters) {
  const centroids = history[step]?.centroids;
  if (!centroids?.length) {
    return dataRows.map(() => 0);
  }

  const lastStep = history.length - 1;
  const useBackend =
    step >= lastStep &&
    Array.isArray(finalClusters) &&
    finalClusters.length === dataRows.length;

  if (useBackend) {
    return finalClusters;
  }

  return dataRows.map((row) => nearestCentroidIdFull(row, centroids));
}
