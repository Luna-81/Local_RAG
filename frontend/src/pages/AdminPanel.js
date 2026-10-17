import React, { useState } from 'react';
import AdminUsersTab from '../components/admin/AdminUsersTab';
import AuditLogsTab from '../components/admin/AuditLogsTab';
import QAStatsTab from '../components/admin/QAStatsTab';
import UserFormModal from '../components/admin/UserFormModal';
import XdpPanel from '../components/xdp/XdpPanel';
import useAdminPanelController from '../hooks/useAdminPanelController';
import '../css/AdminPanel.css';

const ADMIN_TABS = [
  { id: 'users', label: 'Account Management' },
  { id: 'logs', label: 'System Audit Log' },
  { id: 'qa', label: 'Question Analytics' },
  { id: 'xdp', label: 'XDP Firewall' },
];

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('users');
  const admin = useAdminPanelController(activeTab);

  if (admin.loading) return <div className="page-container">Loading control panel...</div>;

  return (
    <div className="page-container">
      <h2>System Control Panel</h2>
      {admin.error && <p className="error-msg">{admin.error}</p>}

      <div className="tab-navigation">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <AdminUsersTab
          users={admin.users}
          onCreate={admin.openCreateUser}
          onEdit={admin.openEditUser}
          onDelete={admin.handleDeleteUser}
          onChangeType={admin.handleUserTypeChange}
        />
      )}
      {activeTab === 'logs' && (
        <AuditLogsTab
          logs={admin.logs}
          filters={admin.filters}
          onFilterChange={admin.setFilters}
          onSearch={admin.loadLogs}
          onClear={admin.handleClearLogs}
        />
      )}
      {activeTab === 'qa' && <QAStatsTab stats={admin.stats} />}
      {activeTab === 'xdp' && <XdpPanel />}

      {admin.showUserModal && (
        <UserFormModal
          user={admin.editingUser}
          form={admin.userForm}
          onChange={admin.setUserForm}
          onClose={() => admin.setShowUserModal(false)}
          onSave={admin.submitUserForm}
        />
      )}
    </div>
  );
};

export default AdminPanel;
