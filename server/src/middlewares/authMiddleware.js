const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const activeSessions = require('../utils/sessionStore');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Nếu token cũ thì đá 
    const currentToken = activeSessions.get(decoded.id);
    if (currentToken && currentToken !== token) {
      return res.status(401).json({ success: false, error: 'Tài khoản đang được đăng nhập ở thiết bị khác.' });
    }

    // Kiểm tra user còn active không (phòng trường hợp bị lock sau khi JWT đã cấp)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true, is_active: true },
    });

    if (!user || !user.is_active) {
      return res.status(403).json({ success: false, error: 'Tài khoản đã bị vô hiệu hóa.' });
    }

    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
