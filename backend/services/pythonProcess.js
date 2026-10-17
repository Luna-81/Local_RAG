const path = require('path');
const { execFile, spawn } = require('child_process');
const { BACKEND_ROOT, PYTHON_EXECUTABLE } = require('../config/runtime');

const PARSER_ROOT = path.join(BACKEND_ROOT, 'parser');
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

function resolveParserScript(scriptName) {
  const scriptPath = path.resolve(PARSER_ROOT, scriptName);
  if (!scriptPath.startsWith(`${PARSER_ROOT}${path.sep}`)) {
    throw new Error(`Parser script must be inside ${PARSER_ROOT}`);
  }
  return scriptPath;
}

function execParser(scriptName, args, options, callback) {
  const scriptPath = resolveParserScript(scriptName);
  const childOptions = {
    cwd: PARSER_ROOT,
    env: process.env,
    maxBuffer: DEFAULT_MAX_BUFFER,
    ...options,
  };
  execFile(PYTHON_EXECUTABLE, [scriptPath, ...args], childOptions, callback);
}

function spawnParser(scriptName, args, options = {}) {
  const scriptPath = resolveParserScript(scriptName);
  return spawn(PYTHON_EXECUTABLE, [scriptPath, ...args], {
    cwd: PARSER_ROOT,
    env: process.env,
    ...options,
  });
}

module.exports = { execParser, spawnParser };
