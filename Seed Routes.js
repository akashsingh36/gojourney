/**
 * One-time import: loads routes-data.json (700 bus routes + 200 shuttle routes,
 * covering 58 major Indian cities, fully bidirectional) into your MongoDB Atlas
 * BusRoute and ShuttleRoute collections — same schemas already used by server.js.
 *
 * Usage:
 *   export MONGO_URI="your_atlas_connection_string"
 *   node seed-routes.js
 *
 * By default this ADDS to existing routes (won't touch your hand-written ones).
 * Pass --reset to wipe both collections first:
 *   node seed-routes.js --reset
 */
const fs = require("fs");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ Set MONGO_URI env var first, e.g.\n   export MONGO_URI=\"mongodb+srv://...\"");
  process.exit(1);
}

const RESET = process.argv.includes("--reset");

// Schemas mirrored exactly from server.js so they map onto the same collections
const BusRouteSchema = new mongoose.Schema({
  from:        { type: String, required: true, lowercase: true },
  to:          { type: String, required: true, lowercase: true },
  name:        { type: String, required: true },
  type:        { type: String, required: true },
  departure:   { type: String, required: true },
  arrival:     { type: String, required: true },
  price:       { type: Number, required: true },
  totalSeats:  { type: Number, default: 40 },
  distanceKm:  { type: Number },
  active:      { type: Boolean, default: true },
});

const ShuttleRouteSchema = new mongoose.Schema({
  city:       { type: String, required: true, lowercase: true },
  name:       { type: String, required: true },
  from:       { type: String, required: true },
  to:         { type: String, required: true },
  price:      { type: Number, required: true },
  timing:     { type: String, required: true },
  frequency:  { type: String, required: true },
  duration:   { type: String, required: true },
  active:     { type: Boolean, default: true },
});

const BusRoute = mongoose.model("BusRoute", BusRouteSchema);
const ShuttleRoute = mongoose.model("ShuttleRoute", ShuttleRouteSchema);

async function run() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected");

  const raw = fs.readFileSync("routes-data.json", "utf8");
  const { busRoutes, shuttleRoutes } = JSON.parse(raw);
  console.log(`Loaded ${busRoutes.length} bus routes and ${shuttleRoutes.length} shuttle routes from routes-data.json`);

  if (RESET) {
    console.log("⚠️  --reset flag set: clearing existing BusRoute and ShuttleRoute collections...");
    await BusRoute.deleteMany({});
    await ShuttleRoute.deleteMany({});
  }

  console.log("Inserting bus routes...");
  await BusRoute.insertMany(busRoutes, { ordered: false }).catch(err => {
    console.warn(`  (${err.writeErrors?.length || 0} bus routes skipped due to errors)`);
  });

  console.log("Inserting shuttle routes...");
  await ShuttleRoute.insertMany(shuttleRoutes, { ordered: false }).catch(err => {
    console.warn(`  (${err.writeErrors?.length || 0} shuttle routes skipped due to errors)`);
  });

  const finalBusCount = await BusRoute.countDocuments();
  const finalShuttleCount = await ShuttleRoute.countDocuments();
  console.log(`✅ Done. Collections now contain ${finalBusCount} bus routes, ${finalShuttleCount} shuttle routes.`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});