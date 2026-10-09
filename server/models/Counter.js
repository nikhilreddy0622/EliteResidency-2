const mongoose = require('mongoose');

// Counter schema for sequential invoice numbering
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  financialYear: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.statics.getNextSequence = async function(financialYear) {
  const counter = await this.findOneAndUpdate(
    { _id: 'invoiceNumber', financialYear },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
