/**
 * Strip UTF-8 BOM so the first header parses correctly.
 */
function stripBom(text) {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

/**
 * Parse one CSV line (RFC 4180 style): commas split fields; double quotes wrap fields;
 * "" inside quotes becomes a single ".
 */
export function parseCsvRow(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function splitLines(text) {
  return text.split(/\r?\n/).filter((line) => line.length > 0);
}

/**
 * Prefer ';' when it splits into more fields than ',' on the first line (common Excel EU CSV).
 */
function detectDelimiter(firstLine) {
  const commaParts = parseCsvRow(firstLine).length;
  const semiParts = firstLine.split(';').length;
  if (semiParts > commaParts && semiParts >= 2) return ';';
  return ',';
}

function cellIsFiniteNumber(cell) {
  const n = Number.parseFloat(String(cell).trim());
  return Number.isFinite(n);
}

function rowIsAllNumeric(parts) {
  if (parts.length < 2) return false;
  return parts.every((cell) => cellIsFiniteNumber(cell));
}

function numericColumnIndices(dataRows, nCols) {
  const indices = [];
  for (let j = 0; j < nCols; j += 1) {
    let ok = true;
    for (let r = 0; r < dataRows.length; r += 1) {
      const row = dataRows[r];
      if (!row || row.length !== nCols || !cellIsFiniteNumber(row[j])) {
        ok = false;
        break;
      }
    }
    if (ok) indices.push(j);
  }
  return indices;
}

/**
 * Read CSV and list every column that is numeric on all data rows (text columns excluded).
 *
 * @returns {{ availableNumericHeaders: string[], fullNumericRows: number[][] }}
 */
export function analyzeClusteringCsv(text) {
  const raw = stripBom(text);
  const lines = splitLines(raw);
  if (!lines.length) {
    return { availableNumericHeaders: [], fullNumericRows: [] };
  }

  const delim = detectDelimiter(lines[0]);
  const matrix =
    delim === ';'
      ? lines.map((ln) => ln.split(';').map((c) => c.trim()))
      : lines.map((ln) => parseCsvRow(ln));
  const firstParts = matrix[0];
  let headerParts;
  let dataMatrix;

  if (rowIsAllNumeric(firstParts)) {
    headerParts = firstParts.map((_, i) => `Column ${i + 1}`);
    dataMatrix = matrix;
  } else {
    headerParts = firstParts.map((h, i) =>
      h && String(h).length ? String(h).trim() : `Column ${i + 1}`,
    );
    dataMatrix = matrix.slice(1);
  }

  const nCols = headerParts.length;
  if (nCols < 2 || !dataMatrix.length) {
    return { availableNumericHeaders: [], fullNumericRows: [] };
  }

  for (let r = 0; r < dataMatrix.length; r += 1) {
    if (dataMatrix[r].length !== nCols) {
      return { availableNumericHeaders: [], fullNumericRows: [] };
    }
  }

  const numIdx = numericColumnIndices(dataMatrix, nCols);
  if (numIdx.length < 2) {
    return { availableNumericHeaders: [], fullNumericRows: [] };
  }

  const availableNumericHeaders = numIdx.map((j) => headerParts[j]);
  const fullNumericRows = dataMatrix.map((row) =>
    numIdx.map((j) => Number.parseFloat(String(row[j]).trim())),
  );

  return { availableNumericHeaders, fullNumericRows };
}

/**
 * Project down to the user's chosen clustering columns (order preserved).
 */
export function subsetNumericColumns(availableNumericHeaders, fullNumericRows, selectedNames) {
  if (
    !availableNumericHeaders.length ||
    !fullNumericRows.length ||
    !selectedNames?.length
  ) {
    return { columnNames: [], rows: [] };
  }

  const indices = selectedNames.map((name) => availableNumericHeaders.indexOf(name));
  if (indices.some((i) => i < 0)) {
    return { columnNames: [], rows: [] };
  }

  const columnNames = selectedNames.slice();
  const rows = fullNumericRows.map((row) => indices.map((i) => row[i]));
  return { columnNames, rows };
}
