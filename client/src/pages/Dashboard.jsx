import { useState, useEffect } from 'react';
import { reportAPI, auditAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  FileText,
  Lock,
  Clock,
  Activity,
  ArrowRight
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, finalized: 0, locked: 0, totalAmount: 0 });
  const [recentReports, setRecentReports] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [reportsRes, logsRes] = await Promise.all([
        reportAPI.getAll({ limit: 5 }),
        user?.role !== 'viewer' ? auditAPI.getAll({ limit: 5 }) : Promise.resolve({ data: { data: [] } })
      ]);

      const reports = reportsRes.data.data;
      
      const draft = reportsRes.data.pagination.total || 0; // Total overall count requires a separate stats endpoint ideally
      
      let total = 0, locked = 0, finalized = 0, amount = 0;
      
      if (reportsRes.data.pagination.total) {
        total = reportsRes.data.pagination.total;
      }

      reports.forEach(r => {
        if (r.status === 'locked') locked++;
        else if (r.status === 'finalized') finalized++;
        amount += r.grandTotal || 0;
      });

      setStats({
        total,
        finalized,
        locked,
        totalAmount: amount
      });
      setRecentReports(reports);
      setRecentLogs(logsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    const map = {
      created: 'badge-created',
      edited: 'badge-edited',
      locked: 'badge-locked',
      unlocked: 'badge-unlocked',
      deleted: 'badge-deleted'
    };
    return map[action] || 'badge-draft';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p className="text-muted">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Welcome back, {user?.name?.split(' ')[0]}</h2>
        <p>Here is an overview of Elite Residency operations</p>
      </div>

      {user?.role !== 'viewer' && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <FileText size={24} strokeWidth={1.5} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Invoices</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success">
              <Activity size={24} strokeWidth={1.5} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.finalized}</div>
              <div className="stat-label">Finalized</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon danger">
              <Lock size={24} strokeWidth={1.5} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.locked}</div>
              <div className="stat-label">Locked</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning">
              <span style={{ fontSize: '1.4rem', fontWeight: 600, fontFamily: 'Playfair Display' }}>₹</span>
            </div>
            <div className="stat-content">
              <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCurrency(stats.totalAmount)}</div>
              <div className="stat-label">Recent Volume</div>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid" style={user?.role === 'viewer' ? { display: 'block' } : {}}>
        
        {/* Recent Reports */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '24px 24px 0', borderBottom: 'none' }}>
            <h3>Recent Invoices</h3>
            <Link to="/reports" className="btn btn-ghost btn-sm">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="table-wrapper" style={{ padding: '0 24px 24px' }}>
            {recentReports.length > 0 ? (
              <table style={{ marginTop: '12px' }}>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Party</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map(report => (
                    <tr key={report._id}>
                      <td>
                        <Link to={`/reports/${report._id}`} style={{ fontWeight: 600 }}>
                          {report.invoiceNumber}
                        </Link>
                      </td>
                      <td>
                        <div style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.partyDetails?.name || '-'}
                        </div>
                      </td>
                      <td className="text-muted">{format(new Date(report.invoiceDate), 'dd/MM/yyyy')}</td>
                      <td>
                        <span className={`badge badge-${report.status}`}>
                          {report.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <p>No invoices created yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        {user?.role !== 'viewer' && (
          <div className="card">
            <div className="card-header">
              <h3>Recent Activity</h3>
              <Link to="/audit-logs" className="btn btn-ghost btn-sm">All Logs <ArrowRight size={14} /></Link>
            </div>
            
            <div className="timeline" style={{ marginTop: '24px' }}>
              {recentLogs.length > 0 ? (
                recentLogs.map(log => (
                  <div className="timeline-item" key={log._id}>
                    <div className={`timeline-dot ${log.action}`}></div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <div className="timeline-title">
                          <span style={{ color: 'var(--accent-primary)' }}>{log.performedBy?.name || 'Unknown'}</span> 
                          {' '} {log.action} invoice 
                          {' '} <Link to={`/reports/${log.reportId}`} style={{ fontWeight: 600 }}>{log.invoiceNumber}</Link>
                        </div>
                        <div className="timeline-date">
                          <Clock size={12} /> {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm')}
                        </div>
                      </div>
                      {log.changes?.length > 0 && (
                        <div className="timeline-body">
                          Updated {log.changes.length} field(s)
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <p>No recent activity found.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
