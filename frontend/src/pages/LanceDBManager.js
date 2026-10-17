// src/pages/LanceDBManager.js
import React, { useEffect, useState, useCallback } from 'react';
import { getVectorIndexStatsApi } from '../api/lancedbApi';
import { listVectorDocsApi } from '../api/knowledgeApi';
import { listKbApi } from '../api/kbApi';
import KnowledgeMap from '../components/knowledge/KnowledgeMap';
import '../css/LanceDBManager.css';

const LanceDBManager = () => {
  const [stats, setStats] = useState(null);
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // KB state
  const [kbList, setKbList] = useState([]);
  const [kbId, setKbId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ---- Load KB list (once) ----
  useEffect(() => {
    (async () => {
      try {
        const res = await listKbApi();
        const list = res?.knowledgeBases || [];
        setKbList(list);
        setKbId(list.length > 0 ? list[0].id : null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load knowledge bases.');
      }
    })();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await getVectorIndexStatsApi();
      if (res.success) setStats(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch storage metrics.');
    }
  };

  const fetchDocs = useCallback(async (targetKbId) => {
    if (!targetKbId) {
      setDocs([]);
      return;
    }
    try {
      const res = await listVectorDocsApi(targetKbId);
      if (res.success) setDocs(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch documents.');
    }
  }, []);

  // Initial: stats
  useEffect(() => {
    fetchStats();
  }, []);

  // When kbId changes: reload docs, clear current selection
  useEffect(() => {
    setSelectedDoc(null);
    fetchDocs(kbId);
  }, [kbId, fetchDocs]);

  // Loading ends as soon as the first stats fetch settles
  useEffect(() => {
    if (stats !== null || error) setLoading(false);
  }, [stats, error]);

  if (loading) {
    return <div className="page-container">Loading storage statistics...</div>;
  }

  return (
    <div className="page-container">
      <h2>Vector Storage Governance</h2>

      {error && <div className="error-banner">{error}</div>}

      {stats && (
        <div className="overview-cards">
          <div className="card">
            <h4>Total Data Tables</h4>
            <p>{stats.total_tables}</p>
          </div>
          <div className="card">
            <h4>Total Index Items</h4>
            <p>{stats.total_vectors}</p>
          </div>
          <div className="card">
            <h4>Storage Path</h4>
            <p className="path-text">{stats.storage_directory}</p>
          </div>
        </div>
      )}

      <h3>Data Tables</h3>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Table Name</th>
              <th>Item Count</th>
            </tr>
          </thead>
          <tbody>
            {stats?.tables?.length === 0 ? (
              <tr>
                <td colSpan="2" className="utility-cell-centered">
                  No data tables found.
                </td>
              </tr>
            ) : (
              stats?.tables?.map((tbl) => (
                <tr key={tbl.name}>
                  <td>
                    {tbl.kbName ? (
                      <>
                        <span className="lancedb-kb-name">{tbl.kbName}</span>
                        <span className="lancedb-table-name">({tbl.name})</span>
                      </>
                    ) : (
                      tbl.name
                    )}
                  </td>
                  <td>{tbl.vector_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* KB selector + Documents */}
      <div className="lancedb-documents-header">
        <h3 className="lancedb-section-heading">Documents in Index</h3>

        <label className="lancedb-kb-label">Knowledge base:</label>
        <select
          value={kbId || ''}
          onChange={(e) => setKbId(Number(e.target.value))}
          disabled={kbList.length === 0}
          className="lancedb-kb-select"
        >
          {kbList.length === 0 && <option value="">(none)</option>}
          {kbList.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name} ({kb.tableName})
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrapper lancedb-documents-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Document Name</th>
              <th>Chunks</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td colSpan="3" className="utility-cell-centered">
                  No documents found.
                </td>
              </tr>
            ) : (
              docs.map((d) => {
                const name = d.document_name;
                const on = selectedDoc === name;
                return (
                  <tr key={name} className={on ? 'lancedb-selected-row' : undefined}>
                    <td className="utility-break-word">{d.display_name || name}</td>
                    <td>{d.chunk_count}</td>
                    <td>
                      <button
                        className={on ? 'btn-danger' : ''}
                        onClick={() => setSelectedDoc(on ? null : name)}
                      >
                        {on ? 'Deselect' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Knowledge map for current selection */}
      {selectedDoc && kbId && (
        <KnowledgeMap
          docName={selectedDoc}
          displayName={
            docs.find((doc) => doc.document_name === selectedDoc)?.display_name || selectedDoc
          }
          kbId={kbId}
        />
      )}

      {selectedDoc && !kbId && (
        <p className="lancedb-select-prompt">Please select a knowledge base first.</p>
      )}
    </div>
  );
};

export default LanceDBManager;
