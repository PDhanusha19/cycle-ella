const jwt = require('jsonwebtoken');

// Separate from middleware/authMiddleware.js's `protect` on purpose: a user
// JWT (signed for a patient account) and an admin JWT (role: 'admin', 2h
// expiry) must never be interchangeable, so this checks the role claim
// explicitly rather than reusing `protect` and trusting any valid token.
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token, access denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { adminAuth };
