const express = require('express');
const Customer = require('../models/Customer');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const query = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
        { panNo: { $regex: search, $options: 'i' } }
      ]
    } : {};
    const customers = await Customer.find(query).sort({ name: 1 }).limit(50);
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, authorize('admin', 'logger'), async (req, res) => {
  try {
    const details = req.body;
    if (!details.name?.trim()) return res.status(400).json({ success: false, message: 'Customer name is required' });

    const key = details.gstin?.trim()
      ? { gstin: details.gstin.trim().toUpperCase() }
      : { name: details.name.trim(), panNo: (details.panNo || '').trim().toUpperCase() };
    const customer = await Customer.findOneAndUpdate(
      key,
      { ...details, createdBy: req.user._id, lastModifiedBy: req.user._id },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
