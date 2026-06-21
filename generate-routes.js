/**
 * ONE-TIME GENERATOR (not part of the app) — produces routes-data.json
 * which seed-routes.js then loads and inserts into MongoDB Atlas.
 * Run locally with: node generate-routes.js
 */
const fs = require('fs');

// ── Major Indian cities with approximate lat/lng (for realistic distance calc) ──
const CITIES = [
  { name: 'Delhi', lat: 28.6139, lng: 77.2090, tier: 1 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777, tier: 1 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946, tier: 1 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867, tier: 1 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707, tier: 1 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639, tier: 1 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567, tier: 1 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, tier: 1 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873, tier: 1 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462, tier: 1 },
  { name: 'Kanpur', lat: 26.4499, lng: 80.3319, tier: 2 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882, tier: 2 },
  { name: 'Indore', lat: 22.7196, lng: 75.8577, tier: 2 },
  { name: 'Bhopal', lat: 23.2599, lng: 77.4126, tier: 2 },
  { name: 'Patna', lat: 25.5941, lng: 85.1376, tier: 2 },
  { name: 'Surat', lat: 21.1702, lng: 72.8311, tier: 2 },
  { name: 'Varanasi', lat: 25.3176, lng: 82.9739, tier: 2 },
  { name: 'Prayagraj', lat: 25.4358, lng: 81.8463, tier: 2 },
  { name: 'Agra', lat: 27.1767, lng: 78.0081, tier: 2 },
  { name: 'Amritsar', lat: 31.6340, lng: 74.8723, tier: 2 },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, tier: 2 },
  { name: 'Dehradun', lat: 30.3165, lng: 78.0322, tier: 2 },
  { name: 'Haridwar', lat: 29.9457, lng: 78.1642, tier: 3 },
  { name: 'Rishikesh', lat: 30.0869, lng: 78.2676, tier: 3 },
  { name: 'Shimla', lat: 31.1048, lng: 77.1734, tier: 3 },
  { name: 'Manali', lat: 32.2432, lng: 77.1892, tier: 3 },
  { name: 'Jodhpur', lat: 26.2389, lng: 73.0243, tier: 2 },
  { name: 'Udaipur', lat: 24.5854, lng: 73.7125, tier: 2 },
  { name: 'Ajmer', lat: 26.4499, lng: 74.6399, tier: 3 },
  { name: 'Goa', lat: 15.2993, lng: 74.1240, tier: 2 },
  { name: 'Nashik', lat: 19.9975, lng: 73.7898, tier: 2 },
  { name: 'Aurangabad', lat: 19.8762, lng: 75.3433, tier: 3 },
  { name: 'Mysore', lat: 12.2958, lng: 76.6394, tier: 2 },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558, tier: 2 },
  { name: 'Madurai', lat: 9.9252, lng: 78.1198, tier: 2 },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673, tier: 2 },
  { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366, tier: 2 },
  { name: 'Vizag', lat: 17.6868, lng: 83.2185, tier: 2 },
  { name: 'Vijayawada', lat: 16.5062, lng: 80.6480, tier: 2 },
  { name: 'Bhubaneswar', lat: 20.2961, lng: 85.8245, tier: 2 },
  { name: 'Ranchi', lat: 23.3441, lng: 85.3096, tier: 2 },
  { name: 'Raipur', lat: 21.2514, lng: 81.6296, tier: 2 },
  { name: 'Guwahati', lat: 26.1445, lng: 91.7362, tier: 2 },
  { name: 'Siliguri', lat: 26.7271, lng: 88.3953, tier: 3 },
  { name: 'Gwalior', lat: 26.2183, lng: 78.1828, tier: 3 },
  { name: 'Jabalpur', lat: 23.1815, lng: 79.9864, tier: 3 },
  { name: 'Faridabad', lat: 28.4089, lng: 77.3178, tier: 2 },
  { name: 'Gurgaon', lat: 28.4595, lng: 77.0266, tier: 2 },
  { name: 'Noida', lat: 28.5355, lng: 77.3910, tier: 2 },
  { name: 'Meerut', lat: 28.9845, lng: 77.7064, tier: 3 },
  { name: 'Ludhiana', lat: 30.9010, lng: 75.8573, tier: 2 },
  { name: 'Jalandhar', lat: 31.3260, lng: 75.5762, tier: 3 },
  { name: 'Rajkot', lat: 22.3039, lng: 70.8022, tier: 2 },
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812, tier: 2 },
  { name: 'Gorakhpur', lat: 26.7606, lng: 83.3732, tier: 3 },
  { name: 'Bareilly', lat: 28.3670, lng: 79.4304, tier: 3 },
  { name: 'Allahabad', lat: 25.4358, lng: 81.8463, tier: 3 },
  { name: 'Mathura', lat: 27.4924, lng: 77.6737, tier: 3 },
  { name: 'Pushkar', lat: 26.4897, lng: 74.5511, tier: 3 },
  { name: 'Mount Abu', lat: 24.5926, lng: 72.7156, tier: 3 },
];

// ── Realistic operator names by bus type ──
const OPERATORS = {
  'AC Volvo':  ['VRL Travels', 'SRS Travels', 'Orange Travels', 'Paulo Travels', 'Neeta Travels', 'Patel Travels', 'Sharma Travels', 'Kaveri Travels', 'IntrCity SmartBus', 'Zingbus'],
  'Sleeper':   ['Raj National Express', 'Shrinath Travels', 'Laxmi Holidays', 'Jain Travels', 'Royal Travels', 'Hans Travels'],
  'AC Seater': ['UPSRTC Janrath', 'RSRTC Volvo', 'MSRTC Shivneri', 'KSRTC Airavata', 'TNSTC Express', 'GSRTC Express'],
  'Non-AC':    ['UPSRTC Express', 'State Transport', 'RSRTC Express', 'Local Roadways'],
};

