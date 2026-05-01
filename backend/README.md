# Backend - Flask Layer

This is the Flask-based REST API backend for the Clustering Visualiser. It handles file uploads, triggers the C clustering engine, and returns results.

## Structure

```
backend/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── routes/
│   └── cluster.py        # API endpoints for clustering
├── services/
│   └── run_c.py          # Subprocess logic to execute C program
└── utils/
    └── file_handler.py   # File operations (upload, validation, read/write)
```

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

### 3. Run the Server

```bash
python app.py
```

Or with Flask CLI:

```bash
flask --app app run
```

The API will be available at `http://localhost:5000`

## API Endpoints

### 1. Health Check
```
GET /api/cluster/health
```

Response:
```json
{
  "status": "healthy",
  "message": "Clustering API is running"
}
```

### 2. Upload CSV File
```
POST /api/cluster/upload
Content-Type: multipart/form-data
```

Request body: Form data with `file` field containing CSV file

Response (Success):
```json
{
  "success": true,
  "filename": "data.csv",
  "rows": 100,
  "columns": 3,
  "headers": ["x", "y", "z"]
}
```

Response (Error):
```json
{
  "error": "Only CSV files are allowed"
}
```

### 3. Run Clustering
```
POST /api/cluster/run
Content-Type: application/json
```

Request body:
```json
{
  "filename": "data.csv",
  "k": 3,
  "max_iterations": 100
}
```

Response (Success):
```json
{
  "success": true,
  "data": {
    "clusters": [...],
    "centroids": [...],
    "iterations": 45
  }
}
```

### 4. Get Results
```
GET /api/cluster/results/<filename_base>
```

Example: `GET /api/cluster/results/data`

Response:
```json
{
  "success": true,
  "data": {
    "clusters": [...],
    "centroids": [...],
    "iterations": 45
  }
}
```

## File Operations

- **Uploads**: CSV files are saved to `backend/uploads/`
- **Outputs**: JSON results are saved to `backend/outputs/`

## Requirements

- Flask 2.3.3
- Flask-CORS 4.0.0
- python-dotenv 1.0.0

## Notes

- Maximum file upload size: 16MB
- Only CSV files are accepted
- CSV must have numeric data with consistent column count
- The C executable must be compiled in `c_core/bin/kmeans`
