import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerAPI, reportAPI, savedItemAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { amountInWords } from '../utils/amountInWords';
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
  pinCode: '',
  phone: ''
};

const TAX_RATES = {
  gst: { cgstRate: 9, sgstRate: 9, igstRate: 0 },
  gst_returnable: { cgstRate: 2.5, sgstRate: 2.5, igstRate: 0 },
  non_gst: { cgstRate: 2.5, sgstRate: 2.5, igstRate: 0 }
};

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const localDateString = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Single source of truth for every figure on the form. Totals are derived from
// the line items and invoice type on each render (same rounding as the server),
// so GST can never be left out of the total by a stale state update.
const computeTotals = (data) => {
  const rates = TAX_RATES[data.invoiceType] || TAX_RATES.gst;
  const lineItems = data.lineItems.map((item) => ({
    ...item,
    amount: round2((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0))
  }));
  const totalAmount = round2(lineItems.reduce((sum, item) => sum + item.amount, 0));
  const cgstAmount = round2((totalAmount * rates.cgstRate) / 100);
  const sgstAmount = round2((totalAmount * rates.sgstRate) / 100);
  const igstAmount = round2((totalAmount * rates.igstRate) / 100);
  const grandTotal = round2(totalAmount + cgstAmount + sgstAmount + igstAmount);
  return { ...rates, lineItems, totalAmount, cgstAmount, sgstAmount, igstAmount, grandTotal, amountInWords: amountInWords(grandTotal) };
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
  const [savedItems, setSavedItems] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState({ description: '', hsnCode: '6815.99.10', uom: 'NOS', defaultRate: 0 });

  // Form State
  const [formData, setFormData] = useState({
    invoiceDate: localDateString(),
    invoiceType: 'gst',
    poNumber: '',
    vehicleNo: '',
    status: 'draft',
    companyDetails: { ...initialCompanyDetails },
    partyDetails: { ...initialPartyDetails },
    lineItems: [
      { description: '', hsnCode: '6815.99.10', quantity: 1, uom: 'NOS', rate: 0, amount: 0 }
    ],
    notes: ''
  });

  const totals = computeTotals(formData);

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

  useEffect(() => {
    savedItemAPI.getAll().then(({ data }) => setSavedItems(data.data)).catch(() => toast.error('Saved item descriptions could not be loaded'));
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
        fetchedData.invoiceDate = localDateString(new Date(fetchedData.invoiceDate));
      }

      setFormData(fetchedData);
    } catch (err) {
      toast.error('Failed to load report data');
      navigate('/reports');
    } finally {
      setFetching(false);
    }
  };

  // Generic handle change for nested objects
  const handleChange = (section, field, value) => {
    setFormData((prev) => (section
      ? { ...prev, [section]: { ...prev[section], [field]: value } }
      : { ...prev, [field]: value }));
  };

  const updateLineItem = (index, changes) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => (i === index ? { ...item, ...changes } : item))
    }));
  };

  const handleLineItemChange = (index, field, value) => updateLineItem(index, { [field]: value });

  const applySavedItem = (index, itemId) => {
    const savedItem = savedItems.find((item) => item._id === itemId);
    if (!savedItem) return;
    updateLineItem(index, { description: savedItem.description, hsnCode: savedItem.hsnCode || '6815.99.10', uom: savedItem.uom || 'NOS', rate: savedItem.defaultRate ?? 0 });
  };

  const openItemModal = (item = null) => {
    setEditingItemId(item?._id || null);
    setItemDraft(item ? { description: item.description || '', hsnCode: item.hsnCode || '6815.99.10', uom: item.uom || 'NOS', defaultRate: item.defaultRate ?? 0 } : { description: '', hsnCode: '6815.99.10', uom: 'NOS', defaultRate: 0 });
    setShowItemModal(true);
  };

  const saveItem = async (event) => {
    event.preventDefault();
    if (!itemDraft.description.trim()) { toast.error('Item description is required'); return; }
    setSavingItem(true);
    try {
      const { data } = editingItemId ? await savedItemAPI.update(editingItemId, itemDraft) : await savedItemAPI.save(itemDraft);
      setSavedItems((previous) => [...previous.filter((item) => item._id !== data.data._id), data.data].sort((a, b) => a.description.localeCompare(b.description)));
      toast.success(editingItemId ? 'Saved item updated' : 'Item description saved');
      setShowItemModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save item'); }
    finally { setSavingItem(false); }
  };

  const deleteItem = async () => {
    if (!editingItemId || !window.confirm('Delete this saved item description? Existing invoices will not change.')) return;
    try {
      await savedItemAPI.delete(editingItemId);
      setSavedItems((previous) => previous.filter((item) => item._id !== editingItemId));
      toast.success('Saved item deleted'); setShowItemModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete item'); }
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
        pinCode: customer.pinCode || '',
        phone: customer.phone || ''
      },
      lineItems: previous.lineItems.map((item, index) => index === 0 && (!item.hsnCode || item.hsnCode === '6815.99.10')
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
          stateCode: savedCustomer.stateCode || '', pinCode: savedCustomer.pinCode || '', phone: savedCustomer.phone || ''
        },
        lineItems: previous.lineItems.map((item, index) => index === 0 && (!item.hsnCode || item.hsnCode === '6815.99.10')
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
    setFormData((prev) => ({ ...prev, invoiceType }));
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: '', hsnCode: '6815.99.10', quantity: 1, uom: 'NOS', rate: 0, amount: 0 }
      ]
    }));
  };

  const removeLineItem = (index) => {
    setFormData((prev) => (prev.lineItems.length === 1
      ? prev
      : { ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
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
      lineItems: totals.lineItems.map((item, index) => ({
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
      totalAmount: totals.totalAmount,
      cgstRate: totals.cgstRate,
      cgstAmount: totals.cgstAmount,
      sgstRate: totals.sgstRate,
      sgstAmount: totals.sgstAmount,
      igstRate: totals.igstRate,
      igstAmount: totals.igstAmount,
      grandTotal: totals.grandTotal,
      amountInWords: totals.amountInWords
    };

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
            <button type="button" className="btn btn-outline" onClick={() => navigate('/reports')}>Cancel</button>
            <button type="submit" form="invoice-form" className="btn btn-primary" disabled={loading}>
              <Save size={16} /> {loading ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </div>
      </div>

      <form id="invoice-form" onSubmit={handleSubmit} className="form-container">
        
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
              <small className="form-hint">{formData.invoiceType === 'gst_returnable' ? 'GST is added to the total; the invoice also prints the reverse-charge notice.' : 'GST is calculated from the selected template and added to the total.'}</small>
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
              <label className="form-label">Pin Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="507128"
                inputMode="numeric"
                value={formData.partyDetails.pinCode || ''}
                onChange={(e) => handleChange('partyDetails', 'pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number (with STD code if landline)</label>
              <input
                type="text"
                className="form-input"
                placeholder="08746-243332"
                value={formData.partyDetails.phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d\s,+-]/g, '').slice(0, 25);
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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openItemModal()}><Settings size={16} /> Saved Items</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={addLineItem}><Plus size={16} /> Add Item</button>
            </div>
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
                      <select className="form-select" defaultValue="" onChange={(e) => applySavedItem(index, e.target.value)} style={{ marginBottom: '8px' }}>
                        <option value="">Use a saved item description</option>
                        {savedItems.map((savedItem) => <option value={savedItem._id} key={savedItem._id}>{savedItem.description}</option>)}
                      </select>
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
                        {totals.lineItems[index].amount.toFixed(2)}
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
                  value={totals.cgstRate}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label className="form-label">SGST Rate (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={totals.sgstRate}
                  readOnly
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">IGST Rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={totals.igstRate}
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
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>₹ {totals.totalAmount.toFixed(2)}</span>
              </div>
              
              {totals.cgstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Add: CGST @ {totals.cgstRate}%</span>
                  <span>₹ {totals.cgstAmount.toFixed(2)}</span>
                </div>
              )}
              
              {totals.sgstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Add: SGST @ {totals.sgstRate}%</span>
                  <span>₹ {totals.sgstAmount.toFixed(2)}</span>
                </div>
              )}

              {totals.igstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Add: IGST @ {totals.igstRate}%</span>
                  <span>₹ {totals.igstAmount.toFixed(2)}</span>
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
                <span>₹ {totals.grandTotal.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Amount in Words: </strong> {totals.amountInWords}
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
                  <div className="form-group"><label className="form-label">Pin Code</label><input className="form-input" value={customerDraft.pinCode || ''} onChange={(e) => setCustomerDraft({ ...customerDraft, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></div>
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
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><h3>{editingItemId ? 'Edit Saved Item' : 'Save Item Description'}</h3><button type="button" className="modal-close" onClick={() => setShowItemModal(false)}><X size={18} /></button></div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: '20px' }}>Saved items fill the description, HSN/SAC, UOM, and rate for new invoice lines. Existing invoices remain unchanged.</p>
              {savedItems.length > 0 && <div className="form-group"><label className="form-label">Edit an existing item</label><select className="form-select" value={editingItemId || ''} onChange={(e) => openItemModal(savedItems.find((item) => item._id === e.target.value) || null)}><option value="">Add a new saved item</option>{savedItems.map((savedItem) => <option value={savedItem._id} key={savedItem._id}>{savedItem.description}</option>)}</select></div>}
              <form onSubmit={saveItem}>
                <div className="form-group"><label className="form-label">Item description</label><textarea className="form-textarea" rows={3} value={itemDraft.description} onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })} required /></div>
                <div className="form-row"><div className="form-group"><label className="form-label">HSN / SAC</label><input className="form-input" value={itemDraft.hsnCode} onChange={(e) => setItemDraft({ ...itemDraft, hsnCode: e.target.value })} /></div><div className="form-group"><label className="form-label">UOM</label><input className="form-input" value={itemDraft.uom} onChange={(e) => setItemDraft({ ...itemDraft, uom: e.target.value })} /></div></div>
                <div className="form-group"><label className="form-label">Default rate (₹)</label><input className="form-input" type="number" min="0" step="0.01" value={itemDraft.defaultRate} onChange={(e) => setItemDraft({ ...itemDraft, defaultRate: e.target.value })} /></div>
                <div className="modal-actions">{editingItemId && <button type="button" className="btn btn-ghost text-danger" onClick={deleteItem}>Delete Item</button>}<button type="button" className="btn btn-ghost" onClick={() => setShowItemModal(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={savingItem}>{savingItem ? 'Saving...' : 'Save Item'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
