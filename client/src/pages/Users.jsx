import { useState, useEffect } from 'react';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  ShieldCheck,
  Lock,
  Plus,
  X,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [creating, setCreating] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await authAPI.getUsers();
      setUsers(data.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    if (userId === currentUser._id) {
      toast.error("Cannot change your own role");
      return;
    }
    try {
      await authAPI.updateUser(userId, { role });
      toast.success('Role updated');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    if (userId === currentUser._id) {
      toast.error("Cannot lock your own account");
      return;
    }
    try {
      await authAPI.updateUser(userId, { isActive });
      toast.success(`User ${isActive ? 'unlocked' : 'locked'}`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await authAPI.createUser(newUser);
      toast.success('User created successfully');
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'viewer' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetting(true);
    try {
      await authAPI.resetPassword(passwordResetUser._id, newPassword);
      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setPasswordResetUser(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p className="text-muted">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h2>User Management</h2>
            <p>Manage users, roles, and access credentials</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>All Users ({users.length})</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '0.8rem' }}>
                        {u.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {u.name}
                        {u._id === currentUser._id && <span className="text-muted" style={{ fontWeight: 400 }}> (you)</span>}
                      </span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="form-select"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      disabled={u._id === currentUser._id}
                      style={{ width: '130px', padding: '8px 12px', fontSize: '0.85rem' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="logger">Logger</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-finalized' : 'badge-locked'}`}>
                      {u.isActive ? 'Active' : 'Locked'}
                    </span>
                  </td>
                  <td className="text-muted">
                    {format(new Date(u.createdAt), 'dd/MM/yyyy')}
                  </td>
                  <td>
                    {u._id !== currentUser._id ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Change Password"
                          onClick={() => {
                            setPasswordResetUser(u);
                            setShowPasswordModal(true);
                          }}
                        >
                          <Key size={16} />
                        </button>
                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-outline text-danger' : 'btn-success'}`}
                          onClick={() => handleToggleActive(u._id, !u.isActive)}
                          style={{ fontSize: '0.8rem' }}
                        >
                          {u.isActive ? (
                            <><Lock size={14} /> Lock</>
                          ) : (
                            <><ShieldCheck size={14} /> Unlock</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>No actions available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAddPassword ? "text" : "password"}
                      className="form-input"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={6}
                      style={{ paddingRight: '40px' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowAddPassword(!showAddPassword)}
                      style={{ 
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', 
                        background: 'none', border: 'none', color: 'var(--text-muted)', 
                        cursor: 'pointer', display: 'flex', padding: 0
                      }}
                    >
                      {showAddPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="viewer">Viewer (Read Only)</option>
                    <option value="logger">Logger (Create & Edit Reports)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && passwordResetUser && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleResetPassword}>
                <p style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Set a new password for <strong>{passwordResetUser.name}</strong>.
                </p>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showResetPassword ? "text" : "password"}
                      className="form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      autoFocus
                      style={{ paddingRight: '40px' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      style={{ 
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', 
                        background: 'none', border: 'none', color: 'var(--text-muted)', 
                        cursor: 'pointer', display: 'flex', padding: 0
                      }}
                    >
                      {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowPasswordModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={resetting}>
                    {resetting ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
