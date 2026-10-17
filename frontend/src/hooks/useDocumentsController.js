import { useCallback, useEffect, useState } from 'react';
import {
  deleteDocumentApi,
  listUploadsApi,
  retryDocumentApi,
  uploadDocumentApi,
} from '../api/documentsApi';
import { listKbApi } from '../api/kbApi';

export default function useDocumentsController() {
  const [documents, setDocuments] = useState([]);
  const [kbList, setKbList] = useState([]);
  const [kbId, setKbId] = useState(() => {
    const savedId = Number(localStorage.getItem('kbId'));
    return savedId > 0 ? savedId : null;
  });

  const loadKbList = useCallback(async () => {
    try {
      const response = await listKbApi();
      const list = response?.knowledgeBases || [];
      setKbList(list);
      setKbId((previousId) => {
        if (previousId && list.some((knowledgeBase) => knowledgeBase.id === previousId)) {
          return previousId;
        }
        return list[0]?.id || null;
      });
    } catch (error) {
      console.error('Failed to load KB list:', error);
    }
  }, []);

  useEffect(() => {
    loadKbList();
  }, [loadKbList]);

  useEffect(() => {
    if (kbId) localStorage.setItem('kbId', String(kbId));
  }, [kbId]);

  const fetchDocuments = useCallback(async () => {
    if (!kbId) {
      setDocuments([]);
      return [];
    }
    try {
      const response = await listUploadsApi(kbId);
      const uploadedDocuments = response?.documents || [];
      setDocuments(uploadedDocuments);
      return uploadedDocuments;
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      return [];
    }
  }, [kbId]);

  useEffect(() => {
    if (!kbId) {
      setDocuments([]);
      return undefined;
    }
    fetchDocuments();
    const pollingId = setInterval(fetchDocuments, 2500);
    return () => clearInterval(pollingId);
  }, [kbId, fetchDocuments]);

  const handleUpload = async (file, chunkSize, overlap) => {
    if (!kbId) {
      alert('Please select or create a knowledge base first.');
      throw new Error('No KB selected');
    }
    try {
      const response = await uploadDocumentApi(file, chunkSize, overlap, kbId);
      const uploadedFile = response?.file;
      if (uploadedFile) {
        setDocuments((previous) => [
          uploadedFile,
          ...previous.filter((doc) => doc.id !== uploadedFile.id),
        ]);
      }
      fetchDocuments();
      loadKbList();
      return response;
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      if (status === 409) {
        const existing = error.response?.data?.existing;
        const prompt = existing?.kbName ? `${message}\n\nSwitch to that knowledge base?` : message;
        if (existing?.kbId && window.confirm(prompt)) setKbId(existing.kbId);
      } else {
        alert('Upload failed: ' + message);
      }
      throw error;
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocumentApi(documentId);
      setDocuments((previous) => previous.filter((document) => document.id !== documentId));
      loadKbList();
    } catch (error) {
      alert('Delete failed: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleRetry = async (documentId) => {
    try {
      await retryDocumentApi(documentId);
      await fetchDocuments();
    } catch (error) {
      alert('Retry failed: ' + (error.response?.data?.message || error.message));
    }
  };

  return {
    documents,
    kbList,
    kbId,
    setKbId,
    loadKbList,
    handleUpload,
    handleDelete,
    handleRetry,
  };
}
