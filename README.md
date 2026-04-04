# ✈️ GoJourney — Travel Booking Platform

A full-stack, production-ready travel booking website built with HTML/CSS/JavaScript frontend and Node.js + MongoDB backend.

## 🚀 Quick Start

### Option A — Frontend Only (No setup required)
Just open `index.html` in a browser. Everything works with localStorage.

### Option B — Full Stack
```bash
npm install
node server.js
# Visit http://localhost:3000
```

### Option C — With MongoDB
```bash
# Start MongoDB first
mongod

# Set env variables (optional)
export MONGO_URI=mongodb://localhost:27017/gojourney
export JWT_SECRET=your_secret_key

npm start
```

## 📁 Project Structure
```
gojourney/
├── index.html        # Main frontend (all sections)
├── styles.css        # Complete responsive stylesheet
├── app.js            # Frontend logic (search, booking, auth)
├── server.js         # Node.js + Express backend
├── package.json      # Dependencies
└── README.md
```

## ✅ Features

### Frontend
- 🏨 Hotel search & booking with room selection
- 🚖 Cab booking with fare calculation
- 🚌 Bus booking with interactive seat map
- 🗺️ Tour packages with itinerary
- 🚐 Shuttle services with fixed routes
- 🔍 Search with filters & sorting
- 💳 Mock payment (UPI / Card / Net Banking)
- 🔐 Auth (Login / Signup / Social login UI)
- 📊 User dashboard with booking history
- ⚙️ Admin panel (bookings, users, listings)
- ❤️ Wishlist / save functionality
- 🎟️ Coupon codes (HOTEL30, CAB20, TOUR2K, etc.)
- 📍 Geolocation support
- 📱 Fully responsive (mobile/tablet/desktop)
- ✨ Smooth animations & transitions

### Backend (server.js)
- REST API with Express
- MongoDB + Mongoose ODM
- JWT authentication
- Password hashing (bcrypt)
- Admin-protected routes
- Booking CRUD operations
- Coupon validation
- User management

## 🎟️ Test Coupon Codes
| Code | Discount |
|------|----------|
| HOTEL30 | 30% off hotels |
| CAB20 | 20% off cabs |
| TOUR2K | ₹2000 off tours |
| BUS3FOR2 | 33% off buses |
| FIRST10 | 10% off anything |

## 🔐 Demo Login
Any email + password (6+ chars) works in demo mode.
Data is saved to localStorage.

## 🌐 API Endpoints
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/search/hotels?destination=Goa&checkin=2026-04-05
GET    /api/search/cabs?from=Delhi&to=Manali
GET    /api/search/buses?from=Mumbai&to=Goa
GET    /api/search/tours?destination=Kerala
GET    /api/search/shuttles

POST   /api/bookings          (auth required)
GET    /api/bookings/my       (auth required)
PATCH  /api/bookings/:id/cancel

POST   /api/wishlist/toggle   (auth required)
POST   /api/coupons/validate  (auth required)

GET    /api/admin/stats       (admin only)
GET    /api/admin/bookings    (admin only)
GET    /api/admin/users       (admin only)
```

## 🎨 Design System
- **Primary**: #0A4DA3 (Deep Blue)
- **Accent**: #f97316 (Orange)
- **Cyan**: #0891b2
- **Font**: Syne (headings) + DM Sans (body)
