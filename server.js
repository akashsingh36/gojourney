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

const https = require("https");

// Simple fetch wrapper using built-in https (avoids node-fetch ESM issues)
function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => JSON.parse(raw) }); }
        catch(e) { resolve({ ok: false, status: res.statusCode, json: () => ({}) }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const app = express();
const PORT = process.env.PORT || 8080;
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
  .then(async () => {
    console.log('✅ MongoDB connected');
    // Ensure the admin account exists with role: 'admin'
    const adminEmail = 'akashengsingh@gmail.com';
    const adminPassword = '13141450#Akash';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const hashed = await require('bcryptjs').hash(adminPassword, 12);
      admin = await User.create({ name: 'Admin', email: adminEmail, password: hashed, role: 'admin' });
      console.log('✅ Admin account created');
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      await admin.save();
      console.log('✅ Admin role updated');
    }
  })
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

// ===== SEARCH ROUTES =====

// ===== HOTELS4 (RapidAPI) PROXY =====
// Keeps the API key server-side when running in full-stack mode
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '03f82b3f8e2cbb5b2bf8035b96e55308';

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ ok: false, status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// /api/hotels/location?q=Mumbai  → resolves destination to gaiaId
app.get('/api/hotels/location', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const url = `https://hotels4.p.rapidapi.com/locations/v3/search?q=${encodeURIComponent(q)}&locale=en_US&langid=1033&siteid=300000001`;
    const resp = await httpGet(url, {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'hotels4.p.rapidapi.com'
    });
    res.json(resp.body);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/hotels/search?gaiaId=...&checkin=...&checkout=...&adults=2
app.get('/api/hotels/search', async (req, res) => {
  const { gaiaId, checkin, checkout, adults = 2 } = req.query;
  if (!gaiaId) return res.status(400).json({ error: 'gaiaId required' });
  try {
    const ci = checkin  || new Date().toISOString().split('T')[0];
    const co = checkout || (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();
    const url = `https://hotels4.p.rapidapi.com/properties/v2/list` +
      `?currency=INR&eapid=1&locale=en_US&siteId=300000001` +
      `&destination%5BregionId%5D=${gaiaId}` +
      `&checkInDate=${ci}&checkOutDate=${co}` +
      `&rooms%5B0%5D%5BnumberOfAdults%5D=${adults}` +
      `&resultsStartingIndex=0&resultsSize=20&sort=RECOMMENDED`;
    const resp = await httpGet(url, {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'hotels4.p.rapidapi.com'
    });
    res.json(resp.body);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔥 ADD YOUR BUS API HERE (PASTE BELOW)

app.get("/api/search-buses", async (req, res) => {
  let { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: "From and To required" });
  }

  from = from.toLowerCase();
  to = to.toLowerCase();

  try {
    // 🔴 CHANGE THIS LINE ONLY
    const distance = 300; const duration = "5 hours"; // placeholder


    const buses = [
      { from: "delhi", to: "kanpur", name: "Volvo AC", type: "AC", pricePerKm: 2 },
      { from: "delhi", to: "kanpur", name: "Sleeper Bus", type: "Sleeper", pricePerKm: 1.5 },
      { from: "delhi", to: "prayagraj", name: "UPSRTC Express", type: "Non-AC", pricePerKm: 1.2 }
    ];

    const filtered = buses.filter(
      b => b.from === from && b.to === to
    );

    if (filtered.length === 0) {
      return res.json({ message: "No buses found" });
    }

    const result = filtered.map(bus => ({
      name: bus.name,
      type: bus.type,
      price: Math.round(bus.pricePerKm * distance),
      duration: duration,
      seats: Math.floor(Math.random() * 30 + 1)
    }));

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: "API failed" });
  }
});

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Required fields missing' });
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: password, phone });
    
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

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password).catch(() => password === user.password);

    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({
      id: user._id,
      email: user.email,
      role: user.role
    }, process.env.JWT_SECRET);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// --- SEARCH ROUTES ---
