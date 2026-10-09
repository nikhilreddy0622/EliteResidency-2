const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Reference to the report
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true
  },

  // Action performed
  action: {
    type: String,
    enum: ['created', 'edited', 'locked', 'unlocked', 'deleted', 'status_changed'],
    required: true
  },

  // Who performed the action
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Version info
  version: {
    type: Number,
    required: true
  },

  // What changed (for edits)
  changes: [{
    field: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed }
  }],

  // Full snapshot of the report at this version
  snapshot: {
    type: mongoose.Schema.Types.Mixed
  },

  // Additional notes
  notes: { type: String, trim: true },

  // IP address (optional)
  ipAddress: { type: String }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ reportId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
