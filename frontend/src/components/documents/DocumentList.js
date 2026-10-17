import React, { useState } from 'react';
import DocumentTable from './DocumentTable';
import DocumentToolbar from './DocumentToolbar';
import DocumentUploadPanel from './DocumentUploadPanel';
import '../../css/Documents.css';

function DocumentList({
  documents = [],
  onUpload,
  onDelete,
  onRetry,
  kbList = [],
  kbId = null,
  onKbChange,
  onCreateKb,
  onManageKb,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredDocuments = (documents || []).filter((document) =>
    document.originalName?.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const hasKnowledgeBase = kbId !== null && kbId !== undefined;

  return (
    <div className="documents-page-container">
      <div className="page-header">
        <h2>Knowledge Base Management</h2>
        <p className="text-muted">
          Upload PDF assets to build and manage your vector index in real-time.
        </p>
      </div>

      <div className="documents-main-layout">
        <DocumentUploadPanel hasKnowledgeBase={hasKnowledgeBase} onUpload={onUpload} />

        <main className="documents-content panel-card">
          <DocumentToolbar
            kbList={kbList}
            kbId={kbId}
            onKbChange={onKbChange}
            onCreateKb={onCreateKb}
            onManageKb={onManageKb}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
          <DocumentTable documents={filteredDocuments} onDelete={onDelete} onRetry={onRetry} />
        </main>
      </div>
    </div>
  );
}

export default DocumentList;
