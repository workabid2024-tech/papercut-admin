import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Edit, Search, RefreshCw, DollarSign, FolderPlus, Folder } from 'lucide-react';

const PaperCutAdmin = () => {
  const [config, setConfig] = useState({
    serverUrl: localStorage.getItem('papercut_serverUrl') || 'https://papercut.yourdomain.com:9192/rpc/api/xmlrpc',
    authToken: localStorage.getItem('papercut_authToken') || ''
  });
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error

  // Form states
  const [userForm, setUserForm] = useState({
    username: '',
    fullname: '',
    email: '',
    balance: 0,
    pin: ''
  });

  const [groupForm, setGroupForm] = useState({
    groupName: '',
    newGroupName: ''
  });

  // Save config to localStorage
  const saveConfig = () => {
    localStorage.setItem('papercut_serverUrl', config.serverUrl);
    localStorage.setItem('papercut_authToken', config.authToken);
    alert('Configuration saved successfully!');
  };

  // Test connection
  const testConnection = async () => {
    if (!config.serverUrl || !config.authToken) {
      alert('Please enter Server URL and Auth Token first!');
      return;
    }
    
    setConnectionStatus('connecting');
    
    // Try to get server version as a test
    const result = await callPaperCutAPI('getServerVersion');
    
    if (result !== null) {
      setConnectionStatus('connected');
      alert(`✅ Connected successfully!\nServer Version: ${result}`);
    } else {
      setConnectionStatus('error');
      alert('❌ Connection failed! Please check your URL and Auth Token.');
    }
  };

  // PaperCut XML-RPC API Call
  const callPaperCutAPI = async (method, params = []) => {
    try {
      const xmlBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>api.${method}</methodName>
  <params>
    <param><value><string>${config.authToken}</string></value></param>
    ${params.map(p => {
      if (typeof p === 'number') {
        return `<param><value><double>${p}</double></value></param>`;
      } else if (typeof p === 'boolean') {
        return `<param><value><boolean>${p ? 1 : 0}</boolean></value></param>`;
      } else {
        return `<param><value><string>${p}</string></value></param>`;
      }
    }).join('\n')}
  </params>
</methodCall>`;

      const response = await fetch(config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
        },
        body: xmlBody
      });

      const text = await response.text();
      
      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      // Check for fault
      const fault = xmlDoc.querySelector('fault');
      if (fault) {
        const faultString = xmlDoc.querySelector('member > name:contains("faultString")').nextElementSibling.textContent;
        throw new Error(faultString);
      }

      // Extract value
      const valueElement = xmlDoc.querySelector('methodResponse params param value');
      if (valueElement) {
        const stringValue = valueElement.querySelector('string')?.textContent;
        const arrayValue = valueElement.querySelector('array');
        
        if (stringValue !== undefined) {
          return stringValue;
        } else if (arrayValue) {
          const values = Array.from(arrayValue.querySelectorAll('data > value')).map(v => 
            v.querySelector('string')?.textContent || ''
          );
          return values;
        }
      }
      
      return null;
    } catch (error) {
      console.error('API Error:', error);
      alert(`API Error: ${error.message}`);
      return null;
    }
  };

  // Load Users
  const loadUsers = async () => {
    setLoading(true);
    const offset = 0;
    const limit = 1000;
    const userList = await callPaperCutAPI('listUserAccounts', [offset, limit]);
    if (userList && Array.isArray(userList)) {
      setUsers(userList);
    }
    setLoading(false);
  };

  // Load Groups
  const loadGroups = async () => {
    setLoading(true);
    const offset = 0;
    const limit = 1000;
    const groupList = await callPaperCutAPI('listUserGroups', [offset, limit]);
    if (groupList && Array.isArray(groupList)) {
      setGroups(groupList);
    }
    setLoading(false);
  };

  // Create User
  const createUser = async () => {
    if (!userForm.username || !userForm.fullname) {
      alert('Username and Full Name are required!');
      return;
    }
    
    const success = await callPaperCutAPI('addNewUser', [userForm.username]);
    if (success !== null) {
      // Set additional properties
      await callPaperCutAPI('setUserProperty', [userForm.username, 'full-name', userForm.fullname]);
      if (userForm.email) {
        await callPaperCutAPI('setUserProperty', [userForm.username, 'email', userForm.email]);
      }
      if (userForm.balance > 0) {
        await callPaperCutAPI('adjustUserAccountBalance', [userForm.username, userForm.balance, 'Initial balance']);
      }
      
      alert('User created successfully!');
      setShowModal(false);
      resetUserForm();
      loadUsers();
    }
  };

  // Delete User
  const deleteUser = async (username) => {
    if (!window.confirm(`Are you sure you want to delete user: ${username}?`)) return;
    
    const success = await callPaperCutAPI('deleteExistingUser', [username, false]);
    if (success !== null) {
      alert('User deleted successfully!');
      loadUsers();
    }
  };

  // Create Group
  const createGroup = async () => {
    if (!groupForm.groupName) {
      alert('Group name is required!');
      return;
    }
    
    const success = await callPaperCutAPI('addNewGroup', [groupForm.groupName]);
    if (success !== null) {
      alert('Group created successfully!');
      setShowModal(false);
      resetGroupForm();
      loadGroups();
    }
  };

  // Rename Group
  const renameGroup = async () => {
    if (!groupForm.groupName || !groupForm.newGroupName) {
      alert('Both old and new group names are required!');
      return;
    }
    
    const success = await callPaperCutAPI('renameUserGroup', [groupForm.groupName, groupForm.newGroupName]);
    if (success !== null) {
      alert('Group renamed successfully!');
      setShowModal(false);
      resetGroupForm();
      loadGroups();
    }
  };

  // Delete Group
  const deleteGroup = async (groupName) => {
    if (!window.confirm(`Are you sure you want to delete group: ${groupName}?`)) return;
    
    const success = await callPaperCutAPI('deleteExistingGroup', [groupName]);
    if (success !== null) {
      alert('Group deleted successfully!');
      loadGroups();
    }
  };

  // Add User to Group
  const addUserToGroup = async (username, groupName) => {
    const success = await callPaperCutAPI('addUserToGroup', [username, groupName]);
    if (success !== null) {
      alert(`User ${username} added to group ${groupName}!`);
    }
  };

  // Remove User from Group
  const removeUserFromGroup = async (username, groupName) => {
    const success = await callPaperCutAPI('removeUserFromGroup', [username, groupName]);
    if (success !== null) {
      alert(`User ${username} removed from group ${groupName}!`);
    }
  };

  // Get User Groups
  const getUserGroups = async (username) => {
    const groupList = await callPaperCutAPI('getUserGroups', [username]);
    return groupList || [];
  };

  const resetUserForm = () => {
    setUserForm({ username: '', fullname: '', email: '', balance: 0, pin: '' });
  };

  const resetGroupForm = () => {
    setGroupForm({ groupName: '', newGroupName: '' });
  };

  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  const filteredUsers = users.filter(u => 
    u.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">PaperCut Admin Panel</h1>
          <p className="text-blue-100 mt-1">Complete User & Group Management</p>
        </div>
      </div>

      {/* Config Section */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Server Configuration</h2>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  ✓ Connected
                </span>
              )}
              {connectionStatus === 'error' && (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  ✗ Error
                </span>
              )}
              {connectionStatus === 'connecting' && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                  ⟳ Connecting...
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">Server URL</label>
              <input
                type="text"
                value={config.serverUrl}
                onChange={(e) => setConfig({...config, serverUrl: e.target.value})}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://papercut.yourdomain.com:9192/rpc/api/xmlrpc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Auth Token</label>
              <input
                type="password"
                value={config.authToken}
                onChange={(e) => setConfig({...config, authToken: e.target.value})}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your auth token"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Test Connection
            </button>
            <button
              onClick={saveConfig}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 p-4 font-medium ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              <Users className="inline mr-2" size={20} />
              Users
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 p-4 font-medium ${activeTab === 'groups' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              <Folder className="inline mr-2" size={20} />
              Groups
            </button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 p-2 border rounded"
                  placeholder={`Search ${activeTab}...`}
                />
              </div>
            </div>
            
            <button
              onClick={() => activeTab === 'users' ? loadUsers() : loadGroups()}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw size={20} />
              Refresh
            </button>

            {activeTab === 'users' && (
              <button
                onClick={() => openModal('createUser')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <UserPlus size={20} />
                New User
              </button>
            )}

            {activeTab === 'groups' && (
              <>
                <button
                  onClick={() => openModal('createGroup')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                >
                  <FolderPlus size={20} />
                  New Group
                </button>
                <button
                  onClick={() => openModal('renameGroup')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center gap-2"
                >
                  <Edit size={20} />
                  Rename Group
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="animate-spin mx-auto mb-2" size={32} />
              <p>Loading...</p>
            </div>
          ) : activeTab === 'users' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-left">Username</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3">{user}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const userGroups = await getUserGroups(user);
                              alert(`Groups for ${user}:\n${userGroups.join('\n') || 'No groups'}`);
                            }}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                          >
                            View Groups
                          </button>
                          <button
                            onClick={() => {
                              const group = prompt('Enter group name to add user to:');
                              if (group) addUserToGroup(user, group);
                            }}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                          >
                            Add to Group
                          </button>
                          <button
                            onClick={() => {
                              const group = prompt('Enter group name to remove user from:');
                              if (group) removeUserFromGroup(user, group);
                            }}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
                          >
                            Remove from Group
                          </button>
                          <button
                            onClick={() => deleteUser(user)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No users found. Click "Refresh" to load users.
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-left">Group Name</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3">{group}</td>
                      <td className="p-3">
                        <button
                          onClick={() => deleteGroup(group)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredGroups.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No groups found. Click "Refresh" to load groups.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            {modalType === 'createUser' && (
              <>
                <h2 className="text-xl font-bold mb-4">Create New User</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Username *</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={userForm.fullname}
                      onChange={(e) => setUserForm({...userForm, fullname: e.target.value})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Initial Balance</label>
                    <input
                      type="number"
                      value={userForm.balance}
                      onChange={(e) => setUserForm({...userForm, balance: parseFloat(e.target.value) || 0})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={createUser}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {setShowModal(false); resetUserForm();}}
                    className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {modalType === 'createGroup' && (
              <>
                <h2 className="text-xl font-bold mb-4">Create New Group</h2>
                <div>
                  <label className="block text-sm font-medium mb-1">Group Name *</label>
                  <input
                    type="text"
                    value={groupForm.groupName}
                    onChange={(e) => setGroupForm({...groupForm, groupName: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={createGroup}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {setShowModal(false); resetGroupForm();}}
                    className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {modalType === 'renameGroup' && (
              <>
                <h2 className="text-xl font-bold mb-4">Rename Group</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Current Group Name *</label>
                    <input
                      type="text"
                      value={groupForm.groupName}
                      onChange={(e) => setGroupForm({...groupForm, groupName: e.target.value})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">New Group Name *</label>
                    <input
                      type="text"
                      value={groupForm.newGroupName}
                      onChange={(e) => setGroupForm({...groupForm, newGroupName: e.target.value})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={renameGroup}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {setShowModal(false); resetGroupForm();}}
                    className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperCutAdmin;