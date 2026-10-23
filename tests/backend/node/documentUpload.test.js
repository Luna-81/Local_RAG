const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MAX_UPLOAD_SIZE_BYTES, acceptPdfUpload } = require('../../../backend/utils/uploadPolicy');

function validateMimeType(mimetype) {
  let result;
  acceptPdfUpload({ mimetype }, (error, accepted) => {
    result = { error, accepted };
  });
  return result;
}

test('document upload accepts PDF MIME type and rejects other document types', () => {
  assert.deepEqual(validateMimeType('application/pdf'), { error: null, accepted: true });
  for (const mimetype of ['text/plain', 'application/msword', 'application/octet-stream', '']) {
    const result = validateMimeType(mimetype);
    assert.equal(result.accepted, undefined);
    assert.match(result.error.message, /Only PDF files are allowed/);
  }
});

test('document upload limit is 50 MiB', () => {
  assert.equal(MAX_UPLOAD_SIZE_BYTES, 50 * 1024 * 1024);
});
