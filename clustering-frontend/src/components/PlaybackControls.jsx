export default function PlaybackControls({
  step,
  maxStep,
  onStepChange,
  isPlaying,
  onTogglePlay,
}) {
  const safeMax = Math.max(0, maxStep);

  return (
    <div className="playback-controls">
      <button type="button" className="btn-play" onClick={onTogglePlay} disabled={safeMax < 1}>
        <span className="btn-play__icon" aria-hidden>
          {isPlaying ? '❚❚' : '▶'}
        </span>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <label className="slider-label">
        <span className="sr-only">Iteration</span>
        <input
          type="range"
          min={0}
          max={safeMax}
          value={Math.min(step, safeMax)}
          onChange={(e) => onStepChange(Number(e.target.value))}
        />
      </label>
      <span className="iteration-label">
        Step {Math.min(step, safeMax) + 1} / {safeMax + 1}
      </span>
    </div>
  );
}
