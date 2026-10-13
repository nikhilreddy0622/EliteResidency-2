import { useState, useEffect } from 'react';
import { authAPI, reportAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  Search,
  RefreshCcw,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Lock,
  FileText
  ,Download
} from 'lucide-react';

export default function Reports({ mineOnly = false }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loggerId, setLoggerId] = useState('');
  const [loggers, setLoggers] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [exportMode, setExportMode] = useState('monthly');
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [page, status, startDate, endDate, loggerId, paymentStatus, mineOnly]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    authAPI.getUsers().then(({ data }) => setLoggers(data.data.filter((account) => account.role === 'logger'))).catch(() => {
      toast.error('Failed to load logger list');
    });
  }, [user?.role]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (status) params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search) params.search = search;
      if (loggerId && user?.role === 'admin') params.loggerId = loggerId;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (mineOnly && user?.role === 'logger') params.mine = 'true';

      const { data } = await reportAPI.getAll(params);
      setReports(data.data);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    setPage(1);
    fetchReports();
  };

  const handleClear = () => {
    setStatus('');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setLoggerId('');
    setPaymentStatus('');
    setPage(1);
    setTimeout(fetchReports, 0);
  };

  const handleExport = async () => {
    const params = { status, paymentStatus, loggerId, mine: mineOnly ? 'true' : undefined };
    if (exportMode === 'monthly') params.month = exportMonth;
    else {
      if (!startDate || !endDate) { toast.error('Choose both dates for a date-range export'); return; }
      params.startDate = startDate; params.endDate = endDate;
    }
    Object.keys(params).forEach((key) => !params[key] && delete params[key]);
    setExporting(true);
    try {
      const response = await reportAPI.exportGstSales(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `GST-SALES-${params.month || `${params.startDate}_to_${params.endDate}`}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
      toast.success('GST sales workbook downloaded');
    } catch (err) {
      toast.error('Could not generate the GST sales workbook');
    } finally { setExporting(false); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this invoice? This cannot be undone.')) {
      try {
        await reportAPI.delete(id);
        toast.success('Invoice deleted successfully');
        fetchReports();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete invoice');
      }
    }
  };

  const handleToggleLock = async (report) => {
    if (window.confirm('Lock this invoice? It cannot be changed after confirmation.')) {
      try {
        await reportAPI.lock(report._id, true);
        toast.success('Invoice locked successfully');
        fetchReports();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to lock invoice');
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h2>{mineOnly ? 'My Invoices' : 'Invoices & Reports'}</h2>
            <p>{mineOnly ? 'View and manage invoices you created' : 'Manage, track, and generate invoices'}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {(user?.role === 'admin' || user?.role === 'logger') && <Link to="/reports/new" className="btn btn-primary"><Plus size={18} /> New Invoice</Link>}
            {(user?.role === 'admin' || user?.role === 'logger') && <button type="button" className="btn btn-outline" onClick={handleExport} disabled={exporting}><Download size={18} /> {exporting ? 'Preparing…' : 'Download GST Excel'}</button>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <form className="filters-bar" onSubmit={handleSearch}>
        <div className="filter-item">
          <input
            type="text"
            className="form-input"
            placeholder="Search invoice #, party, PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-item" style={{ minWidth: '140px' }}>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="locked">Locked</option>
          </select>
        </div>
        <div className="filter-item" style={{ minWidth: '150px' }}>
          <select className="form-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="">All Payments</option><option value="pending">Payment Pending</option><option value="partial">Partially Paid</option><option value="paid">Paid</option>
          </select>
        </div>
        {user?.role === 'admin' && <div className="filter-item" style={{ minWidth: '180px' }}>
          <select className="form-select" value={loggerId} onChange={(e) => setLoggerId(e.target.value)}>
            <option value="">All logger accounts</option>
            {loggers.map((logger) => <option key={logger._id} value={logger._id}>{logger.name}</option>)}
          </select>
        </div>}
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
        {(user?.role === 'admin' || user?.role === 'logger') && <div className="filter-item" style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '250px' }}>
          <select className="form-select" value={exportMode} onChange={(e) => setExportMode(e.target.value)} style={{ minWidth: '110px' }}><option value="monthly">Monthly</option><option value="range">Date range</option></select>
          {exportMode === 'monthly' && <input type="month" className="form-input" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} />}
        </div>}
      </form>

      {/* Table */}
      <div className="table-container">
        <div className="table-header">
          <h3>Results ({pagination.total || 0})</h3>
        </div>
        
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-container">
              <div className="spinner" />
            </div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FileText size={64} strokeWidth={1} />
              </div>
              <h4>No invoices found</h4>
              <p>Try adjusting your filters or create a new invoice</p>
              {(user?.role === 'admin' || user?.role === 'logger') && (
                <Link to="/reports/new" className="btn btn-primary mt-4" style={{ marginTop: '20px' }}>
                  Create Invoice
                </Link>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Party Name</th>
                  {user?.role === 'admin' && <th>Created By</th>}
                  <th>Vehicle No</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report._id}>
                    <td>
                      <Link to={`/reports/${report._id}`} style={{ fontWeight: 600 }}>
                        {report.invoiceNumber}
                      </Link>
                    </td>
                    <td className="text-muted">
                      {format(new Date(report.invoiceDate), 'dd/MM/yyyy')}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {report.partyDetails?.name || '-'}
                    </td>
                    {user?.role === 'admin' && <td>{report.createdBy?.name || 'Unknown'}</td>}
                    <td>{report.vehicleNo || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(report.grandTotal)}</td>
                    <td><span className={`badge badge-${report.paymentStatus === 'paid' ? 'locked' : report.paymentStatus === 'partial' ? 'draft' : 'pending'}`}>{report.paymentStatus === 'partial' ? 'partially paid' : report.paymentStatus || 'pending'}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(report.balanceAmount ?? report.grandTotal)}</td>
                    <td>
                      <span className={`badge badge-${report.status}`}>
                        {report.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Link to={`/reports/${report._id}`} className="btn btn-ghost btn-icon btn-sm" title="View">
                          <Eye size={16} />
                        </Link>
                        
                        {(user?.role === 'admin' || (user?.role === 'logger' && report.createdBy?._id === user._id && report.status === 'draft')) && (
                          <Link to={`/reports/${report._id}/edit`} className="btn btn-ghost btn-icon btn-sm" title="Edit">
                            <Edit2 size={16} />
                          </Link>
                        )}

                        {(user?.role === 'admin' || (user?.role === 'logger' && report.createdBy?._id === user._id)) && report.status === 'draft' && (
                          <>
                            <button
                              className="btn btn-ghost btn-icon btn-sm text-warning"
                              onClick={() => handleToggleLock(report)}
                              title="Lock invoice"
                            >
                              <Lock size={16} />
                            </button>
                          </>
                        )}
                        {user?.role === 'admin' && (
                          <>
                            <button
                              className="btn btn-ghost btn-icon btn-sm text-danger"
                              onClick={() => handleDelete(report._id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
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
    </div>
  );
}
