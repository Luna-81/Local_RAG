const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createUploadFilename } = require('../../../backend/utils/uploadFilename');

test('upload storage names do not contain user-supplied path segments', () => {
  const filename = createUploadFilename();

  assert.match(filename, /^[0-9a-f-]{36}\.pdf$/i);
  assert.equal(filename.includes('/'), false);
  assert.equal(filename.includes('\\'), false);
});

test('XDP helper receives discrete arguments without shell interpolation', () => {
  const Module = require('node:module');
  const calls = [];
  const originalLoad = Module._load;
  Module._load = function (request) {
    if (request === 'child_process') {
      return {
        execFile: (...args) => {
          calls.push(args);
          args.at(-1)(null, 'ok', '');
        },
      };
    }
    if (request === '../config/db') return { db: {} };
    return originalLoad.apply(this, arguments);
  };

  let runHelper;
  try {
    ({ runHelper } = require('../../../backend/services/xdpService'));
  } finally {
    Module._load = originalLoad;
  }

  let result;
  runHelper('add-whitelist', ['0xc0', '0xa8', '0x01', '0x0a'], (error, stdout) => {
    result = { error, stdout };
  });

  const [executable, args] = calls[0];
  assert.equal(executable, 'bash');
  assert.deepEqual(args.slice(1), ['add-whitelist', '0xc0', '0xa8', '0x01', '0x0a']);
  assert.equal(result.error, null);
  assert.equal(result.stdout, 'ok');
});
