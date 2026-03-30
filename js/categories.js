/**
 * Category definitions and OSM tag → category mapping.
 * Priority-ordered: first match wins when a POI has multiple tags.
 */
const CATEGORIES = {
  castles: {
    label: 'Castles & Fortifications',
    color: '#8B1A1A',
    icon: 'icons/castle.svg',
  },
  museums: {
    label: 'Museums & Galleries',
    color: '#7B2D8E',
    icon: 'icons/museum.svg',
  },
  churches: {
    label: 'Churches & Monasteries',
    color: '#D4A017',
    icon: 'icons/church.svg',
  },
  monuments: {
    label: 'Monuments & Memorials',
    color: '#5A6B7A',
    icon: 'icons/monument.svg',
  },
  nature: {
    label: 'Nature & Parks',
    color: '#2E7D32',
    icon: 'icons/nature.svg',
  },
  ruins: {
    label: 'Archaeological Sites & Ruins',
    color: '#8D6E3F',
    icon: 'icons/ruins.svg',
  },
  viewpoints: {
    label: 'Viewpoints',
    color: '#1565C0',
    icon: 'icons/viewpoint.svg',
  },
  attractions: {
    label: 'Other Attractions',
    color: '#E65100',
    icon: 'icons/attraction.svg',
  },
};

// Priority-ordered rules for categorizing OSM elements
const CATEGORY_RULES = [
  { category: 'castles', match: (t) => /^(castle|fort|citadel)$/.test(t.historic || '') },
  { category: 'museums', match: (t) => /^(museum|gallery)$/.test(t.tourism || '') },
  {
    category: 'churches',
    match: (t) =>
      /^(church|monastery|cathedral)$/.test(t.historic || '') ||
      (t.amenity === 'place_of_worship' && /cathedral|church|monastery/.test(t.building || '')),
  },
  { category: 'monuments', match: (t) => /^(monument|memorial)$/.test(t.historic || '') },
  {
    category: 'nature',
    match: (t) =>
      t.leisure === 'nature_reserve' ||
      t.boundary === 'national_park' ||
      /^(peak|cave_entrance|waterfall|glacier)$/.test(t.natural || ''),
  },
  { category: 'ruins', match: (t) => /^(archaeological_site|ruins)$/.test(t.historic || '') },
  { category: 'viewpoints', match: (t) => t.tourism === 'viewpoint' },
  {
    category: 'attractions',
    match: (t) => /^(attraction|artwork|zoo|aquarium|theme_park)$/.test(t.tourism || ''),
  },
];

function categorize(tags) {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(tags)) return rule.category;
  }
  return 'attractions';
}

/**
 * Transform raw Overpass API elements into GeoJSON features.
 */
function transformOverpassData(elements) {
  const features = [];
  let skippedNoName = 0;
  let skippedNoCoords = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    if (!tags.name) { skippedNoName++; continue; }

    let lng, lat;
    if (el.type === 'node' && el.lat != null) {
      lng = el.lon; lat = el.lat;
    } else if (el.center) {
      lng = el.center.lon; lat = el.center.lat;
    } else {
      skippedNoCoords++; continue;
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: `${el.type}/${el.id}`,
        name: tags.name,
        name_en: tags['name:en'] || '',
        category: categorize(tags),
        wikipedia: tags.wikipedia || '',
        wikidata: tags.wikidata || '',
        website: tags.website || tags['contact:website'] || '',
        region: tags['addr:county'] || tags['is_in:county'] || '',
      },
    });
  }

  console.log(`Transform: ${features.length} features, skipped ${skippedNoName} (no name), ${skippedNoCoords} (no coords)`);
  return features;
}
