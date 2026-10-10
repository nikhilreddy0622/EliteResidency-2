const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  sno: { type: Number, required: true },
  description: { type: String, required: true, trim: true },
  hsnCode: { type: String, trim: true },
  quantity: { type: Number, required: true },
  uom: { type: String, trim: true, default: 'NOS' },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true }
}, { _id: false });

const reportSchema = new mongoose.Schema({
  // Sequential invoice number (e.g., 371/2026-27)
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  sequenceNumber: {
    type: Number,
    required: true
  },
  financialYear: {
    type: String,
    required: true
  },
  invoiceDate: {
    type: Date,
    required: [true, 'Invoice date is required'],
    default: Date.now
  },

  // Company details (seller)
  companyDetails: {
    name: { type: String, default: 'BHARATH ELITE ENTERPRISES' },
    gstin: { type: String, default: '36AJVPP5821A1Z2' },
    panNo: { type: String, default: 'AJVPP5821A' },
    stateCode: { type: String, default: '36' },
    address: { type: String, default: 'Office D.NO.:2-295, OPP- EAST GATE, SARAPAKA, BURGUMPAHAD MANDAL' },
    city: { type: String, default: 'SARAPAKA -507128 BHADRADRI KOTHAGUDEM DT, TELANGANA STATE' },
    phone: { type: String, default: '08743-232929; 995999-6666' },
    vendorCode: { type: String, default: '1021036' },
    email: { type: String, default: 'bfbprasad@gmail.com' }
  },

  // Delivery Challan
  deliveryChallanNo: { type: String, trim: true },
  billType: { type: String, default: 'CASH/CREDIT BILL' },

  // Party details (buyer)
  partyDetails: {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    gstin: { type: String, trim: true },
    panNo: { type: String, trim: true },
    state: { type: String, trim: true },
    stateCode: { type: String, trim: true },
    poNumber: { type: String, trim: true },
    vendorCode: { type: String, trim: true },
    vehicleNo: { type: String, trim: true },
    phone: { type: String, trim: true }
  },

  // Transport and purchase details shown on the invoice
  poNumber: { type: String, trim: true },
  vehicleNo: { type: String, trim: true },

  // Delivery address
  deliveryAddress: { type: String, trim: true },

  // HSN Code
  hsnCode: { type: String, default: '6815.99.10' },

  // Line items
  lineItems: [lineItemSchema],

  // Amounts
  totalAmount: { type: Number, required: true },
  cgstRate: { type: Number, default: 9 },
  cgstAmount: { type: Number, default: 0 },
  sgstRate: { type: Number, default: 9 },
  sgstAmount: { type: Number, default: 0 },
  igstRate: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  amountInWords: { type: String, trim: true },

  // Bank details
  bankDetails: {
    bankName: { type: String, default: 'HDFC BANK' },
    accountNo: { type: String, default: '22962000000396' },
    ifscCode: { type: String, default: 'HDFC0002296' },
    branch: { type: String, default: 'BHADRACHALAM -507111' }
  },

  // Notes
  notes: { type: String, trim: true },

  // Status & Locking
  status: {
    type: String,
    enum: ['draft', 'finalized', 'locked'],
    default: 'draft'
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lockedAt: {
    type: Date
  },

  // Version tracking
  version: {
    type: Number,
    default: 1
  },

  // Created/Modified by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient querying
reportSchema.index({ invoiceNumber: 1 });
reportSchema.index({ financialYear: 1, sequenceNumber: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ 'partyDetails.name': 1 });
reportSchema.index({ invoiceDate: -1 });
reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
