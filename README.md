# Clustering Visualiser

Web app for **K-means clustering** with a **multithreaded C core** (Lloyd iterations, K-means++ initialization), a **Flask** REST API, and a **React (Vite)** frontend for uploads, parameters, and charts—including an **elbow-method** curve (WCSS vs. *k*).

## Architecture

| Layer | Role |
|--------|------|
| **`c_core/`** | Reads numeric CSV, runs K-means, writes JSON with centroid history and labels. Builds `kmeans` and `elbow` CLI binaries. |
| **`backend/`** | Flask app: uploads, validation, subprocess calls into the C binaries, JSON responses. |
| **`clustering-frontend/`** | React UI; dev server proxies `/api` to the Flask backend. |

## Prerequisites

- **C**: GCC, `make`, POSIX threads (`-lpthread`), math lib (`-lm`)
- **Python**: 3.13+ (see `backend/pyproject.toml`)
- **Node.js**: current LTS recommended (for Vite/React)

Optional: [uv](https://docs.astral.sh/uv/) for Python env + deps (used by the root `Makefile` `install` target).

## Quick start

### Firstly make a folder named 'bin' inside c_core directory

### 1. Build the C engine

From the repository root:

```bash
make build
```

Produces:

- `c_core/bin/kmeans` — main clustering executable  
- `c_core/bin/elbow` — elbow / WCSS sweep for *k* = 1 … *k_max*

### 2. Install Python and frontend dependencies

```bash
make install
```

Or manually:

```bash
cd backend && uv sync    # or: pip install -e .
cd ../clustering-frontend && npm install
```

### 4. Run backend and frontend

Two terminals:

```bash
# Terminal 1 — API (default http://127.0.0.1:5000)
make dev-backend
# equivalent: cd backend && uv run app.py
```

```bash
# Terminal 2 — UI (Vite dev server; proxies /api → Flask)
make dev-frontend
# equivalent: cd clustering-frontend && npm run dev
```

## Project layout

```
Clustering-Visualiser/
├── Makefile                 # build C binaries; convenience dev/install targets
├── c_core/
│   ├── src/                 # C sources (e.g. main, io, kmeans, kmeans_init, kmeans_math, elbow)
│   └── bin/                 # built executables (after make build)
├── backend/
│   ├── app.py               # Flask entrypoint
│   ├── routes/cluster.py    # REST endpoints
│   ├── services/run_c.py    # invokes c_core/bin/kmeans and c_core/bin/elbow
│   ├── uploads/             # uploaded CSVs (created at runtime)
│   └── outputs/             # generated JSON (created at runtime)
├── clustering-frontend/     # React + Vite app
└── data/                    # optional sample or local data files
```

## C module overview

Sources under `c_core/src/` are split roughly into:

- **I/O** (`io.c` / `io.h`) — CSV load, dataset struct, JSON output for visualization  
- **Math** (`kmeans_math.c`) — squared Euclidean distance  
- **Initialization** (`kmeans_init.c` / `kmeans_init.h`) — K-means++ and fallbacks  
- **Algorithm** (`kmeans.c` / `kmeans.h`) — Lloyd iterations, optional WCSS path for elbow  
- **Drivers** — `main.c` (CLI k-means), `elbow.c` (elbow sweep)

Clean rebuild:

```bash
make clean && make build
```

## API reference

Detailed routes, request bodies, and examples live in **`backend/README.md`**. Common bases:

- Health: `GET /api/cluster/health`  
- Upload: `POST /api/cluster/upload`  
- Run clustering / elbow: see blueprint under `/api/cluster/` in `backend/routes/cluster.py`
