const express = require('express');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

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
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

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
    const totalReports = await Report.countDocuments();
    const draftReports = await Report.countDocuments({ status: 'draft' });
    const finalizedReports = await Report.countDocuments({ status: 'finalized' });
    const lockedReports = await Report.countDocuments({ status: 'locked' });

    // Total revenue
    const revenueResult = await Report.aggregate([
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Recent reports
    const recentReports = await Report.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Monthly revenue
    const monthlyRevenue = await Report.aggregate([
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
        finalizedReports,
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
    const reportData = req.body;

    // Determine financial year
    const invoiceDate = reportData.invoiceDate || new Date();
    const financialYear = getFinancialYear(invoiceDate);

    // Get next sequential number
    const seqNum = await Counter.getNextSequence(financialYear);
    const invoiceNumber = `${seqNum}/${financialYear}`;

    // Create report
    const report = await Report.create({
      ...reportData,
      invoiceNumber,
      sequenceNumber: seqNum,
      financialYear,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });

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

    // Check if report is locked
    if (report.isLocked && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Report is locked. Only admin can modify locked reports.'
      });
    }

    // Detect changes
    const changes = detectChanges(report.toObject(), req.body);

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
      ...req.body,
      version: newVersion,
      lastModifiedBy: req.user._id
    };

    // Don't allow changing invoice number or sequence
    delete updateData.invoiceNumber;
    delete updateData.sequenceNumber;
    delete updateData.financialYear;
    delete updateData.createdBy;

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

    res.json({ success: true, data: updatedReport });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/reports/:id/lock
// @desc    Lock/unlock report
// @access  Private (admin only)
router.put('/:id/lock', protect, authorize('admin'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const { lock } = req.body; // true to lock, false to unlock
    const action = lock ? 'locked' : 'unlocked';

    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      {
        isLocked: lock,
        status: lock ? 'locked' : 'finalized',
        lockedBy: lock ? req.user._id : null,
        lockedAt: lock ? new Date() : null,
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
      action,
      performedBy: req.user._id,
      version: report.version,
      changes: [{ field: 'isLocked', oldValue: !lock, newValue: lock }],
      snapshot: updatedReport.toObject(),
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: updatedReport,
      message: `Report ${action} successfully`
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

    if (report.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete a locked report. Unlock it first.'
      });
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
