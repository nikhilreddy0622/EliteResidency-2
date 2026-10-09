import { useState, useEffect } from 'react';
import { auditAPI, authAPI } from '../api';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import {
  Search,
  RefreshCcw,
  Clock,
  Eye,
  ClipboardList
} from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  // Filters
  const [action, setAction] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, action, performedBy, startDate, endDate]);

  const fetchUsers = async () => {
    try {
      const { data } = await authAPI.getUsers();
      setUsers(data.data);
    } catch {
      // Non-admin users won't have access, that's fine
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (action) params.action = action;
      if (performedBy) params.performedBy = performedBy;
      if (invoiceNumber) params.invoiceNumber = invoiceNumber;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const { data } = await auditAPI.getAll(params);
      setLogs(data.data);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleClear = () => {
    setAction('');
    setPerformedBy('');
    setInvoiceNumber('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setTimeout(fetchLogs, 0);
  };

  const getActionColor = (action) => {
    const map = {
      created: 'badge-created',
      edited: 'badge-edited',
      locked: 'badge-locked',
      unlocked: 'badge-unlocked',
      deleted: 'badge-deleted',
      status_changed: 'badge-draft'
    };
    return map[action] || 'badge-draft';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Audit Logs</h2>
        <p>Complete record of all actions performed on reports</p>
      </div>

      {/* Filters */}
      <form className="filters-bar" onSubmit={handleSearch}>
        <div className="filter-item">
          <input
            type="text"
            className="form-input"
            placeholder="Search by Invoice #..."
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>
        <div className="filter-item" style={{ minWidth: '140px' }}>
          <select className="form-select" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All Actions</option>
            <option value="created">Created</option>
            <option value="edited">Edited</option>
            <option value="locked">Locked</option>
            <option value="unlocked">Unlocked</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
        {users.length > 0 && (
          <div className="filter-item" style={{ minWidth: '140px' }}>
            <select className="form-select" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)}>
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="filter-item">
          <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="filter-item">
          <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="filter-actions">
          <button type="submit" className="btn btn-primary btn-sm">
            <Search size={16} /> Search
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleClear}>
            <RefreshCcw size={16} /> Clear
          </button>
        </div>
      </form>

      {/* Logs Table */}
      <div className="table-container">
        <div className="table-header">
          <h3>Activity Log ({pagination.total || 0} records)</h3>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-container">
              <div className="spinner" />
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardList size={64} strokeWidth={1} />
              </div>
              <h4>No audit logs found</h4>
              <p>Audit logs will appear here once reports are created</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Invoice #</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Role</th>
                  <th>Version</th>
                  <th>Changes</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {format(new Date(log.createdAt), 'dd/MM/yyyy')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {format(new Date(log.createdAt), 'HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link
                        to={`/reports/${log.reportId}`}
                        style={{ fontWeight: 600, color: 'var(--accent-primary-hover)' }}
                      >
                        {log.invoiceNumber}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {log.performedBy?.name || 'Unknown'}
                    </td>
                    <td>
                      <span className="text-muted" style={{ textTransform: 'capitalize' }}>
                        {log.performedBy?.role || '-'}
                      </span>
                    </td>
                    <td className="text-muted">v{log.version}</td>
                    <td>
                      {log.changes?.length > 0 ? (
                        <span className="text-muted">{log.changes.length} field(s)</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setSelectedLog(log)}
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Audit Log Detail</h3>
              <button className="modal-close" onClick={() => setSelectedLog(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row" style={{ marginBottom: '24px' }}>
                <div>
                  <div className="form-label">Invoice Number</div>
                  <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '1.1rem' }}>{selectedLog.invoiceNumber}</div>
                </div>
                <div>
                  <div className="form-label">Action</div>
                  <span className={`badge ${getActionColor(selectedLog.action)}`}>{selectedLog.action}</span>
                </div>
                <div>
                  <div className="form-label">Performed By</div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {selectedLog.performedBy?.name}
                    <span className="text-muted"> ({selectedLog.performedBy?.role})</span>
                  </div>
                </div>
                <div>
                  <div className="form-label">Date & Time</div>
                  <div style={{ color: 'var(--text-primary)' }}>{format(new Date(selectedLog.createdAt), 'dd/MM/yyyy HH:mm:ss')}</div>
                </div>
              </div>

              {selectedLog.changes?.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>Changes Made</h4>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-color)' }}>
                    {selectedLog.changes.map((change, i) => (
                      <div className="change-item" key={i}>
                        <span className="change-field">{change.field}</span>
                        <div>
                          {typeof change.oldValue !== 'object' ? (
                            <>
                              <span className="change-old">{String(change.oldValue ?? '-')}</span>
                              {' → '}
                              <span className="change-new">{String(change.newValue ?? '-')}</span>
                            </>
                          ) : (
                            <span className="text-muted">[Complex data updated]</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
