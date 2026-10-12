const express = require('express');
const AuditLog = require('../models/AuditLog');
const Report = require('../models/Report');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/audit-logs
// @desc    Get all audit logs with filters
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      reportId,
      action,
      performedBy,
      startDate,
      endDate,
      invoiceNumber,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    let ownReportIds = null;
    if (req.user.role === 'logger') {
      const ownReports = await Report.find({ createdBy: req.user._id }).select('_id');
      ownReportIds = ownReports.map((report) => report._id.toString());
      query.reportId = { $in: ownReports.map((report) => report._id) };
    }

    if (reportId) {
      if (ownReportIds && !ownReportIds.includes(reportId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this invoice history' });
      }
      query.reportId = reportId;
    }
    if (action) query.action = action;
    if (performedBy) query.performedBy = performedBy;
    if (invoiceNumber) {
      query.invoiceNumber = { $regex: invoiceNumber, $options: 'i' };
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('performedBy', 'name email role')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: logs,
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

// @route   GET /api/audit-logs/report/:reportId
// @desc    Get version history for a specific report
// @access  Private
router.get('/report/:reportId', protect, async (req, res) => {
  try {
    if (req.user.role === 'logger') {
      const report = await Report.findOne({ _id: req.params.reportId, createdBy: req.user._id });
      if (!report) return res.status(403).json({ success: false, message: 'Not authorized to view this invoice history' });
    }
    const logs = await AuditLog.find({ reportId: req.params.reportId })
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/audit-logs/:id
// @desc    Get single audit log with full snapshot
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate('performedBy', 'name email role');

    if (!log) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }
    if (req.user.role === 'logger') {
      const report = await Report.findOne({ _id: log.reportId, createdBy: req.user._id });
      if (!report) return res.status(403).json({ success: false, message: 'Not authorized to view this audit log' });
    }

    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
