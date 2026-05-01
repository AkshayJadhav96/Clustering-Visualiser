import os
import json
import csv
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


def validate_csv_file(filepath):
    """
    Validate CSV file format and content
    
    Args:
        filepath (str): Path to CSV file
        
    Returns:
        dict: Validation result
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        if len(rows) < 2:
            return {
                "valid": False,
                "error": "CSV file must have at least 2 rows (header + data)"
            }
        
        # Check if data rows have numeric values
        headers = rows[0]
        data_rows = rows[1:]
        
        for i, row in enumerate(data_rows):
            if len(row) != len(headers):
                return {
                    "valid": False,
                    "error": f"Row {i+2} has {len(row)} columns, expected {len(headers)}"
                }
            
            # Try to convert to float (or check if numeric)
            for j, val in enumerate(row):
                try:
                    float(val.strip())
                except ValueError:
                    return {
                        "valid": False,
                        "error": f"Row {i+2}, Column {j+1} contains non-numeric value: {val}"
                    }
        
        return {
            "valid": True,
            "rows": len(data_rows),
            "columns": len(headers),
            "headers": headers
        }
    except Exception as e:
        return {
            "valid": False,
            "error": f"Failed to validate CSV: {str(e)}"
        }


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
