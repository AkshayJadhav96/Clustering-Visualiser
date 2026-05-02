import { useState } from 'react';

const defaultParams = { k: 3, max_iterations: 100, threads: 4 };

function pickCsvFile(list) {
  if (!list?.length) return null;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (f.type === 'text/csv' || f.name?.toLowerCase().endsWith('.csv')) return f;
  }
  return list[0];
}

export default function ControlPanel({
  onFileSelected,
  onRun,
  loading,
  canRun,
  error,
  uploadMeta,
  pointCount,
}) {
  const [params, setParams] = useState(defaultParams);
  const [dragOver, setDragOver] = useState(false);

  const update = (key) => (e) => {
    const v = e.target.value;
    setParams((p) => ({ ...p, [key]: v === '' ? '' : Number(v) }));
  };

  const handleRun = () => {
    onRun({
      k: Number(params.k) || 3,
      max_iterations: Number(params.max_iterations) || 100,
      threads: Number(params.threads) || 4,
    });
  };

  return (
    <div className="control-panel">
      <div className="panel-card">
        <h2 className="section-title">Dataset</h2>
        <p className="hint">Drop a numeric CSV. The first two columns become your x and y axes.</p>
        <label
          className={`file-drop${dragOver ? ' file-drop--active' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = pickCsvFile(e.dataTransfer?.files);
            if (f) onFileSelected(f);
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelected(f);
              e.target.value = '';
            }}
          />
          <span className="file-drop__text">Choose file or drag here</span>
          <span className="file-drop__sub">.csv — validated on the server</span>
        </label>
        {uploadMeta && (
          <p className="meta">
            <code>{uploadMeta.filename}</code>
            <br />
            {uploadMeta.rows} rows × {uploadMeta.columns} columns
            {pointCount > 0 ? ` · ${pointCount} points in the chart` : null}
          </p>
        )}
      </div>

      <div className="panel-card">
        <h2 className="section-title">Parameters</h2>
        <div className="field-row">
          <label>
            Clusters (k)
            <input
              type="number"
              min={1}
              value={params.k}
              onChange={update('k')}
              disabled={loading}
            />
          </label>
          <label>
            Max iterations
            <input
              type="number"
              min={1}
              value={params.max_iterations}
              onChange={update('max_iterations')}
              disabled={loading}
            />
          </label>
          <label>
            Threads
            <input
              type="number"
              min={1}
              value={params.threads}
              onChange={update('threads')}
              disabled={loading}
            />
          </label>
        </div>
        <button type="button" className="btn-primary" onClick={handleRun} disabled={loading || !canRun}>
          {loading ? 'Running…' : 'Run K-means'}
        </button>
      </div>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
