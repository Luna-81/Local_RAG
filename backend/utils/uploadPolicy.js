const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

function acceptPdfUpload(file, callback) {
  if (file.mimetype === 'application/pdf') {
    return callback(null, true);
  }
  return callback(new Error('Only PDF files are allowed.'));
}

module.exports = { MAX_UPLOAD_SIZE_BYTES, acceptPdfUpload };
