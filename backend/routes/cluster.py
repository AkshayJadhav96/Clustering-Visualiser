from flask import Blueprint, request, jsonify
import os
from pathlib import Path

from services.run_c import KMeansRunner
from utils.file_handler import (
    save_upload_file, 
    get_output_path, 
    read_json_output,
    validate_csv_file,
    cleanup_file
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
        
        return jsonify({
            "success": True,
            "filename": result['filename'],
            "rows": validation['rows'],
            "columns": validation['columns'],
            "headers": validation['headers']
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


@cluster_bp.route('/run', methods=['POST'])
def run_clustering():
    """
    Run clustering on uploaded file
    
    Expected JSON:
    {
        "filename": "uploaded_filename.csv",
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
        k = data.get('k', 3)
        max_iterations = data.get('max_iterations', 100)
        num_threads = data.get('threads',4)
        
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
        
        # Get input file path
        from utils.file_handler import UPLOAD_FOLDER
        input_file = os.path.join(UPLOAD_FOLDER, filename)
        
        if not os.path.exists(input_file):
            return jsonify({"error": f"File not found: {filename}"}), 404
        
        # Get output file path
        filename_base = os.path.splitext(filename)[0]
        output_file = get_output_path(filename_base)
        
        # Run clustering
        exec_result = kmeans_runner.run_clustering(
            input_file, 
            output_file, 
            k, 
            max_iterations,
            num_threads
        )
        
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
