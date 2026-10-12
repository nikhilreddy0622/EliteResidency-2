const express = require('express');
const mongoose = require('mongoose');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const taxConfiguration = {
  gst: { cgstRate: 9, sgstRate: 9, taxReturnable: false },
  gst_returnable: { cgstRate: 2.5, sgstRate: 2.5, taxReturnable: true },
  non_gst: { cgstRate: 2.5, sgstRate: 2.5, taxReturnable: false }
};

const buildCalculatedInvoice = (input) => {
  const invoiceType = input.invoiceType || 'gst';
  const config = taxConfiguration[invoiceType];
  if (!config) throw new Error('Invalid invoice type');
  if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) throw new Error('At least one line item is required');

  const lineItems = input.lineItems.map((item, index) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    if (!item.description?.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) {
      throw new Error(`Line item ${index + 1} is invalid`);
    }
    return { ...item, sno: index + 1, quantity, rate, amount: Number((quantity * rate).toFixed(2)) };
  });
  const totalAmount = Number(lineItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const cgstAmount = Number((totalAmount * config.cgstRate / 100).toFixed(2));
  const sgstAmount = Number((totalAmount * config.sgstRate / 100).toFixed(2));
  const grandTotal = config.taxReturnable
    ? totalAmount
    : Math.round((totalAmount + cgstAmount + sgstAmount) * 100) / 100;

  return {
    ...input,
    invoiceType,
    lineItems,
    totalAmount,
    cgstRate: config.cgstRate,
    cgstAmount,
    sgstRate: config.sgstRate,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    grandTotal
  };
};

const saveCustomerDetails = async (partyDetails, lineItems, userId) => {
  if (!partyDetails?.name?.trim()) return;
  const details = {
    ...partyDetails,
    hsnCode: lineItems?.[0]?.hsnCode || '',
    lastModifiedBy: userId
  };
  const key = details.gstin?.trim()
    ? { gstin: details.gstin.trim().toUpperCase() }
    : { name: details.name.trim(), panNo: (details.panNo || '').trim().toUpperCase() };
  await Customer.findOneAndUpdate(key, { ...details, createdBy: userId }, { upsert: true, new: true, runValidators: true });
};

