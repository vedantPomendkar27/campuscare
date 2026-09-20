const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Generate unique ticket code e.g. CMP-2026-1025
function generateTicketCode() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `CMP-${year}-${randomNum}`;
}

// Automatic department routing mapping based on category
function getAssignedDepartment(category) {
  switch (category) {
    case 'IT & Labs':
      return 'IT & Computer Science Dept';
    case 'Sanitation & Hygiene':
      return 'Campus Housekeeping & Sanitation';
    case 'Infrastructure & Maintenance':
      return 'Estate & Electrical Maintenance';
    case 'Library':
      return 'Library Information Section';
    case 'Academic & Canteen':
      return 'Student Affairs & Canteen Committee';
    case 'Security & Safety':
      return 'Campus Security Cell';
    default:
      return 'General Campus Administration';
  }
}

// POST /api/v1/complaints - Submit new grievance
router.post('/', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const { title, category, location, urgency, description } = req.body;

    if (!title || !category || !location || !description) {
      return res.status(400).json({ success: false, message: 'Title, category, location, and description are required.' });
    }

    const ticketCode = generateTicketCode();
    const departmentAssigned = getAssignedDepartment(category);

    let photoUrl = null;
    if (req.file) {
      photoUrl = '/uploads/' + req.file.filename;
    }

    const [result] = await db.query(
      `INSERT INTO complaints 
       (ticket_code, user_id, department_assigned, category, location, urgency, title, description, photo_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
      [
        ticketCode,
        req.user.user_id,
        departmentAssigned,
        category,
        location.trim(),
        urgency || 'MEDIUM',
        title.trim(),
        description.trim(),
        photoUrl
      ]
    );

    const complaintId = result.insertId;

    // Add to timeline
    await db.query(
      `INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by)
       VALUES (?, 'SUBMITTED', 'Grievance ticket created by student', ?)`,
      [complaintId, req.user.user_id]
    );

    // Create user notification
    await db.query(
      `INSERT INTO notifications (user_id, title, message, link)
       VALUES (?, ?, ?, ?)`,
      [
        req.user.user_id,
        `Grievance Registered: ${ticketCode}`,
        `Your complaint "${title}" has been assigned to ${departmentAssigned}.`,
        '/complaints.html'
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Grievance submitted successfully! Your tracking code is ' + ticketCode,
      ticketCode,
      complaintId
    });
  } catch (err) {
    console.error('Submit complaint error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit grievance: ' + err.message });
  }
});

// GET /api/v1/complaints/my - Logged-in user's complaints
router.get('/my', authenticate, async (req, res) => {
  try {
    const [complaints] = await db.query(
      `SELECT * FROM complaints 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );

    return res.json({ success: true, complaints });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/complaints/all - Admin query with filters
router.get('/all', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const { category, urgency, status, search } = req.query;

    let sql = `
      SELECT c.*, u.full_name as student_name, u.email as student_email, u.roll_number, u.phone as student_phone
      FROM complaints c
      JOIN users u ON c.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND c.category = ?';
      params.push(category);
    }

    if (urgency && urgency !== 'All') {
      sql += ' AND c.urgency = ?';
      params.push(urgency);
    }

    if (status && status !== 'All') {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    if (search && search.trim().length > 0) {
      sql += ' AND (c.ticket_code LIKE ? OR c.title LIKE ? OR c.description LIKE ? OR c.location LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY c.created_at DESC';

    const [complaints] = await db.query(sql, params);
    return res.json({ success: true, complaints });
  } catch (err) {
    console.error('Admin complaints error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/complaints/:id - Complaint details and timeline
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [complaints] = await db.query(
      `SELECT c.*, u.full_name as student_name, u.email as student_email, u.roll_number, u.phone as student_phone, u.department as student_dept
       FROM complaints c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.complaint_id = ?`,
      [req.params.id]
    );

    if (!complaints || complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = complaints[0];

    // Authorization check: only owner or admins
    if (complaint.user_id !== req.user.user_id && !['dept_admin', 'super_admin'].includes(req.user.role_name)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Get timeline
    const [timeline] = await db.query(
      `SELECT t.*, u.full_name as updated_by_name, r.role_name 
       FROM complaint_timeline t
       LEFT JOIN users u ON t.updated_by = u.user_id
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE t.complaint_id = ?
       ORDER BY t.created_at ASC`,
      [req.params.id]
    );

    return res.json({ success: true, complaint, timeline });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/complaints/:id/status - Admin update status and notes
router.put('/:id/status', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { status, resolution_notes } = req.body;

    const validStatuses = ['SUBMITTED', 'UNDER REVIEW', 'IN PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint status.' });
    }

    const [complaints] = await db.query('SELECT * FROM complaints WHERE complaint_id = ?', [complaintId]);
    if (!complaints || complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = complaints[0];

    await db.query(
      `UPDATE complaints 
       SET status = ?, resolution_notes = COALESCE(?, resolution_notes)
       WHERE complaint_id = ?`,
      [status, resolution_notes || null, complaintId]
    );

    // Add to timeline
    await db.query(
      `INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by)
       VALUES (?, ?, ?, ?)`,
      [complaintId, status, resolution_notes || `Status updated to ${status} by Administrator`, req.user.user_id]
    );

    // Notify student
    await db.query(
      `INSERT INTO notifications (user_id, title, message, link)
       VALUES (?, ?, ?, ?)`,
      [
        complaint.user_id,
        `Grievance Update: ${complaint.ticket_code} is ${status}`,
        resolution_notes ? `Notes: ${resolution_notes}` : `Status has been updated to ${status}.`,
        '/complaints.html'
      ]
    );

    return res.json({
      success: true,
      message: `Complaint ${complaint.ticket_code} updated to ${status}.`
    });
  } catch (err) {
    console.error('Update complaint status error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/complaints/:id/feedback - Student submits 1-5 star rating and remarks
router.post('/:id/feedback', authenticate, async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5.' });
    }

    const [complaints] = await db.query('SELECT user_id, ticket_code, status FROM complaints WHERE complaint_id = ?', [complaintId]);
    if (!complaints || complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (complaints[0].user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You can only rate your own complaints.' });
    }

    await db.query(
      `UPDATE complaints 
       SET rating = ?, feedback = ?, status = 'CLOSED' 
       WHERE complaint_id = ?`,
      [rating, feedback || '', complaintId]
    );

    await db.query(
      `INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by)
       VALUES (?, 'CLOSED', ?, ?)`,
      [complaintId, `Student submitted ${rating}-star rating and closed grievance.`, req.user.user_id]
    );

    return res.json({
      success: true,
      message: 'Thank you for your feedback! The grievance is now CLOSED.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
