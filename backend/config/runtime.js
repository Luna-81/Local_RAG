const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BACKEND_ROOT = path.resolve(__dirname, '..');

require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });

function resolveProjectPath(value, fallback) {
  const configuredPath = value || fallback;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(PROJECT_ROOT, configuredPath);
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function resolvePythonExecutable() {
  const configured = process.env.PYTHON_EXECUTABLE;
  if (configured) {
    return configured.includes('/') || path.isAbsolute(configured)
      ? resolveProjectPath(configured)
      : configured;
  }

  const projectPython = path.join(PROJECT_ROOT, 'venv', 'bin', 'python3');
  return fs.existsSync(projectPython) ? projectPython : 'python3';
}

const DATA_DIR = resolveProjectPath(process.env.APP_DATA_DIR, 'data');

module.exports = {
  PROJECT_ROOT,
  BACKEND_ROOT,
  API_HOST: process.env.API_HOST || '0.0.0.0',
  API_PORT: readPositiveInteger('API_PORT', 3000),
  DATA_DIR,
  SQLITE_PATH: resolveProjectPath(process.env.SQLITE_PATH, path.join(DATA_DIR, 'app.sqlite3')),
  UPLOAD_DIR: resolveProjectPath(process.env.UPLOAD_DIR, path.join(DATA_DIR, 'raw_pdfs')),
  VECTOR_DB_PATH: resolveProjectPath(process.env.LANCEDB_PATH, path.join(DATA_DIR, 'vector_db')),
  KNOWLEDGE_MAP_CACHE_DIR: resolveProjectPath(
    process.env.KNOWLEDGE_MAP_CACHE_DIR,
    path.join(DATA_DIR, 'knowledge_maps'),
  ),
  PYTHON_EXECUTABLE: resolvePythonExecutable(),
  QA_PROCESS_TIMEOUT_MS: readPositiveInteger('QA_PROCESS_TIMEOUT_MS', 60_000),
  VECTORIZE_TIMEOUT_MS: readPositiveInteger('VECTORIZE_TIMEOUT_MS', 15 * 60 * 1000),
};
