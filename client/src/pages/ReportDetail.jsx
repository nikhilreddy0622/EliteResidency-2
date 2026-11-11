import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { reportAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import InvoicePaper from '../components/InvoicePaper';
import {
  ArrowLeft,
  Printer,
  Download,
  Edit2,
  Lock
} from 'lucide-react';

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState({ paymentStatus: 'pending', paidAmount: 0 });
  const [savingPayment, setSavingPayment] = useState(false);

  const printRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: report ? `Invoice_${report.invoiceNumber.replace(/[\\/]/g, '-')}` : 'Invoice',
    pageStyle: '@page { size: A4 portrait; margin: 5mm; } html, body { margin: 0; padding: 0; background: #fff; }',
  });

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const { data } = await reportAPI.getById(id);
      setReport(data.data);
      setPayment({ paymentStatus: data.data.paymentStatus || 'pending', paidAmount: data.data.paidAmount || 0 });
    } catch (err) {
      toast.error('Failed to load invoice details');
      navigate('/reports');
    } finally {
      setLoading(false);
    }
  };

  const savePayment = async () => {
    setSavingPayment(true);
    try {
      await reportAPI.updatePayment(report._id, payment);
      toast.success('Payment status updated');
      fetchReport();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update payment status');
    } finally { setSavingPayment(false); }
  };

  const handleToggleLock = async () => {
    if (window.confirm('Lock this invoice? It cannot be changed after confirmation.')) {
      try {
        await reportAPI.lock(report._id, true);
        toast.success('Invoice locked successfully');
        fetchReport(); // Refresh data
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to lock invoice');
      }
    }
  };

  const downloadEInvoice = async () => {
    try {
      const response = await reportAPI.downloadEInvoice(report._id);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `E-INVOICE_${report.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, '-')}.json`;
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
      toast.success('E-invoice JSON downloaded');
    } catch (err) {
      toast.error('Could not generate the e-invoice JSON');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p className="text-muted">Loading invoice details...</p>
      </div>
    );
  }

  if (!report) return null;

  const isOwner = report.createdBy?._id === user?._id || report.createdBy === user?._id;
  const isEditable = user?.role === 'admin' || (report.status === 'draft' && user?.role === 'logger' && isOwner);
  const canLock = report.status === 'draft' && (user?.role === 'admin' || (user?.role === 'logger' && isOwner));
  const canUpdatePayment = user?.role === 'admin' || (user?.role === 'logger' && isOwner);

  return (
    <div className="fade-in">
      {/* Header Actions */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-header-row" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-ghost btn-icon" onClick={() => navigate('/reports')}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                Invoice {report.invoiceNumber}
                <span className={`badge badge-${report.status}`} style={{ fontSize: '0.7rem' }}>
                  {report.status}
                </span>
              </h2>
              <p style={{ margin: 0 }}>Created on {format(new Date(report.createdAt), 'dd MMM yyyy, HH:mm')}</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} /> Print / PDF
            </button>
            <button className="btn btn-outline" onClick={downloadEInvoice}>
              <Download size={16} /> E-Invoice JSON
            </button>
            
            {isEditable && (
              <Link to={`/reports/${report._id}/edit`} className="btn btn-outline">
                <Edit2 size={16} /> Edit
              </Link>
            )}

            {canLock && (
              <button 
                className="btn btn-warning"
                onClick={handleToggleLock}
              >
                <><Lock size={16} /> Lock invoice</>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="responsive-grid">
        {/* Info Cards */}
        <div className="card">
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Billed To</h4>
          <h3 style={{ color: 'var(--accent-primary)', marginBottom: '8px' }}>{report.partyDetails?.name}</h3>
          <p style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', marginBottom: '8px' }}>{report.partyDetails?.address}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
            <div><span className="text-muted">GSTIN:</span> {report.partyDetails?.gstin || '-'}</div>
            <div><span className="text-muted">State:</span> {report.partyDetails?.state || '-'} ({report.partyDetails?.stateCode || '-'})</div>
          </div>
        </div>

        <div className="card">
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Invoice Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
            <div>
              <div className="text-muted" style={{ marginBottom: '4px' }}>Invoice Date</div>
              <div style={{ fontWeight: 500 }}>{format(new Date(report.invoiceDate), 'dd/MM/yyyy')}</div>
            </div>
            <div>
              <div className="text-muted" style={{ marginBottom: '4px' }}>PO Number</div>
              <div style={{ fontWeight: 500 }}>{report.poNumber || '-'}</div>
            </div>
            <div>
              <div className="text-muted" style={{ marginBottom: '4px' }}>Vehicle No</div>
              <div style={{ fontWeight: 500 }}>{report.vehicleNo || '-'}</div>
            </div>
            <div>
              <div className="text-muted" style={{ marginBottom: '4px' }}>Total Amount</div>
              <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>₹ {(report.grandTotal || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Payment Status</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
            <label><span className="form-label">Status</span><select className="form-select" disabled={!canUpdatePayment} value={payment.paymentStatus} onChange={(e) => { const status = e.target.value; setPayment({ paymentStatus: status, paidAmount: status === 'paid' ? report.grandTotal : status === 'pending' ? 0 : payment.paidAmount }); }}><option value="pending">Pending</option><option value="partial">Partially Paid</option><option value="paid">Paid</option></select></label>
            <label><span className="form-label">Paid Amount</span><input className="form-input" type="number" min="0" max={report.grandTotal} step="0.01" disabled={!canUpdatePayment || payment.paymentStatus !== 'partial'} value={payment.paidAmount} onChange={(e) => setPayment({ ...payment, paidAmount: e.target.value })} /></label>
            <div><span className="text-muted">Balance Amount</span><div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginTop: '6px' }}>₹ {Math.max(0, report.grandTotal - (Number(payment.paidAmount) || 0)).toFixed(2)}</div></div>
            {canUpdatePayment && <button className="btn btn-primary" onClick={savePayment} disabled={savingPayment}>{savingPayment ? 'Saving…' : 'Save Payment'}</button>}
          </div>
        </div>
      </div>

      {/* Print Preview Container */}
      <div style={{ marginTop: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>Invoice Preview</h3>
        <div className="inv-shell">
          <InvoicePaper ref={printRef} report={report} />
        </div>
      </div>
    </div>
  );
}
