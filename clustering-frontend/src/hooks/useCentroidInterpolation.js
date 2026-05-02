import { useEffect, useRef } from 'react';

/** Smooth at both ends — less abrupt than ease-out-only */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Updates displayCentroidsRef (same length as centroids, each [x,y]) with smooth
 * interpolation when playing and step advances by 1; otherwise snaps to history[currentStep].
 * Calls drawRef.current() after each centroid update.
 */
export function useCentroidInterpolation({
  history,
  currentStep,
  isPlaying,
  transitionMs,
  displayCentroidsRef,
  drawRef,
}) {
  const prevHandledStepRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    prevHandledStepRef.current = null;
  }, [history]);

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

    if (prev === null) {
      displayCentroidsRef.current = centroids.map((c) => [c[0], c[1]]);
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
      displayCentroidsRef.current = centroids.map((c) => [c[0], c[1]]);
      draw();
      return () => cancelRaf();
    }

    const from = history[fromStep].centroids;
    const to = centroids;
    const n = to.length;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / transitionMs);
      const e = easeInOutCubic(t);
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        const fa = from[i];
        const tb = to[i];
        out[i] = [fa[0] + (tb[0] - fa[0]) * e, fa[1] + (tb[1] - fa[1]) * e];
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
  }, [history, currentStep, isPlaying, transitionMs, displayCentroidsRef, drawRef]);
}
