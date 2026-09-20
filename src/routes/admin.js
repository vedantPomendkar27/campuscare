const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/v1/admin/stats - Overview statistics
router.get('/stats', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalStudents }]] = await db.query('SELECT COUNT(*) as totalStudents FROM users WHERE role_id = 3');
    const [[{ totalComplaints }]] = await db.query('SELECT COUNT(*) as totalComplaints FROM complaints');
    const [[{ pendingComplaints }]] = await db.query("SELECT COUNT(*) as pendingComplaints FROM complaints WHERE status IN ('SUBMITTED', 'UNDER REVIEW')");
    const [[{ inProgressComplaints }]] = await db.query("SELECT COUNT(*) as inProgressComplaints FROM complaints WHERE status = 'IN PROGRESS'");
    const [[{ resolvedComplaints }]] = await db.query("SELECT COUNT(*) as resolvedComplaints FROM complaints WHERE status IN ('RESOLVED', 'CLOSED')");

    const [[{ totalMarketItems }]] = await db.query('SELECT COUNT(*) as totalMarketItems FROM marketplace_items');
    const [[{ availableMarketItems }]] = await db.query("SELECT COUNT(*) as availableMarketItems FROM marketplace_items WHERE status = 'AVAILABLE'");

    const [[{ totalLostFound }]] = await db.query('SELECT COUNT(*) as totalLostFound FROM lost_found_items');
    const [[{ openLostFound }]] = await db.query("SELECT COUNT(*) as openLostFound FROM lost_found_items WHERE status = 'OPEN'");
    const [[{ returnedLostFound }]] = await db.query("SELECT COUNT(*) as returnedLostFound FROM lost_found_items WHERE status = 'RETURNED'");

    const [[{ totalEvents }]] = await db.query('SELECT COUNT(*) as totalEvents FROM events');
    const [[{ totalRegistrations }]] = await db.query('SELECT COUNT(*) as totalRegistrations FROM event_registrations');

    return res.json({
      success: true,
      stats: {
        users: { total: totalUsers, students: totalStudents },
        complaints: { total: totalComplaints, pending: pendingComplaints, inProgress: inProgressComplaints, resolved: resolvedComplaints },
        marketplace: { total: totalMarketItems, available: availableMarketItems },
        lostFound: { total: totalLostFound, open: openLostFound, returned: returnedLostFound },
        events: { total: totalEvents, registrations: totalRegistrations },
        dbMode: db.getMode()
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/admin/users - User management (Super Admin only)
router.get('/users', authenticate, requireRole(['super_admin']), async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.user_id, u.full_name, u.roll_number, u.email, u.phone, u.department, u.year_of_study, 
             u.role_id, u.is_active, u.created_at, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      ORDER BY u.created_at DESC
    `);

    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/users/:id/role - Update user role (Super Admin only)
router.put('/users/:id/role', authenticate, requireRole(['super_admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role_id } = req.body;

    if (!role_id || ![1, 2, 3].includes(parseInt(role_id))) {
      return res.status(400).json({ success: false, message: 'Invalid role_id. Must be 1 (Super Admin), 2 (Dept Admin), or 3 (Student).' });
    }

    if (parseInt(userId) === req.user.user_id) {
      return res.status(400).json({ success: false, message: 'You cannot change your own super admin role.' });
    }

    await db.query('UPDATE users SET role_id = ? WHERE user_id = ?', [role_id, userId]);
    return res.json({ success: true, message: 'User role updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/users/:id/status - Toggle active/deactive status (Super Admin only)
router.put('/users/:id/status', authenticate, requireRole(['super_admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { is_active } = req.body;

    if (parseInt(userId) === req.user.user_id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    await db.query('UPDATE users SET is_active = ? WHERE user_id = ?', [is_active ? 1 : 0, userId]);
    return res.json({
      success: true,
      message: `User account has been ${is_active ? 'activated' : 'deactivated'}.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
