import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerAPI, reportAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { toWords } from 'number-to-words';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Calculator,
  Settings,
  X
} from 'lucide-react';

const initialCompanyDetails = {
  name: 'BHARATH ELITE ENTERPRISES',
  address: 'Office D.NO.:2-295 ,OPP- EAST GATE, SARAPAKA , BURGUMPAHAD MANDAL,\nSARAPAKA -507128 BHADRADRI KOTHAGUDEM DT, TELANGANA STATE\nPh No: 08743-232929 ; 995999-6666 VENDOR CODE: 1021036',
  gstin: '36AJVPP5821A1Z2',
  panNo: 'AJVPP5821A',
  state: 'Telangana',
  stateCode: '36',
  vendorCode: '1021036',
  email: 'bfbprasad@gmail.com',
  phone: '08743-232929; 995999-6666'
};

const initialPartyDetails = {
  name: '',
  address: '',
  gstin: '',
  panNo: '',
  state: '',
  stateCode: '',
  phone: ''
};

export default function ReportForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [customers, setCustomers] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerDraft, setCustomerDraft] = useState({ ...initialPartyDetails, hsnCode: '' });

  // Form State
  const [formData, setFormData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceType: 'gst',
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
  }, [id, user?.role]);

  useEffect(() => {
    customerAPI.getAll().then(({ data }) => setCustomers(data.data)).catch(() => {
      toast.error('Saved customer details could not be loaded');
    });
  }, []);

  const fetchReport = async () => {
    try {
      const { data } = await reportAPI.getById(id);
      if (data.data.status === 'locked' && user?.role !== 'admin') {
        toast.error('This invoice is locked and cannot be edited');
        navigate(`/reports/${id}`);
        return;
      }
      
      // Ensure company details remain the latest standardized version even when editing
      const fetchedData = data.data;
      fetchedData.companyDetails = {
        ...initialCompanyDetails,
        ...(fetchedData.companyDetails || {}),
        panNo: fetchedData.companyDetails?.panNo || fetchedData.companyDetails?.pan || initialCompanyDetails.panNo
      };
      fetchedData.partyDetails = { ...initialPartyDetails, ...(fetchedData.partyDetails || {}) };
      fetchedData.invoiceType = fetchedData.invoiceType || 'gst';
      
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

    const grandTotal = data.invoiceType === 'gst_returnable'
      ? totalAmount
      : Math.round((totalAmount + cgstAmount + sgstAmount + igstAmount) * 100) / 100;

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

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find((item) => item._id === customerId);
    if (!customer) return;
    setFormData((previous) => ({
      ...previous,
      partyDetails: {
        ...previous.partyDetails,
        name: customer.name || '',
        address: customer.address || '',
        gstin: customer.gstin || '',
        panNo: customer.panNo || '',
        state: customer.state || '',
        stateCode: customer.stateCode || '',
        phone: customer.phone || ''
      },
      lineItems: previous.lineItems.map((item, index) => index === 0 && !item.hsnCode
        ? { ...item, hsnCode: customer.hsnCode || '' }
        : item)
    }));
  };

  const openCustomerModal = () => {
    const selectedCustomer = customers.find((item) => item.name === formData.partyDetails.name && item.gstin === formData.partyDetails.gstin);
    setEditingCustomerId(selectedCustomer?._id || null);
    setCustomerDraft({
      ...initialPartyDetails,
      ...(selectedCustomer || formData.partyDetails),
      hsnCode: selectedCustomer?.hsnCode || formData.lineItems?.[0]?.hsnCode || ''
    });
    setShowCustomerModal(true);
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    if (!customerDraft.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSavingCustomer(true);
    try {
      const request = editingCustomerId
        ? customerAPI.update(editingCustomerId, customerDraft)
        : customerAPI.save(customerDraft);
      const { data } = await request;
      const savedCustomer = data.data;
      setCustomers((previous) => {
        const remaining = previous.filter((customer) => customer._id !== savedCustomer._id);
        return [...remaining, savedCustomer].sort((a, b) => a.name.localeCompare(b.name));
      });
      handleCustomerSelect(savedCustomer._id);
      // handleCustomerSelect uses the previous list during this render; populate
      // directly as well so the saved record applies immediately.
      setFormData((previous) => ({
        ...previous,
        partyDetails: {
          ...previous.partyDetails,
          name: savedCustomer.name || '', address: savedCustomer.address || '', gstin: savedCustomer.gstin || '',
          panNo: savedCustomer.panNo || '', state: savedCustomer.state || '',
          stateCode: savedCustomer.stateCode || '', phone: savedCustomer.phone || ''
        },
        lineItems: previous.lineItems.map((item, index) => index === 0 && !item.hsnCode
          ? { ...item, hsnCode: savedCustomer.hsnCode || '' }
          : item)
      }));
      toast.success(editingCustomerId ? 'Saved customer details updated' : 'Customer details saved');
      setShowCustomerModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer details');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleInvoiceTypeChange = (invoiceType) => {
    const rates = invoiceType === 'gst' ? { cgstRate: 9, sgstRate: 9, igstRate: 0 } : { cgstRate: 2.5, sgstRate: 2.5, igstRate: 0 };
    calculateTotals({ ...formData, invoiceType, taxDetails: { ...formData.taxDetails, ...rates } });
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
    const hasInvalidItem = formData.lineItems.some((item) => !item.description.trim() || Number(item.quantity) <= 0 || Number(item.rate) < 0);
    if (hasInvalidItem) {
      toast.error('Add a description, quantity, and valid rate for every line item.');
      return;
    }
    setLoading(true);

    const payload = {
      ...formData,
      lineItems: formData.lineItems.map((item, index) => ({
        ...item,
        description: item.description.trim(),
        hsnCode: item.hsnCode?.trim(),
        uom: item.uom?.trim() || 'NOS',
        sno: index + 1
      })),
      companyDetails: {
        ...initialCompanyDetails,
        ...formData.companyDetails,
        panNo: formData.companyDetails.panNo || initialCompanyDetails.panNo
      },
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
                readOnly={user?.role === 'logger'}
                required
              />
              {user?.role === 'logger' && <small className="form-hint">Invoice dates are managed by an admin.</small>}
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Type</label>
              <select className="form-select" value={formData.invoiceType} onChange={(e) => handleInvoiceTypeChange(e.target.value)}>
                <option value="gst">GST Invoice — CGST 9% + SGST 9%</option>
                <option value="gst_returnable">GST Invoice — Tax Returnable (2.5% + 2.5%)</option>
                <option value="non_gst">Non-GST Invoice — CGST 2.5% + SGST 2.5%</option>
              </select>
              <small className="form-hint">{formData.invoiceType === 'gst_returnable' ? 'Tax is displayed separately and is not added to the total, matching the supplied template.' : 'Tax is calculated from the selected template.'}</small>
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
            <div className="form-group">
              <label className="form-label">Delivery Challan No (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Delivery challan number"
                value={formData.deliveryChallanNo || ''}
                onChange={(e) => handleChange(null, 'deliveryChallanNo', e.target.value)}
              />
            </div>
            <div className="form-hint">New invoices are saved as drafts. Confirming an invoice locks it permanently.</div>
          </div>

          {/* Billed To / Party Details */}
          <div className="card">
            <div className="card-header">
              <h3>Billed To (Party Details)</h3>
            </div>
            <div className="form-group">
              <label className="form-label">Saved Customer</label>
              <div className="customer-picker">
                <select className="form-select" defaultValue="" onChange={(e) => handleCustomerSelect(e.target.value)}>
                  <option value="">Select saved customer or enter details below</option>
                  {customers.map((customer) => <option value={customer._id} key={customer._id}>{customer.name}{customer.gstin ? ` — ${customer.gstin}` : ''}</option>)}
                </select>
                <button type="button" className="btn btn-outline customer-manage-button" onClick={openCustomerModal}>
                  <Settings size={16} /> Add / Manage
                </button>
              </div>
              <small className="form-hint">Create a new customer or update the selected details for future invoices.</small>
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
              {formData.invoiceType !== 'non_gst' && <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="27AADCB2230M1Z2"
                  value={formData.partyDetails.gstin}
                  onChange={(e) => handleChange('partyDetails', 'gstin', e.target.value)}
                />
              </div>}
              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Telangana"
                  value={formData.partyDetails.state}
                  onChange={(e) => handleChange('partyDetails', 'state', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">State Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="36"
                  value={formData.partyDetails.stateCode}
                  onChange={(e) => handleChange('partyDetails', 'stateCode', e.target.value.replace(/\D/g, '').slice(0, 2))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">PAN No. (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="AAACI5950L"
                  value={formData.partyDetails.panNo}
                  onChange={(e) => handleChange('partyDetails', 'panNo', e.target.value.toUpperCase())}
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
                <input type="text" className="form-input" value={formData.companyDetails.panNo} readOnly />
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
          
          <div className="table-wrapper line-items-wrapper">
            <table className="line-items-table">
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
                    <td data-label="Description of goods" style={{ padding: '8px' }}>
                      <textarea
                        className="form-input"
                        style={{ minHeight: '40px', resize: 'vertical' }}
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="Item description"
                        required
                      />
                    </td>
                    <td data-label="HSN / SAC" style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.hsnCode}
                        onChange={(e) => handleLineItemChange(index, 'hsnCode', e.target.value)}
                      />
                    </td>
                    <td data-label="Quantity" style={{ padding: '8px' }}>
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
                    <td data-label="UOM" style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.uom}
                        onChange={(e) => handleLineItemChange(index, 'uom', e.target.value)}
                      />
                    </td>
                    <td data-label="Rate (₹)" style={{ padding: '8px' }}>
                      <input
                        type="number"
                        className="form-input"
                        value={item.rate}
                        onChange={(e) => handleLineItemChange(index, 'rate', e.target.value)}
                        min="0"
                        step="0.01"
                        required
                      />
                      <small className="form-hint">Enter rate manually</small>
                    </td>
                    <td data-label="Amount (₹)" style={{ padding: '8px' }}>
                      <div className="form-input" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        {item.amount.toFixed(2)}
                      </div>
                    </td>
                    <td data-label="" className="line-item-remove" style={{ padding: '8px', textAlign: 'center' }}>
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
              Tax rates are selected automatically from the invoice template.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">CGST Rate (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.taxDetails.cgstRate}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label className="form-label">SGST Rate (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.taxDetails.sgstRate}
                  readOnly
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">IGST Rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={formData.taxDetails.igstRate}
                readOnly
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

      {showCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowCustomerModal(false)}>
          <div className="modal modal-lg" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCustomerId ? 'Modify Saved Customer' : 'Add New Customer Details'}</h3>
              <button type="button" className="modal-close" onClick={() => setShowCustomerModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: '20px' }}>These details are stored for future invoices. Existing invoices keep their original saved details.</p>
              <form onSubmit={saveCustomer}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer / Party Name</label>
                    <input className="form-input" value={customerDraft.name} onChange={(e) => setCustomerDraft({ ...customerDraft, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN (optional for non-GST)</label>
                    <input className="form-input" value={customerDraft.gstin || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, gstin: e.target.value.toUpperCase() })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-textarea" rows={3} value={customerDraft.address || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, address: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">PAN No.</label><input className="form-input" value={customerDraft.panNo || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, panNo: e.target.value.toUpperCase() })} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={customerDraft.phone || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, phone: e.target.value })} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">State</label><input className="form-input" value={customerDraft.state || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, state: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">State Code</label><input className="form-input" value={customerDraft.stateCode || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, stateCode: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></div>
                  <div className="form-group"><label className="form-label">Default HSN / SAC</label><input className="form-input" value={customerDraft.hsnCode || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, hsnCode: e.target.value })} /></div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCustomerModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={savingCustomer}>{savingCustomer ? 'Saving...' : 'Save Customer Details'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
