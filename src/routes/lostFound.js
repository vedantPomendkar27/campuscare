const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/v1/lost-found/reports - Fetch reports
router.get('/reports', async (req, res) => {
  try {
    const { report_type, category, search, status } = req.query;

    let sql = `
      SELECT l.*, u.full_name as reporter_name, u.email as reporter_email, u.phone as reporter_phone, u.department as reporter_dept
      FROM lost_found_items l
      JOIN users u ON l.reporter_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (report_type && report_type !== 'All') {
      sql += ' AND l.report_type = ?';
      params.push(report_type);
    }

    if (category && category !== 'All') {
      sql += ' AND l.category = ?';
      params.push(category);
    }

    if (status && status !== 'All') {
      sql += ' AND l.status = ?';
      params.push(status);
    }

    if (search && search.trim().length > 0) {
      sql += ' AND (l.item_name LIKE ? OR l.description LIKE ? OR l.location_found_lost LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY l.created_at DESC';

    const [reports] = await db.query(sql, params);
    return res.json({ success: true, reports });
  } catch (err) {
    console.error('Lost & Found query error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch reports: ' + err.message });
  }
});

// POST /api/v1/lost-found/reports - Create new report (LOST or FOUND)
router.post('/reports', authenticate, upload.single('image'), async (req, res) => {
  try {
    const { report_type, item_name, category, location_found_lost, event_date, description, identifying_marks, custody_details } = req.body;

    if (!report_type || !item_name || !category || !location_found_lost) {
      return res.status(400).json({ success: false, message: 'Type, item name, category, and location are required.' });
    }

    let imageUrl = '/images/lostfound/default.svg';
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }

    const [result] = await db.query(
      `INSERT INTO lost_found_items 
       (reporter_id, report_type, item_name, category, location_found_lost, event_date, description, identifying_marks, image_url, custody_details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [
        req.user.user_id,
        report_type.toUpperCase(),
        item_name.trim(),
        category,
        location_found_lost.trim(),
        event_date || new Date().toISOString().split('T')[0],
        description || '',
        identifying_marks || '',
        imageUrl,
        custody_details || 'N/A'
      ]
    );

    return res.status(201).json({
      success: true,
      message: `${report_type === 'LOST' ? 'Lost' : 'Found'} item reported successfully!`,
      reportId: result.insertId
    });
  } catch (err) {
    console.error('Create report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit report: ' + err.message });
  }
});

