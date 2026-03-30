/**
 * Category filter panel — one MarkerClusterGroup per category for O(1) toggle.
 */

// Stores { categoryId: L.markerClusterGroup }
const categoryLayers = {};
let allFeatures = [];

function initFilters(map, features) {
  allFeatures = features;
  const panel = document.getElementById('filter-panel');
  const checkboxes = panel.querySelector('.filter-checkboxes');

  for (const [catId, catDef] of Object.entries(CATEGORIES)) {
    const count = features.filter((f) => f.properties.category === catId).length;

    // Create cluster group for this category
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 120,
      disableClusteringAtZoom: 14,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => createClusterIcon(cluster, catDef.color),
    });

    // Add markers for this category
    const catFeatures = features.filter((f) => f.properties.category === catId);
    for (const feature of catFeatures) {
      const [lng, lat] = feature.geometry.coordinates;
      const marker = L.marker([lat, lng], { icon: createCategoryIcon(catId) });
      marker.bindPopup(() => createPopupContent(feature.properties, lat, lng), { maxWidth: 300 });
      marker.feature = feature; // store reference for search
      group.addLayer(marker);
    }

    categoryLayers[catId] = group;
    map.addLayer(group);

    // Create checkbox UI
    const label = document.createElement('label');
    label.className = 'filter-item';
    label.style.setProperty('--swatch-color', catDef.color);
    label.innerHTML = `
      <input type="checkbox" data-category="${catId}" checked>
      <span class="filter-swatch" style="background-color: ${catDef.color}"></span>
      <span class="filter-label">${catDef.label}</span>
      <span class="filter-count">${count}</span>
    `;
    checkboxes.appendChild(label);
  }

  // Event delegation for checkbox changes
  checkboxes.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const catId = e.target.dataset.category;
      if (e.target.checked) {
        map.addLayer(categoryLayers[catId]);
      } else {
        map.removeLayer(categoryLayers[catId]);
      }
    }
  });

  // Toggle all button
  document.getElementById('toggle-all').addEventListener('click', () => {
    const boxes = checkboxes.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(boxes).every((b) => b.checked);
    boxes.forEach((b) => {
      b.checked = !allChecked;
      const catId = b.dataset.category;
      if (b.checked) {
        map.addLayer(categoryLayers[catId]);
      } else {
        map.removeLayer(categoryLayers[catId]);
      }
    });
    document.getElementById('toggle-all').textContent = allChecked ? 'Select All' : 'Deselect All';
  });

  // Panel collapse toggle
  document.getElementById('filter-toggle').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });
}

function getVisibleMarkers() {
  const markers = [];
  for (const [catId, group] of Object.entries(categoryLayers)) {
    const checkbox = document.querySelector(`input[data-category="${catId}"]`);
    if (checkbox && checkbox.checked) {
      group.eachLayer((marker) => markers.push(marker));
    }
  }
  return markers;
}
