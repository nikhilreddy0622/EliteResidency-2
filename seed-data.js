require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');
const Report = require('./server/models/Report');
const AuditLog = require('./server/models/AuditLog');
const Counter = require('./server/models/Counter');

// Hardcoded Data to Seed
const usersData = [
  { name: 'System Admin', email: 'admin@elite.com', password: 'password123', role: 'admin' },
  { name: 'Data Logger', email: 'logger@elite.com', password: 'password123', role: 'logger' },
  { name: 'Guest Viewer', email: 'viewer@elite.com', password: 'password123', role: 'viewer' }
];

const reportsData = [
  {
    status: 'locked',
    isLocked: true,
    partyDetails: { name: 'Reliance Industries', address: 'Mumbai, MH', gstin: '27AAACA1234A1Z5', state: 'Maharashtra', stateCode: '27', phone: '9876543210' },
    lineItems: [
      { sno: 1, description: 'Consulting Services', quantity: 1, rate: 50000, amount: 50000, hsnCode: '9983' }
    ],
    totalAmount: 50000,
    cgstRate: 9, cgstAmount: 4500,
    sgstRate: 9, sgstAmount: 4500,
    igstRate: 0, igstAmount: 0,
    grandTotal: 59000,
    amountInWords: 'FIFTY NINE THOUSAND RUPEES ONLY'
  },
  {
    status: 'locked',
    isLocked: true,
    partyDetails: { name: 'Tata Consultancy', address: 'Pune, MH', gstin: '27AAACT1111A1Z1', state: 'Maharashtra', stateCode: '27', phone: '8877665544' },
    lineItems: [
      { sno: 1, description: 'Software License', quantity: 5, rate: 10000, amount: 50000, hsnCode: '9973' },
      { sno: 2, description: 'Support AMC', quantity: 1, rate: 25000, amount: 25000, hsnCode: '9983' }
    ],
    totalAmount: 75000,
    cgstRate: 0, cgstAmount: 0,
    sgstRate: 0, sgstAmount: 0,
    igstRate: 18, igstAmount: 13500,
    grandTotal: 88500,
    amountInWords: 'EIGHTY EIGHT THOUSAND FIVE HUNDRED RUPEES ONLY'
  },
  {
    status: 'draft',
    isLocked: false,
    partyDetails: { name: 'Adani Power', address: 'Ahmedabad, GJ', gstin: '24AAACA1111A1Z1', state: 'Gujarat', stateCode: '24', phone: '9988776655' },
    lineItems: [
      { sno: 1, description: 'Energy Audit', quantity: 1, rate: 120000, amount: 120000, hsnCode: '9983' }
    ],
    totalAmount: 120000,
    cgstRate: 0, cgstAmount: 0,
    sgstRate: 0, sgstAmount: 0,
    igstRate: 18, igstAmount: 21600,
    grandTotal: 141600,
    amountInWords: 'ONE LAKH FORTY ONE THOUSAND SIX HUNDRED RUPEES ONLY'
  },
  {
    status: 'locked',
    isLocked: true,
    partyDetails: { name: 'Infosys Ltd', address: 'Bangalore, KA', gstin: '29AAACI1111A1Z1', state: 'Karnataka', stateCode: '29', phone: '9999988888' },
    lineItems: [
      { sno: 1, description: 'Server Hardware', quantity: 2, rate: 150000, amount: 300000, hsnCode: '8471' }
    ],
    totalAmount: 300000,
    cgstRate: 0, cgstAmount: 0,
    sgstRate: 0, sgstAmount: 0,
    igstRate: 18, igstAmount: 54000,
    grandTotal: 354000,
    amountInWords: 'THREE LAKH FIFTY FOUR THOUSAND RUPEES ONLY'
  },
  {
    status: 'locked',
    isLocked: true,
    partyDetails: { name: 'Wipro Technologies', address: 'Hyderabad, TS', gstin: '36AAACW1111A1Z1', state: 'Telangana', stateCode: '36', phone: '7777777777' },
    lineItems: [
      { sno: 1, description: 'Networking Setup', quantity: 1, rate: 75000, amount: 75000, hsnCode: '9983' }
    ],
    totalAmount: 75000,
    cgstRate: 9, cgstAmount: 6750,
    sgstRate: 9, sgstAmount: 6750,
    igstRate: 0, igstAmount: 0,
    grandTotal: 88500,
    amountInWords: 'EIGHTY EIGHT THOUSAND FIVE HUNDRED RUPEES ONLY'
  }
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/elite-residency';
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB at ${uri}`);

    // Wipe existing data
    await User.deleteMany();
    await Report.deleteMany();
    await AuditLog.deleteMany();
    await Counter.deleteMany();
    console.log('Cleared existing data.');

    // 1. Seed Users
    const createdUsers = [];
    for (const userData of usersData) {
      const u = await User.create(userData);
      createdUsers.push(u);
    }
    console.log(`Seeded ${createdUsers.length} users successfully.`);

    const adminUser = createdUsers.find(u => u.role === 'admin');
    const loggerUser = createdUsers.find(u => u.role === 'logger');

    // Helper for financial year
    const getFinancialYear = (date) => {
      const d = new Date(date);
      const month = d.getMonth(); 
      const year = d.getFullYear();
      return month >= 3 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
    };

    // 2. Seed Reports
    for (let i = 0; i < reportsData.length; i++) {
      const data = reportsData[i];
      const invoiceDate = new Date();
      // stagger dates a bit to look realistic
      invoiceDate.setDate(invoiceDate.getDate() - (5 - i)); 
      
      const financialYear = getFinancialYear(invoiceDate);

      // Get next counter
      const seqNum = await Counter.getNextSequence(financialYear);
      const invoiceNumber = `${seqNum}/${financialYear}`;
      
      // Randomly assign createdBy to admin or logger
      const creator = i % 2 === 0 ? adminUser : loggerUser;

      const newReport = await Report.create({
        ...data,
        invoiceNumber,
        sequenceNumber: seqNum,
        financialYear,
        invoiceDate,
        createdBy: creator._id,
        lastModifiedBy: creator._id,
        lockedBy: data.isLocked ? adminUser._id : null,
        lockedAt: data.isLocked ? new Date() : null,
      });

      // 3. Create Audit Logs
      await AuditLog.create({
        reportId: newReport._id,
        invoiceNumber,
        action: 'created',
        performedBy: creator._id,
        version: 1,
        snapshot: newReport.toObject(),
        ipAddress: '127.0.0.1'
      });

      if (data.status !== 'draft') {
        await AuditLog.create({
          reportId: newReport._id,
          invoiceNumber,
          action: 'locked',
          performedBy: adminUser._id,
          version: 1,
          changes: [{ field: 'status', oldValue: 'draft', newValue: data.status }],
          snapshot: newReport.toObject(),
          ipAddress: '127.0.0.1'
        });
      }
    }

    console.log(`Seeded ${reportsData.length} reports successfully.`);
    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed Error:', error);
    process.exit(1);
  }
}

seed();