// Helper: Get financial year string (Apr-Mar)
const getFinancialYear = (date) => {
  const d = new Date(date);
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  if (month >= 3) { // April onwards
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

// Helper: Detect changes between old and new data
const detectChanges = (oldData, newData, prefix = '') => {
  const changes = [];
  const fieldsToTrack = [
    'invoiceDate', 'deliveryChallanNo', 'billType', 'deliveryAddress',
    'hsnCode', 'totalAmount', 'cgstRate', 'cgstAmount', 'sgstRate',
    'sgstAmount', 'igstRate', 'igstAmount', 'grandTotal', 'amountInWords',
    'notes', 'status'
  ];
  const nestedFields = ['partyDetails', 'companyDetails', 'bankDetails'];

  for (const field of fieldsToTrack) {
    const key = prefix ? `${prefix}.${field}` : field;
    const oldVal = oldData[field];
    const newVal = newData[field];
    if (newVal !== undefined && String(oldVal) !== String(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }

  for (const nested of nestedFields) {
    if (newData[nested]) {
      for (const [subField, newVal] of Object.entries(newData[nested])) {
        const oldVal = oldData[nested] ? oldData[nested][subField] : undefined;
        if (newVal !== undefined && String(oldVal) !== String(newVal)) {
          changes.push({
            field: `${nested}.${subField}`,
            oldValue: oldVal,
            newValue: newVal
          });
        }
      }
    }
  }

  // Track line items changes
  if (newData.lineItems) {
    const oldItems = JSON.stringify(oldData.lineItems || []);
    const newItems = JSON.stringify(newData.lineItems);
    if (oldItems !== newItems) {
      changes.push({
        field: 'lineItems',
        oldValue: oldData.lineItems,
        newValue: newData.lineItems
      });
    }
  }

  return changes;
};

// @route   GET /api/reports
// @desc    Get all reports with filters
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      financialYear,
      startDate,
      endDate,
      partyName,
      loggerId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Loggers can only ever see their own invoices, even if they modify query
    // parameters manually. Admins may optionally filter by a specific logger.
    if (req.user.role === 'logger') query.createdBy = req.user._id;
    if (req.user.role === 'admin' && loggerId) query.createdBy = loggerId;

    // Search by invoice number or party name
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'partyDetails.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by financial year
    if (financialYear) {
      query.financialYear = financialYear;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    // Filter by party name
    if (partyName) {
      query['partyDetails.name'] = { $regex: partyName, $options: 'i' };
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('lockedBy', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: reports,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/reports/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const ownershipQuery = req.user.role === 'logger' ? { createdBy: req.user._id } : {};
    const totalReports = await Report.countDocuments(ownershipQuery);
    const draftReports = await Report.countDocuments({ ...ownershipQuery, status: 'draft' });
    const lockedReports = await Report.countDocuments({ ...ownershipQuery, status: 'locked' });

    // Total revenue
    const revenueResult = await Report.aggregate([
      { $match: ownershipQuery },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Recent reports
    const recentReports = await Report.find(ownershipQuery)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Monthly revenue
    const monthlyRevenue = await Report.aggregate([
      { $match: ownershipQuery },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Recent audit activity
    const recentActivity = await AuditLog.find()
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalReports,
        draftReports,
        lockedReports,
        totalRevenue,
        recentReports,
        monthlyRevenue,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/reports/:id
// @desc    Get single report
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('lockedBy', 'name email');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (req.user.role === 'logger' && String(report.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only view invoices you created' });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/reports
// @desc    Create new report
// @access  Private (admin, logger)
router.post('/', protect, authorize('admin', 'logger'), async (req, res) => {
  try {
    const reportData = buildCalculatedInvoice(req.body);

    // Determine financial year
    const invoiceDate = req.user.role === 'admin' && reportData.invoiceDate ? reportData.invoiceDate : new Date();
    const financialYear = getFinancialYear(invoiceDate);

    // Assigning a number and inserting the invoice are committed together. A
    // failed invoice write therefore cannot consume a number or create races.
    const session = await mongoose.startSession();
    let report;
    try {
      await session.withTransaction(async () => {
        const seqNum = await Counter.getNextSequence(financialYear, session);
        const invoiceNumber = `${seqNum}/${financialYear}`;
        [report] = await Report.create([{
          ...reportData,
          invoiceNumber,
          sequenceNumber: seqNum,
          financialYear,
          invoiceDate,
          status: 'draft',
          isLocked: false,
          createdBy: req.user._id,
          lastModifiedBy: req.user._id
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    // Create audit log entry
    await AuditLog.create({
      reportId: report._id,
      invoiceNumber: report.invoiceNumber,
      action: 'created',
      performedBy: req.user._id,
      version: 1,
      snapshot: report.toObject(),
      ipAddress: req.ip
    });
    await saveCustomerDetails(report.partyDetails, report.lineItems, req.user._id);

    const populatedReport = await Report.findById(report._id)
      .populate('createdBy', 'name email');

    res.status(201).json({ success: true, data: populatedReport });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/reports/:id
// @desc    Update report
// @access  Private (admin, logger)
router.put('/:id', protect, authorize('admin', 'logger'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (report.isLocked && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Report is locked. Only admin can modify locked reports.'
      });
    }

    if (req.user.role === 'logger' && String(report.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit invoices you created' });
    }
    if (req.user.role === 'logger' && report.status !== 'draft') {
      return res.status(403).json({ success: false, message: 'Only draft invoices can be edited' });
    }

    // A logger may update invoice details but can never alter the invoice date,
    // lifecycle, number, ownership, or calculated values directly.
    const allowedLoggerFields = ['invoiceType', 'partyDetails', 'poNumber', 'vehicleNo', 'deliveryChallanNo', 'billType', 'deliveryAddress', 'hsnCode', 'lineItems', 'bankDetails', 'notes', 'amountInWords'];
    const requestedData = req.user.role === 'logger'
      ? Object.fromEntries(allowedLoggerFields.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]))
      : req.body;
    const updatePayload = buildCalculatedInvoice({ ...report.toObject(), ...requestedData });
    delete updatePayload._id;
    delete updatePayload.__v;
    delete updatePayload.invoiceDate;
    delete updatePayload.invoiceNumber;
    delete updatePayload.sequenceNumber;
    delete updatePayload.financialYear;
    delete updatePayload.createdBy;
    delete updatePayload.status;
    delete updatePayload.isLocked;

    // Only admins may change dates; all other protected fields stay immutable.
    if (req.user.role === 'admin' && req.body.invoiceDate) updatePayload.invoiceDate = req.body.invoiceDate;

    const changes = detectChanges(report.toObject(), updatePayload);

    if (changes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes detected'
      });
    }

    // Increment version
    const newVersion = report.version + 1;

    // Update report
    const updateData = {
      ...updatePayload,
      version: newVersion,
      lastModifiedBy: req.user._id
    };

    // Don't allow changing invoice number, lifecycle, ownership, or sequence
    delete updateData.invoiceNumber;
    delete updateData.sequenceNumber;
    delete updateData.financialYear;
    delete updateData.createdBy;
    delete updateData.status;
    delete updateData.isLocked;

    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('lockedBy', 'name email');

    // Create audit log entry
    await AuditLog.create({
      reportId: report._id,
      invoiceNumber: report.invoiceNumber,
      action: 'edited',
      performedBy: req.user._id,
      version: newVersion,
      changes,
      snapshot: updatedReport.toObject(),
      ipAddress: req.ip
    });
    await saveCustomerDetails(updatedReport.partyDetails, updatedReport.lineItems, req.user._id);

    res.json({ success: true, data: updatedReport });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/reports/:id/lock
// @desc    Lock a draft permanently
// @access  Private (admin, owning logger)
router.put('/:id/lock', protect, authorize('admin', 'logger'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (req.body.lock !== true) {
      return res.status(400).json({ success: false, message: 'Invoices can only be locked once confirmed' });
    }
    if (report.status !== 'draft' || report.isLocked) {
      return res.status(400).json({ success: false, message: 'Only a draft invoice can be locked' });
    }
    if (req.user.role === 'logger' && String(report.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only lock invoices you created' });
    }

    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      {
        isLocked: true,
        status: 'locked',
        lockedBy: req.user._id,
        lockedAt: new Date(),
        lastModifiedBy: req.user._id
      },
      { new: true }
    )
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('lockedBy', 'name email');

    // Create audit log entry
    await AuditLog.create({
      reportId: report._id,
      invoiceNumber: report.invoiceNumber,
      action: 'locked',
      performedBy: req.user._id,
      version: report.version,
      changes: [{ field: 'isLocked', oldValue: false, newValue: true }],
      snapshot: updatedReport.toObject(),
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: updatedReport,
      message: 'Invoice locked successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/reports/:id
// @desc    Delete report (soft - marks as deleted in audit)
// @access  Private (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Create audit log before deletion
    await AuditLog.create({
      reportId: report._id,
      invoiceNumber: report.invoiceNumber,
      action: 'deleted',
      performedBy: req.user._id,
      version: report.version,
      snapshot: report.toObject(),
      ipAddress: req.ip
    });

    await Report.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
