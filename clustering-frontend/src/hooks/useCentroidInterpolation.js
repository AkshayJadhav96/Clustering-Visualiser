import { useEffect, useRef } from 'react';

/** Smooth at both ends — less abrupt than ease-out-only */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Updates displayCentroidsRef (same length as centroids, each [x,y] in **plot** space) with smooth
 * interpolation when playing and step advances by 1; otherwise snaps to history[currentStep].
 * xFeatureIndex / yFeatureIndex pick which dimensions to draw (multi-column k-means).
 * Calls drawRef.current() after each centroid update.
 */
export function useCentroidInterpolation({
  history,
  currentStep,
  isPlaying,
  transitionMs,
  displayCentroidsRef,
  drawRef,
  xFeatureIndex = 0,
  yFeatureIndex = 1,
}) {
  const prevHandledStepRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    prevHandledStepRef.current = null;
  }, [history, xFeatureIndex, yFeatureIndex]);

  useEffect(() => {
    const centroids = history[currentStep]?.centroids;
    if (!centroids?.length) return undefined;

    const cancelRaf = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    const draw = () => drawRef.current?.();

    const prev = prevHandledStepRef.current;
    const stepChanged = prev !== currentStep;

    const project = (c) => [c[xFeatureIndex], c[yFeatureIndex]];

    if (prev === null) {
      displayCentroidsRef.current = centroids.map((c) => project(c));
      prevHandledStepRef.current = currentStep;
      draw();
      return () => cancelRaf();
    }

    if (!stepChanged) {
      return () => cancelRaf();
    }

    const fromStep = prev;
    prevHandledStepRef.current = currentStep;

    const shouldAnimate =
      isPlaying &&
      currentStep === fromStep + 1 &&
      history[fromStep]?.centroids?.length === centroids.length;

    if (!shouldAnimate) {
      displayCentroidsRef.current = centroids.map((c) => project(c));
      draw();
      return () => cancelRaf();
    }

    const from = history[fromStep].centroids;
    const to = centroids;
    const n = to.length;
    const start = performance.now();
    const xi = xFeatureIndex;
    const yi = yFeatureIndex;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / transitionMs);
      const e = easeInOutCubic(t);
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        const fa = from[i];
        const tb = to[i];
        out[i] = [
          fa[xi] + (tb[xi] - fa[xi]) * e,
          fa[yi] + (tb[yi] - fa[yi]) * e,
        ];
      }
      displayCentroidsRef.current = out;
      draw();
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };

    cancelRaf();
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelRaf();
  }, [
    history,
    currentStep,
    isPlaying,
    transitionMs,
    displayCentroidsRef,
    drawRef,
    xFeatureIndex,
    yFeatureIndex,
  ]);
}
