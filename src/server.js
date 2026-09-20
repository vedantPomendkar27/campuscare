require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const db = require('./config/db');

const authRoutes = require('./routes/auth');
const marketplaceRoutes = require('./routes/marketplace');
const lostFoundRoutes = require('./routes/lostFound');
const complaintsRoutes = require('./routes/complaints');
const eventsRoutes = require('./routes/events');
const adminRoutes = require('./routes/admin');
const sosRoutes = require('./routes/sos');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Standard Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/lost-found', lostFoundRoutes);
app.use('/api/v1/complaints', complaintsRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/sos', sosRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    application: 'CampusCare - A Centralized Campus Utility & Support Web Application',
    institution: 'Thakur Ramnarayan College of Arts and Commerce',
    student: 'Vedant Milind Pomendkar (Roll No: 2407106)',
    databaseEngine: db.getMode(),
    timestamp: new Date().toISOString()
  });
});

// Central 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// Fallback to index.html for root if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server after initializing DB
async function startServer() {
  try {
    await db.initDatabase();
    app.listen(PORT, () => {
      console.log('================================================================');
      console.log('  \x1b[36mCAMPUSCARE - Centralized Campus Utility & Support System\x1b[0m');
      console.log('  Thakur Ramnarayan College of Arts and Commerce');
      console.log(`  Server running live at: \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
      console.log(`  Active Database Engine: \x1b[33m${db.getMode().toUpperCase()}\x1b[0m`);
      console.log('================================================================');
    });
  } catch (err) {
    console.error('Fatal Server Initialization Error:', err);
    process.exit(1);
  }
}

startServer();
