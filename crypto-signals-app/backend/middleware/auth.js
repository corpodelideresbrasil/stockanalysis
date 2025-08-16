const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(403).json({ error: 'A token is required for authentication.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Token.' });
  }

  return next();
}

function isAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) {
    return next();
  }

  return res.status(403).json({ error: 'Access denied. Admin rights required.' });
}

function isSubscribed(req, res, next) {
  // This middleware should run AFTER verifyToken
  if (req.user && (req.user.isSubscribed || req.user.isAdmin)) {
    // Admins can always access subscribed content
    return next();
  }

  return res.status(403).json({ error: 'Access denied. Active subscription required.' });
}

module.exports = {
  verifyToken,
  isAdmin,
  isSubscribed,
};
