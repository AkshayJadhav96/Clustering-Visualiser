from flask import Blueprint, request, jsonify
import os
from pathlib import Path

from services.run_c import KMeansRunner
from utils.file_handler import (
    save_upload_file,
    get_output_path,
    read_json_output,
    validate_csv_file,
    cleanup_file,
    build_clustering_csv,
    UPLOAD_FOLDER,
)

# Create blueprint
cluster_bp = Blueprint('cluster', __name__, url_prefix='/api/cluster')

# Initialize KMeans runner
kmeans_runner = KMeansRunner()


@cluster_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "message": "Clustering API is running"
    }), 200


@cluster_bp.route('/upload', methods=['POST'])
def upload_file():
    """
    Upload CSV file endpoint
    
    Returns:
        JSON with file info or error
    """
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({"error": "No file part in request"}), 400
        
        file = request.files['file']
        
        # Save file
        result = save_upload_file(file)
        if not result['success']:
            return jsonify({"error": result['error']}), 400
        
        # Validate CSV
        validation = validate_csv_file(result['filepath'])
        if not validation['valid']:
            cleanup_file(result['filepath'])
            return jsonify({"error": validation['error']}), 400
        
        payload = {
            "success": True,
            "filename": result['filename'],
            "rows": validation['rows'],
            "columns": validation['columns'],
            "headers": validation['headers'],
            "numeric_headers": validation['numeric_headers'],
        }
        return jsonify(payload), 200
        
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


@cluster_bp.route('/run', methods=['POST'])
def run_clustering():
    """
    Run clustering on uploaded file
    
    Expected JSON:
    {
        "filename": "uploaded_filename.csv",
        "clustering_columns": ["Age", "Annual Income (k$)", "Spending Score (1-100)"],
        "k": 3,
        "max_iterations": 100,
        "threads": 4
    }
    
    Returns:
        JSON with clustering results
    """
    try:
        data = request.get_json()
        
        if not data or 'filename' not in data:
            return jsonify({"error": "Missing filename in request"}), 400
        
        filename = data['filename']
        clustering_columns = data.get('clustering_columns')
        k = data.get('k', 3)
        max_iterations = data.get('max_iterations', 100)
        num_threads = data.get('threads', 4)

        if not clustering_columns or not isinstance(clustering_columns, list):
            return jsonify({"error": "Missing clustering_columns array"}), 400
        if len(clustering_columns) < 2:
            return jsonify({"error": "Select at least two columns for clustering"}), 400
        
        # Validate parameters
        try:
            k = int(k)
            max_iterations = int(max_iterations)
            num_threads = int(num_threads)

            if k < 1:
                return jsonify({"error": "k must be positive"}), 400
            if max_iterations < 1:
                return jsonify({"error": "max_iterations must be positive"}), 400
            if num_threads < 1:
                return jsonify({"error": "num_threads must be positive"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "k and max_iterations must be integers"}), 400
        
        input_file = os.path.join(UPLOAD_FOLDER, filename)

        if not os.path.exists(input_file):
            return jsonify({"error": f"File not found: {filename}"}), 404

        filename_base = os.path.splitext(filename)[0]
        output_file = get_output_path(filename_base)

        numeric_input = os.path.join(UPLOAD_FOLDER, f"{filename_base}_kmeans_numeric.csv")
        build_result = build_clustering_csv(input_file, numeric_input, clustering_columns)
        if not build_result['success']:
            return jsonify({"error": build_result['error']}), 400

        try:
            exec_result = kmeans_runner.run_clustering(
                numeric_input,
                output_file,
                k,
                max_iterations,
                num_threads,
            )
        finally:
            try:
                os.remove(numeric_input)
            except OSError:
                pass
        
        if not exec_result['success']:
            return jsonify({"error": exec_result['error']}), 500
        
        # Read and return results
        results = read_json_output(output_file)
        if not results['success']:
            return jsonify({"error": results['error']}), 500
        
        return jsonify({
            "success": True,
            "data": results['data']
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Clustering failed: {str(e)}"}), 500


@cluster_bp.route('/results/<filename>', methods=['GET'])
def get_results(filename):
    """
    Get clustering results for a file
    
    Args:
        filename: Base filename (without extension)
        
    Returns:
        JSON with clustering results
    """
    try:
        output_file = get_output_path(filename)
        
        results = read_json_output(output_file)
        if not results['success']:
            return jsonify({"error": results['error']}), 404
        
        return jsonify({
            "success": True,
            "data": results['data']
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve results: {str(e)}"}), 500
