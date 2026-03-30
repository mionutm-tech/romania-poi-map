/**
 * Search functionality: text search + county dropdown filter.
 * County filtering uses geographic bounding boxes (counties.js)
 * rather than OSM tags, so all POIs are covered regardless of tagging.
 */

let searchIndex = [];

function initSearch(map, features) {
  searchIndex = features;

  // --- Text search ---
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const searchClear = document.getElementById('search-clear');

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length < 2) {
        searchResults.classList.remove('visible');
        searchResults.innerHTML = '';
        return;
      }
      performSearch(query, map, searchResults);
    }, 250);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchResults.classList.remove('visible');
    searchResults.innerHTML = '';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchResults.classList.remove('visible');
    }
  });

  // --- County dropdown: populated from hardcoded list ---
  const regionSelect = document.getElementById('region-select');
  for (const county of ROMANIA_COUNTIES) {
    const opt = document.createElement('option');
    opt.value = county.name;
    opt.textContent = county.name;
    regionSelect.appendChild(opt);
  }

  regionSelect.addEventListener('change', () => {
    filterByRegion(map, regionSelect.value);
  });
}

function performSearch(query, map, resultsEl) {
  const matches = searchIndex
    .filter(f => {
      const name = (f.properties.name || '').toLowerCase();
      const nameEn = (f.properties.name_en || '').toLowerCase();
      return name.includes(query) || nameEn.includes(query);
    })
    .slice(0, 20);

  if (matches.length === 0) {
    resultsEl.innerHTML = '<div class="search-no-results">No results found</div>';
    resultsEl.classList.add('visible');
    return;
  }

  resultsEl.innerHTML = '';
  for (const f of matches) {
    const cat = CATEGORIES[f.properties.category] || CATEGORIES.attractions;
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <span class="search-result-swatch" style="background-color: ${cat.color}"></span>
      <span class="search-result-name">${f.properties.name}</span>
      ${f.properties.region ? `<span class="search-result-region">${f.properties.region}</span>` : ''}
    `;
    item.addEventListener('click', () => {
      const [lng, lat] = f.geometry.coordinates;
      map.flyTo([lat, lng], 15, { duration: 1.2 });
      for (const group of Object.values(categoryLayers)) {
        group.eachLayer(marker => {
          if (marker.feature && marker.feature.properties.id === f.properties.id) {
            group.zoomToShowLayer(marker, () => marker.openPopup());
          }
        });
      }
      resultsEl.classList.remove('visible');
    });
    resultsEl.appendChild(item);
  }
  resultsEl.classList.add('visible');
}

function filterByRegion(map, region) {
  if (!region) {
    resetRegionFilter(map);
    map.flyTo([45.9432, 24.9668], 7, { duration: 0.8 });
    return;
  }

  const county = findCounty(region);
  if (!county) return;

  const matching = featuresInCounty(searchIndex, county);

  // Rebuild each category group with only POIs inside the county
  for (const [catId, group] of Object.entries(categoryLayers)) {
    const checkbox = document.querySelector(`input[data-category="${catId}"]`);
    if (!checkbox || !checkbox.checked) continue;

    group.clearLayers();
    for (const feature of matching.filter(f => f.properties.category === catId)) {
      const [lng, lat] = feature.geometry.coordinates;
      const marker = L.marker([lat, lng], { icon: createCategoryIcon(catId) });
      marker.bindPopup(() => createPopupContent(feature.properties, lat, lng), { maxWidth: 300 });
      marker.feature = feature;
      group.addLayer(marker);
    }
  }

  const [[latMin, lonMin], [latMax, lonMax]] = county.bounds;
  map.flyToBounds(L.latLngBounds([[latMin, lonMin], [latMax, lonMax]]).pad(0.05), { duration: 0.8 });

  updateFilterCounts(region);
}

function updateFilterCounts(region) {
  const county = region ? findCounty(region) : null;
  const inCounty = county ? featuresInCounty(searchIndex, county) : null;

  document.querySelectorAll('input[data-category]').forEach(cb => {
    const catId = cb.dataset.category;
    const pool = inCounty || searchIndex;
    const count = pool.filter(f => f.properties.category === catId).length;
    const countEl = cb.closest('.filter-item').querySelector('.filter-count');
    if (countEl) countEl.textContent = count;
  });
}

function resetRegionFilter(map) {
  for (const [catId, group] of Object.entries(categoryLayers)) {
    const checkbox = document.querySelector(`input[data-category="${catId}"]`);
    group.clearLayers();
    const catFeatures = searchIndex.filter(f => f.properties.category === catId);
    for (const feature of catFeatures) {
      const [lng, lat] = feature.geometry.coordinates;
      const marker = L.marker([lat, lng], { icon: createCategoryIcon(catId) });
      marker.bindPopup(() => createPopupContent(feature.properties, lat, lng), { maxWidth: 300 });
      marker.feature = feature;
      group.addLayer(marker);
    }
    if (checkbox && checkbox.checked && !map.hasLayer(group)) {
      map.addLayer(group);
    }
  }
  updateFilterCounts(null);
}
