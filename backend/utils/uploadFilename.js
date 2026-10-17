const crypto = require('crypto');

function createUploadFilename() {
  return `${crypto.randomUUID()}.pdf`;
}

module.exports = { createUploadFilename };