const BUS_TYPES = ['AC Volvo', 'Sleeper', 'AC Seater', 'Non-AC'];

function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h)) * 1.25); // *1.25 road-distance fudge factor
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

function formatTime(h, m) {
  h = ((h % 24) + 24) % 24;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function priceForDistance(km, type) {
  const perKm = { 'AC Volvo': 2.3, 'Sleeper': 1.7, 'AC Seater': 1.5, 'Non-AC': 1.0 }[type];
  const base = { 'AC Volvo': 250, 'Sleeper': 200, 'AC Seater': 150, 'Non-AC': 100 }[type];
  return Math.round((base + km * perKm) / 10) * 10; // round to nearest 10
}

// ── Build all unique city pairs within a plausible travel range (80km - 2200km) ──
const pairs = [];
for (let i = 0; i < CITIES.length; i++) {
  for (let j = 0; j < CITIES.length; j++) {
    if (i === j) continue;
    const dist = haversine(CITIES[i], CITIES[j]);
    if (dist >= 80 && dist <= 2200) {
      pairs.push({ from: CITIES[i], to: CITIES[j], dist });
    }
  }
}

// Shuffle and trim to a workable pool, prioritizing shorter/more plausible routes
pairs.sort((a, b) => a.dist - b.dist);

// ── Generate BUS routes: 700 total, bidirectional, ~1-3 buses per direction-pair ──
const busRoutes = [];
let pairIdx = 0;
const usedPairs = new Set();

while (busRoutes.length < 700 && pairIdx < pairs.length * 3) {
  const p = pairs[pairIdx % pairs.length];
  pairIdx++;
  const pairKey = p.from.name + '->' + p.to.name;
  const reverseKey = p.to.name + '->' + p.from.name;

  // how many buses to add to this pair this round (1-2)
  const busesThisRound = busRoutes.filter(b => b.from === p.from.name.toLowerCase() && b.to === p.to.name.toLowerCase()).length;
  if (busesThisRound >= 3) continue; // cap at 3 operators per direction

  const type = pick(BUS_TYPES);
  const operator = pick(OPERATORS[type]);
  const depHour = randInt(5, 23);
  const depMin = pick([0, 15, 30, 45]);
  const travelHours = Math.max(1.5, p.dist / 48); // ~48 km/h avg incl. stops
  const totalMins = depHour * 60 + depMin + Math.round(travelHours * 60);
  const arrHour = Math.floor(totalMins / 60) % 24;
  const arrMin = totalMins % 60;

  busRoutes.push({
    from: p.from.name.toLowerCase(),
    to: p.to.name.toLowerCase(),
    name: operator,
    type,
    departure: formatTime(depHour, depMin),
    arrival: formatTime(arrHour, arrMin),
    price: priceForDistance(p.dist, type),
    totalSeats: type === 'AC Volvo' ? 40 : type === 'Sleeper' ? 36 : type === 'AC Seater' ? 45 : 50,
    distanceKm: p.dist,
    active: true,
  });
  usedPairs.add(pairKey);
}

// ── Generate SHUTTLE routes: 200 total — short intra-city / airport-to-hub style ──
const SHUTTLE_TEMPLATES = [
  (city) => ({ name: `${city} Airport Express`, from: `${city} Airport`, to: `${city} City Center`, price: randInt(250, 550), timing: '04:00–23:30', frequency: pick(['Every 20 mins','Every 30 mins','Every 25 mins']), duration: `${randInt(35,65)} mins` }),
  (city) => ({ name: `${city} Railway Connector`, from: `${city} Railway Station`, to: `${city} Bus Stand`, price: randInt(80, 200), timing: '05:00–22:00', frequency: pick(['Every 15 mins','Every 20 mins']), duration: `${randInt(20,40)} mins` }),
  (city) => ({ name: `${city} Tech Hub Shuttle`, from: `${city} IT Park`, to: `${city} Metro Station`, price: randInt(60, 150), timing: '07:00–21:00', frequency: pick(['Every 20 mins','Every 30 mins']), duration: `${randInt(25,45)} mins` }),
  (city) => ({ name: `${city} University Link`, from: `${city} University`, to: `${city} Bus Stand`, price: randInt(50, 120), timing: '06:30–20:30', frequency: 'Every 30 mins', duration: `${randInt(20,35)} mins` }),
  (city) => ({ name: `${city} Old Town Shuttle`, from: `${city} Old City`, to: `${city} New City`, price: randInt(70, 180), timing: '06:00–22:00', frequency: 'Every 25 mins', duration: `${randInt(20,50)} mins` }),
];

const shuttleRoutes = [];
let templateIdx = 0;
const shuttleCities = CITIES.filter(c => c.tier <= 2); // shuttles make sense mainly in bigger cities

while (shuttleRoutes.length < 200) {
  const city = shuttleCities[templateIdx % shuttleCities.length].name;
  const template = SHUTTLE_TEMPLATES[Math.floor(templateIdx / shuttleCities.length) % SHUTTLE_TEMPLATES.length];
  const s = template(city);
  shuttleRoutes.push({
    city: city.toLowerCase(),
    name: s.name,
    from: s.from,
    to: s.to,
    price: s.price,
    timing: s.timing,
    frequency: s.frequency,
    duration: s.duration,
    active: true,
  });
  templateIdx++;
}

fs.writeFileSync('routes-data.json', JSON.stringify({ busRoutes, shuttleRoutes }, null, 0));
console.log(`Generated ${busRoutes.length} bus routes and ${shuttleRoutes.length} shuttle routes -> routes-data.json`);