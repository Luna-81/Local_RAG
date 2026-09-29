// src/pages/Documents.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import DocumentList from '../components/DocumentList';
import CreateKbModal from '../components/CreateKbModal';
import ManageKbModal from '../components/ManageKbModal';
import {
  listUploadsApi,
  uploadDocumentApi,
  deleteDocumentApi,
} from '../api/documentsApi';
import { listKbApi } from '../api/kbApi';

function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [kbList, setKbList] = useState([]);
  const [kbId, setKbId] = useState(() => {
    const saved = Number(localStorage.getItem('kbId'));
    return saved > 0 ? saved : null;
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const pollingRef = useRef(null);

  // ---- Load KB list ----
  const loadKbList = useCallback(async () => {
    try {
      const res = await listKbApi();
      const list = res?.knowledgeBases || [];
      setKbList(list);
      setKbId((prev) => {
        if (prev && list.some((k) => k.id === prev)) return prev;
        return list.length > 0 ? list[0].id : null;
      });
    } catch (err) {
      console.error('Failed to load KB list:', err);
    }
  }, []);

  useEffect(() => {
    loadKbList();
  }, [loadKbList]);

  useEffect(() => {
    if (kbId) localStorage.setItem('kbId', String(kbId));
  }, [kbId]);

  // ---- Fetch documents ----
  const fetchDocuments = useCallback(
    async (showLoading = false) => {
      if (!kbId) {
        setDocuments([]);
        return [];
      }
      try {
        if (showLoading) setLoading(true);
        const res = await listUploadsApi(kbId);
        const docs = res?.documents || [];
        setDocuments(docs);
        return docs;
      } catch (err) {
        console.error('Failed to fetch documents:', err);
        return [];
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [kbId]
  );

  // ---- Polling ----
  useEffect(() => {
    if (!kbId) {
      setDocuments([]);
      return;
    }
    fetchDocuments(true);
    pollingRef.current = setInterval(() => fetchDocuments(false), 2500);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [kbId, fetchDocuments]);

  // ---- Upload ----
  const handleUpload = async (file, chunkSize, overlap) => {
    if (!kbId) {
      alert('Please select or create a knowledge base first.');
      throw new Error('No KB selected');
    }
    try {
      const res = await uploadDocumentApi(file, chunkSize, overlap, kbId);
      const uploadedFile = res?.file;
      if (uploadedFile) {
        setDocuments((prev) => [
          uploadedFile,
          ...prev.filter((d) => d.id !== uploadedFile.id),
        ]);
      }
      fetchDocuments(false);
      loadKbList();
      return res;
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;

      if (status === 409) {
        const existing = err.response?.data?.existing;
        const tip = existing?.kbName
          ? `${msg}\n\nSwitch to that knowledge base?`
          : msg;
        if (existing?.kbId && window.confirm(tip)) {
          setKbId(existing.kbId);
        }
      } else {
        alert('Upload failed: ' + msg);
      }
      throw err;
    }
  };

  // ---- Delete ----
  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocumentApi(docId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      loadKbList();
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <>
      <DocumentList
        documents={documents}
        loading={loading}
        onUpload={handleUpload}
        onDelete={handleDelete}
        kbList={kbList}
        kbId={kbId}
        onKbChange={setKbId}
        onCreateKb={() => setShowCreate(true)}
        onManageKb={() => setShowManage(true)}
      />

      {showCreate && (
        <CreateKbModal
          onClose={() => setShowCreate(false)}
          onCreated={async (newKb) => {
            await loadKbList();
            if (newKb?.id) setKbId(newKb.id);
            setShowCreate(false);
          }}
        />
      )}

      {showManage && (
        <ManageKbModal
          list={kbList}
          onClose={() => setShowManage(false)}
          onChanged={loadKbList}
        />
      )}
    </>
  );
}

export default DocumentsPage;