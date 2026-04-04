/**
 * GoJourney - Backend Server (Node.js + Express + MongoDB)
 * Run: npm install && node server.js
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gojourney_secret_key_2026';
const MONGO_URI = process.env.MONGO_URI;

// ===== MIDDLEWARE =====

app.use(cors({
  origin: "*",   // allow all (for testing)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));


// ===== MONGODB CONNECTION =====
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('⚠️  MongoDB not connected (using mock data):', err.message));

// ===== SCHEMAS =====
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: String,
  role: { type: String, default: 'user', enum: ['user', 'admin'] },
  wishlist: [String],
  createdAt: { type: Date, default: Date.now },
});

const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['hotel', 'cab', 'bus', 'tour', 'shuttle'], required: true },
  serviceId: String,
  details: mongoose.Schema.Types.Mixed,
  amount: { type: Number, required: true },
  status: { type: String, default: 'confirmed', enum: ['pending', 'confirmed', 'cancelled', 'completed'] },
  paymentMethod: String,
  couponApplied: String,
  travelDate: Date,
  createdAt: { type: Date, default: Date.now },
});

const ListingSchema = new mongoose.Schema({
  type: { type: String, enum: ['hotel', 'tour', 'shuttle'], required: true },
  name: String,
  location: String,
  price: Number,
  rating: Number,
  amenities: [String],
  images: [String],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);
const Booking = mongoose.model('Booking', BookingSchema);
const Listing = mongoose.model('Listing', ListingSchema);

// ===== AUTH MIDDLEWARE =====
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = async (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ===== ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GoJourney API running', time: new Date().toISOString() });
});

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Required fields missing' });
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, phone });
    
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// --- SEARCH ROUTES ---
app.get('/api/search/hotels', (req, res) => {
  const { destination, checkin, checkout, guests } = req.query;
  // In production, query MongoDB with filters
  // Mock response:
  res.json({ results: MOCK_HOTELS, total: MOCK_HOTELS.length, query: { destination, checkin, checkout, guests } });
});

app.get('/api/search/cabs', (req, res) => {
  const { from, to, date, vehicleType } = req.query;
  const distance = Math.floor(Math.random() * 400 + 20);
  const fares = MOCK_CABS.map(c => ({ ...c, estimatedFare: Math.max(c.minFare, distance * c.pricePerKm), distance }));
  res.json({ results: fares, distance });
});

app.get('/api/search/buses', (req, res) => {
  const { from, to, date } = req.query;
  res.json({ results: MOCK_BUSES.filter(b => !from || b.route.toLowerCase().includes(from.toLowerCase())) });
});

app.get('/api/search/tours', (req, res) => {
  const { destination, duration, travelers } = req.query;
  res.json({ results: MOCK_TOURS });
});

app.get('/api/search/shuttles', (req, res) => {
  res.json({ results: MOCK_SHUTTLES });
});

// --- BOOKING ROUTES ---
app.post('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { type, serviceId, details, amount, paymentMethod, couponApplied, travelDate } = req.body;
    const bookingId = 'GJ' + Date.now().toString().slice(-8);
    
    const booking = await Booking.create({
      bookingId, userId: req.user.id, type, serviceId, details,
      amount, paymentMethod, couponApplied, travelDate: travelDate ? new Date(travelDate) : null,
    });
    
    res.json({ success: true, booking, bookingId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings/my', authMiddleware, async (req, res) => {
  const bookings = await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(bookings);
});

app.patch('/api/bookings/:id/cancel', authMiddleware, async (req, res) => {
  const booking = await Booking.findOne({ bookingId: req.params.id, userId: req.user.id });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  booking.status = 'cancelled';
  await booking.save();
  res.json({ success: true, booking });
});

// --- WISHLIST ROUTES ---
app.post('/api/wishlist/toggle', authMiddleware, async (req, res) => {
  const { itemId } = req.body;
  const user = await User.findById(req.user.id);
  if (user.wishlist.includes(itemId)) {
    user.wishlist = user.wishlist.filter(i => i !== itemId);
  } else {
    user.wishlist.push(itemId);
  }
  await user.save();
  res.json({ wishlist: user.wishlist });
});

// --- ADMIN ROUTES ---
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  const [totalBookings, totalUsers, bookings] = await Promise.all([
    Booking.countDocuments(),
    User.countDocuments(),
    Booking.find().select('amount status'),
  ]);
  const totalRevenue = bookings.reduce((s, b) => s + b.amount, 0);
  const activeBookings = bookings.filter(b => b.status === 'confirmed').length;
  res.json({ totalBookings, totalUsers, totalRevenue, activeBookings });
});

app.get('/api/admin/bookings', authMiddleware, adminMiddleware, async (req, res) => {
  const bookings = await Booking.find().populate('userId', 'name email').sort({ createdAt: -1 }).limit(100);
  res.json(bookings);
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
});

app.patch('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
  res.json(user);
});

// --- LISTINGS ROUTES ---
app.get('/api/listings', async (req, res) => {
  const listings = await Listing.find({ active: true });
  res.json(listings);
});

app.post('/api/listings', authMiddleware, adminMiddleware, async (req, res) => {
  const listing = await Listing.create(req.body);
  res.json(listing);
});

// --- COUPON VALIDATION ---
app.post('/api/coupons/validate', authMiddleware, (req, res) => {
  const { code, serviceType, amount } = req.body;
  const coupons = {
    'HOTEL30': { type: 'percent', value: 30, service: 'hotels' },
    'CAB20': { type: 'percent', value: 20, service: 'cabs' },
    'TOUR2K': { type: 'flat', value: 2000, service: 'tours' },
    'BUS3FOR2': { type: 'percent', value: 33, service: 'buses' },
    'FIRST10': { type: 'percent', value: 10, service: 'all' },
  };
  
  const coupon = coupons[code.toUpperCase()];
  if (!coupon) return res.status(400).json({ error: 'Invalid coupon code' });
  if (coupon.service !== 'all' && coupon.service !== serviceType) {
    return res.status(400).json({ error: `Coupon valid for ${coupon.service} only` });
  }
  
  const discount = coupon.type === 'percent' ? Math.round(amount * coupon.value / 100) : coupon.value;
  res.json({ valid: true, discount, coupon });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== MOCK DATA FOR API =====
const MOCK_HOTELS = [
  { id: 'h1', name: 'The Grand Seascape', location: 'Goa', rating: 4.8, price: 4999, amenities: ['WiFi', 'Pool', 'Spa'] },
  { id: 'h2', name: 'Mountain Crest Resort', location: 'Manali', rating: 4.6, price: 3499, amenities: ['WiFi', 'Fireplace'] },
];

const MOCK_CABS = [
  { id: 'c1', name: 'Mini', vehicle: 'Swift', pricePerKm: 12, minFare: 299, capacity: 4 },
  { id: 'c2', name: 'Sedan', vehicle: 'Dzire', pricePerKm: 15, minFare: 399, capacity: 4 },
  { id: 'c3', name: 'SUV', vehicle: 'Innova', pricePerKm: 20, minFare: 599, capacity: 7 },
];

const MOCK_BUSES = [
  { id: 'b1', name: 'Sharma Transport', route: 'Delhi → Manali', departure: '22:00', arrival: '08:30', price: 1200 },
  { id: 'b2', name: 'Raj Travels', route: 'Mumbai → Goa', departure: '18:00', arrival: '07:00', price: 950 },
];

const MOCK_TOURS = [
  { id: 't1', title: 'Goa Beach Paradise', duration: '4D/3N', price: 7999, location: 'Goa', rating: 4.8 },
  { id: 't2', title: 'Kerala Backwaters', duration: '5D/4N', price: 12499, location: 'Kerala', rating: 4.9 },
];

const MOCK_SHUTTLES = [
  { id: 's1', route: 'Airport ↔ City', timing: '05:00–23:00', frequency: 'Every 30 mins', price: 299 },
];

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 GoJourney server running on http://localhost:${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT} (click Admin in nav)`);
});

module.exports = app;
