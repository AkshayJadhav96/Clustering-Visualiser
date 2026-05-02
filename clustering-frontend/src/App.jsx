import { useState, useEffect, useCallback } from 'react';
import ControlPanel from './components/ControlPanel';
import ClusterPlot from './components/ClusterPlot';
import PlaybackControls from './components/PlaybackControls';
import ResultSummary from './components/ResultSummary';
import { useClusterApi } from './hooks/useClusterApi';
import { parseNumericCsv2D } from './utils/csv';
import './App.css';

const ANIM_MS = 550;

function App() {
  const { loading, error, upload, run, clearError } = useClusterApi();
  const [uploadMeta, setUploadMeta] = useState(null);
  const [filename, setFilename] = useState(null);
  const [rawPoints, setRawPoints] = useState([]);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localError, setLocalError] = useState(null);

  const displayError = localError || error;

  useEffect(() => {
    if (!isPlaying || !result?.history?.length) return;

    const maxStep = result.history.length - 1;
    if (step >= maxStep) {
      const pauseId = setTimeout(() => setIsPlaying(false), 0);
      return () => clearTimeout(pauseId);
    }

    const timer = setTimeout(() => {
      setStep((s) => s + 1);
    }, ANIM_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, step, result]);

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
    <div className="app">
      <header className="app-header">
        <span className="eyebrow">Clustering visualiser</span>
        <h1>Watch K-means settle in 2D</h1>
        <p className="tagline">
          Native C engine, Flask API, and a live scatter plot from your CSV’s first two columns.
        </p>
      </header>

      <ControlPanel
        onFileSelected={onFileSelected}
        onRun={onRun}
        loading={loading}
        canRun={Boolean(filename && rawPoints.length)}
        error={displayError}
        uploadMeta={uploadMeta}
        pointCount={rawPoints.length}
      />

      {result && (
        <>
          <PlaybackControls
            step={step}
            maxStep={maxStep}
            onStepChange={setStep}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((p) => !p)}
          />
          <div className="viz-row">
            <ClusterPlot
              basePoints={rawPoints}
              history={history}
              currentStep={step}
              finalClusters={result.final_clusters}
            />
            <ResultSummary result={result} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
