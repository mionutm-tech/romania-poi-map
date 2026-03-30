/**
 * All 41 Romanian counties + Bucharest with approximate geographic bounding boxes.
 * Used to populate the county dropdown and spatially filter POIs.
 * Format: { name, bounds: [[latMin, lonMin], [latMax, lonMax]] }
 */
const ROMANIA_COUNTIES = [
  { name: 'Alba',              bounds: [[45.52, 22.85], [46.65, 24.15]] },
  { name: 'Arad',              bounds: [[45.75, 21.20], [46.80, 22.90]] },
  { name: 'Argeș',            bounds: [[44.35, 24.30], [45.60, 25.55]] },
  { name: 'Bacău',            bounds: [[45.85, 26.10], [47.00, 27.30]] },
  { name: 'Bihor',            bounds: [[46.35, 21.55], [47.55, 22.85]] },
  { name: 'Bistrița-Năsăud',  bounds: [[46.80, 23.85], [47.60, 25.25]] },
  { name: 'Botoșani',         bounds: [[47.45, 26.25], [48.25, 27.60]] },
  { name: 'Brăila',           bounds: [[44.90, 27.00], [45.80, 28.15]] },
  { name: 'Brașov',           bounds: [[45.30, 24.75], [46.15, 26.05]] },
  { name: 'București',        bounds: [[44.32, 25.92], [44.60, 26.30]] },
  { name: 'Buzău',            bounds: [[44.95, 25.95], [45.90, 27.35]] },
  { name: 'Călărași',         bounds: [[43.75, 26.20], [44.60, 27.55]] },
  { name: 'Caraș-Severin',    bounds: [[44.60, 21.60], [45.70, 22.90]] },
  { name: 'Cluj',             bounds: [[46.45, 22.85], [47.30, 24.35]] },
  { name: 'Constanța',        bounds: [[43.65, 27.90], [44.80, 29.80]] },
  { name: 'Covasna',          bounds: [[45.55, 25.55], [46.30, 26.60]] },
  { name: 'Dâmbovița',        bounds: [[44.60, 24.90], [45.40, 25.90]] },
  { name: 'Dolj',             bounds: [[43.85, 22.75], [44.90, 24.10]] },
  { name: 'Galați',           bounds: [[45.30, 27.35], [46.10, 28.60]] },
  { name: 'Giurgiu',          bounds: [[43.65, 25.30], [44.40, 26.35]] },
  { name: 'Gorj',             bounds: [[44.60, 22.55], [45.50, 23.90]] },
  { name: 'Harghita',         bounds: [[46.10, 25.25], [47.05, 26.60]] },
  { name: 'Hunedoara',        bounds: [[45.15, 22.20], [46.35, 23.60]] },
  { name: 'Ialomița',         bounds: [[44.40, 26.70], [45.25, 28.05]] },
  { name: 'Iași',             bounds: [[46.80, 26.70], [47.75, 28.10]] },
  { name: 'Ilfov',            bounds: [[44.30, 25.70], [44.90, 26.55]] },
  { name: 'Maramureș',        bounds: [[47.35, 23.05], [48.05, 25.00]] },
  { name: 'Mehedinți',        bounds: [[44.25, 22.10], [45.15, 23.15]] },
  { name: 'Mureș',            bounds: [[46.10, 23.80], [47.20, 25.40]] },
  { name: 'Neamț',            bounds: [[46.50, 25.75], [47.55, 27.05]] },
  { name: 'Olt',              bounds: [[43.80, 23.85], [44.85, 25.15]] },
  { name: 'Prahova',          bounds: [[44.75, 25.40], [45.65, 26.55]] },
  { name: 'Sălaj',            bounds: [[46.90, 22.75], [47.60, 23.90]] },
  { name: 'Satu Mare',        bounds: [[47.45, 22.20], [48.15, 23.50]] },
  { name: 'Sibiu',            bounds: [[45.45, 23.50], [46.30, 25.20]] },
  { name: 'Suceava',          bounds: [[47.05, 24.85], [48.00, 26.80]] },
  { name: 'Teleorman',        bounds: [[43.65, 24.65], [44.65, 26.15]] },
  { name: 'Timiș',            bounds: [[45.20, 21.00], [46.40, 22.40]] },
  { name: 'Tulcea',           bounds: [[44.60, 28.40], [45.70, 30.00]] },
  { name: 'Vâlcea',           bounds: [[44.75, 23.40], [45.60, 24.80]] },
  { name: 'Vaslui',           bounds: [[46.00, 27.30], [47.10, 28.40]] },
  { name: 'Vrancea',          bounds: [[45.30, 26.40], [46.25, 27.70]] },
];

/**
 * Returns matching county object for a given name, or null.
 */
function findCounty(name) {
  return ROMANIA_COUNTIES.find(c => c.name === name) || null;
}

/**
 * Returns features that fall within the county's bounding box.
 */
function featuresInCounty(features, county) {
  const [[latMin, lonMin], [latMax, lonMax]] = county.bounds;
  return features.filter(f => {
    const [lng, lat] = f.geometry.coordinates;
    return lat >= latMin && lat <= latMax && lng >= lonMin && lng <= lonMax;
  });
}
