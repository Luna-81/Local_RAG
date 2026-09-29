// src/components/DocumentList.js
import React, { useRef, useState } from 'react';
import '../css/Documents.css';

function DocumentList({
  documents = [],
  onUpload,
  onDelete,
  kbList = [],
  kbId = null,
  onKbChange,
  onCreateKb,
  onManageKb,
}) {
  const fileInputRef = useRef(null);
  const [chunkSize, setChunkSize] = useState(300);
  const [overlap, setOverlap] = useState(30);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const hasKb = kbId !== null && kbId !== undefined;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!hasKb) {
      alert('Please select or create a knowledge base first.');
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert('Please upload a PDF file.');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!hasKb) {
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
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (doc) => {
    const status = doc.status;
    if (status === 'completed') return <span className="badge badge-success">Completed</span>;
    if (status === 'processing') {
      return (
        <div className="processing-status">
          <span className="badge badge-warning">Processing...</span>
          <div className="mini-progress-bar">
            <div className="mini-progress-fill"></div>
          </div>
        </div>
      );
    }
    if (status === 'failed') return <span className="badge badge-danger">Failed</span>;
    return <span className="badge badge-secondary">Unknown</span>;
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || 'N/A';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr || 'N/A';
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const filteredDocs = (documents || []).filter((doc) =>
    doc.originalName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uploadBtnLabel = () => {
    if (uploading) return 'Uploading & Vectorizing...';
    if (!hasKb) return 'Select a knowledge base';
    return 'Upload & Vectorize';
  };

  return (
    <div className="documents-page-container">
      <div className="page-header">
        <h2>Knowledge Base Management</h2>
        <p className="text-muted">
          Upload PDF assets to build and manage your vector index in real-time.
        </p>
      </div>

      <div className="documents-main-layout">
        {/* Left Sidebar */}
        <aside className="upload-sidebar">
          <div className="panel-card">
            <h3>Upload New Document</h3>

            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!hasKb) return;
                if (!selectedFile && !uploading) fileInputRef.current?.click();
              }}
              style={{ opacity: hasKb ? 1 : 0.55 }}
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
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {selectedFile && (
              <div className="selected-file-preview">
                <span className="file-icon">PDF</span>
                <div className="file-info">
                  <span className="name">{selectedFile.name}</span>
                  <span className="size">{formatSize(selectedFile.size)}</span>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => setSelectedFile(null)}
                  >
                    X
                  </button>
                )}
              </div>
            )}

            <div className="advanced-settings-toggle">
              <button
                type="button"
                className="btn-link"
                onClick={() => setShowSettings(!showSettings)}
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
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Overlap (0-200):</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={overlap}
                    onChange={(e) => setOverlap(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn-primary btn-block"
              onClick={handleUpload}
              disabled={!selectedFile || uploading || !hasKb}
              style={{ marginTop: '16px' }}
            >
              {uploadBtnLabel()}
            </button>
          </div>
        </aside>

        {/* Right Content */}
        <main className="documents-content panel-card">
          <div className="toolbar">
            {/* KB selector on the left */}
            <div className="kb-toolbar-left">
              <label className="kb-toolbar-label">Knowledge base:</label>

              <select
                className="kb-select"
                value={hasKb ? kbId : ''}
                onChange={(e) => onKbChange && onKbChange(Number(e.target.value))}
                disabled={kbList.length === 0}
                title={kbList.find((k) => k.id === kbId)?.description || ''}
              >
                {kbList.length === 0 && <option value="">(none)</option>}
                {kbList.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name} ({kb.fileCount} file{kb.fileCount === 1 ? '' : 's'})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="kb-btn small"
                onClick={onCreateKb}
                title="Create a new knowledge base"
              >
                + New
              </button>
              <button
                type="button"
                className="kb-btn small"
                onClick={onManageKb}
                title="Rename or delete knowledge bases"
              >
                Manage
              </button>
            </div>

            {/* Search on the right */}
            <div className="search-box">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="empty-state">No documents found</div>
          ) : (
            <div className="table-responsive">
              <table className="documents-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Size</th>
                    <th>Upload Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => {
                    const id = doc.id || doc._id;
                    return (
                      <tr key={id}>
                        <td className="doc-name">
                          <span className="doc-icon">PDF</span>
                          <span className="doc-text">{doc.originalName}</span>
                        </td>
                        <td className="doc-size">{formatSize(doc.size)}</td>
                        <td className="doc-date">
                          {formatDate(doc.uploadedAtStr || doc.uploadedAt)}
                        </td>
                        <td className="doc-status">{getStatusBadge(doc)}</td>
                        <td className="doc-action">
                          {onDelete && (
                            <button
                              type="button"
                              className="btn-icon-danger"
                              onClick={() => onDelete(id)}
                              title="Delete"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default DocumentList;