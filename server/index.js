const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const auditLogRoutes = require('./routes/auditLogs');
const customerRoutes = require('./routes/customers');
const { seedCustomers } = require('./seedCustomers');
const Report = require('./models/Report');

const app = express();

const normalizeLegacyInvoices = async () => {
  // Legacy "finalized" documents are equivalent to confirmed invoices and are
  // migrated once to the new immutable locked state without touching their IDs.
  await Report.updateMany(
    { status: 'finalized' },
    { $set: { status: 'locked', isLocked: true } }
  );
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/customers', customerRoutes);

// Root & Health check
app.get('/', (req, res) => {
  res.json({ message: 'Elite Residency API is running', status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const startServer = async () => {
  const PORT = process.env.PORT || 5000;
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await normalizeLegacyInvoices();
    await seedCustomers();
    console.log('✅ MongoDB connected successfully (Compass-compatible at mongodb://localhost:27017/elite-residency)');
  } catch (err) {
    console.warn('⚠️ Local MongoDB not found, falling back to in-memory database...');
    const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    await normalizeLegacyInvoices();
    await seedCustomers();
    console.log(`✅ MongoDB Memory Server connected at ${mongoUri}`);
    
    // Seed database since it's a fresh in-memory instance
    try {
      const { execSync } = require('child_process');
      execSync('node seed-data.js', { env: { ...process.env, MONGODB_URI: mongoUri } });
      console.log('✅ Database seeded automatically.');
    } catch (e) {
      console.error('Failed to seed DB automatically:', e.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();
