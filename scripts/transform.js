/**
 * Transforms raw Overpass API JSON into a clean GeoJSON FeatureCollection.
 *
 * Usage:
 *   node scripts/transform.js                    # reads data/overpass-raw.json
 *   require('./transform').transform(rawData)     # programmatic use
 */

const fs = require('fs');
const path = require('path');

// Priority-ordered category rules. First match wins.
const CATEGORY_RULES = [
  { category: 'castles', match: (t) => /^(castle|fort|citadel)$/.test(t.historic) },
  { category: 'museums', match: (t) => /^(museum|gallery)$/.test(t.tourism) },
  {
    category: 'churches',
    match: (t) =>
      /^(church|monastery|cathedral)$/.test(t.historic) ||
      (t.amenity === 'place_of_worship' && /cathedral|church|monastery/.test(t.building || '')),
  },
  { category: 'monuments', match: (t) => /^(monument|memorial)$/.test(t.historic) },
  {
    category: 'nature',
    match: (t) =>
      t.leisure === 'nature_reserve' ||
      t.boundary === 'national_park' ||
      /^(peak|cave_entrance|waterfall|glacier)$/.test(t.natural),
  },
  { category: 'ruins', match: (t) => /^(archaeological_site|ruins)$/.test(t.historic) },
  { category: 'viewpoints', match: (t) => t.tourism === 'viewpoint' },
  {
    category: 'attractions',
    match: (t) => /^(attraction|artwork|zoo|aquarium|theme_park)$/.test(t.tourism),
  },
];

function categorize(tags) {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(tags)) return rule.category;
  }
  return 'attractions'; // fallback
}

function getCoordinates(element) {
  // Nodes have lat/lon directly
  if (element.type === 'node' && element.lat != null && element.lon != null) {
    return [element.lon, element.lat]; // GeoJSON is [lng, lat]
  }
  // Ways/relations use the center point from "out center"
  if (element.center && element.center.lat != null && element.center.lon != null) {
    return [element.center.lon, element.center.lat];
  }
  return null;
}

function transform(rawData) {
  const elements = rawData.elements || [];
  const features = [];
  const stats = {};
  let skippedNoName = 0;
  let skippedNoCoords = 0;

  for (const el of elements) {
    const tags = el.tags || {};

    // Skip elements without a name
    if (!tags.name) {
      skippedNoName++;
      continue;
    }

    const coords = getCoordinates(el);
    if (!coords) {
      skippedNoCoords++;
      continue;
    }

    const category = categorize(tags);
    stats[category] = (stats[category] || 0) + 1;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coords,
      },
      properties: {
        id: `${el.type}/${el.id}`,
        name: tags.name,
        name_en: tags['name:en'] || '',
        category,
        wikipedia: tags.wikipedia || '',
        wikidata: tags.wikidata || '',
        website: tags.website || tags['contact:website'] || '',
        region: tags['addr:county'] || tags['is_in:county'] || '',
        osm_tags: tags,
      },
    });
  }

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      generated: new Date().toISOString(),
      source: 'OpenStreetMap via Overpass API',
      count: features.length,
      categories: stats,
    },
    features,
  };

  const outPath = path.join(__dirname, '..', 'data', 'poi.geojson');
  fs.writeFileSync(outPath, JSON.stringify(geojson), 'utf-8');

  console.log(`\nTransform complete:`);
  console.log(`  Total features: ${features.length}`);
  console.log(`  Skipped (no name): ${skippedNoName}`);
  console.log(`  Skipped (no coords): ${skippedNoCoords}`);
  console.log(`  Categories:`, stats);
  console.log(`  Output: ${outPath}\n`);

  return geojson;
}

// If run directly, read raw file and transform
if (require.main === module) {
  const rawPath = path.join(__dirname, '..', 'data', 'overpass-raw.json');
  if (!fs.existsSync(rawPath)) {
    console.error(`Raw data file not found: ${rawPath}`);
    console.error('Run fetch-overpass.js first.');
    process.exit(1);
  }
  const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  transform(rawData);
}

module.exports = { transform, categorize };
