/**
 * Parse CSV text into 2D points (first two numeric columns).
 * Skips rows where the first two cells are not finite numbers.
 */
export function parseNumericCsv2D(text) {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
  const points = [];

  for (let row = 0; row < lines.length; row++) {
    const parts = lines[row].split(',').map((s) => s.trim());
    if (parts.length < 2) continue;
    const x = Number.parseFloat(parts[0]);
    const y = Number.parseFloat(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x, y, index: points.length });
  }

  return points;
}
