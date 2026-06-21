/**
 * GoJourney - Backend Server (Node.js + Express + MongoDB)
 * Run: npm install && node server.js
 *
 * ✅ REAL CAB SEARCH  → Google Maps Distance Matrix API (set GOOGLE_MAPS_KEY env var)
 * ✅ REAL BUS SEARCH  → Your own MongoDB BusRoute collection (seed it below)
 * ✅ REAL SHUTTLE     → Your own MongoDB ShuttleRoute collection (seed it below)
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const https = require('https');

// ===== SIMPLE HTTPS HELPERS =====
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET', headers };
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
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '03f82b3f8e2cbb5b2bf8035b96e55308';

// ✅ SET THIS in Railway / .env: GOOGLE_MAPS_KEY=your_key_here
// Get free key at: https://console.cloud.google.com → Enable "Distance Matrix API"
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY || '';

// ===== MIDDLEWARE =====
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ===== MONGODB CONNECTION =====
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');

    // Ensure admin account
    const adminEmail = 'akashengsingh@gmail.com';
    const adminPassword = '13141450#Akash';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const hashed = await bcrypt.hash(adminPassword, 12);
      await User.create({ name: 'Admin', email: adminEmail, password: hashed, role: 'admin' });
      console.log('✅ Admin account created');
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      await admin.save();
      console.log('✅ Admin role updated');
    }

    // ===== SEED BUS ROUTES (only if empty) =====
    const busCount = await BusRoute.countDocuments();
    if (busCount === 0) {
      await BusRoute.insertMany([
        // Format: from/to in lowercase, name, type, departure, arrival, price, totalSeats
        { from: 'delhi', to: 'manali',      name: 'Himachal Volvo',    type: 'AC Volvo',   departure: '21:00', arrival: '08:00', price: 1400, totalSeats: 40 },
        { from: 'delhi', to: 'manali',      name: 'HRTC Express',      type: 'Sleeper',    departure: '20:00', arrival: '09:00', price: 1100, totalSeats: 36 },
        { from: 'delhi', to: 'kanpur',      name: 'UP Volvo Express',  type: 'AC Volvo',   departure: '22:00', arrival: '04:00', price: 900,  totalSeats: 40 },
        { from: 'delhi', to: 'kanpur',      name: 'UPSRTC Sleeper',    type: 'Sleeper',    departure: '23:00', arrival: '05:30', price: 650,  totalSeats: 36 },
        { from: 'delhi', to: 'prayagraj',   name: 'UPSRTC Express',    type: 'Non-AC',     departure: '06:00', arrival: '14:00', price: 550,  totalSeats: 50 },
        { from: 'delhi', to: 'varanasi',    name: 'Kashi Express Volvo', type: 'AC Volvo', departure: '20:30', arrival: '07:00', price: 1100, totalSeats: 40 },
        { from: 'delhi', to: 'varanasi',    name: 'UPSRTC Sleeper',    type: 'Sleeper',    departure: '19:00', arrival: '08:00', price: 850,  totalSeats: 36 },
        { from: 'delhi', to: 'agra',        name: 'Agra Express',      type: 'AC Seater',  departure: '07:00', arrival: '10:30', price: 450,  totalSeats: 45 },
        { from: 'delhi', to: 'jaipur',      name: 'Pink City Volvo',   type: 'AC Volvo',   departure: '06:00', arrival: '11:00', price: 600,  totalSeats: 40 },
        { from: 'delhi', to: 'haridwar',    name: 'Haridwar Express',  type: 'AC Seater',  departure: '05:30', arrival: '10:00', price: 500,  totalSeats: 45 },
        { from: 'mumbai', to: 'goa',        name: 'Raj Travels',       type: 'Sleeper',    departure: '18:00', arrival: '07:00', price: 950,  totalSeats: 36 },
        { from: 'mumbai', to: 'goa',        name: 'Paulo Travels',     type: 'AC Volvo',   departure: '19:30', arrival: '08:30', price: 1200, totalSeats: 40 },
        { from: 'mumbai', to: 'pune',       name: 'Shivneri Volvo',    type: 'AC Volvo',   departure: '07:00', arrival: '10:00', price: 350,  totalSeats: 45 },
        { from: 'mumbai', to: 'nashik',     name: 'MSRTC Express',     type: 'AC Seater',  departure: '06:00', arrival: '09:30', price: 280,  totalSeats: 50 },
        { from: 'bangalore', to: 'mysore',  name: 'KSRTC Airavata',    type: 'AC Volvo',   departure: '08:00', arrival: '11:00', price: 400,  totalSeats: 45 },
        { from: 'bangalore', to: 'goa',     name: 'VRL Travels',       type: 'AC Volvo',   departure: '21:00', arrival: '07:00', price: 1100, totalSeats: 40 },
        { from: 'bangalore', to: 'hyderabad', name: 'SRS Travels',     type: 'Sleeper',    departure: '22:00', arrival: '06:00', price: 900,  totalSeats: 36 },
        { from: 'hyderabad', to: 'bangalore', name: 'Orange Travels',  type: 'AC Volvo',   departure: '21:00', arrival: '05:00', price: 950,  totalSeats: 40 },
        { from: 'chennai', to: 'bangalore', name: 'TNSTC Express',     type: 'AC Seater',  departure: '06:00', arrival: '11:00', price: 550,  totalSeats: 45 },
        { from: 'varanasi', to: 'delhi',    name: 'Kashi Volvo',       type: 'AC Volvo',   departure: '17:00', arrival: '04:00', price: 1100, totalSeats: 40 },
        { from: 'varanasi', to: 'prayagraj', name: 'UPSRTC Local',     type: 'Non-AC',     departure: '06:00', arrival: '09:00', price: 180,  totalSeats: 55 },
        { from: 'prayagraj', to: 'varanasi', name: 'UPSRTC Local',     type: 'Non-AC',     departure: '07:00', arrival: '10:00', price: 180,  totalSeats: 55 },
        { from: 'lucknow', to: 'varanasi',  name: 'UPSRTC Express',    type: 'AC Seater',  departure: '08:00', arrival: '13:00', price: 400,  totalSeats: 45 },
        { from: 'lucknow', to: 'delhi',     name: 'Gomti Volvo',       type: 'AC Volvo',   departure: '22:00', arrival: '06:00', price: 900,  totalSeats: 40 },
        // ADD MORE ROUTES HERE — same format
      ]);
      console.log('✅ Bus routes seeded');
    }

    // ===== SEED SHUTTLE ROUTES (only if empty) =====
    const shuttleCount = await ShuttleRoute.countDocuments();
    if (shuttleCount === 0) {
      await ShuttleRoute.insertMany([
        // city, name, from, to, price, timing, frequency, duration
        { city: 'delhi',     name: 'Airport Express',           from: 'IGI Airport T3',        to: 'Connaught Place',     price: 499, timing: '04:00–23:30', frequency: 'Every 20 mins', duration: '45 mins' },
        { city: 'delhi',     name: 'Gurgaon Shuttle',           from: 'Gurgaon Cyber City',    to: 'Delhi ISBT',          price: 299, timing: '06:00–22:00', frequency: 'Every 30 mins', duration: '60 mins' },
        { city: 'mumbai',    name: 'CSIA Airport Shuttle',      from: 'Chhatrapati Shivaji T2',to: 'Bandra Kurla Complex', price: 399, timing: '05:00–00:00', frequency: 'Every 30 mins', duration: '40 mins' },
        { city: 'mumbai',    name: 'Navi Mumbai Connector',     from: 'Vashi',                 to: 'CST Mumbai',          price: 249, timing: '06:00–23:00', frequency: 'Every 45 mins', duration: '50 mins' },
        { city: 'bangalore', name: 'KIAL Airport Shuttle',      from: 'Kempegowda Airport',    to: 'MG Road',             price: 450, timing: '04:00–00:30', frequency: 'Every 30 mins', duration: '60 mins' },
        { city: 'bangalore', name: 'Tech Park Express',         from: 'Electronic City',       to: 'Majestic Bus Stand',  price: 199, timing: '07:00–21:00', frequency: 'Every 20 mins', duration: '45 mins' },
        { city: 'hyderabad', name: 'RGIA Airport Shuttle',      from: 'Rajiv Gandhi Airport',  to: 'Hitech City',         price: 350, timing: '04:30–23:00', frequency: 'Every 30 mins', duration: '55 mins' },
        { city: 'chennai',   name: 'MAA Airport Shuttle',       from: 'Chennai Airport',       to: 'T Nagar',             price: 299, timing: '05:00–23:00', frequency: 'Every 40 mins', duration: '35 mins' },
        { city: 'varanasi',  name: 'Lal Bahadur Airport Shuttle', from: 'Babatpur Airport',   to: 'Godaulia Chowk',      price: 249, timing: '06:00–22:00', frequency: 'Every 60 mins', duration: '40 mins' },
        { city: 'varanasi',  name: 'Ghats City Shuttle',        from: 'Varanasi Railway Station', to: 'Dashashwamedh Ghat', price: 99, timing: '05:00–22:00', frequency: 'Every 30 mins', duration: '20 mins' },
        { city: 'goa',       name: 'GOA Airport Shuttle',       from: 'Dabolim Airport',       to: 'Panaji Bus Stand',    price: 299, timing: '06:00–23:00', frequency: 'Every 45 mins', duration: '35 mins' },
        // ADD MORE SHUTTLES HERE — same format
      ]);
      console.log('✅ Shuttle routes seeded');
    }
  })
  .catch(err => console.log('⚠️  MongoDB not connected (using mock data):', err.message));

// ===== SCHEMAS =====
const UserSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  phone:     String,
  role:      { type: String, default: 'user', enum: ['user', 'admin'] },
  wishlist:  [String],
  createdAt: { type: Date, default: Date.now },
});

const BookingSchema = new mongoose.Schema({
  bookingId:     { type: String, unique: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type:          { type: String, enum: ['hotel','cab','bus','tour','shuttle'], required: true },
  serviceId:     String,
  details:       mongoose.Schema.Types.Mixed,
  amount:        { type: Number, required: true },
  status:        { type: String, default: 'confirmed', enum: ['pending','confirmed','cancelled','completed'] },
  paymentMethod: String,
  couponApplied: String,
  travelDate:    Date,
  createdAt:     { type: Date, default: Date.now },
});

const ListingSchema = new mongoose.Schema({
  type:      { type: String, enum: ['hotel','tour','shuttle'], required: true },
  name:      String,
  location:  String,
  price:     Number,
  rating:    Number,
  amenities: [String],
  images:    [String],
  active:    { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// ✅ NEW: BusRoute schema for real bus search
const BusRouteSchema = new mongoose.Schema({
  from:        { type: String, required: true, lowercase: true }, // e.g. "delhi"
  to:          { type: String, required: true, lowercase: true }, // e.g. "manali"
  name:        { type: String, required: true },                  // operator name
  type:        { type: String, required: true },                  // AC Volvo / Sleeper / Non-AC
  departure:   { type: String, required: true },                  // "21:00"
  arrival:     { type: String, required: true },                  // "08:00"
  price:       { type: Number, required: true },                  // in INR
  totalSeats:  { type: Number, default: 40 },
  active:      { type: Boolean, default: true },
});

// ✅ NEW: ShuttleRoute schema for real shuttle search
const ShuttleRouteSchema = new mongoose.Schema({
  city:       { type: String, required: true, lowercase: true }, // e.g. "delhi"
  name:       { type: String, required: true },
  from:       { type: String, required: true },
  to:         { type: String, required: true },
  price:      { type: Number, required: true },
  timing:     { type: String, required: true },
  frequency:  { type: String, required: true },
  duration:   { type: String, required: true },
  active:     { type: Boolean, default: true },
});

// ✅ NEW: Place schema — backs /api/places/search, populated via seed-places.js
// from GeoNames data (cities, towns, villages, universities, colleges, schools)
const PlaceSchema = new mongoose.Schema({
  geonameId:    String,
  name:         { type: String, required: true },
  nameLower:    { type: String, index: true },
  altNames:     [String],
  latitude:     Number,
  longitude:    Number,
  featureClass: String,
  featureCode:  String,
  type:         { type: String, enum: ['place', 'institution'], default: 'place' },
  admin1:       String,
  population:   { type: Number, default: 0 },
});
PlaceSchema.index({ nameLower: 1 });

const User         = mongoose.model('User',         UserSchema);
const Booking      = mongoose.model('Booking',      BookingSchema);
const Listing      = mongoose.model('Listing',      ListingSchema);
const BusRoute     = mongoose.model('BusRoute',     BusRouteSchema);
const ShuttleRoute = mongoose.model('ShuttleRoute', ShuttleRouteSchema);
const Place        = mongoose.model('Place',        PlaceSchema);

// ===== AUTH MIDDLEWARE =====
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ===== ROUTES =====
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ───────────────────────────────────────────────────────
//  ✅ MONGODB PLACES SEARCH (your own GeoNames-derived data)
//  GET /api/places/search?q=gau
//  Covers cities/towns/villages + universities/colleges/schools.
//  Run seed-places.js once (after convert-geonames.js) to populate.
// ───────────────────────────────────────────────────────
app.get('/api/places/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json({ predictions: [] });

  try {
    const query = q.toLowerCase().trim();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Tier 1: name starts with query (best matches, e.g. "gau" -> "Gautam Buddha University")
    // Tier 2: any word in the name starts with query (e.g. "buddha" -> "Gautam Buddha University")
    const [startsWith, wordStartsWith] = await Promise.all([
      Place.find({ nameLower: { $regex: '^' + escaped } })
        .sort({ type: 1, population: -1 }) // institutions are useful too; population breaks ties
        .limit(8)
        .lean(),
      Place.find({ nameLower: { $regex: '\\b' + escaped, $not: { $regex: '^' + escaped } } })
        .sort({ population: -1 })
        .limit(8)
        .lean(),
    ]);

    const seen = new Set();
    const results = [];
    for (const p of [...startsWith, ...wordStartsWith]) {
      if (seen.has(p._id.toString())) continue;
      seen.add(p._id.toString());
      results.push({
        name: p.name,
        description: p.type === 'institution'
          ? [p.name, p.admin1, 'India'].filter(Boolean).join(', ')
          : [p.name, p.admin1, 'India'].filter(Boolean).join(', '),
        state: p.admin1 || '',
        type: p.type === 'institution' ? 'institution' : 'city',
        latitude: p.latitude,
        longitude: p.longitude,
        source: 'mongo',
      });
      if (results.length >= 10) break;
    }

    res.json({ predictions: results });
  } catch (err) {
    console.error('Places search (MongoDB) error:', err.message);
    res.status(500).json({ predictions: [], error: err.message });
  }
});

// ───────────────────────────────────────────────────────
//  ✅ GOOGLE PLACES AUTOCOMPLETE PROXY
//  GET /api/places/autocomplete?q=gautam
//  Keeps API key server-side — never exposed to browser
// ───────────────────────────────────────────────────────
app.get('/api/places/autocomplete', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ predictions: [] });

  if (!GOOGLE_MAPS_KEY) {
    return res.json({ predictions: [], error: 'GOOGLE_MAPS_KEY not set' });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`
      + `?input=${encodeURIComponent(q)}`
      + `&components=country:in`
      + `&language=en`
      + `&key=${GOOGLE_MAPS_KEY}`;
    // No &types filter — returns cities, areas, airports, stations, landmarks, everything

    const resp = await httpGet(url);
    const data = resp.body;

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', data.status, data.error_message);
    }

    // Map to clean format for frontend
    const predictions = (data.predictions || []).map(p => ({
      name:        p.structured_formatting?.main_text || p.description.split(',')[0],
      description: p.description,
      state:       p.structured_formatting?.secondary_text || '',
      place_id:    p.place_id,
      types:       p.types || [],
    }));

    res.json({ predictions, status: data.status });
  } catch(err) {
    console.error('Places autocomplete error:', err.message);
    res.status(500).json({ predictions: [], error: err.message });
  }
});

// ───────────────────────────────────────────────────────
//  HOTELS (RapidAPI proxy — unchanged)
// ───────────────────────────────────────────────────────
app.get('/api/hotels/location', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const url = `https://hotels4.p.rapidapi.com/locations/v3/search?q=${encodeURIComponent(q)}&locale=en_US&langid=1033&siteid=300000001`;
    const resp = await httpGet(url, { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'hotels4.p.rapidapi.com' });
    res.json(resp.body);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/hotels/search', async (req, res) => {
  const { gaiaId, checkin, checkout, adults = 2 } = req.query;
  if (!gaiaId) return res.status(400).json({ error: 'gaiaId required' });
  try {
    const ci = checkin  || new Date().toISOString().split('T')[0];
    const co = checkout || (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();
    const url = `https://hotels4.p.rapidapi.com/properties/v2/list?currency=INR&eapid=1&locale=en_US&siteId=300000001`
      + `&destination%5BregionId%5D=${gaiaId}&checkInDate=${ci}&checkOutDate=${co}`
      + `&rooms%5B0%5D%5BnumberOfAdults%5D=${adults}&resultsStartingIndex=0&resultsSize=20&sort=RECOMMENDED`;
    const resp = await httpGet(url, { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'hotels4.p.rapidapi.com' });
    res.json(resp.body);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────
//  ✅ REAL CAB SEARCH — Google Maps Distance Matrix API
//
//  GET /api/search/cabs?from=Delhi&to=Manali&date=2026-07-10
//
//  Returns real distance + duration from Google Maps.
//  Falls back to estimated distance if no API key.
// ───────────────────────────────────────────────────────
const CAB_TYPES = [
  { id: 'mini',    name: 'Mini',    vehicle: 'Maruti Swift / WagonR', pricePerKm: 12, minFare: 299,  capacity: 4, icon: '🚗' },
  { id: 'sedan',   name: 'Sedan',   vehicle: 'Dzire / Etios',         pricePerKm: 15, minFare: 399,  capacity: 4, icon: '🚕' },
  { id: 'suv',     name: 'SUV',     vehicle: 'Innova / Ertiga',       pricePerKm: 20, minFare: 599,  capacity: 7, icon: '🚙' },
  { id: 'luxury',  name: 'Luxury',  vehicle: 'Fortuner / BMW',        pricePerKm: 35, minFare: 1299, capacity: 4, icon: '🏎️' },
  { id: 'tempo',   name: 'Tempo Traveller', vehicle: '12-Seater',    pricePerKm: 28, minFare: 999,  capacity: 12, icon: '🚐' },
];

app.get('/api/search/cabs', async (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  let distanceKm = null;
  let durationText = null;
  let source = 'estimated';

  // ── Try Google Maps Distance Matrix ──
  if (GOOGLE_MAPS_KEY) {
    try {
      const origin = encodeURIComponent(from + ', India');
      const destination = encodeURIComponent(to + ', India');
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
        + `?origins=${origin}&destinations=${destination}&units=metric&key=${GOOGLE_MAPS_KEY}`;
      const resp = await httpGet(url);
      const element = resp.body?.rows?.[0]?.elements?.[0];
      if (element?.status === 'OK') {
        distanceKm  = Math.round(element.distance.value / 1000);
        durationText = element.duration.text;   // e.g. "6 hours 20 mins"
        source = 'google_maps';
      }
    } catch(e) {
      console.log('Google Maps error:', e.message);
    }
  }

  // ── Fallback: rough estimate based on common Indian city pairs ──
  if (!distanceKm) {
    const DISTANCE_TABLE = {
      'delhi-manali': 574,    'delhi-shimla': 348,   'delhi-agra': 233,
      'delhi-jaipur': 281,    'delhi-haridwar': 228, 'delhi-kanpur': 490,
      'delhi-lucknow': 558,   'delhi-varanasi': 821, 'delhi-mumbai': 1415,
      'mumbai-goa': 594,      'mumbai-pune': 149,    'mumbai-nashik': 171,
      'bangalore-mysore': 144,'bangalore-goa': 590,  'bangalore-hyderabad': 575,
      'hyderabad-bangalore': 575, 'chennai-bangalore': 346,
      'varanasi-prayagraj': 125, 'varanasi-lucknow': 320, 'lucknow-delhi': 558,
    };
    const key1 = `${from.toLowerCase()}-${to.toLowerCase()}`;
    const key2 = `${to.toLowerCase()}-${from.toLowerCase()}`;
    distanceKm = DISTANCE_TABLE[key1] || DISTANCE_TABLE[key2] || Math.floor(Math.random() * 400 + 100);
    // Estimate duration: avg 50 km/h on Indian highways
    const hours = Math.floor(distanceKm / 50);
    const mins  = Math.round(((distanceKm / 50) - hours) * 60);
    durationText = hours > 0 ? `${hours} hr ${mins} mins` : `${mins} mins`;
    source = 'estimated';
  }

  // ── Calculate fares for all cab types ──
  const results = CAB_TYPES.map(cab => ({
    id:            cab.id,
    name:          cab.name,
    vehicle:       cab.vehicle,
    icon:          cab.icon,
    capacity:      cab.capacity,
    distanceKm,
    duration:      durationText,
    fare:          Math.max(cab.minFare, Math.round(distanceKm * cab.pricePerKm)),
    pricePerKm:    cab.pricePerKm,
    includes:      ['Fuel', 'Driver', 'Tolls (shared)'],
  }));

  res.json({ results, distanceKm, duration: durationText, source, from, to });
});

// ───────────────────────────────────────────────────────
//  ✅ REAL BUS SEARCH — Your MongoDB BusRoute collection
//
//  GET /api/search/buses?from=Delhi&to=Manali&date=2026-07-10
//
//  Returns real buses from your DB.
//  Add more routes to BusRoute collection to expand.
// ───────────────────────────────────────────────────────
// Normalize city names: "New Delhi" -> "delhi", "Greater Mumbai" -> "mumbai"
function normalizeCity(name) {
  return name.toLowerCase().trim()
    .replace(/^(new|old|greater|navi|north|south|east|west|central)\s+/i, '')
    .replace(/\s*(city|district|junction|jn|cantt|cantonment)$/i, '')
    .trim();
}

app.get('/api/search/buses', async (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const fromNorm = normalizeCity(from);
  const toNorm   = normalizeCity(to);
  const fromFull = from.toLowerCase().trim();
  const toFull   = to.toLowerCase().trim();

  try {
    // Smart match: tries normalized ("delhi") AND full ("new delhi") form
    const fromRegex = fromNorm !== fromFull ? new RegExp('(' + fromNorm + '|' + fromFull + ')', 'i') : new RegExp(fromNorm, 'i');
    const toRegex   = toNorm   !== toFull   ? new RegExp('(' + toNorm   + '|' + toFull   + ')', 'i') : new RegExp(toNorm, 'i');
    const buses = await BusRoute.find({
      from: { $regex: fromRegex },
      to:   { $regex: toRegex },
      active: true,
    }).lean();

    // Add available seats (random simulation — replace with a Booking-based query for real seat management)
    const results = buses.map(b => ({
      ...b,
      availableSeats: Math.floor(Math.random() * (b.totalSeats - 5) + 5),
      date: date || null,
    }));

    if (results.length === 0) {
      return res.json({
        results: [],
        message: `No buses found for ${from} → ${to}. Try adding this route in BusRoute collection.`,
        source: 'db',
      });
    }

    res.json({ results, total: results.length, source: 'db', from, to, date });

  } catch(err) {
    // Fallback to mock if DB not connected
    const MOCK_BUSES = [
      { name: 'Volvo AC Express', type: 'AC Volvo', departure: '21:00', arrival: '08:00', price: 1200, availableSeats: 22 },
      { name: 'UPSRTC Sleeper',   type: 'Sleeper',  departure: '22:00', arrival: '09:00', price: 850,  availableSeats: 15 },
    ];
    res.json({ results: MOCK_BUSES, source: 'mock_fallback', from, to });
  }
});

// ───────────────────────────────────────────────────────
//  ✅ REAL SHUTTLE SEARCH — Your MongoDB ShuttleRoute collection
//
//  GET /api/search/shuttles?city=Delhi
//  or
//  GET /api/search/shuttles (returns all)
//
//  Add more shuttles to ShuttleRoute collection to expand.
// ───────────────────────────────────────────────────────
app.get('/api/search/shuttles', async (req, res) => {
  const { city, from, to } = req.query;

  try {
    let query = { active: true };
    const normCity = city ? normalizeCity(city) : '';
    const normFrom = from ? normalizeCity(from) : '';
    const normTo   = to   ? normalizeCity(to)   : '';

    if (normCity) {
      query.city = { $regex: normCity, $options: 'i' };
    }
    if (normFrom) {
      query.$or = [
        { from: { $regex: normFrom, $options: 'i' } },
        { city: { $regex: normFrom, $options: 'i' } },
      ];
    }
    if (normTo) {
      query.to = { $regex: normTo, $options: 'i' };
    }

    const shuttles = await ShuttleRoute.find(query).lean();

    res.json({
      results: shuttles,
      total: shuttles.length,
      source: 'db',
      city: city || 'all',
    });

  } catch(err) {
    // Fallback if DB not connected
    const MOCK_SHUTTLES = [
      { city: 'delhi', name: 'Airport Express', from: 'IGI Airport T3', to: 'Connaught Place', price: 499, timing: '04:00–23:30', frequency: 'Every 20 mins', duration: '45 mins' },
    ];
    res.json({ results: MOCK_SHUTTLES, source: 'mock_fallback' });
  }
});

// ───────────────────────────────────────────────────────
//  ADMIN: Add a bus route
//  POST /api/admin/bus-routes
//  Body: { from, to, name, type, departure, arrival, price, totalSeats }
// ───────────────────────────────────────────────────────
app.post('/api/admin/bus-routes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const route = await BusRoute.create({
      ...req.body,
      from: req.body.from?.toLowerCase(),
      to:   req.body.to?.toLowerCase(),
    });
    res.json({ success: true, route });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/bus-routes', authMiddleware, adminMiddleware, async (req, res) => {
  const routes = await BusRoute.find().sort({ from: 1, to: 1 });
  res.json(routes);
});

app.delete('/api/admin/bus-routes/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await BusRoute.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ───────────────────────────────────────────────────────
//  ADMIN: Add a shuttle route
//  POST /api/admin/shuttles
//  Body: { city, name, from, to, price, timing, frequency, duration }
// ───────────────────────────────────────────────────────
app.post('/api/admin/shuttles', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const shuttle = await ShuttleRoute.create({
      ...req.body,
      city: req.body.city?.toLowerCase(),
    });
    res.json({ success: true, shuttle });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/shuttles', authMiddleware, adminMiddleware, async (req, res) => {
  const shuttles = await ShuttleRoute.find().sort({ city: 1 });
  res.json(shuttles);
});

// ───────────────────────────────────────────────────────
//  LEGACY SEARCH ROUTES (kept for compatibility)
// ───────────────────────────────────────────────────────
app.get('/api/search/hotels', async (req, res) => {
  const { destination, checkin, checkout, guests } = req.query;
  try {
    let query = { type: 'hotel', active: true };
    if (destination) query.location = { $regex: destination, $options: 'i' };
    const dbListings = await Listing.find(query).limit(12);
    if (dbListings.length > 0) return res.json({ results: dbListings, source: 'db' });
  } catch(e) {}
  res.json({ results: [], source: 'mock', message: 'Add hotels via /api/listings' });
});

app.get('/api/search/tours', (req, res) => {
  res.json({ results: [], message: 'Add tours via MongoDB Listing collection (type: tour)' });
});

// ───────────────────────────────────────────────────────
//  ✅ AI TRIP PLANNER (OpenAI-powered)
//
//  POST /api/trip-planner
//  Body: { source, destination, budget, days, interests: [...] }
//
//  Grounds the AI response in REAL data from your app:
//    - Destination resolved via your Place (GeoNames) collection
//    - Hotel suggestions pulled from RapidAPI Hotels4 (same flow as /api/hotels/search)
//    - Cab fare estimate calculated with your existing CAB_TYPES pricing logic
//  Set OPENAI_API_KEY in Railway env vars to enable.
// ───────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

async function openaiChat(messages, opts = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: opts.model || 'gpt-4o-mini',
      messages,
      temperature: opts.temperature ?? 0.7,
      response_format: opts.json ? { type: 'json_object' } : undefined,
    });
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Reuse the same RapidAPI Hotels4 two-stage flow as /api/hotels/location + /api/hotels/search,
// but as an internal helper so the trip planner can pull real hotel names/prices.
async function getRealHotelsForCity(cityName, budget, days) {
  try {
    const locUrl = `https://hotels4.p.rapidapi.com/locations/v3/search?q=${encodeURIComponent(cityName)}&locale=en_US&langid=1033&siteid=300000001`;
    const locResp = await httpGet(locUrl, { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'hotels4.p.rapidapi.com' });
    const gaiaId = locResp.body?.sr?.[0]?.gaiaId;
    if (!gaiaId) return [];

    const checkin = new Date().toISOString().split('T')[0];
    const checkoutDate = new Date(); checkoutDate.setDate(checkoutDate.getDate() + Math.max(1, days));
    const checkout = checkoutDate.toISOString().split('T')[0];

    const hotelUrl = `https://hotels4.p.rapidapi.com/properties/v2/list?currency=INR&eapid=1&locale=en_US&siteId=300000001`
      + `&destination%5BregionId%5D=${gaiaId}&checkInDate=${checkin}&checkOutDate=${checkout}`
      + `&rooms%5B0%5D%5BnumberOfAdults%5D=2&resultsStartingIndex=0&resultsSize=10&sort=PRICE_LOW_TO_HIGH`;
    const hotelResp = await httpGet(hotelUrl, { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'hotels4.p.rapidapi.com' });

    const properties = hotelResp.body?.data?.propertySearch?.properties || [];
    const perNightBudget = budget / Math.max(1, days) * 0.4; // ~40% of daily budget toward stay

    return properties
      .map(p => ({
        name: p.name,
        pricePerNight: p.price?.lead?.amount || null,
        rating: p.reviews?.score || null,
      }))
      .filter(h => h.pricePerNight)
      .sort((a, b) => Math.abs(a.pricePerNight - perNightBudget) - Math.abs(b.pricePerNight - perNightBudget))
      .slice(0, 5);
  } catch (e) {
    console.error('getRealHotelsForCity error:', e.message);
    return [];
  }
}

app.post('/api/trip-planner', async (req, res) => {
  const { source, destination, budget, days, interests } = req.body;

  if (!destination || !budget || !days) {
    return res.status(400).json({ error: 'destination, budget, and days are required' });
  }
  const numDays = Math.max(1, Math.min(30, parseInt(days)));
  const numBudget = Math.max(500, parseInt(budget));
  const interestList = Array.isArray(interests) ? interests : (interests ? [interests] : ['General sightseeing']);

  // ── Ground the plan in real data ──
  let destinationPlace = null;
  try {
    destinationPlace = await Place.findOne({ nameLower: destination.toLowerCase().trim() }).lean();
  } catch (e) { /* Place collection may not exist yet — proceed without it */ }

  const realHotels = await getRealHotelsForCity(destination, numBudget, numDays);

  // ── Estimate transport cost using existing cab pricing logic, if source given ──
  let transportEstimate = null;
  if (source) {
    try {
      const origin = encodeURIComponent(source + ', India');
      const dest = encodeURIComponent(destination + ', India');
      let distanceKm = 300; // fallback default
      if (GOOGLE_MAPS_KEY) {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&units=metric&key=${GOOGLE_MAPS_KEY}`;
        const resp = await httpGet(url);
        const element = resp.body?.rows?.[0]?.elements?.[0];
        if (element?.status === 'OK') distanceKm = Math.round(element.distance.value / 1000);
      }
      const sedanFare = Math.max(399, Math.round(distanceKm * 15));
      transportEstimate = { distanceKm, roundTripCabFare: sedanFare * 2 };
    } catch (e) { /* skip if it fails */ }
  }

  if (!OPENAI_API_KEY) {
    return res.json({
      error: 'OPENAI_API_KEY not set — AI itinerary generation unavailable. Set it in Railway env vars.',
      groundingData: { destinationPlace, realHotels, transportEstimate },
    });
  }

  // ── Build grounded prompt ──
  const groundingNotes = [];
  if (destinationPlace) {
    groundingNotes.push(`Destination coordinates: ${destinationPlace.latitude}, ${destinationPlace.longitude} (${destinationPlace.admin1 || ''})`);
  }
  if (realHotels.length) {
    groundingNotes.push(`Real available hotels (use these, do not invent other hotel names):\n` +
      realHotels.map(h => `- ${h.name}: ₹${h.pricePerNight}/night${h.rating ? `, rating ${h.rating}` : ''}`).join('\n'));
  }
  if (transportEstimate) {
    groundingNotes.push(`Estimated round-trip cab fare from ${source} to ${destination}: ₹${transportEstimate.roundTripCabFare} (${transportEstimate.distanceKm} km one-way)`);
  }

  const systemPrompt = `You are GoJourney's AI trip planner for Indian travel. Generate a realistic, day-by-day itinerary.
Use ONLY the real hotel names provided in the grounding data if given — never invent hotel names if real ones are supplied.
Be specific with real, well-known places to visit in the destination. Keep costs realistic for India in INR.
Respond ONLY with valid JSON in this exact structure, no markdown, no preamble:
{
  "destination": "string",
  "days": number,
  "totalEstimatedCost": number,
  "budgetFit": "under budget" | "on budget" | "over budget",
  "itinerary": [
    { "day": 1, "title": "string", "activities": ["string", "string"], "estimatedCost": number }
  ],
  "hotelSuggestions": [ { "name": "string", "pricePerNight": number, "note": "string" } ],
  "tips": ["string", "string"]
}`;

  const userPrompt = `Plan a ${numDays}-day trip to ${destination}${source ? ` from ${source}` : ''}.
Total budget: ₹${numBudget}.
Interests: ${interestList.join(', ')}.
${groundingNotes.length ? '\nGrounding data:\n' + groundingNotes.join('\n\n') : ''}`;

  try {
    const completion = await openaiChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { json: true });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      console.error('OpenAI returned no content. Full response:', JSON.stringify(completion));
      return res.status(500).json({
        error: completion.error?.message
          ? `OpenAI error: ${completion.error.message}`
          : 'AI did not return a valid response — check Railway logs for details',
      });
    }

    let plan;
    try {
      const cleaned = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      plan = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse AI JSON. Raw content:', content);
      return res.status(500).json({ error: 'AI returned malformed data. Please try again.' });
    }
    res.json({ plan, groundingData: { realHotels, transportEstimate }, source: 'openai' });
  } catch (err) {
    console.error('Trip planner error:', err.message);
    res.status(500).json({ error: 'Failed to generate trip plan', detail: err.message });
  }
});

// ───────────────────────────────────────────────────────
//  ✅ GROUP / COLLEGE TRIP PLANNER (Student Travel Mode)
//
//  POST /api/group-trip
//  Body: { destination, groupSize, budgetPerPerson, days, collegeName }
//
//  Builds a group-oriented plan: bulk transport (bus/tempo traveller),
//  shared accommodation, and a per-person cost breakdown.
// ───────────────────────────────────────────────────────
app.post('/api/group-trip', async (req, res) => {
  const { source, destination, groupSize, budgetPerPerson, days, collegeName } = req.body;

  if (!destination || !groupSize || !budgetPerPerson || !days) {
    return res.status(400).json({ error: 'destination, groupSize, budgetPerPerson, and days are required' });
  }
  const numGroup = Math.max(2, Math.min(60, parseInt(groupSize)));
  const numDays = Math.max(1, Math.min(15, parseInt(days)));
  const numBudgetPP = Math.max(300, parseInt(budgetPerPerson));
  const totalBudget = numGroup * numBudgetPP;

  // ── Real bus options for the route (your seeded BusRoute data) ──
  let busOptions = [];
  if (source) {
    const fromNorm = normalizeCity(source);
    const toNorm = normalizeCity(destination);
    busOptions = await BusRoute.find({
      from: { $regex: fromNorm, $options: 'i' },
      to: { $regex: toNorm, $options: 'i' },
      active: true,
    }).limit(5).lean();
  }

  // ── Recommend tempo traveller for groups, using existing CAB_TYPES pricing ──
  let groupTransport = null;
  if (source) {
    try {
      let distanceKm = 300;
      if (GOOGLE_MAPS_KEY) {
        const origin = encodeURIComponent(source + ', India');
        const dest = encodeURIComponent(destination + ', India');
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&units=metric&key=${GOOGLE_MAPS_KEY}`;
        const resp = await httpGet(url);
        const element = resp.body?.rows?.[0]?.elements?.[0];
        if (element?.status === 'OK') distanceKm = Math.round(element.distance.value / 1000);
      }
      const tempoCount = Math.ceil(numGroup / 12); // 12-seater tempo travellers
      const tempoFareEach = Math.max(999, Math.round(distanceKm * 28));
      groupTransport = {
        distanceKm,
        vehicleType: 'Tempo Traveller (12-seater)',
        vehiclesNeeded: tempoCount,
        totalFare: tempoFareEach * tempoCount * 2, // round trip
        perPersonFare: Math.round((tempoFareEach * tempoCount * 2) / numGroup),
      };
    } catch (e) { /* skip */ }
  }

  // ── Real budget hotel options grouped for shared rooms ──
  const realHotels = await getRealHotelsForCity(destination, numBudgetPP * numDays, numDays);
  const sharedRoomHotels = realHotels.map(h => ({
    ...h,
    roomsNeeded: Math.ceil(numGroup / 3), // assume triple-sharing
    costPerPersonPerNight: Math.round(h.pricePerNight / 3),
  }));

  const accommodationCostPP = sharedRoomHotels.length
    ? sharedRoomHotels[0].costPerPersonPerNight * numDays
    : Math.round(numBudgetPP * 0.4);

  const transportCostPP = groupTransport ? groupTransport.perPersonFare : (busOptions[0]?.price || Math.round(numBudgetPP * 0.25));
  const foodAndMiscPP = Math.max(0, numBudgetPP - accommodationCostPP - transportCostPP);

  res.json({
    destination,
    source: source || null,
    collegeName: collegeName || null,
    groupSize: numGroup,
    days: numDays,
    budgetPerPerson: numBudgetPP,
    totalGroupBudget: totalBudget,
    transport: {
      busOptions: busOptions.map(b => ({ name: b.name, type: b.type, price: b.price, departure: b.departure, arrival: b.arrival })),
      groupVehicle: groupTransport,
    },
    accommodation: sharedRoomHotels,
    costBreakdownPerPerson: {
      accommodation: accommodationCostPP,
      transport: transportCostPP,
      foodAndMisc: foodAndMiscPP,
      total: accommodationCostPP + transportCostPP + foodAndMiscPP,
    },
    note: numGroup >= 10 ? 'Groups of 10+ may qualify for bulk hotel/bus discounts — contact operators directly to negotiate.' : null,
  });
});

