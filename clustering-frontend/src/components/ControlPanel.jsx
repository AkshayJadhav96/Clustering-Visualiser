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
    <section className="kv-control-card">
      <div className="kv-control-grid">
        <div>
          <h2 className="kv-section-label">Dataset</h2>
          <p className="kv-section-hint">
            Upload a numeric CSV. The first two columns map to the x and y axes.
          </p>
          <label
            className={`kv-dropzone${dragOver ? ' kv-dropzone--active' : ''}`}
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
            <span className="kv-dropzone__title">Drop a file here or click to browse</span>
            <span className="kv-dropzone__sub">CSV · validated on the server</span>
          </label>
          {uploadMeta && (
            <p className="kv-meta">
              <code>{uploadMeta.filename}</code>
              <br />
              {uploadMeta.rows} rows × {uploadMeta.columns} columns
              {pointCount > 0 ? ` · ${pointCount} points plotted` : null}
            </p>
          )}
        </div>

        <div>
          <h2 className="kv-section-label">Parameters</h2>
          <p className="kv-section-hint">Tune the engine, then launch a run.</p>
          <div className="kv-fields">
            <label>
              k (clusters)
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
          <button type="button" className="kv-btn-run" onClick={handleRun} disabled={loading || !canRun}>
            {loading ? 'Running…' : 'Run K-Means'}
          </button>
        </div>

        {error ? <p className="kv-error">{error}</p> : null}
      </div>
    </section>
  );
}
