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
  numericOptions,
  selectedClusteringColumns,
  onClusteringColumnsChange,
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

  const toggleColumn = (name) => {
    const set = new Set(selectedClusteringColumns);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    const order = numericOptions.filter((n) => set.has(n));
    onClusteringColumnsChange(order);
  };

  const selectAllNumeric = () => {
    onClusteringColumnsChange(numericOptions.slice());
  };

  const clearClusteringSelection = () => {
    onClusteringColumnsChange([]);
  };

  return (
    <section className="kv-control-card">
      <div className="kv-control-grid">
        <div>
          <h2 className="kv-section-label">Dataset</h2>
          <p className="kv-section-hint">
            Upload a CSV with a header row. Choose which <strong>numeric</strong> columns k-means should use
            (non-numeric columns are hidden here). The chart below still lets you pick any two of those
            columns for the 2D view.
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
              {numericOptions.length > 0
                ? ` · ${numericOptions.length} numeric column${numericOptions.length === 1 ? '' : 's'} available`
                : null}
              {pointCount > 0 ? ` · ${pointCount} rows in clustering matrix` : null}
            </p>
          )}

          {numericOptions.length > 0 ? (
            <div className="kv-cluster-cols">
              <div className="kv-cluster-cols__head">
                <span className="kv-cluster-cols__title">Columns for k-means</span>
                <span className="kv-cluster-cols__actions">
                  <button type="button" className="kv-link-btn" onClick={selectAllNumeric}>
                    Select all
                  </button>
                  <button type="button" className="kv-link-btn" onClick={clearClusteringSelection}>
                    Clear
                  </button>
                </span>
              </div>
              <p className="kv-cluster-cols__hint">
                At least two selected. Only checked columns are written to the file used by the clustering
                engine.
              </p>
              <ul className="kv-cluster-cols__list" aria-label="Numeric columns for clustering">
                {numericOptions.map((name) => (
                  <li key={name}>
                    <label className="kv-cluster-cols__item">
                      <input
                        type="checkbox"
                        checked={selectedClusteringColumns.includes(name)}
                        onChange={() => toggleColumn(name)}
                        disabled={loading}
                      />
                      <span>{name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
