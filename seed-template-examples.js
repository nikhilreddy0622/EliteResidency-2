require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./server/models/Report');
const AuditLog = require('./server/models/AuditLog');
const Counter = require('./server/models/Counter');
const User = require('./server/models/User');
const { seedCustomers } = require('./server/seedCustomers');

const examples = [
  {
    invoiceType: 'gst',
    status: 'draft',
    partyDetails: { name: 'ITC Limited', address: 'ITC Limited PSPD, Sarapaka, Bhadradri Kothagudem district, Telangana State, Pin Code-507128', gstin: '36AAACI5950L1ZB', panNo: 'AAACI5950L', state: 'Telangana', stateCode: '36', phone: '08746-243332' },
    poNumber: '4509115739', vehicleNo: 'AP05TM5359', deliveryChallanNo: 'DC-GST-001',
    lineItems: [{ description: 'PAID HOLIDAY FOR THE MONTH OF MAY 2026', hsnCode: '9985.13', quantity: 30, uom: 'DAYS', rate: 2928.26 }]
  },
  {
    invoiceType: 'gst',
    status: 'locked',
    partyDetails: { name: 'ITC Limited', address: 'ITC Limited PSPD, Sarapaka, Bhadradri Kothagudem district, Telangana State, Pin Code-507128', gstin: '36AAACI5950L1ZB', panNo: 'AAACI5950L', state: 'Telangana', stateCode: '36', phone: '08746-243332' },
    poNumber: '4509113852', vehicleNo: 'AP05TM5360', deliveryChallanNo: 'DC-GST-002',
    lineItems: [{ description: 'SUPPLY OF FLY ASH BRICKS (SIZE: 400 x 200 x 100 MM)', hsnCode: '6815.99.10', quantity: 1500, uom: 'NOS', rate: 24.25 }]
  },
  {
    invoiceType: 'gst_returnable',
    status: 'draft',
    partyDetails: { name: 'SRI BHUPATHI TRANSPORTATION', address: 'D.NO6-421/19, Vijayawada Road, Jaggiahpeta, NTR Dist., Andhra Pradesh, PIN:521175', gstin: '37ABSFS2725F1ZV', panNo: 'ABSFS2725F', state: 'Andhra Pradesh', stateCode: '37' },
    poNumber: 'SBT-RET-001', vehicleNo: 'AP16TB2101', deliveryChallanNo: 'DC-RET-001',
    lineItems: [{ description: 'TRANSPORTATION OF DREG FILTER AND DLM P. LIME WASTE', hsnCode: '9967.91', quantity: 1728.59, uom: 'MT', rate: 390 }]
  },
  {
    invoiceType: 'gst_returnable',
    status: 'locked',
    partyDetails: { name: 'PVR REDDY TRADERS', address: 'R.S NO.252, 253 AND 262, BHURGAMPAHAD MANDALAM, SARAPAKA, BHADRADRI KOTHAGUDEM, TELANGANA, 507128', gstin: '36ANFPP1286M1ZI', panNo: 'ANFPP1286M', state: 'Telangana', stateCode: '36' },
    poNumber: 'PVR-RET-002', vehicleNo: 'TS28TB4321', deliveryChallanNo: 'DC-RET-002',
    lineItems: [{ description: 'TRANSPORTATION SERVICE — TAX RETURNABLE', hsnCode: '9967.91', quantity: 850, uom: 'MT', rate: 390 }]
  },
  {
    invoiceType: 'non_gst',
    status: 'draft',
    partyDetails: { name: 'DASARI VENKAT RAO', address: 'BHURGAMPAHAD', gstin: '', panNo: '', state: 'Telangana', stateCode: '36' },
    poNumber: 'NONGST-001', vehicleNo: 'TS04UA1001', deliveryChallanNo: 'DC-NGST-001',
    lineItems: [{ description: 'FLY ASH NAVA LIMITED', hsnCode: '2621.90.00', quantity: 17.69, uom: 'MT', rate: 120 }]
  },
  {
    invoiceType: 'non_gst',
    status: 'locked',
    partyDetails: { name: 'DASARI VENKAT RAO', address: 'BHURGAMPAHAD', gstin: '', panNo: '', state: 'Telangana', stateCode: '36' },
    poNumber: 'NONGST-002', vehicleNo: 'TS04UA1002', deliveryChallanNo: 'DC-NGST-002',
    lineItems: [{ description: 'FLY ASH SUPPLY', hsnCode: '2621.90.00', quantity: 25, uom: 'MT', rate: 120 }]
  }
];

const financialYearFor = (date) => {
  const year = date.getFullYear();
  return date.getMonth() >= 3 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
};

const createExample = async (example, creator) => {
  const invoiceDate = new Date();
  const financialYear = financialYearFor(invoiceDate);
  const sequenceNumber = await Counter.getNextSequence(financialYear);
  const lineItems = example.lineItems.map((item, index) => ({ ...item, sno: index + 1, amount: Number((item.quantity * item.rate).toFixed(2)) }));
  const totalAmount = Number(lineItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const taxRate = example.invoiceType === 'gst' ? 9 : 2.5;
  const cgstAmount = Number((totalAmount * taxRate / 100).toFixed(2));
  const sgstAmount = Number((totalAmount * taxRate / 100).toFixed(2));
  const grandTotal = example.invoiceType === 'gst_returnable' ? totalAmount : Number((totalAmount + cgstAmount + sgstAmount).toFixed(2));
  const report = await Report.create({
    ...example,
    invoiceNumber: `${sequenceNumber}/${financialYear}`,
    sequenceNumber,
    financialYear,
    invoiceDate,
    lineItems,
    totalAmount,
    cgstRate: taxRate,
    cgstAmount,
    sgstRate: taxRate,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    grandTotal,
    amountInWords: '',
    isLocked: example.status === 'locked',
    lockedBy: example.status === 'locked' ? creator._id : null,
    lockedAt: example.status === 'locked' ? new Date() : null,
    createdBy: creator._id,
    lastModifiedBy: creator._id
  });
  await AuditLog.create({ reportId: report._id, invoiceNumber: report.invoiceNumber, action: 'created', performedBy: creator._id, version: 1, snapshot: report.toObject() });
  if (report.status === 'locked') await AuditLog.create({ reportId: report._id, invoiceNumber: report.invoiceNumber, action: 'locked', performedBy: creator._id, version: 1, snapshot: report.toObject() });
  return report;
};

async function resetAndSeedExamples() {
  await mongoose.connect(process.env.MONGODB_URI);
  const creator = await User.findOne({ role: 'admin' }) || await User.findOne({ role: 'logger' });
  if (!creator) throw new Error('Create an admin or logger before seeding invoice examples');
  await Promise.all([Report.deleteMany({}), AuditLog.deleteMany({}), Counter.deleteMany({})]);
  await seedCustomers();
  const reports = [];
  for (const example of examples) reports.push(await createExample(example, creator));
  console.log(`Reset invoice data and seeded ${reports.length} template examples: ${reports.map((report) => report.invoiceNumber).join(', ')}`);
  await mongoose.disconnect();
}

resetAndSeedExamples().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
