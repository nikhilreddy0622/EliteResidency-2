const express = require('express');
const SavedItem = require('../models/SavedItem');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const query = search ? { description: { $regex: search, $options: 'i' } } : {};
    const items = await SavedItem.find(query).sort({ description: 1 }).limit(100).lean();
    res.json({ success: true, data: items });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, authorize('admin', 'logger'), async (req, res) => {
  try {
    const details = req.body;
    if (!details.description?.trim()) return res.status(400).json({ success: false, message: 'Item description is required' });
    const item = await SavedItem.findOneAndUpdate(
      { description: details.description.trim() },
      { ...details, description: details.description.trim(), createdBy: req.user._id, lastModifiedBy: req.user._id },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, message: err.code === 11000 ? 'An item with this description already exists' : err.message }); }
});

router.put('/:id', protect, authorize('admin', 'logger'), async (req, res) => {
  try {
    if (!req.body.description?.trim()) return res.status(400).json({ success: false, message: 'Item description is required' });
    const item = await SavedItem.findByIdAndUpdate(req.params.id, { ...req.body, description: req.body.description.trim(), lastModifiedBy: req.user._id }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Saved item not found' });
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, message: err.code === 11000 ? 'An item with this description already exists' : err.message }); }
});

router.delete('/:id', protect, authorize('admin', 'logger'), async (req, res) => {
  try {
    const item = await SavedItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Saved item not found' });
    res.json({ success: true, message: 'Saved item deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
