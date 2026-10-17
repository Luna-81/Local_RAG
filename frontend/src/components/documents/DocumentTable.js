import React from 'react';
import { formatDocumentDate, formatFileSize } from '../../utils/documents';

function StatusBadge({ status }) {
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
}

export default function DocumentTable({ documents, onDelete, onRetry }) {
  if (documents.length === 0) return <div className="empty-state">No documents found</div>;

  return (
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
          {documents.map((document) => {
            const id = document.id || document._id;
            return (
              <tr key={id}>
                <td className="doc-name">
                  <span className="doc-icon">PDF</span>
                  <span className="doc-text">{document.originalName}</span>
                </td>
                <td className="doc-size">{formatFileSize(document.size)}</td>
                <td className="doc-date">
                  {formatDocumentDate(document.uploadedAtStr || document.uploadedAt)}
                </td>
                <td className="doc-status">
                  <StatusBadge status={document.status} />
                </td>
                <td className="doc-action">
                  {document.status === 'failed' && onRetry && (
                    <button
                      type="button"
                      className="kb-btn small"
                      onClick={() => onRetry(id)}
                      title="Retry vectorization"
                    >
                      Retry
                    </button>
                  )}
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
  );
}
