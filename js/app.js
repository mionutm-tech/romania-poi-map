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

  // --- Tile layers ---
  // Day layer 1 (base): CartoDB Voyager — crisp streets + cities at every zoom level
  const dayBase = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  );

  // Desaturate + darken the base for a dramatic, moody terrain aesthetic
  dayBase.on('add', () => {
    const el = dayBase.getContainer();
    if (el) el.style.filter = 'brightness(0.84) saturate(0.68)';
  });

  // Day layer 2 (overlay): ESRI Shaded Relief — greyscale hillshade blended with multiply
  // Higher opacity + contrast filter = deep mountain shadows, visible relief at all zoom levels
  const dayRelief = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles &copy; Esri',
      maxNativeZoom: 13,
      maxZoom: 19,
      opacity: 0.68,
    }
  );

  dayRelief.on('add', () => {
    const container = dayRelief.getContainer();
    if (container) {
      container.style.mixBlendMode = 'multiply';
      // Boost contrast for deeper valley shadows, slight sepia for earthy warmth
      container.style.filter = 'contrast(1.4) brightness(0.7) sepia(0.2)';
    }
  });

  dayBase.addTo(map);
  dayRelief.addTo(map);

  // --- Romania border + night mask ---
  try {
    const borderResp = await fetch(
      'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/ROU.geo.json'
    );
    if (borderResp.ok) {
      const romaniaGeo = await borderResp.json();

      // Border: glow pass + crisp line
      L.geoJSON(romaniaGeo, {
        style: { color: '#FFFFFF', weight: 6, opacity: 0.18, fill: false },
        interactive: false,
      }).addTo(map);
      L.geoJSON(romaniaGeo, {
        style: { color: '#FF9238', weight: 2, opacity: 0.82, fill: false },
        interactive: false,
      }).addTo(map);

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

  statusEl.textContent = `Loaded ${features.length} points of interest`;
  setTimeout(() => statusEl.classList.add('fade-out'), 2000);
  setTimeout(() => statusEl.remove(), 2500);

  // --- Initialize modules ---
  initFilters(map, features);
  initSearch(map, features);

  // --- URL hash state ---
  applyHashState(map);
  window.addEventListener('hashchange', () => applyHashState(map));

  map.on('moveend', updateHash);
  document.querySelector('.filter-checkboxes').addEventListener('change', updateHash);

  console.log('Romania POI Map initialized.');
})();

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
