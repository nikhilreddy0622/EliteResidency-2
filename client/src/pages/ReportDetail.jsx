import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { reportAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import {
  ArrowLeft,
  Printer,
  Edit2,
  Lock,
  Unlock,
  Download
} from 'lucide-react';

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const printRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: report ? `Invoice_${report.invoiceNumber}` : 'Invoice',
  });

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const { data } = await reportAPI.getById(id);
      setReport(data.data);
    } catch (err) {
      toast.error('Failed to load invoice details');
      navigate('/reports');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async () => {
    const action = report.status === 'locked' ? 'unlock' : 'lock';
    if (window.confirm(`Are you sure you want to ${action} this invoice?`)) {
      try {
        await reportAPI.lock(report._id, report.status !== 'locked');
        toast.success(`Invoice ${action}ed successfully`);
        fetchReport(); // Refresh data
      } catch (err) {
        toast.error(err.response?.data?.message || `Failed to ${action} invoice`);
      }
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

  const isEditable = (user?.role === 'admin' || user?.role === 'logger') && report.status !== 'locked';

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
            
            {isEditable && (
              <Link to={`/reports/${report._id}/edit`} className="btn btn-outline">
                <Edit2 size={16} /> Edit
              </Link>
            )}

            {user?.role === 'admin' && (
              <button 
                className={`btn ${report.status === 'locked' ? 'btn-warning' : 'btn-danger'}`}
                onClick={handleToggleLock}
              >
                {report.status === 'locked' ? (
                  <><Unlock size={16} /> Unlock</>
                ) : (
                  <><Lock size={16} /> Lock</>
                )}
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
      </div>

      {/* Print Preview Container */}
      <div style={{ marginTop: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>Invoice Preview</h3>
        <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px' }}>
          <div ref={printRef} style={{ minWidth: '800px', maxWidth: '800px', margin: '0 auto', padding: '40px', background: 'white', color: 'black', fontFamily: 'Arial, sans-serif', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          
          {/* Top Bar 1 */}
          <div style={{ display: 'flex', border: '1px solid black', borderBottom: 'none', color: '#0d8aab', fontWeight: 'bold' }}>
            <div style={{ width: '33.33%', padding: '4px 8px', borderRight: '1px solid black' }}>GSTIN.{report.companyDetails?.gstin}</div>
            <div style={{ width: '33.33%', padding: '4px 8px', borderRight: '1px solid black', textAlign: 'center' }}>TAX INVOICE</div>
            <div style={{ width: '33.33%', padding: '4px 8px' }}>PAN NO. {report.companyDetails?.pan}</div>
          </div>
          
          {/* Top Bar 2 */}
          <div style={{ display: 'flex', border: '1px solid black', borderBottom: 'none', color: '#0d8aab', fontWeight: 'bold' }}>
            <div style={{ width: '33.33%', padding: '4px 8px', borderRight: '1px solid black' }}>STATE CODE. {report.companyDetails?.stateCode}</div>
            <div style={{ width: '33.33%', padding: '4px 8px', borderRight: '1px solid black', textAlign: 'center' }}>DATE. {format(new Date(report.invoiceDate), 'dd.MM.yyyy')}</div>
            <div style={{ width: '33.33%', padding: '4px 8px' }}>INVOICE NO. {report.invoiceNumber}</div>
          </div>

          {/* Header Section */}
          <div style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid black', borderBottom: 'none' }}>
            <h1 style={{ margin: '0 0 8px 0', color: '#d32f2f', fontFamily: '"Times New Roman", Times, serif', fontSize: '28px', fontWeight: 'bold' }}>
              {report.companyDetails?.name}
            </h1>
            <div style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '12px', lineHeight: '1.4' }}>
              {report.companyDetails?.address.split('\n').map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>

          {/* Delivery Challan Bar */}
          <div style={{ display: 'flex', border: '1px solid black', borderBottom: 'none', color: '#0d8aab', fontWeight: 'bold', padding: '4px 8px' }}>
            <div style={{ width: '33.33%' }}>DELIVERY CHALLAN NO.:</div>
            <div style={{ width: '33.33%', textAlign: 'center' }}>CASH/CREDIT BILL</div>
            <div style={{ width: '33.33%', textAlign: 'right' }}>E-mail : bfbprasad@gmail.com</div>
          </div>

          {/* Party Details Section */}
          <div style={{ display: 'flex', border: '1px solid black', borderBottom: 'none', minHeight: '120px' }}>
            <div style={{ width: '60%', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 'bold' }}>
              <div>NAME OF THE PARTY: {report.partyDetails?.name}</div>
              <div>PARTY ADDRESS: {report.partyDetails?.address}</div>
              <div style={{ paddingLeft: '40px' }}>{report.partyDetails?.state} State, Pin Code: {report.partyDetails?.stateCode}, Phone: {report.partyDetails?.phone}</div>
              <div style={{ marginTop: 'auto' }}>
                <div>HSN CODE : {report.lineItems?.[0]?.hsnCode || ''}</div>
                <div>PARTY GSTIN: {report.partyDetails?.gstin}</div>
                <div>PAN NO : {report.partyDetails?.gstin ? report.partyDetails.gstin.substring(2, 12) : ''}</div>
              </div>
            </div>
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', alignItems: 'center', fontWeight: 'bold', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 20px' }}>
                <div>PO. NO. {report.poNumber || ''}</div>
                <div>VENDOR CODE: 1021036</div>
              </div>
              <div style={{ marginTop: '8px' }}>{report.vehicleNo || ''}</div>
            </div>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', borderBottom: 'none' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid black' }}>
                <th style={{ borderRight: '1px solid black', padding: '8px', width: '6%' }}>S.NO.</th>
                <th style={{ borderRight: '1px solid black', padding: '8px', width: '44%' }}>PRODUCT DESCRIPTION</th>
                <th style={{ borderRight: '1px solid black', padding: '8px', width: '15%' }}>QTY IN No's</th>
                <th style={{ borderRight: '1px solid black', padding: '8px', width: '15%' }}>RATE in Rs.</th>
                <th style={{ padding: '8px', width: '20%' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {report.lineItems?.map((item, i) => (
                <tr key={i} style={{ borderBottom: i === report.lineItems.length - 1 ? '1px solid black' : 'none' }}>
                  <td style={{ borderRight: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{i + 1}</td>
                  <td style={{ borderRight: '1px solid black', padding: '8px', fontWeight: 'bold', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </td>
                  <td style={{ borderRight: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>
                    {item.quantity.toLocaleString('en-IN')}
                  </td>
                  <td style={{ borderRight: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>
                    {item.rate.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>
                    Rs. {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              
              {/* Empty filler rows to push total down if needed, but we'll just let it flow */}
              <tr style={{ borderBottom: '1px solid black', fontWeight: 'bold' }}>
                <td colSpan="2" style={{ borderRight: '1px solid black', padding: '8px', textAlign: 'center' }}>TOTAL</td>
                <td style={{ borderRight: '1px solid black', padding: '8px', textAlign: 'center' }}>
                  {report.lineItems?.reduce((sum, item) => sum + Number(item.quantity), 0).toLocaleString('en-IN')}
                </td>
                <td style={{ borderRight: '1px solid black', padding: '8px', textAlign: 'center' }}>
                  {report.lineItems?.[0]?.rate.toFixed(2)}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  Rs. {report.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Tax Breakdown */}
          <div style={{ display: 'flex', border: '1px solid black', borderBottom: 'none', borderTop: 'none', fontWeight: 'bold' }}>
            <div style={{ width: '50%', borderRight: '1px solid black' }}></div>
            <div style={{ width: '50%' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <div style={{ width: '60%', padding: '4px 8px', borderRight: '1px solid black' }}>TOTAL AMOUNT =</div>
                <div style={{ width: '40%', padding: '4px 8px', textAlign: 'right' }}>Rs. {report.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <div style={{ width: '60%', padding: '4px 8px', borderRight: '1px solid black' }}>ADD CGST : {report.cgstRate}%</div>
                <div style={{ width: '40%', padding: '4px 8px', textAlign: 'right' }}>{report.cgstAmount > 0 ? `Rs. ${report.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'NILL'}</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <div style={{ width: '60%', padding: '4px 8px', borderRight: '1px solid black' }}>ADD SGST : {report.sgstRate}%</div>
                <div style={{ width: '40%', padding: '4px 8px', textAlign: 'right' }}>{report.sgstAmount > 0 ? `Rs. ${report.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'NILL'}</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <div style={{ width: '60%', padding: '4px 8px', borderRight: '1px solid black' }}>ADD IGST : {report.igstRate > 0 ? `${report.igstRate}%` : ''}</div>
                <div style={{ width: '40%', padding: '4px 8px', textAlign: 'right' }}>{report.igstAmount > 0 ? `Rs. ${report.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'NILL'}</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <div style={{ width: '60%', padding: '4px 8px', borderRight: '1px solid black' }}>TOTAL</div>
                <div style={{ width: '40%', padding: '4px 8px', textAlign: 'right' }}>Rs. {report.grandTotal?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>

          {/* Amount in Words */}
          <div style={{ padding: '4px 8px', border: '1px solid black', borderBottom: 'none', borderTop: 'none', fontWeight: 'bold' }}>
            AMOUNT IN WORDS : {report.amountInWords}
          </div>

          {/* Bank & Signature */}
          <div style={{ display: 'flex', border: '1px solid black', fontWeight: 'bold' }}>
            <div style={{ width: '50%', padding: '8px', borderRight: '1px solid black', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ textDecoration: 'underline', textAlign: 'center' }}>BANK DETAILS</div>
              <div>{report.companyDetails?.name}</div>
              <div>BANK A/C NO : 22962000000396</div>
              <div>RTGS/IFSC CODE : HDFC0002296</div>
              <div>HDFC BANK</div>
              <div>BHADRACHALAM -507111</div>
              <div style={{ marginTop: 'auto' }}>NOTE: DETAILS SHEET ENCLOSED HERE WITH</div>
            </div>
            <div style={{ width: '50%', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>For, {report.companyDetails?.name}</div>
              <div style={{ marginTop: '60px' }}>AUTHORISED SIGNATURE</div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
