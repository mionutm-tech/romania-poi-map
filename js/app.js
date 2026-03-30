/**
 * Main application: map initialization, data loading, tile layers, time-of-day toggle.
 */

(async function () {
  // --- Map setup ---
  const map = L.map('map', {
    center: [45.9432, 24.9668],
    zoom: 7,
    minZoom: 6,
    maxZoom: 18,
    zoomControl: false,
  });

  // Zoom control – bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // --- Tile layers: satellite hybrid ---
  // Layer 1: ESRI World Imagery — photorealistic satellite, always visible
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
    }
  );
  satellite.on('add', () => {
    const el = satellite.getContainer();
    if (el) el.style.filter = 'saturate(0.88) brightness(0.88)';
  });

  // Layer 2: ESRI Roads — fades in as you zoom in
  const roads = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri', maxZoom: 19, opacity: 0 }
  );

  // Layer 3: ESRI Labels / Places — fades in as you zoom in
  const labels = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri', maxZoom: 19, opacity: 0 }
  );

  satellite.addTo(map);
  roads.addTo(map);
  labels.addTo(map);

  // Tag labels layer for CSS styling (boosted visibility)
  labels.on('add', () => {
    const el = labels.getContainer();
    if (el) el.classList.add('labels-layer');
  });
  if (labels.getContainer()) labels.getContainer().classList.add('labels-layer');

  // Smoothly reveal roads + labels as zoom increases
  // Labels: visible from z7 (initial view), roads fade in z9–z12
  function updateOverlayOpacity() {
    const zoom = map.getZoom();
    const tLabels = Math.max(0, Math.min(1, (zoom - 6) / 2));  // visible from z7, full at z8
    const tRoads  = Math.max(0, Math.min(1, (zoom - 9) / 3));  // visible from z9, full at z12
    roads.setOpacity(tRoads * 0.80);
    labels.setOpacity(tLabels * 0.95);
  }
  map.on('zoomend', updateOverlayOpacity);
  updateOverlayOpacity();

  // --- Romania border + night mask ---
  try {
    const borderResp = await fetch(
      'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/ROU.geo.json'
    );
    if (borderResp.ok) {
      const romaniaGeo = await borderResp.json();

      // Outer mask: darken everything outside Romania
      const outerRing = [[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]];
      const romaniaCoords = romaniaGeo.features[0].geometry.coordinates;
      // Build inverted polygon (world minus Romania)
      const invertedCoords = [outerRing];
      for (const ring of romaniaCoords) {
        // GeoJSON polygons may be nested arrays (MultiPolygon-like)
        if (Array.isArray(ring[0][0])) {
          for (const sub of ring) invertedCoords.push(sub.map(c => [c[1], c[0]]));
        } else {
          invertedCoords.push(ring.map(c => [c[1], c[0]]));
        }
      }
      L.polygon(invertedCoords, {
        color: 'transparent',
        fillColor: '#0a0a0a',
        fillOpacity: 0.55,
        interactive: false,
      }).addTo(map);

      // Border: glow pass + crisp line
      L.geoJSON(romaniaGeo, {
        style: { color: '#FFFFFF', weight: 7, opacity: 0.25, fill: false },
        interactive: false,
      }).addTo(map);
      L.geoJSON(romaniaGeo, {
        style: { color: '#FF9238', weight: 2.5, opacity: 0.9, fill: false },
        interactive: false,
      }).addTo(map);

      // Store for POI filtering
      window._romaniaGeo = romaniaGeo;
    }
  } catch (e) {
    console.warn('Could not load Romania border:', e);
  }

  // --- Load data ---
  const statusEl = document.getElementById('loading-status');
  statusEl.textContent = 'Loading POI data...';

  let features = [];

  try {
    const resp = await fetch('data/poi.geojson');
    if (resp.ok) {
      const geojson = await resp.json();
      features = geojson.features || [];
      console.log(`Loaded ${features.length} features from poi.geojson`);
    }
  } catch (e) {
    console.warn('poi.geojson not available, trying raw files...');
  }

  if (features.length === 0) {
    const rawFiles = [
      'data/raw-tourism.json',
      'data/raw-historic.json',
      'data/raw-nature.json',
      'data/raw-worship.json',
    ];
    let allElements = [];

    for (const file of rawFiles) {
      try {
        const resp = await fetch(file);
        if (resp.ok) {
          const data = await resp.json();
          if (data.elements && data.elements.length > 0) {
            allElements = allElements.concat(data.elements);
            console.log(`Loaded ${data.elements.length} elements from ${file}`);
          }
        }
      } catch (e) {
        console.warn(`Could not load ${file}:`, e.message);
      }
    }

    if (allElements.length > 0) {
      features = transformOverpassData(allElements);
    }
  }

  if (features.length === 0) {
    statusEl.textContent = 'Error: No POI data found. Run the fetch script first.';
    statusEl.classList.add('error');
    return;
  }

  // Deduplicate by ID
  const seen = new Set();
  features = features.filter((f) => {
    if (seen.has(f.properties.id)) return false;
    seen.add(f.properties.id);
    return true;
  });

  // Filter out POIs outside Romania borders
  if (window._romaniaGeo) {
    const before = features.length;
    features = features.filter((f) => {
      const [lng, lat] = f.geometry.coordinates;
      return isPointInRomania(lng, lat, window._romaniaGeo);
    });
    console.log(`Filtered POIs: ${before} → ${features.length} (removed ${before - features.length} outside Romania)`);
  }

  statusEl.textContent = `Loaded ${features.length} points of interest`;
  setTimeout(() => statusEl.classList.add('fade-out'), 2000);
  setTimeout(() => statusEl.remove(), 2500);

  // --- Initialize modules ---
  initFilters(map, features);
  initSearch(map, features);

  // --- Hero image fetch on popup open ---
  map.on('popupopen', async (e) => {
    const popup  = e.popup;
    const props  = popup._source?.feature?.properties;
    console.log('[hero] popupopen — props:', props?.name, '| wiki:', props?.wikipedia, '| wd:', props?.wikidata);
    if (!props?.wikipedia && !props?.wikidata) { console.log('[hero] no wiki data, skip'); return; }

    const hero = popup.getElement()?.querySelector('.popup-img-hero');
    console.log('[hero] hero element:', hero);
    if (!hero || hero.querySelector('img')) { console.log('[hero] no hero or already has img'); return; }

    console.log('[hero] fetching image for', props.wikipedia, props.wikidata);
    const imgUrl = await fetchPOIImage(props.wikipedia || '', props.wikidata || '');
    console.log('[hero] imgUrl:', imgUrl);

    if (!hero.isConnected) { console.log('[hero] popup closed during fetch'); return; }

    if (!imgUrl) { console.log('[hero] no image found, removing hero'); hero.style.display = 'none'; return; }

    const img    = document.createElement('img');
    img.alt      = '';
    img.decoding = 'async';
    img.addEventListener('load', () => {
      console.log('[hero] image loaded OK');
      img.classList.add('hero-img-loaded');
      // No popup.update() — it resets innerHTML (function-based popup content),
      // destroying the img we just appended. Fixed height CSS means no relayout needed.
    });
    img.addEventListener('error', () => {
      console.log('[hero] image error');
      // Only update when removing the hero (changes popup height).
      if (hero.isConnected) hero.style.display = 'none';
    });
    hero.appendChild(img);
    img.src = imgUrl;
  });

  // --- URL hash state ---
  applyHashState(map);
  window.addEventListener('hashchange', () => applyHashState(map));

  map.on('moveend', updateHash);
  document.querySelector('.filter-checkboxes').addEventListener('change', updateHash);

  console.log('Romania POI Map initialized.');
})();

