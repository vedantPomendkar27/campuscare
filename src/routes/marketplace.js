const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/v1/marketplace/items - Query items with filters
router.get('/items', async (req, res) => {
  try {
    const { category, listing_type, search, condition, status } = req.query;

    let sql = `
      SELECT m.*, u.full_name as owner_name, u.department as owner_dept, u.email as owner_email, u.phone as owner_phone
      FROM marketplace_items m
      JOIN users u ON m.owner_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND m.category = ?';
      params.push(category);
    }

    if (listing_type && listing_type !== 'All') {
      sql += ' AND m.listing_type = ?';
      params.push(listing_type);
    }

    if (condition && condition !== 'All') {
      sql += ' AND m.item_condition = ?';
      params.push(condition);
    }

    if (status && status !== 'All') {
      sql += ' AND m.status = ?';
      params.push(status);
    } else if (!status) {
      // By default show AVAILABLE items first
      sql += " AND m.status != 'COMPLETED'";
    }

    if (search && search.trim().length > 0) {
      sql += ' AND (m.title LIKE ? OR m.description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY m.created_at DESC';

    const [items] = await db.query(sql, params);
    return res.json({ success: true, items });
  } catch (err) {
    console.error('Marketplace query error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch items: ' + err.message });
  }
});

// GET /api/v1/marketplace/items/:id - Specific item
router.get('/items/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.*, u.full_name as owner_name, u.department as owner_dept, u.email as owner_email, u.phone as owner_phone, u.roll_number as owner_roll
       FROM marketplace_items m
       JOIN users u ON m.owner_id = u.user_id
       WHERE m.item_id = ?`,
      [req.params.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    return res.json({ success: true, item: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/marketplace/items - Create item
router.post('/items', authenticate, upload.single('image'), async (req, res) => {
  try {
    const { title, category, listing_type, price, item_condition, description } = req.body;

    if (!title || !category || !listing_type) {
      return res.status(400).json({ success: false, message: 'Title, category, and listing type are required.' });
    }

    let imageUrl = '/images/items/default-item.svg';
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }

    const [result] = await db.query(
      `INSERT INTO marketplace_items (owner_id, title, category, listing_type, price, item_condition, description, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
      [
        req.user.user_id,
        title.trim(),
        category,
        listing_type,
        price ? parseFloat(price) : 0.0,
        item_condition || 'Good',
        description || '',
        imageUrl
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Item listed successfully!',
      itemId: result.insertId
    });
  } catch (err) {
    console.error('Create marketplace item error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list item: ' + err.message });
  }
});

// POST /api/v1/marketplace/items/:id/request - Send request for item
router.post('/items/:id/request', authenticate, async (req, res) => {
  try {
    const itemId = req.params.id;
    const { request_type, proposed_duration, message, contact_phone } = req.body;

    // Fetch item
    const [items] = await db.query('SELECT * FROM marketplace_items WHERE item_id = ?', [itemId]);
    if (!items || items.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }
    const item = items[0];

    if (item.owner_id === req.user.user_id) {
      return res.status(400).json({ success: false, message: 'You cannot request your own listed item.' });
    }

    if (item.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'This item is no longer available.' });
    }

    // Check if user already has an active pending request
    const [existing] = await db.query(
      "SELECT request_id FROM marketplace_requests WHERE item_id = ? AND requester_id = ? AND status = 'PENDING'",
      [itemId, req.user.user_id]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: 'You already have a pending request for this item.' });
    }

    const [reqResult] = await db.query(
      `INSERT INTO marketplace_requests (item_id, requester_id, request_type, proposed_duration, message, contact_phone, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        itemId,
        req.user.user_id,
        request_type || (item.listing_type === 'BORROW' ? 'BORROW' : 'BUY'),
        proposed_duration || null,
        message || 'Interested in this item.',
        contact_phone || req.user.phone || ''
      ]
    );

    // Notify item owner
    await db.query(
      `INSERT INTO notifications (user_id, title, message, link)
       VALUES (?, ?, ?, ?)`,
      [
        item.owner_id,
        `New Request for "${item.title}"`,
        `${req.user.full_name} has requested your item (${request_type || item.listing_type}).`,
        '/marketplace.html#my-requests'
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Request sent to owner successfully! You will be notified when they respond.',
      requestId: reqResult.insertId
    });
  } catch (err) {
    console.error('Request item error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/marketplace/my-activity - Logged in user listings and requests
router.get('/my-activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // My Listings
    const [myItems] = await db.query(
      `SELECT m.*, 
              (SELECT COUNT(*) FROM marketplace_requests r WHERE r.item_id = m.item_id AND r.status = 'PENDING') as pending_requests_count
       FROM marketplace_items m
       WHERE m.owner_id = ?
       ORDER BY m.created_at DESC`,
      [userId]
    );

    // Requests Received on My Items
    const [receivedRequests] = await db.query(
      `SELECT r.*, m.title as item_title, m.listing_type, m.price, u.full_name as requester_name, u.email as requester_email, u.department as requester_dept, u.phone as requester_phone
       FROM marketplace_requests r
       JOIN marketplace_items m ON r.item_id = m.item_id
       JOIN users u ON r.requester_id = u.user_id
       WHERE m.owner_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    // Requests Sent by Me
    const [sentRequests] = await db.query(
      `SELECT r.*, m.title as item_title, m.listing_type, m.price, m.status as item_status, u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email
       FROM marketplace_requests r
       JOIN marketplace_items m ON r.item_id = m.item_id
       JOIN users u ON m.owner_id = u.user_id
       WHERE r.requester_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      myItems,
      receivedRequests,
      sentRequests
    });
  } catch (err) {
    console.error('My marketplace activity error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/marketplace/requests/:id/respond - Owner accepts or rejects request
router.post('/requests/:id/respond', authenticate, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { action } = req.body; // 'ACCEPT' or 'REJECT'

    if (!['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be ACCEPT or REJECT.' });
    }

    const [reqs] = await db.query(
      `SELECT r.*, m.owner_id, m.title as item_title 
       FROM marketplace_requests r 
       JOIN marketplace_items m ON r.item_id = m.item_id 
       WHERE r.request_id = ?`,
      [requestId]
    );

    if (!reqs || reqs.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const reqData = reqs[0];
    if (reqData.owner_id !== req.user.user_id && req.user.role_name !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this item.' });
    }

    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    await db.query('UPDATE marketplace_requests SET status = ? WHERE request_id = ?', [newStatus, requestId]);

    if (action === 'ACCEPT') {
      // Mark item as RESERVED
      await db.query("UPDATE marketplace_items SET status = 'RESERVED' WHERE item_id = ?", [reqData.item_id]);

      // Notify requester
      await db.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES (?, ?, ?, ?)`,
        [
          reqData.requester_id,
          `Request Accepted for "${reqData.item_title}"!`,
          `Good news! Your request was accepted by the owner. Check contacts to coordinate exchange.`,
          '/marketplace.html#my-requests'
        ]
      );
    } else {
      // Notify requester of rejection
      await db.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES (?, ?, ?, ?)`,
        [
          reqData.requester_id,
          `Request Declined for "${reqData.item_title}"`,
          `The owner was unable to accept your request at this time.`,
          '/marketplace.html'
        ]
      );
    }

    return res.json({
      success: true,
      message: `Request has been ${newStatus.toLowerCase()} successfully.`
    });
  } catch (err) {
    console.error('Respond request error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/marketplace/items/:id/status - Mark RESERVED or COMPLETED
router.put('/items/:id/status', authenticate, async (req, res) => {
  try {
    const itemId = req.params.id;
    const { status } = req.body;

    const [items] = await db.query('SELECT owner_id FROM marketplace_items WHERE item_id = ?', [itemId]);
    if (!items || items.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (items[0].owner_id !== req.user.user_id && req.user.role_name !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    await db.query('UPDATE marketplace_items SET status = ? WHERE item_id = ?', [status, itemId]);
    return res.json({ success: true, message: `Item marked as ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
