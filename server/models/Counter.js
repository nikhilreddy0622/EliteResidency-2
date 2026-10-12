const mongoose = require('mongoose');

// Counter schema for sequential invoice numbering
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  financialYear: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.statics.getNextSequence = async function(financialYear, session = null) {
  // A single atomic document is shared by every financial year.  The update
  // pipeline also moves legacy counters below 100 to the agreed starting point.
  const counter = await this.findOneAndUpdate(
    { _id: 'invoiceNumber' },
    [{
      $set: {
        financialYear,
        seq: { $add: [{ $max: [{ $ifNull: ['$seq', 100] }, 100] }, 1] }
      }
    }],
    { new: true, upsert: true, setDefaultsOnInsert: false, session }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
