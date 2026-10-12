const Customer = require('./models/Customer');

const initialCustomers = [
  {
    name: 'ITC Limited',
    address: 'ITC Limited PSPD, Sarapaka, Bhadradri Kothagudem district, Telangana State, Pin Code-507128',
    gstin: '36AAACI5950L1ZB',
    panNo: 'AAACI5950L',
    state: 'Telangana',
    stateCode: '36',
    phone: '08746-243332'
  },
  {
    name: 'SRI BHUPATHI TRANSPORTATION',
    address: 'D.NO6-421/19, Vijayawada Road, Jaggiahpeta, NTR Dist., Andhra Pradesh, PIN:521175',
    gstin: '37ABSFS2725F1ZV',
    panNo: 'ABSFS2725F',
    state: 'Andhra Pradesh',
    stateCode: '37',
    hsnCode: '2621.90.00'
  },
  {
    name: 'PVR REDDY TRADERS',
    address: 'R.S NO.252, 253 AND 262, BHURGAMPAHAD MANDALAM, SARAPAKA, BHADRADRI KOTHAGUDEM, TELANGANA, 507128',
    gstin: '36ANFPP1286M1ZI',
    panNo: 'ANFPP1286M',
    state: 'Telangana',
    stateCode: '36',
    hsnCode: '2621.90.00'
  }
];

async function seedCustomers() {
  await Promise.all(initialCustomers.map((customer) => Customer.findOneAndUpdate(
    { gstin: customer.gstin },
    { $setOnInsert: customer },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )));
}

module.exports = { seedCustomers, initialCustomers };
