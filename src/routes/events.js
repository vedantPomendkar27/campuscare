const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Generate QR hash string
function generateQRHash(eventId, userId) {
  const secret = 'CampusCare_TRCAC_Pass_Validation_Secret_2026';
  return crypto.createHash('sha256').update(`${eventId}-${userId}-${Date.now()}-${secret}`).digest('hex').slice(0, 32);
}

// GET /api/v1/events - List events
router.get('/', async (req, res) => {
  try {
    const { status, department } = req.query;

    let sql = `
      SELECT e.*, u.full_name as organizer_name,
             (e.seat_capacity - e.registered_count) as remaining_seats
      FROM events e
      JOIN users u ON e.organizer_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    if (department && department !== 'All') {
      sql += ' AND e.department = ?';
      params.push(department);
    }

    sql += ' ORDER BY e.event_date ASC';

    const [events] = await db.query(sql, params);
    return res.json({ success: true, events });
  } catch (err) {
    console.error('Fetch events error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch events: ' + err.message });
  }
});

// GET /api/v1/events/:id - Event detail
router.get('/:id', async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.full_name as organizer_name, u.email as organizer_email,
              (e.seat_capacity - e.registered_count) as remaining_seats
       FROM events e
       JOIN users u ON e.organizer_id = u.user_id
       WHERE e.event_id = ?`,
      [req.params.id]
    );

    if (!events || events.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    return res.json({ success: true, event: events[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/events - Create new event (Admin only)
router.post('/', authenticate, requireRole(['dept_admin', 'super_admin']), upload.single('banner'), async (req, res) => {
  try {
    const { title, department, description, venue, event_date, seat_capacity, has_certificate } = req.body;

    if (!title || !venue || !event_date) {
      return res.status(400).json({ success: false, message: 'Title, venue, and date/time are required.' });
    }

    let bannerUrl = '/images/events/default-event.svg';
    if (req.file) {
      bannerUrl = '/uploads/' + req.file.filename;
    }

    const [result] = await db.query(
      `INSERT INTO events 
       (organizer_id, title, department, description, venue, event_date, seat_capacity, registered_count, has_certificate, banner_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'UPCOMING')`,
      [
        req.user.user_id,
        title.trim(),
        department || req.user.department || 'Computer Science',
        description || '',
        venue.trim(),
        event_date,
        seat_capacity ? parseInt(seat_capacity) : 100,
        has_certificate === '0' || has_certificate === false ? 0 : 1,
        bannerUrl
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Campus event published successfully!',
      eventId: result.insertId
    });
  } catch (err) {
    console.error('Create event error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create event: ' + err.message });
  }
});

// POST /api/v1/events/register/:id - Register for event
router.post('/register/:id', authenticate, async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.user_id;

    // Check event exists and has seats
    const [events] = await db.query('SELECT * FROM events WHERE event_id = ?', [eventId]);
    if (!events || events.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    const event = events[0];

    if (event.registered_count >= event.seat_capacity) {
      return res.status(400).json({ success: false, message: 'Sorry, this event is already fully booked!' });
    }

    // Check if already registered
    const [existing] = await db.query('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?', [eventId, userId]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: 'You have already registered for this event!' });
    }

    const rollPart = req.user.roll_number ? req.user.roll_number.replace(/[^a-zA-Z0-9]/g, '').slice(-4) : 'PASS';
    const ticketCode = `EVT-2026-${eventId}-${rollPart}-${Math.floor(100 + Math.random() * 900)}`;
    const qrHash = generateQRHash(eventId, userId);

    const [regResult] = await db.query(
      `INSERT INTO event_registrations (event_id, user_id, ticket_code, qr_hash, attendance_status)
       VALUES (?, ?, ?, ?, 'REGISTERED')`,
      [eventId, userId, ticketCode, qrHash]
    );

    // Increment count
    await db.query('UPDATE events SET registered_count = registered_count + 1 WHERE event_id = ?', [eventId]);

    // Generate QR Code Data URL
    const qrDataPayload = JSON.stringify({
      app: 'CampusCare',
      ticketCode,
      qrHash,
      eventId: event.event_id,
      userId
    });
    const qrDataUrl = await QRCode.toDataURL(qrDataPayload, { width: 300, margin: 2 });

    // Send notification
    await db.query(
      `INSERT INTO notifications (user_id, title, message, link)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        `Event Pass Confirmed: ${event.title}`,
        `Your seat is reserved. QR Entry Pass generated (${ticketCode}).`,
        '/events.html#passes'
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your entry pass is ready.',
      ticketCode,
      qrHash,
      qrDataUrl
    });
  } catch (err) {
    console.error('Event registration error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/events/my-passes - Retrieve user's registered passes
router.get('/user/my-passes', authenticate, async (req, res) => {
  try {
    const [passes] = await db.query(
      `SELECT r.*, e.title as event_title, e.venue, e.event_date, e.department as event_dept, e.has_certificate
       FROM event_registrations r
       JOIN events e ON r.event_id = e.event_id
       WHERE r.user_id = ?
       ORDER BY e.event_date DESC`,
      [req.user.user_id]
    );

    // Generate QR codes for passes
    const passesWithQr = await Promise.all(
      passes.map(async (p) => {
        const qrPayload = JSON.stringify({
          app: 'CampusCare',
          ticketCode: p.ticket_code,
          qrHash: p.qr_hash,
          eventId: p.event_id,
          userId: p.user_id
        });
        const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 250, margin: 2 });
        return { ...p, qrDataUrl };
      })
    );

    return res.json({ success: true, passes: passesWithQr });
  } catch (err) {
    console.error('My passes error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/events/verify-pass - Gate Scanner verification
router.post('/verify-pass', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const { qr_string, ticket_code } = req.body;

    let searchHash = null;
    let searchTicket = null;

    if (qr_string) {
      try {
        const parsed = JSON.parse(qr_string);
        searchHash = parsed.qrHash;
        searchTicket = parsed.ticketCode;
      } catch (e) {
        // Plain text string or raw hash
        searchHash = qr_string.trim();
        searchTicket = qr_string.trim();
      }
    } else if (ticket_code) {
      searchTicket = ticket_code.trim();
    }

    if (!searchHash && !searchTicket) {
      return res.status(400).json({ success: false, message: 'QR token or Ticket Code is required.' });
    }

    const [rows] = await db.query(
      `SELECT r.*, e.title as event_title, e.venue, e.event_date,
              u.full_name as student_name, u.roll_number, u.department as student_dept, u.email as student_email
       FROM event_registrations r
       JOIN events e ON r.event_id = e.event_id
       JOIN users u ON r.user_id = u.user_id
       WHERE r.qr_hash = ? OR r.ticket_code = ?`,
      [searchHash || searchTicket, searchTicket || searchHash]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        status: 'INVALID',
        message: 'Invalid Pass! No matching registration record found in database.'
      });
    }

    const reg = rows[0];

    // Check if already scanned
    if (reg.attendance_status === 'ATTENDED') {
      return res.status(200).json({
        success: false,
        status: 'ALREADY_USED',
        message: `Warning: This pass was already scanned at ${reg.attended_at || 'earlier today'}! Duplicate entry prohibited.`,
        pass: reg
      });
    }

    // Mark as ATTENDED
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await db.query(
      `UPDATE event_registrations 
       SET attendance_status = 'ATTENDED', attended_at = ?, certificate_issued = 1 
       WHERE registration_id = ?`,
      [nowStr, reg.registration_id]
    );

    return res.json({
      success: true,
      status: 'VERIFIED',
      message: 'Pass Verified! Welcome to the event.',
      pass: {
        ...reg,
        attendance_status: 'ATTENDED',
        attended_at: nowStr
      }
    });
  } catch (err) {
    console.error('Verify pass error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/events/certificate/:regId - Certificate details
router.get('/certificate/:regId', authenticate, async (req, res) => {
  try {
    const regId = req.params.regId;

    const [rows] = await db.query(
      `SELECT r.*, e.title as event_title, e.department as event_dept, e.event_date, e.venue,
              u.full_name as student_name, u.roll_number, u.department as student_dept
       FROM event_registrations r
       JOIN events e ON r.event_id = e.event_id
       JOIN users u ON r.user_id = u.user_id
       WHERE r.registration_id = ?`,
      [regId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate record not found.' });
    }

    const cert = rows[0];

    if (cert.attendance_status !== 'ATTENDED') {
      return res.status(400).json({
        success: false,
        message: 'Certificate is only available for attendees who have verified entry at the gate.'
      });
    }

    return res.json({
      success: true,
      certificate: {
        certificateId: `TRCAC-CC-CERT-${cert.registration_id}-${cert.user_id}`,
        studentName: cert.student_name,
        rollNumber: cert.roll_number,
        department: cert.student_dept,
        eventTitle: cert.event_title,
        eventDate: cert.event_date,
        venue: cert.venue,
        college: 'Thakur Ramnarayan College of Arts and Commerce',
        signatoryGuide: 'Dr. Sandeep Kamble (HOD, Computer Science)',
        signatoryPrincipal: 'Dr. Sumathi Rajkumar (Principal)',
        issuedAt: cert.attended_at || cert.created_at
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
