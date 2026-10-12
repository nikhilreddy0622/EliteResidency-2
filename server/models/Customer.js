const mongoose = require('mongoose');

// Reusable party details are deliberately stored separately from invoices so
// updating a customer never changes an already-issued invoice.
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  address: { type: String, trim: true },
  gstin: { type: String, trim: true, uppercase: true, sparse: true, index: true },
  panNo: { type: String, trim: true, uppercase: true },
  state: { type: String, trim: true },
  stateCode: { type: String, trim: true },
  phone: { type: String, trim: true },
  hsnCode: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

customerSchema.index({ gstin: 1 }, { unique: true, sparse: true });
customerSchema.index({ name: 1, panNo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Customer', customerSchema);
