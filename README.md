# Local RAG

Local RAG is a self-hosted PDF question-answering workspace. It turns uploaded PDFs into searchable vector indexes, retrieves relevant passages for each question, and uses a local `llama-server` to generate answers with source references.

## Highlights

- **Knowledge bases:** Keep document collections in separate LanceDB tables.
- **PDF workflow:** Upload PDFs, track processing, remove documents, and avoid duplicate uploads with SHA-256 content hashes.
- **Grounded answers:** Search with `BAAI/bge-small-zh-v1.5` embeddings and generate answers through llama.cpp's OpenAI-compatible API.
- **Knowledge maps:** Explore indexed documents as clustered visual maps with generated topic summaries.
- **Three user roles:** A shared User Hub provides shortcuts suited to each user's permissions. Administrators can manage documents, indexes, users, and audit logs.
- **Network visibility:** The optional XDP/eBPF module displays traffic statistics, dropped IPs, and a whitelist.
- **Local data:** SQLite stores application metadata, while LanceDB stores document vectors.

## Architecture

| Directory | Purpose |
| --- | --- |
| `frontend/` | React application |
| `backend/` | Express API, authentication, SQLite models, and Python integration |
| `backend/parser/` | PDF extraction, embeddings, retrieval, answer generation, and knowledge maps |
| `xdp/` | XDP/eBPF program |
| `data/` | Local uploads, database, vector indexes, model files, and generated maps |

The backend serves its API on port `3000` by default. The frontend development server reads the same `API_PORT` from `backend/.env` and proxies `/api` and `/health` to it. `llama-server` serves the model on port `8080` by default.

## Requirements

- Node.js 20, npm, Python 3, and Python `venv`
- A built `llama-server` and a compatible GGUF model for answer generation
- Linux and XDP tooling for the optional network module

## Setup

From the repository root, install the JavaScript and Python dependencies:

```bash
npm --prefix backend ci
npm --prefix frontend ci
python3 -m venv venv
./venv/bin/python3 -m pip install -r backend/requirements.txt
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
openssl rand -hex 32
```

Put the generated value after `JWT_SECRET=` in `backend/.env`. The secret must be at least 32 bytes and should remain the same across restarts. On a new database, also set `INITIAL_ADMIN_PASSWORD` to a password of at least 12 characters and at most 72 bytes. The initial username is `admin`; additional users are created in Admin Panel.

Review the other settings in `backend/.env.example` before starting the project. Relative data, model, Python, and llama.cpp paths are resolved from the repository root. `PYTHON_EXECUTABLE` defaults to `venv/bin/python3` when present and otherwise uses `python3`. Install optional formatting tools with `python3 -m pip install -r backend/requirements-dev.txt`.

`backend/.env` is ignored by Git. Keep it private.

## Run

To start all three services with the project script, configure `LLAMA_SERVER_BIN` and `LLAMA_MODEL_PATH` in `backend/.env`, then run:

```bash
./start_all.sh
```

Logs and per-user process IDs are stored under the runtime temporary directory. Stop only the services started by this script with `./stop_all.sh`. Alternatively, start each service in a separate terminal:

```bash
# Terminal 1: use the paths for your local llama.cpp build and model.
/path/to/llama-server -m /path/to/model.gguf --host 127.0.0.1 --port 8080
```

```bash
# Terminal 2
cd backend
npm start
```

```bash
# Terminal 3
cd frontend
npm start
```

Open the frontend URL printed in its terminal, typically `http://localhost:3001`. The backend health endpoint is `http://localhost:3000/health` by default. Set `API_PORT` and `FRONTEND_PORT` in `backend/.env` to change the ports.

## Roles and sessions

| Role | Available pages |
| --- | --- |
| Standard user | User Hub and Chat Console |
| AI operator | Standard pages, Documents, LanceDB Manager, and Dashboard |
| System administrator | AI operator pages and Admin Panel |

All roles use the same User Hub; its shortcuts follow their permissions. JWTs expire after one hour. The browser keeps the login state for the current tab, including page refreshes. Logging out, changing a password or role, and deleting an account invalidate existing tokens.

## Checks

```bash
node --test backend/tests/auth.test.js
npm --prefix frontend run build
python -m unittest discover -s backend/parser/tests -v
```

The Python parser tests use the standard library test runner and require the
dependencies from `backend/requirements.txt` to be installed in the active Python
environment.
If the embedding model is already cached locally and you want to avoid
network access, run `export EMBED_OFFLINE=1` before starting the backend.
