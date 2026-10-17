const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const calls = { execFile: [], spawn: [] };
const originalLoad = Module._load;

Module._load = function (request) {
  if (request === 'child_process') {
    return {
      execFile: (...args) => calls.execFile.push(args),
      spawn: (...args) => {
        calls.spawn.push(args);
        return { pid: 123 };
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

let execParser;
let spawnParser;
try {
  ({ execParser, spawnParser } = require('../../../backend/services/pythonProcess'));
} finally {
  Module._load = originalLoad;
}

test('execParser invokes the configured interpreter with a parser-local script', () => {
  execParser('ask.py', ['question'], { timeout: 1000 }, () => {});

  const [executable, args, options] = calls.execFile[0];
  assert.equal(executable, require('../../../backend/config/runtime').PYTHON_EXECUTABLE);
  assert.equal(args[0], path.join(__dirname, '../../../backend/parser/ask.py'));
  assert.deepEqual(args.slice(1), ['question']);
  assert.equal(options.cwd, path.join(__dirname, '../../../backend/parser'));
  assert.equal(options.timeout, 1000);
});

test('spawnParser invokes a parser-local script and returns the child process', () => {
  const child = spawnParser('run.py', ['document.pdf']);

  const [executable, args, options] = calls.spawn[0];
  assert.equal(child.pid, 123);
  assert.equal(executable, require('../../../backend/config/runtime').PYTHON_EXECUTABLE);
  assert.equal(args[0], path.join(__dirname, '../../../backend/parser/run.py'));
  assert.deepEqual(args.slice(1), ['document.pdf']);
  assert.equal(options.cwd, path.join(__dirname, '../../../backend/parser'));
});

test('parser process helpers reject paths outside the parser directory', () => {
  assert.throws(() => execParser('../server.js', [], {}, () => {}), /must be inside/);
  assert.throws(() => spawnParser('../server.js'), /must be inside/);
  assert.equal(calls.execFile.length, 1);
  assert.equal(calls.spawn.length, 1);
});
