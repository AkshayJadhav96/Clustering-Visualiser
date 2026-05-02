import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import Visualization from './components/Visualization';
import AnimationControls from './components/AnimationControls';
import { useClusterApi } from './hooks/useClusterApi';
import { parseNumericCsv2D } from './utils/csv';

const ANIM_MS = 550;

function App() {
  const { loading, error, upload, run, clearError } = useClusterApi();
  const [uploadMeta, setUploadMeta] = useState(null);
  const [filename, setFilename] = useState(null);
  const [rawPoints, setRawPoints] = useState([]);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [localError, setLocalError] = useState(null);

  const displayError = localError || error;
  const stepIntervalMs = ANIM_MS / playbackSpeed;

  useEffect(() => {
    if (!isPlaying || !result?.history?.length) return;

    const maxStep = result.history.length - 1;
    if (step >= maxStep) {
      const pauseId = setTimeout(() => setIsPlaying(false), 0);
      return () => clearTimeout(pauseId);
    }

    const timer = setTimeout(() => {
      setStep((s) => s + 1);
    }, stepIntervalMs);
    return () => clearTimeout(timer);
  }, [isPlaying, step, result, stepIntervalMs]);

  const handleStepChange = useCallback((next) => {
    setIsPlaying(false);
    setStep(next);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const hist = result?.history;
    const last = hist?.length ? hist.length - 1 : 0;
    if (last >= 0 && step >= last) {
      setStep(0);
    }
    setIsPlaying(true);
  }, [isPlaying, result, step]);

  const handleResetPlayback = useCallback(() => {
    setIsPlaying(false);
    setStep(0);
  }, []);

  const onFileSelected = useCallback(
    async (file) => {
      clearError();
      setLocalError(null);
      setResult(null);
      setStep(0);
      setIsPlaying(false);

      let text;
      try {
        text = await file.text();
      } catch {
        setLocalError('Could not read the file.');
        return;
      }

      const pts = parseNumericCsv2D(text);
      if (!pts.length) {
        setLocalError('No valid numeric rows with at least two columns.');
        setRawPoints([]);
        setUploadMeta(null);
        setFilename(null);
        return;
      }

      setRawPoints(pts);

      const meta = await upload(file);
      if (!meta?.success) {
        setRawPoints([]);
        setUploadMeta(null);
        setFilename(null);
        return;
      }

      setUploadMeta(meta);
      setFilename(meta.filename);
    },
    [upload, clearError],
  );

  const onRun = useCallback(
    async (params) => {
      if (!filename) return;
      clearError();
      setLocalError(null);
      setIsPlaying(false);

      const payload = {
        filename,
        k: params.k,
        max_iterations: params.max_iterations,
        threads: params.threads,
      };

      const res = await run(payload);
      if (!res?.success || !res.data) return;

      const data = res.data;
      if (!Array.isArray(data.history) || !Array.isArray(data.final_clusters)) {
        setLocalError('Unexpected response shape from the server.');
        return;
      }

      if (data.final_clusters.length !== rawPoints.length) {
        setLocalError(
          `Label count (${data.final_clusters.length}) does not match parsed points (${rawPoints.length}). Re-upload the CSV.`,
        );
        return;
      }

      setResult(data);
      setStep(0);
    },
    [filename, run, clearError, rawPoints.length],
  );

  const history = result?.history ?? [];
  const maxStep = history.length > 0 ? history.length - 1 : 0;

  return (
    <div className="kv-page">
      <Header />

      <ControlPanel
        onFileSelected={onFileSelected}
        onRun={onRun}
        loading={loading}
        canRun={Boolean(filename && rawPoints.length)}
        error={displayError}
        uploadMeta={uploadMeta}
        pointCount={rawPoints.length}
      />

      <Visualization
        basePoints={rawPoints}
        result={result}
        currentStep={step}
        isPlaying={isPlaying}
        transitionMs={stepIntervalMs}
      />

      {result ? (
        <AnimationControls
          step={step}
          maxStep={maxStep}
          onStepChange={handleStepChange}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onReset={handleResetPlayback}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={setPlaybackSpeed}
        />
      ) : null}
    </div>
  );
}

export default App;
