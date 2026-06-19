const fs = require("fs");

const data = fs.readFileSync("IN.txt", "utf8");
const lines = data.split("\n");

const places = [];

for (const line of lines) {
  const cols = line.split("\t");

  if (cols.length > 14 && cols[6] === "P") {
    places.push({
      geonameId: cols[0],
      name: cols[1],
      latitude: Number(cols[4]),
      longitude: Number(cols[5]),
      population: Number(cols[14]) || 0
    });
  }
}

fs.writeFileSync("places.json", JSON.stringify(places));

console.log(`Saved ${places.length} places`);