function nearestCentroidId(x, y, centroids) {
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j < centroids.length; j++) {
    const c = centroids[j];
    const dx = x - c[0];
    const dy = y - c[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

/**
 * Cluster id per point for the current animation step.
 * Uses backend labels on the last step when lengths match; otherwise nearest centroid in 2D.
 */
export function clusterIdsForStep(points2d, history, step, finalClusters) {
  const centroids = history[step]?.centroids;
  if (!centroids?.length) {
    return points2d.map(() => 0);
  }

  const lastStep = history.length - 1;
  const useBackend =
    step >= lastStep &&
    Array.isArray(finalClusters) &&
    finalClusters.length === points2d.length;

  if (useBackend) {
    return finalClusters;
  }

  return points2d.map((p) => nearestCentroidId(p.x, p.y, centroids));
}
