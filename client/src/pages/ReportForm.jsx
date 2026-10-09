import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { reportAPI } from '../api';
import { toast } from 'react-toastify';
import { toWords } from 'number-to-words';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Calculator
} from 'lucide-react';

const initialCompanyDetails = {
  name: 'BHARATH ELITE ENTERPRISES',
  address: 'Office D.NO.:2-295 ,OPP- EAST GATE, SARAPAKA , BURGUMPAHAD MANDAL,\nSARAPAKA -507128 BHADRADRI KOTHAGUDEM DT, TELANGANA STATE\nPh No: 08743-232929 ; 995999-6666 VENDOR CODE: 1021036',
  gstin: '36AJVPP5821A1Z2',
  pan: 'AJVPP5821A',
  state: 'Telangana',
  stateCode: '36'
};

const initialPartyDetails = {
  name: '',
  address: '',
  gstin: '',
  state: '',
  stateCode: '',
  phone: ''
};

export default function ReportForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  // Form State
  const [formData, setFormData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    poNumber: '',
    vehicleNo: '',
    status: 'draft',
    companyDetails: { ...initialCompanyDetails },
    partyDetails: { ...initialPartyDetails },
    lineItems: [
      { description: '', hsnCode: '', quantity: 1, uom: 'NOS', rate: 0, amount: 0 }
    ],
    taxDetails: {
      cgstRate: 9,
      cgstAmount: 0,
      sgstRate: 9,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0
    },
    totalAmount: 0,
    grandTotal: 0,
    amountInWords: '',
    notes: ''
  });

  useEffect(() => {
    if (isEdit) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    try {
      const { data } = await reportAPI.getById(id);
      if (data.data.status === 'locked') {
        toast.error('This invoice is locked and cannot be edited');
        navigate(`/reports/${id}`);
        return;
      }
      
      // Ensure company details remain the latest standardized version even when editing
      const fetchedData = data.data;
      fetchedData.companyDetails = { ...initialCompanyDetails };
      
      // Format date for input
      if (fetchedData.invoiceDate) {
        fetchedData.invoiceDate = new Date(fetchedData.invoiceDate).toISOString().split('T')[0];
      }

      // Remap flat taxes to nested object for form
      fetchedData.taxDetails = {
        cgstRate: fetchedData.cgstRate || 0,
        cgstAmount: fetchedData.cgstAmount || 0,
        sgstRate: fetchedData.sgstRate || 0,
        sgstAmount: fetchedData.sgstAmount || 0,
        igstRate: fetchedData.igstRate || 0,
        igstAmount: fetchedData.igstAmount || 0,
      };
      
      setFormData(fetchedData);
    } catch (err) {
      toast.error('Failed to load report data');
      navigate('/reports');
    } finally {
      setFetching(false);
    }
  };

  const calculateTotals = (data = formData) => {
    let totalAmount = 0;
    
    // Calculate line items
    const updatedLineItems = data.lineItems.map(item => {
      const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
      totalAmount += amount;
      return { ...item, amount };
    });

    // Calculate taxes
    const cgstAmount = (totalAmount * (parseFloat(data.taxDetails.cgstRate) || 0)) / 100;
    const sgstAmount = (totalAmount * (parseFloat(data.taxDetails.sgstRate) || 0)) / 100;
    const igstAmount = (totalAmount * (parseFloat(data.taxDetails.igstRate) || 0)) / 100;

    const grandTotal = Math.round(totalAmount + cgstAmount + sgstAmount + igstAmount);

    // Amount in words
    let amountInWords = '';
    try {
      amountInWords = toWords(grandTotal).replace(/-/g, ' ').toUpperCase() + ' RUPEES ONLY';
    } catch (e) {
      amountInWords = '';
    }

    setFormData({
      ...data,
      lineItems: updatedLineItems,
      totalAmount,
      taxDetails: {
        ...data.taxDetails,
        cgstAmount,
        sgstAmount,
        igstAmount
      },
      grandTotal,
      amountInWords
    });
  };

  // Generic handle change for nested objects
  const handleChange = (section, field, value) => {
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Trigger calculation when relevant fields change
  useEffect(() => {
    // We only want to trigger this when rates change, as line items have their own handlers
    calculateTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.taxDetails.cgstRate, formData.taxDetails.sgstRate, formData.taxDetails.igstRate]);

  const handleLineItemChange = (index, field, value) => {
    const newLineItems = [...formData.lineItems];
    newLineItems[index][field] = value;
    calculateTotals({ ...formData, lineItems: newLineItems });
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: '', hsnCode: '', quantity: 1, uom: 'NOS', rate: 0, amount: 0 }
      ]
    }));
  };

  const removeLineItem = (index) => {
    if (formData.lineItems.length === 1) return;
    const newLineItems = formData.lineItems.filter((_, i) => i !== index);
    calculateTotals({ ...formData, lineItems: newLineItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      lineItems: formData.lineItems.map((item, index) => ({
        ...item,
        sno: index + 1
      })),
      cgstRate: formData.taxDetails.cgstRate,
      cgstAmount: formData.taxDetails.cgstAmount,
      sgstRate: formData.taxDetails.sgstRate,
      sgstAmount: formData.taxDetails.sgstAmount,
      igstRate: formData.taxDetails.igstRate,
      igstAmount: formData.taxDetails.igstAmount,
    };
    delete payload.taxDetails;

    try {
      if (isEdit) {
        await reportAPI.update(id, payload);
        toast.success('Invoice updated successfully');
        navigate(`/reports/${id}`);
      } else {
        const { data } = await reportAPI.create(payload);
        toast.success('Invoice created successfully');
        navigate(`/reports/${data.data._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving invoice');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p className="text-muted">Loading invoice details...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate('/reports')}>
                <ArrowLeft size={18} />
              </button>
              <h2 style={{ margin: 0 }}>{isEdit ? 'Edit Invoice' : 'Create New Invoice'}</h2>
            </div>
            <p style={{ marginLeft: '40px' }}>Fill in the details to generate a professional tax invoice.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-outline" onClick={() => navigate('/reports')}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              <Save size={16} /> {loading ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        
        {/* Basic Info & Company */}
        <div className="responsive-grid">
          
          {/* General Details */}
          <div className="card">
            <div className="card-header">
              <h3>General Details</h3>
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.invoiceDate}
                onChange={(e) => handleChange(null, 'invoiceDate', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">PO Number (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. SIPL/ITC/..."
                value={formData.poNumber}
                onChange={(e) => handleChange(null, 'poNumber', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle No (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. AP05..."
                value={formData.vehicleNo}
                onChange={(e) => handleChange(null, 'vehicleNo', e.target.value)}
              />
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => handleChange(null, 'status', e.target.value)}
                >
                  <option value="draft">Draft (Can edit later)</option>
                  <option value="finalized">Finalized (Ready for print)</option>
                </select>
              </div>
            )}
          </div>

          {/* Billed To / Party Details */}
          <div className="card">
            <div className="card-header">
              <h3>Billed To (Party Details)</h3>
            </div>
            <div className="form-group">
              <label className="form-label">Party Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Company Name"
                value={formData.partyDetails.name}
                onChange={(e) => handleChange('partyDetails', 'name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-textarea"
                placeholder="Full Address"
                value={formData.partyDetails.address}
                onChange={(e) => handleChange('partyDetails', 'address', e.target.value)}
                rows={2}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="27AADCB2230M1Z2"
                  value={formData.partyDetails.gstin}
                  onChange={(e) => handleChange('partyDetails', 'gstin', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">State & Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Telangana (36)"
                  value={`${formData.partyDetails.state} ${formData.partyDetails.stateCode ? `(${formData.partyDetails.stateCode})` : ''}`.trim()}
                  onChange={(e) => {
                    // Simple parse if user types something like "Telangana (36)"
                    const val = e.target.value;
                    const match = val.match(/(.*?)\s*(?:\((.*?)\))?$/);
                    handleChange('partyDetails', 'state', match[1]?.trim() || val);
                    if (match[2]) handleChange('partyDetails', 'stateCode', match[2].trim());
                  }}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number (10 digits)</label>
              <input
                type="text"
                className="form-input"
                placeholder="9876543210"
                value={formData.partyDetails.phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  handleChange('partyDetails', 'phone', val);
                }}
              />
            </div>
          </div>

          {/* Company Details (Fixed) */}
          <div className="card" style={{ opacity: 0.85 }}>
            <div className="card-header">
              <h3>Our Company Details <span className="badge badge-locked" style={{ marginLeft: '12px', fontSize: '0.65rem' }}>Fixed</span></h3>
            </div>
            <div className="form-row readonly-row">
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input type="text" className="form-input" value={formData.companyDetails.name} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input type="text" className="form-input" value={formData.companyDetails.gstin} readOnly />
              </div>
            </div>
            <div className="form-row readonly-row">
              <div className="form-group">
                <label className="form-label">PAN</label>
                <input type="text" className="form-input" value={formData.companyDetails.pan} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input type="text" className="form-input" value={`${formData.companyDetails.state} (${formData.companyDetails.stateCode})`} readOnly />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Company details are read-only and will be printed exactly as shown above.</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="card" style={{ marginTop: '32px' }}>
          <div className="card-header">
            <h3>Line Items</h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={addLineItem}>
              <Plus size={16} /> Add Item
            </button>
          </div>
          
          <div className="table-wrapper" style={{ overflow: 'visible' }}>
            <table style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Description of Goods</th>
                  <th style={{ width: '15%' }}>HSN/SAC</th>
                  <th style={{ width: '10%' }}>Qty</th>
                  <th style={{ width: '10%' }}>UOM</th>
                  <th style={{ width: '15%' }}>Rate (₹)</th>
                  <th style={{ width: '15%' }}>Amount (₹)</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {formData.lineItems.map((item, index) => (
                  <tr key={index}>
                    <td style={{ padding: '8px' }}>
                      <textarea
                        className="form-input"
                        style={{ minHeight: '40px', resize: 'vertical' }}
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="Item description"
                        required
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.hsnCode}
                        onChange={(e) => handleLineItemChange(index, 'hsnCode', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="number"
                        className="form-input"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.uom}
                        onChange={(e) => handleLineItemChange(index, 'uom', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="number"
                        className="form-input"
                        value={item.rate}
                        onChange={(e) => handleLineItemChange(index, 'rate', e.target.value)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div className="form-input" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        {item.amount.toFixed(2)}
                      </div>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon text-danger"
                        onClick={() => removeLineItem(index)}
                        disabled={formData.lineItems.length === 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Taxes & Totals */}
        <div className="responsive-grid" style={{ marginTop: '32px' }}>
          
          {/* Tax Configuration */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} /> Tax Settings
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Adjust the applicable tax rates. Leave at 0 if not applicable.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">CGST Rate (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.taxDetails.cgstRate}
                  onChange={(e) => handleChange('taxDetails', 'cgstRate', e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">SGST Rate (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.taxDetails.sgstRate}
                  onChange={(e) => handleChange('taxDetails', 'sgstRate', e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">IGST Rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={formData.taxDetails.igstRate}
                onChange={(e) => handleChange('taxDetails', 'igstRate', e.target.value)}
                min="0"
                step="0.1"
              />
            </div>
          </div>

          {/* Grand Totals */}
          <div className="card" style={{ background: 'var(--gradient-card)' }}>
            <div className="card-header">
              <h3>Invoice Summary</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Total Taxable Value</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>₹ {(formData.totalAmount || 0).toFixed(2)}</span>
              </div>
              
              {formData.taxDetails.cgstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Add: CGST @ {formData.taxDetails.cgstRate}%</span>
                  <span>₹ {formData.taxDetails.cgstAmount.toFixed(2)}</span>
                </div>
              )}
              
              {formData.taxDetails.sgstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Add: SGST @ {formData.taxDetails.sgstRate}%</span>
                  <span>₹ {formData.taxDetails.sgstAmount.toFixed(2)}</span>
                </div>
              )}

              {formData.taxDetails.igstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Add: IGST @ {formData.taxDetails.igstRate}%</span>
                  <span>₹ {formData.taxDetails.igstAmount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginTop: '12px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color)',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--accent-primary)'
              }}>
                <span>Total Invoice Value</span>
                <span>₹ {(formData.grandTotal || 0).toFixed(2)}</span>
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Amount in Words: </strong> {formData.amountInWords}
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