// --- Hero image fetcher ---
async function fetchPOIImage(wikipedia, wikidata) {
  // Try Wikipedia pageimages first (faster, pre-sized thumbnail)
  if (wikipedia) {
    const colonIdx = wikipedia.indexOf(':');
    const lang    = colonIdx > -1 ? wikipedia.slice(0, colonIdx)  : 'en';
    const article = colonIdx > -1 ? wikipedia.slice(colonIdx + 1) : wikipedia;
    try {
      const resp = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query` +
        `&titles=${encodeURIComponent(article)}&prop=pageimages` +
        `&format=json&pithumbsize=600&origin=*`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        const page = Object.values(data?.query?.pages || {})[0];
        if (page?.thumbnail?.source) return page.thumbnail.source;
      }
    } catch (e) { /* fall through to Wikidata */ }
  }

  // Fallback: Wikidata P18 image property
  if (wikidata) {
    try {
      const resp = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities` +
        `&ids=${encodeURIComponent(wikidata)}&props=claims&format=json&origin=*`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (resp.ok) {
        const data     = await resp.json();
        const filename = data?.entities?.[wikidata]?.claims?.P18?.[0]
          ?.mainsnak?.datavalue?.value;
        if (filename)
          return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=600`;
      }
    } catch (e) { /* no image available */ }
  }

  return null;
}

// --- Hash state management ---
function applyHashState(map) {
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);

  const categories = params.get('categories');
  if (categories) {
    const active = new Set(categories.split(','));
    document.querySelectorAll('input[data-category]').forEach((cb) => {
      const catId = cb.dataset.category;
      const shouldBeActive = active.has(catId);
      if (cb.checked !== shouldBeActive) {
        cb.checked = shouldBeActive;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  const region = params.get('region');
  if (region) {
    const regionSelect = document.getElementById('region-select');
    regionSelect.value = region;
    regionSelect.dispatchEvent(new Event('change'));
  }

  const lat  = params.get('lat');
  const lng  = params.get('lng');
  const zoom = params.get('zoom');
  if (lat && lng && zoom) {
    map.setView([parseFloat(lat), parseFloat(lng)], parseInt(zoom));
  }
}

// --- Point-in-polygon (ray casting) for Romania border filtering ---
function isPointInRomania(lng, lat, geoJson) {
  const geometry = geoJson.features[0].geometry;
  const coords = geometry.type === 'MultiPolygon'
    ? geometry.coordinates
    : [geometry.coordinates];

  for (const polygon of coords) {
    if (isPointInPolygon(lng, lat, polygon[0])) return true;
  }
  return false;
}

function isPointInPolygon(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function updateHash() {
  clearTimeout(updateHash._timer);
  updateHash._timer = setTimeout(() => {
    const center = map.getCenter();
    const zoom   = map.getZoom();
    const active = [];
    document.querySelectorAll('input[data-category]:checked').forEach((cb) => {
      active.push(cb.dataset.category);
    });

    const region = document.getElementById('region-select').value;
    const params = new URLSearchParams();
    params.set('lat',  center.lat.toFixed(4));
    params.set('lng',  center.lng.toFixed(4));
    params.set('zoom', zoom);
    if (active.length < Object.keys(CATEGORIES).length) {
      params.set('categories', active.join(','));
    }
    if (region) params.set('region', region);

    history.replaceState(null, '', '#' + params.toString());
  }, 300);
}
