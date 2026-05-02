export default function ResultSummary({ result }) {
  if (!result) return null;

  const iterations = result.iterations ?? result.history?.length;
  const historyLen = result.history?.length ?? 0;
  const nPoints = Array.isArray(result.final_clusters) ? result.final_clusters.length : null;

  return (
    <aside className="result-summary">
      <h3 className="result-summary__title">Run summary</h3>
      <ul className="stat-list">
        <li className="stat">
          <span className="stat__label">Snapshots in history</span>
          <span className="stat__value">{historyLen}</span>
        </li>
        {iterations != null && (
          <li className="stat">
            <span className="stat__label">Engine iterations</span>
            <span className="stat__value">{iterations}</span>
          </li>
        )}
        {nPoints != null && (
          <li className="stat">
            <span className="stat__label">Points labeled</span>
            <span className="stat__value">{nPoints}</span>
          </li>
        )}
      </ul>
    </aside>
  );
}
