const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// POST /api/v1/sos/trigger - Trigger emergency SOS with GPS coordinates
router.post('/trigger', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, location_name } = req.body;

    const [result] = await db.query(
      `INSERT INTO sos_alerts (user_id, latitude, longitude, location_name, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [
        req.user.user_id,
        latitude ? parseFloat(latitude) : 19.2568, // Default approx TRCAC Mumbai coordinate
        longitude ? parseFloat(longitude) : 72.8687,
        location_name || 'Campus Main Grounds / Academic Wing'
      ]
    );

    const sosId = result.insertId;

    // Broadcast notification to all admins
    const [admins] = await db.query('SELECT user_id FROM users WHERE role_id IN (1, 2)');
    for (const admin of admins) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES (?, ?, ?, ?)`,
        [
          admin.user_id,
          `EMERGENCY SOS ALERT! [${req.user.full_name}]`,
          `Student ${req.user.full_name} (${req.user.roll_number}, Phone: ${req.user.phone || 'N/A'}) triggered an Emergency SOS near ${location_name || 'Campus Grounds'}. Immediate security intervention requested.`,
          '/admin-dashboard.html#sos'
        ]
      );
    }

    return res.status(201).json({
      success: true,
      sosId,
      message: 'EMERGENCY SOS DISPATCHED! Campus Security and Department Staff have been alerted to your position.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('SOS trigger error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/sos/active - View active SOS alerts (Admin only)
router.get('/active', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const [alerts] = await db.query(`
      SELECT s.*, u.full_name as student_name, u.roll_number, u.phone as student_phone, u.department, u.email
      FROM sos_alerts s
      JOIN users u ON s.user_id = u.user_id
      ORDER BY s.created_at DESC
      LIMIT 20
    `);

    return res.json({ success: true, alerts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/sos/resolve/:id - Resolve SOS alert
router.post('/resolve/:id', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const sosId = req.params.id;
    const { remarks } = req.body;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await db.query(
      `UPDATE sos_alerts 
       SET status = 'RESOLVED', resolved_by = ?, resolution_remarks = ?, resolved_at = ? 
       WHERE sos_id = ?`,
      [req.user.user_id, remarks || 'Attended and resolved by campus security team', nowStr, sosId]
    );

    return res.json({ success: true, message: 'SOS Alert marked as RESOLVED.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
