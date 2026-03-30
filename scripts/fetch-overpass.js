/**
 * Fetches Romanian tourist POI data from the Overpass API
 * and saves raw JSON to data/overpass-raw.json.
 *
 * Usage: node scripts/fetch-overpass.js
 */

const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const QUERY = `
[out:json][timeout:120];
area(id:3600090689)->.romania;
(
  nwr["tourism"~"museum|attraction|gallery|viewpoint|artwork|zoo|aquarium|theme_park"](area.romania);
  nwr["historic"~"castle|monument|memorial|ruins|archaeological_site|fort|citadel|church|monastery"](area.romania);
  nwr["leisure"="nature_reserve"](area.romania);
  nwr["boundary"="national_park"](area.romania);
  nwr["natural"~"peak|cave_entrance|waterfall|glacier"](area.romania);
  nwr["amenity"="place_of_worship"]["building"~"cathedral|church|monastery"](area.romania);
);
out center tags;
`;

async function fetchOverpass() {
  console.log('Fetching POI data from Overpass API...');
  console.log('This may take 30-120 seconds for a country-wide query.\n');

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`Received ${data.elements.length} raw elements from Overpass API.`);

  const outPath = path.join(__dirname, '..', 'data', 'overpass-raw.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Raw data saved to ${outPath}`);

  return data;
}

// If run directly, fetch and then transform
if (require.main === module) {
  fetchOverpass()
    .then((data) => {
      // Auto-run transform
      const { transform } = require('./transform');
      transform(data);
    })
    .catch((err) => {
      console.error('Error fetching data:', err.message);
      process.exit(1);
    });
}

module.exports = { fetchOverpass };
