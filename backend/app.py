from flask import Flask, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__)

# Configure app
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')

# Enable CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Create uploads and outputs folders
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(__file__), 'outputs'), exist_ok=True)

# Register blueprints
from routes.cluster import cluster_bp
app.register_blueprint(cluster_bp)


@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        "name": "Clustering Visualiser API",
        "version": "1.0.0",
        "description": "K-means clustering API backed by C engine",
        "endpoints": {
            "health": "/api/cluster/health",
            "upload": "POST /api/cluster/upload",
            "run": "POST /api/cluster/run",
            "results": "GET /api/cluster/results/<filename>"
        }
    }), 200


@app.route('/api', methods=['GET'])
def api_info():
    """API info endpoint"""
    return jsonify({
        "name": "Clustering Visualiser API",
        "version": "1.0.0",
        "description": "K-means clustering API backed by C engine"
    }), 200


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        "error": "Endpoint not found",
        "status": 404
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        "error": "Internal server error",
        "status": 500
    }), 500


if __name__ == '__main__':
    # Run development server
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ['true', '1', 'yes']
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    
    app.run(
        host=host,
        port=port,
        debug=debug
    )
