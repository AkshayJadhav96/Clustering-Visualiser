import os
import json
import csv
import io
from pathlib import Path
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {'csv'}
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../uploads')
OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), '../outputs')

# Create folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if file has allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_upload_file(file):
    """
    Save uploaded file to uploads folder
    
    Args:
        file: Flask file object
        
    Returns:
        dict: Result with success status and file path or error
    """
    try:
        if not file or file.filename == '':
            return {"success": False, "error": "No file provided"}
        
        if not allowed_file(file.filename):
            return {"success": False, "error": "Only CSV files are allowed"}
        
        # Secure filename
        filename = secure_filename(file.filename)
        
        # Save file
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        return {
            "success": True,
            "filename": filename,
            "filepath": filepath
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to save file: {str(e)}"
        }


def get_output_path(filename_base):
    """
    Get path for output file
    
    Args:
        filename_base (str): Base filename without extension
        
    Returns:
        str: Full path to output JSON file
    """
    return os.path.join(OUTPUT_FOLDER, f"{filename_base}_output.json")


def get_elbow_output_path(filename_base):
    """JSON path for elbow (WCSS vs k) curve."""
    return os.path.join(OUTPUT_FOLDER, f"{filename_base}_elbow.json")


def read_json_output(filepath):
    """
    Read clustering results from JSON output file
    
    Args:
        filepath (str): Path to output JSON file
        
    Returns:
        dict: Parsed JSON data or error
    """
    try:
        if not os.path.exists(filepath):
            return {
                "success": False,
                "error": f"Output file not found: {filepath}"
            }
        
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        return {
            "success": True,
            "data": data
        }
    except json.JSONDecodeError:
        return {
            "success": False,
            "error": "Invalid JSON in output file"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read output: {str(e)}"
        }


def _detect_delimiter(first_line):
    """Prefer ';' when it splits into more fields than ',' (Excel regional CSV)."""
    try:
        comma_fields = next(csv.reader([first_line]))
    except Exception:
        comma_fields = first_line.split(',')
    semi_fields = first_line.split(';')
    if len(semi_fields) > len(comma_fields) and len(semi_fields) >= 2:
        return ';'
    return ','


def read_csv_table(filepath):
    """Read entire CSV using delimiter aligned with the frontend heuristic."""
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        raw = f.read()
    if not raw.strip():
        return []
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    if not lines:
        return []
    delim = _detect_delimiter(lines[0])
    buf = io.StringIO(raw)
    return list(csv.reader(buf, delimiter=delim))


def _cell_is_numeric(val):
    try:
        float(str(val).strip())
        return True
    except (ValueError, TypeError):
        return False


def _numeric_column_indices(headers, data_rows):
    """Indices of columns where every data cell parses as float (skip categorical/text)."""
    n_cols = len(headers)
    indices = []
    for j in range(n_cols):
        ok = True
        for row in data_rows:
            if j >= len(row) or not _cell_is_numeric(row[j]):
                ok = False
                break
        if ok:
            indices.append(j)
    return indices


def _resolve_column_index(headers, name):
    """First column index whose header matches name after strip (exact string match)."""
    key = str(name).strip()
    for i, h in enumerate(headers):
        if str(h).strip() == key:
            return i
    return None


def validate_csv_file(filepath):
    """
    Validate CSV: header + data rows, rectangular grid, and at least two fully-numeric
    columns (mixed datasets like Mall Customers with Gender + numerics are accepted).
    """
    try:
        rows = read_csv_table(filepath)

        if len(rows) < 2:
            return {
                "valid": False,
                "error": "CSV file must have at least 2 rows (header + data)"
            }

        headers = [str(h).strip() for h in rows[0]]
        data_rows = rows[1:]
        n_cols = len(headers)

        if n_cols < 2:
            return {
                "valid": False,
                "error": "CSV must have at least 2 columns"
            }

        for i, row in enumerate(data_rows):
            if len(row) != n_cols:
                return {
                    "valid": False,
                    "error": f"Row {i+2} has {len(row)} columns, expected {n_cols}"
                }

        numeric_indices = _numeric_column_indices(headers, data_rows)
        if len(numeric_indices) < 2:
            return {
                "valid": False,
                "error": (
                    "Need at least 2 columns where every row has a numeric value "
                    "(text columns like Gender are ignored if other numeric columns exist)."
                ),
            }

        numeric_headers = [headers[j] for j in numeric_indices]

        return {
            "valid": True,
            "rows": len(data_rows),
            "columns": n_cols,
            "headers": headers,
            "numeric_headers": numeric_headers,
            "numeric_column_indices": numeric_indices,
        }
    except Exception as e:
        return {
            "valid": False,
            "error": f"Failed to validate CSV: {str(e)}"
        }


def build_clustering_csv(src_path, dest_path, clustering_columns):
    """
    Write a CSV with only the user-selected columns (must be numeric on every row).
    Used as input for the C k-means binary. clustering_columns preserves order.
    """
    try:
        if not clustering_columns:
            return {
                "success": False,
                "error": "Select at least two columns for clustering.",
            }

        seen = set()
        clustering_columns_unique = []
        for c in clustering_columns:
            key = str(c).strip()
            if key in seen:
                continue
            seen.add(key)
            clustering_columns_unique.append(key)

        if len(clustering_columns_unique) < 2:
            return {
                "success": False,
                "error": "Select at least two distinct columns for clustering.",
            }

        clustering_columns = clustering_columns_unique

        rows = read_csv_table(src_path)

        if len(rows) < 2:
            return {"success": False, "error": "CSV must have header and data rows"}

        headers = [str(h).strip() for h in rows[0]]
        data_rows = rows[1:]
        n_cols = len(headers)

        for row in data_rows:
            if len(row) != n_cols:
                return {"success": False, "error": "CSV rows have inconsistent column counts"}

        indices = []
        subset_headers = []
        for name in clustering_columns:
            j = _resolve_column_index(headers, name)
            if j is None:
                return {
                    "success": False,
                    "error": f"Unknown column for clustering: {name}",
                }
            for row in data_rows:
                if j >= len(row) or not _cell_is_numeric(row[j]):
                    return {
                        "success": False,
                        "error": (
                            f"Column “{headers[j]}” is not numeric on every row "
                            "(choose only numeric columns)."
                        ),
                    }
            indices.append(j)
            subset_headers.append(headers[j])

        out_rows = []
        for row in data_rows:
            out_rows.append([float(row[j].strip()) for j in indices])

        with open(dest_path, 'w', newline='', encoding='utf-8') as out_f:
            writer = csv.writer(out_f)
            writer.writerow(subset_headers)
            writer.writerows(out_rows)

        return {"success": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to build clustering CSV: {str(e)}"}


def cleanup_file(filepath):
    """
    Delete a file safely
    
    Args:
        filepath (str): Path to file to delete
        
    Returns:
        bool: Success status
    """
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False
    except Exception as e:
        print(f"Failed to cleanup file {filepath}: {str(e)}")
        return False
