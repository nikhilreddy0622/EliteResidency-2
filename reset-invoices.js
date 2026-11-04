require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./server/models/Report');
const AuditLog = require('./server/models/AuditLog');
const Counter = require('./server/models/Counter');

const FINANCIAL_YEAR = '2026-27';
const NEXT_INVOICE_NUMBER = 413;

async function resetInvoices() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    // Invoice-only reset: user accounts and saved customer information stay intact.
    const [reports, auditLogs] = await Promise.all([
      Report.deleteMany({}),
      AuditLog.deleteMany({})
    ]);
    await Counter.findByIdAndUpdate(
      'invoiceNumber',
      { _id: 'invoiceNumber', financialYear: FINANCIAL_YEAR, seq: NEXT_INVOICE_NUMBER - 1 },
      { upsert: true, new: true, setDefaultsOnInsert: false }
    );
    const remainingReports = await Report.countDocuments();
    const counter = await Counter.findById('invoiceNumber').lean();
    if (remainingReports !== 0 || counter.seq !== NEXT_INVOICE_NUMBER - 1) {
      throw new Error('Invoice reset verification failed');
    }
    console.log(`Removed ${reports.deletedCount} invoices and ${auditLogs.deletedCount} audit records. Next invoice: ${NEXT_INVOICE_NUMBER}/${FINANCIAL_YEAR}`);
  } finally {
    await mongoose.disconnect();
  }
}

resetInvoices().catch((error) => { console.error(error); process.exitCode = 1; });