// ───────────────────────────────────────────────────────
//  ✅ AI CHAT ASSISTANT (general travel Q&A, multi-turn)
//
//  POST /api/chat
//  Body: { messages: [{ role: 'user'|'assistant', content: '...' }, ...] }
//
//  Stateless on the server — frontend sends full conversation history each
//  time (same pattern recommended for any Claude/OpenAI-powered chat UI).
//  Scoped to travel topics only via system prompt; not connected to live
//  booking/search data — for that, direct users to the relevant search tab.
// ───────────────────────────────────────────────────────
const CHAT_SYSTEM_PROMPT = `You are GoJourney AI Assistant, a friendly travel expert for travelers in India.
You help with general travel questions: best times to visit places, what to pack, local customs,
budget tips, safety advice, visa/ID requirements for domestic travel, food recommendations, weather,
festivals, and trip ideas.
You do NOT have access to live prices, real-time bus/hotel/cab availability, or the user's bookings.
If asked about live prices, availability, or "book me a...", politely say you can't check live data
or make bookings directly, and point them to the relevant GoJourney search tab (Hotels, Cabs, Buses,
Tours, Shuttle, AI Trip Planner, or Group/College Trip) instead.
Keep answers concise, warm, and practical — a few short paragraphs or a short list, not an essay.
If a question is unrelated to travel, politely redirect to travel topics.`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Conversation too long. Please start a new chat.' });
  }
  for (const m of messages) {
    if (!m.role || !m.content || typeof m.content !== 'string' || m.content.length > 2000) {
      return res.status(400).json({ error: 'Invalid message format or message too long' });
    }
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI Assistant unavailable — OPENAI_API_KEY not set.' });
  }

  try {
    const completion = await openaiChat([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ], { temperature: 0.6 });

    const reply = completion.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(500).json({ error: 'AI did not return a response' });
    }
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Failed to get AI response', detail: err.message });
  }
});

