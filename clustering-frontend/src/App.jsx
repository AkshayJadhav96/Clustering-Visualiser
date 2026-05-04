import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import Visualization from './components/Visualization';
import ElbowChart from './components/ElbowChart';
import AnimationControls from './components/AnimationControls';
import { useClusterApi } from './hooks/useClusterApi';
import { analyzeClusteringCsv, subsetNumericColumns } from './utils/csv';

const ANIM_MS = 550;

function App() {
  const { loading, error, upload, run, runElbow, clearError } = useClusterApi();
  const [uploadMeta, setUploadMeta] = useState(null);
  const [filename, setFilename] = useState(null);
  const [csvAnalysis, setCsvAnalysis] = useState(null);
  const [selectedClusteringColumns, setSelectedClusteringColumns] = useState([]);
  const [kClusters, setKClusters] = useState(3);
  const [elbowCurve, setElbowCurve] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [localError, setLocalError] = useState(null);

  const clusteringKey = useMemo(() => selectedClusteringColumns.join('\0'), [selectedClusteringColumns]);

  const dataset = useMemo(() => {
    if (!csvAnalysis?.availableNumericHeaders?.length) {
      return { columnNames: [], rows: [] };
    }
    return subsetNumericColumns(
      csvAnalysis.availableNumericHeaders,
      csvAnalysis.fullNumericRows,
      selectedClusteringColumns,
    );
  }, [csvAnalysis, selectedClusteringColumns]);

  const displayError = localError || error;
  const stepIntervalMs = ANIM_MS / playbackSpeed;

  useEffect(() => {
    setResult(null);
    setStep(0);
    setIsPlaying(false);
  }, [selectedClusteringColumns]);

  useEffect(() => {
    setElbowCurve(null);
  }, [filename, clusteringKey]);

  useEffect(() => {
    if (!elbowCurve?.length) return;
    const maxK = Math.max(...elbowCurve.map((p) => p.k));
    setKClusters((prev) => (prev > maxK ? maxK : prev));
  }, [elbowCurve]);

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
      setElbowCurve(null);
      setStep(0);
      setIsPlaying(false);

      let text;
      try {
        text = await file.text();
      } catch {
        setLocalError('Could not read the file.');
        return;
      }

      const analysis = analyzeClusteringCsv(text);
      if (!analysis.availableNumericHeaders.length || analysis.availableNumericHeaders.length < 2) {
        setLocalError(
          'No usable data: need a rectangular CSV with a header row, consistent columns, and at least two columns that are numeric on every row (text columns are listed separately).',
        );
        setCsvAnalysis(null);
        setSelectedClusteringColumns([]);
        setUploadMeta(null);
        setFilename(null);
        return;
      }

      const meta = await upload(file);
      if (!meta?.success) {
        setCsvAnalysis(null);
        setSelectedClusteringColumns([]);
        setUploadMeta(null);
        setFilename(null);
        return;
      }

      setCsvAnalysis(analysis);
      setSelectedClusteringColumns(analysis.availableNumericHeaders.slice());
      setUploadMeta(meta);
      setFilename(meta.filename);
      setKClusters(3);
    },
    [upload, clearError],
  );

  const onRunElbow = useCallback(
    async (opts) => {
      if (!filename) return;
      clearError();
      setLocalError(null);
      setResult(null);
      setIsPlaying(false);
      setStep(0);

      if (selectedClusteringColumns.length < 2) {
        setLocalError('Select at least two columns for clustering.');
        return;
      }

      const res = await runElbow({
        filename,
        clustering_columns: selectedClusteringColumns,
        k_max: opts.k_max,
        max_iterations: opts.max_iterations,
        threads: opts.threads,
      });

      if (!res?.success) return;

      const curve = res.data?.curve;
      if (!Array.isArray(curve) || !curve.length) {
        setLocalError('Elbow response did not include a curve.');
        return;
      }

      setElbowCurve(curve);
    },
    [filename, runElbow, clearError, selectedClusteringColumns],
  );

  const onRun = useCallback(
    async (params) => {
      if (!filename) return;
      clearError();
      setLocalError(null);
      setIsPlaying(false);

      if (selectedClusteringColumns.length < 2) {
        setLocalError('Select at least two columns for clustering.');
        return;
      }

      const payload = {
        filename,
        clustering_columns: selectedClusteringColumns,
        k: kClusters,
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

      if (data.final_clusters.length !== dataset.rows.length) {
        setLocalError(
          `Label count (${data.final_clusters.length}) does not match parsed rows (${dataset.rows.length}). Re-upload the CSV.`,
        );
        return;
      }

      setResult(data);
      setStep(0);
    },
    [filename, run, clearError, dataset.rows.length, selectedClusteringColumns, kClusters],
  );

  const history = result?.history ?? [];
  const maxStep = history.length > 0 ? history.length - 1 : 0;

  const canRun =
    Boolean(filename && csvAnalysis && dataset.rows.length > 0) &&
    selectedClusteringColumns.length >= 2;

  return (
    <div className="kv-page">
      <Header />

      <ControlPanel
        onFileSelected={onFileSelected}
        onRun={onRun}
        onRunElbow={onRunElbow}
        loading={loading}
        canRun={canRun}
        error={displayError}
        uploadMeta={uploadMeta}
        pointCount={dataset.rows.length}
        numericOptions={csvAnalysis?.availableNumericHeaders ?? []}
        selectedClusteringColumns={selectedClusteringColumns}
        onClusteringColumnsChange={setSelectedClusteringColumns}
        kClusters={kClusters}
        onKClustersChange={setKClusters}
      />

      <ElbowChart curve={elbowCurve} selectedK={kClusters} onPickK={setKClusters} />

      <Visualization
        dataRows={dataset.rows}
        columnNames={dataset.columnNames}
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
