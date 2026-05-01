# Clustering-Visualiser
clustering-toolkit/ \
│
├── README.md \
├── .gitignore \
├── Makefile                # For compiling C code \
│ \
├── data/                   # Input/output files \
│   ├── input.csv\
│   └── output.json\
│\
├── c_core/                 # 🔥 C Engine (MAIN FOCUS)\
│   ├── src/\
│   │   ├── main.c\
│   │   ├── kmeans.c\
│   │   ├── kmeans.h\
│   │   ├── io.c           # CSV reading / JSON writing\
│   │   ├── io.h\
│   │   ├── utils.c        # helper functions\
│   │   ├── utils.h\
│   │   ├── thread_pool.c  # (optional advanced)\
│   │   └── thread_pool.h\
│   │\
│   ├── include/           # (optional but clean)\
│   │   ├── kmeans.h\
│   │   ├── io.h\
│   │   └── utils.h\
│   │\
│   ├── bin/               # compiled executables\
│   │   └── kmeans\
│   │\
│   └── tests/\
│       └── test_kmeans.c\
│\
├── backend/               # 🐍 Flask layer\
│   ├── app.py\
│   ├── routes/\
│   │   └── cluster.py\
│   ├── services/\
│   │   └── run_c.py       # subprocess logic\
│   ├── utils/\
│   │   └── file_handler.py\
│   └── requirements.txt\
│\
├── frontend/              # ⚛️ React app\
│   ├── src/\
│   │   ├── components/\
│   │   │   ├── Upload.jsx\
│   │   │   ├── Plot.jsx\
│   │   │   └── Controls.jsx\
│   │   ├── services/\
│   │   │   └── api.js\
│   │   └── App.js\
│   └── package.json\
│\
└── docs/                  # (VERY IMPRESSIVE)\
    ├── architecture.md\
    └── design_decisions.md\