// GET /api/v1/lost-found/matches - Algorithmic similarity matcher between OPEN Lost and Found items
router.get('/matches', async (req, res) => {
  try {
    const [lostItems] = await db.query("SELECT * FROM lost_found_items WHERE report_type = 'LOST' AND status = 'OPEN'");
    const [foundItems] = await db.query("SELECT * FROM lost_found_items WHERE report_type = 'FOUND' AND status = 'OPEN'");

    const matches = [];

    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'of', 'to', 'is', 'it', 'my']);

    function getKeywords(str) {
      if (!str) return [];
      return str
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
    }

    for (const lost of lostItems) {
      const lostWords = new Set([...getKeywords(lost.item_name), ...getKeywords(lost.description), ...getKeywords(lost.identifying_marks)]);

      for (const found of foundItems) {
        let score = 0;
        const reasons = [];

        // 1. Exact or similar category match
        if (lost.category.toLowerCase() === found.category.toLowerCase()) {
          score += 35;
          reasons.push('Same category (' + lost.category + ')');
        }

        // 2. Keyword overlap in title and description
        const foundWords = new Set([...getKeywords(found.item_name), ...getKeywords(found.description), ...getKeywords(found.identifying_marks)]);
        const sharedWords = [];
        for (const word of lostWords) {
          if (foundWords.has(word)) {
            sharedWords.push(word);
          }
        }

        if (sharedWords.length > 0) {
          const wordBonus = Math.min(45, sharedWords.length * 15);
          score += wordBonus;
          reasons.push(`Keywords matched: [${sharedWords.join(', ')}]`);
        }

        // 3. Proximity in location if similar words exist
        const lostLocWords = getKeywords(lost.location_found_lost);
        const foundLocWords = getKeywords(found.location_found_lost);
        const sharedLoc = lostLocWords.filter(w => foundLocWords.includes(w));
        if (sharedLoc.length > 0) {
          score += 20;
          reasons.push(`Common location keyword: [${sharedLoc.join(', ')}]`);
        }

        if (score >= 35) {
          matches.push({
            matchScore: Math.min(98, score),
            reasons,
            lostItem: lost,
            foundItem: found
          });
        }
      }
    }

    // Sort descending by score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return res.json({ success: true, count: matches.length, matches });
  } catch (err) {
    console.error('Match algorithm error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/lost-found/claims - Submit claim for found item
router.post('/claims', authenticate, upload.single('proof_image'), async (req, res) => {
  try {
    const { report_id, proof_description } = req.body;

    if (!report_id || !proof_description) {
      return res.status(400).json({ success: false, message: 'Report ID and proof description are required.' });
    }

    // Verify found item
    const [reports] = await db.query('SELECT * FROM lost_found_items WHERE report_id = ?', [report_id]);
    if (!reports || reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Item report not found.' });
    }

    let proofImageUrl = null;
    if (req.file) {
      proofImageUrl = '/uploads/' + req.file.filename;
    }

    const [claimResult] = await db.query(
      `INSERT INTO lost_found_claims (report_id, claimant_id, proof_description, proof_image_url, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [report_id, req.user.user_id, proof_description.trim(), proofImageUrl]
    );

    // Notify reporter if reporter is someone else
    if (reports[0].reporter_id !== req.user.user_id) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES (?, ?, ?, ?)`,
        [
          reports[0].reporter_id,
          `Claim Submitted for "${reports[0].item_name}"`,
          `${req.user.full_name} submitted an ownership claim. Waiting for admin verification.`,
          '/lost-found.html'
        ]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Claim submitted successfully! Department Admin will review your proof and contact you for handover.',
      claimId: claimResult.insertId
    });
  } catch (err) {
    console.error('Claim submission error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/lost-found/claims - Admin view of claims
router.get('/claims', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const [claims] = await db.query(`
      SELECT c.*, l.item_name, l.category, l.report_type, l.custody_details, l.image_url as item_image,
             u.full_name as claimant_name, u.email as claimant_email, u.phone as claimant_phone, u.roll_number as claimant_roll
      FROM lost_found_claims c
      JOIN lost_found_items l ON c.report_id = l.report_id
      JOIN users u ON c.claimant_id = u.user_id
      ORDER BY c.created_at DESC
    `);

    return res.json({ success: true, claims });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/lost-found/claims/:id/verify - Admin verifies claim
router.post('/claims/:id/verify', authenticate, requireRole(['dept_admin', 'super_admin']), async (req, res) => {
  try {
    const claimId = req.params.id;
    const { action, admin_remarks } = req.body; // 'APPROVE' or 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be APPROVE or REJECT.' });
    }

    const [claims] = await db.query(
      `SELECT c.*, l.item_name, l.report_id, u.full_name as claimant_name, u.email as claimant_email
       FROM lost_found_claims c
       JOIN lost_found_items l ON c.report_id = l.report_id
       JOIN users u ON c.claimant_id = u.user_id
       WHERE c.claim_id = ?`,
      [claimId]
    );

    if (!claims || claims.length === 0) {
      return res.status(404).json({ success: false, message: 'Claim not found.' });
    }

    const claim = claims[0];
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await db.query(
      `UPDATE lost_found_claims 
       SET status = ?, admin_remarks = ?, verified_by = ? 
       WHERE claim_id = ?`,
      [newStatus, admin_remarks || 'Processed by Department Admin', req.user.user_id, claimId]
    );

    if (action === 'APPROVE') {
      // Mark item as RETURNED
      await db.query("UPDATE lost_found_items SET status = 'RETURNED' WHERE report_id = ?", [claim.report_id]);

      // Return receipt code
      const receiptCode = `RET-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      // Notify claimant
      await db.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES (?, ?, ?, ?)`,
        [
          claim.claimant_id,
          `Ownership Claim Approved! [Receipt: ${receiptCode}]`,
          `Your claim for "${claim.item_name}" has been approved! You can collect it from the designated custody desk with Receipt: ${receiptCode}.`,
          '/lost-found.html'
        ]
      );

      return res.json({
        success: true,
        message: 'Claim approved! Item marked as RETURNED. Handover receipt generated.',
        receiptCode
      });
    } else {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES (?, ?, ?, ?)`,
        [
          claim.claimant_id,
          `Claim Status Update: "${claim.item_name}"`,
          `Your claim could not be verified with the provided proof: ${admin_remarks || 'Insufficient proof'}.`,
          '/lost-found.html'
        ]
      );

      return res.json({
        success: true,
        message: 'Claim rejected.'
      });
    }
  } catch (err) {
    console.error('Verify claim error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
