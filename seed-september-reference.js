require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Report = require('./server/models/Report');
const AuditLog = require('./server/models/AuditLog');
const Counter = require('./server/models/Counter');
const User = require('./server/models/User');
const { amountInWords } = require('./server/utils/amountInWords');

const sourcePath = process.argv[2] || path.join(process.env.USERPROFILE || 'C:\\Users\\nikhi', 'Downloads', 'GST SALES SEP2026.xlsx');
const parseDate = (value) => {
  const [day, month, year] = String(value).split('.').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

async function seedReferenceMonth() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  const sheet = workbook.getWorksheet('Sales Invoice');
  if (!sheet) throw new Error('Sales Invoice sheet was not found in the supplied workbook');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const creator = await User.findOne({ role: 'admin' }) || await User.findOne({ role: 'logger' });
    if (!creator) throw new Error('Create an admin or logger before seeding the reference month');
    await Promise.all([Report.deleteMany({}), AuditLog.deleteMany({}), Counter.deleteMany({})]);
    const reports = [];
    for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const invoiceNumber = row.getCell(3).text.trim();
      if (!invoiceNumber) continue;
      const taxable = Number(row.getCell(12).value?.result ?? row.getCell(12).value ?? 0);
      const taxRate = Number(row.getCell(13).value ?? 0) * 100;
      const cgstAmount = Number((taxable * taxRate / 200).toFixed(2));
      const sgstAmount = Number((taxable * taxRate / 200).toFixed(2));
      const grandTotal = Number((taxable + cgstAmount + sgstAmount).toFixed(2));
      const sequenceNumber = Number(invoiceNumber.split('/')[0]);
      const invoiceDate = parseDate(row.getCell(2).text);
      const status = sequenceNumber % 3 === 0 ? 'draft' : 'locked';
      const paidAmount = sequenceNumber % 5 === 0 ? grandTotal : sequenceNumber % 4 === 0 ? Number((grandTotal / 2).toFixed(2)) : 0;
      const balanceAmount = Number((grandTotal - paidAmount).toFixed(2));
      const paymentStatus = paidAmount === 0 ? 'pending' : balanceAmount === 0 ? 'paid' : 'partial';
      const report = await Report.create({
        invoiceNumber, sequenceNumber, financialYear: invoiceNumber.split('/')[1], invoiceDate,
        invoiceType: taxRate === 18 ? 'gst' : taxRate === 5 ? 'non_gst' : 'gst_returnable',
        partyDetails: { name: row.getCell(4).text, gstin: row.getCell(5).text, state: row.getCell(6).text },
        lineItems: [{ sno: 1, description: row.getCell(8).text, hsnCode: row.getCell(9).text, exportHsnCode: row.getCell(9).text, quantity: Number(row.getCell(10).value || 1) || 1, exportQuantity: row.getCell(10).value === null ? '' : row.getCell(10).value, uom: row.getCell(11).text || 'OTH', rate: Number((taxable / (Number(row.getCell(10).value) || 1)).toFixed(4)), amount: taxable }],
        totalAmount: taxable, cgstRate: taxRate / 2, cgstAmount, sgstRate: taxRate / 2, sgstAmount, igstRate: 0, igstAmount: 0, grandTotal, amountInWords: amountInWords(grandTotal),
        paymentStatus, paidAmount, balanceAmount, status, isLocked: status === 'locked', lockedBy: status === 'locked' ? creator._id : undefined, lockedAt: status === 'locked' ? invoiceDate : undefined,
        createdBy: creator._id, lastModifiedBy: creator._id, notes: row.getCell(18).text
      });
      reports.push(report);
      await AuditLog.create({ reportId: report._id, invoiceNumber, action: 'created', performedBy: creator._id, version: 1, snapshot: report.toObject() });
    }
    const maximumSequence = Math.max(...reports.map((report) => report.sequenceNumber));
    await Counter.create({ _id: 'invoiceNumber', financialYear: '2026-27', seq: maximumSequence });
    console.log(`Reset invoice data and seeded ${reports.length} September 2026 reference invoices from ${sourcePath}`);
  } finally { await mongoose.disconnect(); }
}

seedReferenceMonth().catch((error) => { console.error(error); process.exitCode = 1; });
