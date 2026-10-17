import React from 'react';

export default function DocumentToolbar({
  kbList,
  kbId,
  onKbChange,
  onCreateKb,
  onManageKb,
  searchTerm,
  onSearchChange,
}) {
  const hasKnowledgeBase = kbId !== null && kbId !== undefined;

  return (
    <div className="toolbar">
      <div className="kb-toolbar-left">
        <label className="kb-toolbar-label">Knowledge base:</label>
        <select
          className="kb-select"
          value={hasKnowledgeBase ? kbId : ''}
          onChange={(event) => onKbChange && onKbChange(Number(event.target.value))}
          disabled={kbList.length === 0}
          title={kbList.find((knowledgeBase) => knowledgeBase.id === kbId)?.description || ''}
        >
          {kbList.length === 0 && <option value="">(none)</option>}
          {kbList.map((knowledgeBase) => (
            <option key={knowledgeBase.id} value={knowledgeBase.id}>
              {knowledgeBase.name} ({knowledgeBase.fileCount} file
              {knowledgeBase.fileCount === 1 ? '' : 's'})
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

      <div className="search-box">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  );
}