app.get('/api/search/hotels', async (req, res) => {
  const { destination, checkin, checkout, guests } = req.query;
  try {
    // Try to find real hotels from DB first
    let query = { type: 'hotel', active: true };
    if (destination) {
      query.location = { $regex: destination, $options: 'i' };
    }
    const dbListings = await Listing.find(query).limit(12);
    if (dbListings.length > 0) {
      return res.json({ results: dbListings, total: dbListings.length, source: 'db', query: { destination, checkin, checkout, guests } });
    }
  } catch(e) {}
  // Fallback mock data filtered by destination
  let results = MOCK_HOTELS;
  if (destination) {
    results = results.filter(h => h.location.toLowerCase().includes(destination.toLowerCase()));
    if (!results.length) results = MOCK_HOTELS; // return all if no match
  }
  res.json({ results, total: results.length, source: 'mock', query: { destination, checkin, checkout, guests } });
});

app.get('/api/search/cabs', (req, res) => {
  const { from, to, date, vehicleType } = req.query;
  const distance = Math.floor(Math.random() * 400 + 20);
  const fares = MOCK_CABS.map(c => ({c, estimatedFare: Math.max(c.minFare, distance * c.pricePerKm), distance }));
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

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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


// ===== OTP ROUTES (Fast2SMS) =====
// Store OTPs temporarily in memory (use Redis in production)
const otpStore = new Map(); // phone -> { otp, expiresAt }

app.post('/api/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }
  const cleanPhone = phone.replace(/\D/g, '').slice(-10); // last 10 digits
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpStore.set(cleanPhone, { otp, expiresAt });

  const FAST2SMS_KEY = process.env.FAST2SMS_KEY;
  const TWILIO_SID   = process.env.TWILIO_SID;
  const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
  const TWILIO_FROM  = process.env.TWILIO_FROM;

  // ── Try Fast2SMS (OTP route) ──
  if (FAST2SMS_KEY) {
    try {
      const smsRes = await httpPost('https://www.fast2sms.com/dev/bulkV2',
        { 'authorization': FAST2SMS_KEY, 'Content-Type': 'application/json' },
        JSON.stringify({ route: 'otp', variables_values: otp, numbers: cleanPhone, flash: 0 })
      );
      const smsData = smsRes.json();
      console.log('Fast2SMS OTP route:', JSON.stringify(smsData));
      if (smsData.return === true) {
        return res.json({ success: true, message: 'OTP sent via SMS' });
      }
      // Try Quick SMS route as fallback
      const smsRes2 = await httpPost('https://www.fast2sms.com/dev/bulkV2',
        { 'authorization': FAST2SMS_KEY, 'Content-Type': 'application/json' },
        JSON.stringify({ route: 'q', message: 'Your GoJourney OTP is ' + otp + '. Valid 5 mins. Do not share.', language: 'english', numbers: cleanPhone })
      );
      const smsData2 = smsRes2.json();
      console.log('Fast2SMS Q route:', JSON.stringify(smsData2));
      if (smsData2.return === true) {
        return res.json({ success: true, message: 'OTP sent via SMS' });
      }
      console.error('Fast2SMS failed both routes:', JSON.stringify(smsData2));
    } catch (e) {
      console.error('Fast2SMS exception:', e.message);
    }
  }

  // ── Try Twilio ──
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      const toNumber = '+91' + cleanPhone;
      const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_TOKEN).toString('base64');
      const twilioBody = 'From=' + encodeURIComponent(TWILIO_FROM) + '&To=' + encodeURIComponent(toNumber) + '&Body=' + encodeURIComponent('Your GoJourney OTP is: ' + otp + '. Valid for 5 minutes. Do not share.');
      const twilioRes = await httpPost(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        twilioBody
      );
      const twilioData = twilioRes.json();
      console.log('Twilio response:', JSON.stringify(twilioData));
      if (twilioData.sid) {
        return res.json({ success: true, message: 'OTP sent via SMS' });
      }
      console.error('Twilio failed:', JSON.stringify(twilioData));
    } catch (e) {
      console.error('Twilio exception:', e.message);
    }
  }

  // ── No SMS provider working — Dev mode fallback ──
  console.log(`[DEV] OTP for ${cleanPhone}: ${otp}`);
  return res.json({ success: true, dev: true, otp, message: 'Dev mode: no SMS provider configured' });
});

app.post('/api/otp/verify', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const record = otpStore.get(cleanPhone);

  if (!record) return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanPhone);
    return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });

  otpStore.delete(cleanPhone); // one-time use
  res.json({ success: true, message: 'Phone verified' });
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