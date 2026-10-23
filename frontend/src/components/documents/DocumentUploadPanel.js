import React, { useRef, useState } from 'react';
import { formatFileSize } from '../../utils/documents';

export default function DocumentUploadPanel({ hasKnowledgeBase, onUpload }) {
  const fileInputRef = useRef(null);
  const [chunkSize, setChunkSize] = useState(300);
  const [overlap, setOverlap] = useState(30);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const selectPdf = (file) => {
    if (file?.type === 'application/pdf') {
      setSelectedFile(file);
    } else if (file) {
      alert('Please upload a PDF file.');
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) setSelectedFile(file);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (!hasKnowledgeBase) {
      alert('Please select or create a knowledge base first.');
      return;
    }
    selectPdf(event.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!hasKnowledgeBase) {
      alert('Please select or create a knowledge base first.');
      return;
    }
    if (typeof onUpload !== 'function') {
      console.error('onUpload prop is missing.');
      alert('System error: Upload handler function is missing.');
      return;
    }

    setUploading(true);
    try {
      await onUpload(selectedFile, chunkSize, overlap);
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const uploadLabel = uploading
    ? 'Uploading & Vectorizing...'
    : hasKnowledgeBase
      ? 'Upload & Vectorize'
      : 'Select a knowledge base';

  return (
    <aside className="upload-sidebar">
      <div className="panel-card">
        <h3>Upload New Document</h3>
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${!hasKnowledgeBase ? 'disabled' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => {
            if (hasKnowledgeBase && !selectedFile && !uploading) fileInputRef.current?.click();
          }}
        >
          <div className="drop-zone-prompt">
            <div className="icon">PDF</div>
            <p>
              {isDragging ? 'Release to upload' : 'Drag & drop PDF here, or '}
              <span>Browse</span>
            </p>
            <small>Supports PDF files up to 50MB</small>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf"
          className="document-file-input"
          onChange={handleFileChange}
        />

        {selectedFile && (
          <div className="selected-file-preview">
            <span className="file-icon">PDF</span>
            <div className="file-info">
              <span className="name">{selectedFile.name}</span>
              <span className="size">{formatFileSize(selectedFile.size)}</span>
            </div>
            {!uploading && (
              <button type="button" className="btn-remove" onClick={() => setSelectedFile(null)}>
                X
              </button>
            )}
          </div>
        )}

        <div className="advanced-settings-toggle">
          <button
            type="button"
            className="btn-link"
            onClick={() => setShowSettings((visible) => !visible)}
          >
            {showSettings ? 'Hide' : 'Show'} Vector Chunk Settings
          </button>
        </div>

        {showSettings && (
          <div className="vector-settings-panel">
            <div className="form-group">
              <label>Chunk Size (100-1000):</label>
              <input
                type="number"
                min="100"
                max="1000"
                value={chunkSize}
                onChange={(event) => setChunkSize(Number(event.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Overlap (0-200):</label>
              <input
                type="number"
                min="0"
                max="200"
                value={overlap}
                onChange={(event) => setOverlap(Number(event.target.value))}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || uploading || !hasKnowledgeBase}
          className={`btn-primary btn-block document-upload-button${uploading ? ' is-uploading' : ''}`}
        >
          {uploadLabel}
        </button>
      </div>
    </aside>
  );
}
