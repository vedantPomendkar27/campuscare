const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/v1/notifications - User notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const [notifications] = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 25`,
      [req.user.user_id]
    );

    const [unread] = await db.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = ? AND is_read = 0`,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      unreadCount: unread[0] ? unread[0].count : 0,
      notifications
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/notifications/:id/read - Mark one as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/notifications/read-all - Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.user_id]);
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
