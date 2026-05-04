import { useState } from 'react';

const defaultParams = { max_iterations: 100, threads: 4 };

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
  onRunElbow,
  loading,
  canRun,
  error,
  uploadMeta,
  pointCount,
  numericOptions,
  selectedClusteringColumns,
  onClusteringColumnsChange,
  kClusters,
  onKClustersChange,
}) {
  const [params, setParams] = useState(defaultParams);
  const [dragOver, setDragOver] = useState(false);
  const [elbowKMax, setElbowKMax] = useState(10);

  const update = (key) => (e) => {
    const v = e.target.value;
    setParams((p) => ({ ...p, [key]: v === '' ? '' : Number(v) }));
  };

  const handleRun = () => {
    onRun({
      max_iterations: Number(params.max_iterations) || 100,
      threads: Number(params.threads) || 4,
    });
  };

  const handleElbow = () => {
    onRunElbow({
      k_max: Math.max(2, Math.min(100, Number(elbowKMax) || 10)),
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
            (non-numeric columns are hidden here). Run the elbow curve to pick k, then run K-means for the
            animated map.
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
          <p className="kv-section-hint">Elbow scan and K-means share max iterations and thread count.</p>
          <div className="kv-fields">
            <label>
              k (clusters)
              <input
                type="number"
                min={1}
                value={kClusters}
                onChange={(e) => {
                  const v = e.target.value === '' ? 1 : Number(e.target.value);
                  onKClustersChange(Number.isFinite(v) && v >= 1 ? v : 1);
                }}
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

          <div className="kv-elbow-actions">
            <label className="kv-elbow-kmax">
              Elbow: max k
              <input
                type="number"
                min={2}
                max={100}
                value={elbowKMax}
                onChange={(e) => {
                  const v = e.target.value === '' ? 2 : Number(e.target.value);
                  setElbowKMax(Number.isFinite(v) ? Math.max(2, Math.min(100, v)) : 10);
                }}
                disabled={loading}
              />
            </label>
            <button
              type="button"
              className="kv-btn-elbow"
              onClick={handleElbow}
              disabled={loading || !canRun}
            >
              {loading ? 'Working…' : 'Compute elbow curve'}
            </button>
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
