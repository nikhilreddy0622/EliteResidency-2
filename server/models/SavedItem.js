const mongoose = require('mongoose');

// Reusable item descriptions are independent from issued invoices. Editing a
// saved item therefore never changes a historical invoice line.
const savedItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  hsnCode: { type: String, trim: true },
  uom: { type: String, trim: true, default: 'NOS' },
  defaultRate: { type: Number, min: 0, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

savedItemSchema.index({ description: 1 }, { unique: true });

module.exports = mongoose.model('SavedItem', savedItemSchema);
