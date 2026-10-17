import React, { useState } from 'react';
import DocumentList from '../components/documents/DocumentList';
import CreateKbModal from '../components/kb/CreateKbModal';
import ManageKbModal from '../components/kb/ManageKbModal';
import useDocumentsController from '../hooks/useDocumentsController';

function DocumentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const { documents, kbList, kbId, setKbId, loadKbList, handleUpload, handleDelete, handleRetry } =
    useDocumentsController();

  const handleKnowledgeBaseCreated = async (knowledgeBase) => {
    await loadKbList();
    if (knowledgeBase?.id) setKbId(knowledgeBase.id);
    setShowCreate(false);
  };

  return (
    <>
      <DocumentList
        documents={documents}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onRetry={handleRetry}
        kbList={kbList}
        kbId={kbId}
        onKbChange={setKbId}
        onCreateKb={() => setShowCreate(true)}
        onManageKb={() => setShowManage(true)}
      />

      {showCreate && (
        <CreateKbModal
          onClose={() => setShowCreate(false)}
          onCreated={handleKnowledgeBaseCreated}
        />
      )}

      {showManage && (
        <ManageKbModal list={kbList} onClose={() => setShowManage(false)} onChanged={loadKbList} />
      )}
    </>
  );
}

export default DocumentsPage;
