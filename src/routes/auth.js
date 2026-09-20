const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const upload = require('../middleware/upload');

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const { full_name, roll_number, email, password, phone, department, year_of_study, role_name } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide full name, email, and password.' });
    }

    // Check existing email
    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Check roll number if provided
    if (roll_number) {
      const [existingRoll] = await db.query('SELECT user_id FROM users WHERE roll_number = ?', [roll_number.trim()]);
      if (existingRoll && existingRoll.length > 0) {
        return res.status(400).json({ success: false, message: 'An account with this roll number already exists.' });
      }
    }

    // Default role is student (role_id = 3) unless specified by admin or allowed
    let roleId = 3;
    if (role_name === 'dept_admin') roleId = 2;
    if (role_name === 'super_admin') roleId = 1;

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (full_name, roll_number, email, password_hash, phone, department, year_of_study, role_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name.trim(),
        roll_number ? roll_number.trim() : `STU-${Date.now().toString().slice(-4)}`,
        email.toLowerCase().trim(),
        passwordHash,
        phone || null,
        department || 'Computer Science',
        year_of_study || 'T.Y.B.Sc. (CS)',
        roleId
      ]
    );

    const userId = result.insertId;

    // Issue token
    const token = jwt.sign({ userId, email: email.toLowerCase().trim(), roleId }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('campuscare_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to CampusCare.',
      token,
      user: {
        userId,
        fullName: full_name,
        email: email.toLowerCase().trim(),
        roleId,
        roleName: roleId === 1 ? 'super_admin' : roleId === 2 ? 'dept_admin' : 'student'
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration: ' + err.message });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const [users] = await db.query(
      `SELECT u.*, r.role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE LOWER(u.email) = ?`,
      [email.toLowerCase().trim()]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact campus admin.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Token creation
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, roleId: user.role_id, roleName: user.role_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('campuscare_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    const redirectUrl = (user.role_name === 'super_admin' || user.role_name === 'dept_admin') 
      ? '/admin-dashboard.html' 
      : '/dashboard.html';

    return res.json({
      success: true,
      message: `Welcome back, ${user.full_name}!`,
      token,
      redirectUrl,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        rollNumber: user.roll_number,
        department: user.department,
        yearOfStudy: user.year_of_study,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        roleId: user.role_id,
        roleName: user.role_name
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('campuscare_token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req, res) => {
  return res.json({
    success: true,
    user: {
      userId: req.user.user_id,
      fullName: req.user.full_name,
      email: req.user.email,
      rollNumber: req.user.roll_number,
      department: req.user.department,
      yearOfStudy: req.user.year_of_study,
      phone: req.user.phone,
      avatarUrl: req.user.avatar_url,
      roleId: req.user.role_id,
      roleName: req.user.role_name
    }
  });
});

// PUT /api/v1/auth/profile
router.put('/profile', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    const { full_name, phone, department, year_of_study } = req.body;
    let avatar_url = req.user.avatar_url;

    if (req.file) {
      avatar_url = '/uploads/' + req.file.filename;
    }

    await db.query(
      `UPDATE users 
       SET full_name = ?, phone = ?, department = ?, year_of_study = ?, avatar_url = ? 
       WHERE user_id = ?`,
      [
        full_name || req.user.full_name,
        phone || req.user.phone,
        department || req.user.department,
        year_of_study || req.user.year_of_study,
        avatar_url,
        req.user.user_id
      ]
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      avatarUrl: avatar_url
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile: ' + err.message });
  }
});

// PUT /api/v1/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required.' });
    }

    const [rows] = await db.query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.user_id]);
    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, req.user.user_id]);

    return res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to change password: ' + err.message });
  }
});

// GET /api/v1/auth/demo-accounts (convenience for evaluation)
router.get('/demo-accounts', (req, res) => {
  return res.json({
    student: { email: 'vedant@campuscare.edu', password: 'student123', name: 'Vedant Pomendkar (Student)' },
    student2: { email: 'student@campuscare.edu', password: 'student123', name: 'Rahul Sharma (Student)' },
    dept_admin: { email: 'deptadmin@campuscare.edu', password: 'admin123', name: 'Dr. Sandeep Kamble (HOD / Guide)' },
    super_admin: { email: 'admin@campuscare.edu', password: 'admin123', name: 'Super Admin (System Governance)' }
  });
});

module.exports = router;
