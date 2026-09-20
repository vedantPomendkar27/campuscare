const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'campuscare_super_secret_jwt_key_2026';

// Authenticate user via Cookie or Bearer Authorization header
async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.campuscare_token) {
      token = req.cookies.campuscare_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user in database
    const [users] = await db.query(
      `SELECT u.user_id, u.full_name, u.roll_number, u.email, u.phone, u.department, u.year_of_study, 
              u.avatar_url, u.role_id, u.is_active, r.role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE u.user_id = ?`,
      [decoded.userId]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact Admin.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}

// Require specific role(s)
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const roleName = req.user.role_name;
    // super_admin has access to everything
    if (roleName === 'super_admin') {
      return next();
    }

    if (allowedRoles.includes(roleName)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of: [${allowedRoles.join(', ')}]. Current role: ${roleName}`
    });
  };
}

module.exports = {
  authenticate,
  requireRole,
  JWT_SECRET
};
