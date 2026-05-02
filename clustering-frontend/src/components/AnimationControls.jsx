const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25×' },
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
];

export default function AnimationControls({
  step,
  maxStep,
  onStepChange,
  isPlaying,
  onTogglePlay,
  onReset,
  playbackSpeed,
  onPlaybackSpeedChange,
}) {
  const safeMax = Math.max(0, maxStep);
  const canPlayback = safeMax >= 1;

  return (
    <section className="kv-anim-bar" aria-label="Animation controls">
      <div className="kv-anim-actions">
        <button type="button" className="kv-btn-play" onClick={onTogglePlay} disabled={!canPlayback}>
          <span className="kv-btn-play__icon" aria-hidden>
            {isPlaying ? '❚❚' : '▶'}
          </span>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="kv-btn-ghost"
          onClick={onReset}
          disabled={step === 0 && !isPlaying}
          title="Stop and jump to first iteration"
        >
          Reset
        </button>
      </div>

      <label className="kv-slider-wrap">
        <span className="sr-only">Iteration</span>
        <input
          type="range"
          min={0}
          max={safeMax}
          value={Math.min(step, safeMax)}
          onChange={(e) => onStepChange(Number(e.target.value))}
        />
      </label>

      <span className="kv-iter-badge">
        Step {Math.min(step, safeMax) + 1} / {safeMax + 1}
      </span>

      <div className="kv-speed">
        <label htmlFor="kv-speed-select">Speed</label>
        <select
          id="kv-speed-select"
          value={playbackSpeed}
          onChange={(e) => onPlaybackSpeedChange(Number(e.target.value))}
        >
          {SPEED_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