// ───────────────────────────────────────────────────────
//  AUTH ROUTES
// ───────────────────────────────────────────────────────
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
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password).catch(() => password === user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// ───────────────────────────────────────────────────────
//  BOOKING ROUTES
// ───────────────────────────────────────────────────────
app.post('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { type, serviceId, details, amount, paymentMethod, couponApplied, travelDate } = req.body;
    const bookingId = 'GJ' + Date.now().toString().slice(-8);
    const booking = await Booking.create({
      bookingId, userId: req.user.id, type, serviceId, details,
      amount, paymentMethod, couponApplied, travelDate: travelDate ? new Date(travelDate) : null,
    });
    res.json({ success: true, booking, bookingId });
  } catch(err) {
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

// ───────────────────────────────────────────────────────
//  WISHLIST
// ───────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────
//  ADMIN ROUTES
// ───────────────────────────────────────────────────────
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  const [totalBookings, totalUsers, bookings] = await Promise.all([
    Booking.countDocuments(), User.countDocuments(), Booking.find().select('amount status'),
  ]);
  const totalRevenue  = bookings.reduce((s, b) => s + b.amount, 0);
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
    res.json({ message: 'User deleted successfully' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────
//  LISTINGS
// ───────────────────────────────────────────────────────
app.get('/api/listings', async (req, res) => {
  const listings = await Listing.find({ active: true });
  res.json(listings);
});

app.post('/api/listings', authMiddleware, adminMiddleware, async (req, res) => {
  const listing = await Listing.create(req.body);
  res.json(listing);
});

// ───────────────────────────────────────────────────────
//  COUPONS
// ───────────────────────────────────────────────────────
app.post('/api/coupons/validate', authMiddleware, (req, res) => {
  const { code, serviceType, amount } = req.body;
  const coupons = {
    'HOTEL30':   { type: 'percent', value: 30,   service: 'hotels' },
    'CAB20':     { type: 'percent', value: 20,   service: 'cabs'   },
    'TOUR2K':    { type: 'flat',    value: 2000, service: 'tours'  },
    'BUS3FOR2':  { type: 'percent', value: 33,   service: 'buses'  },
    'FIRST10':   { type: 'percent', value: 10,   service: 'all'    },
  };
  const coupon = coupons[code.toUpperCase()];
  if (!coupon) return res.status(400).json({ error: 'Invalid coupon code' });
  if (coupon.service !== 'all' && coupon.service !== serviceType) {
    return res.status(400).json({ error: `Coupon valid for ${coupon.service} only` });
  }
  const discount = coupon.type === 'percent' ? Math.round(amount * coupon.value / 100) : coupon.value;
  res.json({ valid: true, discount, coupon });
});

// ───────────────────────────────────────────────────────
//  OTP (Fast2SMS / Twilio)
// ───────────────────────────────────────────────────────
const otpStore = new Map();

app.post('/api/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Valid phone number required' });
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  const FAST2SMS_KEY = process.env.FAST2SMS_KEY;
  if (FAST2SMS_KEY) {
    try {
      const r = await httpPost('https://www.fast2sms.com/dev/bulkV2',
        { 'authorization': FAST2SMS_KEY, 'Content-Type': 'application/json' },
        JSON.stringify({ route: 'otp', variables_values: otp, numbers: cleanPhone, flash: 0 })
      );
      if (r.json().return === true) return res.json({ success: true, message: 'OTP sent via SMS' });
    } catch(e) { console.error('Fast2SMS error:', e.message); }
  }

  console.log(`[DEV] OTP for ${cleanPhone}: ${otp}`);
  return res.json({ success: true, dev: true, otp, message: 'Dev mode: OTP shown here (no SMS provider configured)' });
});

app.post('/api/otp/verify', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const record = otpStore.get(cleanPhone);
  if (!record) return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
  if (Date.now() > record.expiresAt) { otpStore.delete(cleanPhone); return res.status(400).json({ error: 'OTP expired.' }); }
  if (record.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });
  otpStore.delete(cleanPhone);
  res.json({ success: true, message: 'Phone verified' });
});

// Serve frontend
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 GoJourney running on http://localhost:${PORT}`);
  console.log(`🗺️  Real cabs: ${GOOGLE_MAPS_KEY ? '✅ Google Maps connected' : '⚠️  Set GOOGLE_MAPS_KEY for real distances'}`);
  console.log(`🚌 Real buses: ✅ MongoDB BusRoute collection`);
  console.log(`🚐 Real shuttles: ✅ MongoDB ShuttleRoute collection`);
  console.log(`🤖 AI Trip Planner & Chat Assistant: ${OPENAI_API_KEY ? '✅ OpenAI connected' : '⚠️  Set OPENAI_API_KEY to enable'}`);
});

module.exports = app;