require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./src/routes/authRoutes');
const addressRoutes = require('./src/routes/addressRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const quotationRoutes = require('./src/routes/quotationRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const complaintRoutes = require('./src/routes/complaintRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const technicianRoutes = require('./src/routes/technicianRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const blogRoutes = require('./src/routes/blogRoutes');
const { verifyMailConnection } = require('./src/utils/mailer');
const path = require('path');

const app = express();

app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan('dev'));
app.use(express.json());

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/technician', technicianRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/blogs', blogRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await verifyMailConnection();
});
