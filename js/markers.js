/**
 * Marker creation, custom teardrop icons, and glassmorphism popup content.
 */

function createCategoryIcon(category) {
  const cat = CATEGORIES[category] || CATEGORIES.attractions;
  const color = cat.color;

  // Teardrop SVG: circle top + pointed bottom
  const tearSvg = `
    <svg class="marker-teardrop" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
      <!-- Teardrop body -->
      <path d="M15 1.5 C7.268 1.5 1 7.768 1 15.5 C1 26.5 15 40.5 15 40.5 C15 40.5 29 26.5 29 15.5 C29 7.768 22.732 1.5 15 1.5 Z"
            fill="${color}"
            stroke="rgba(255,255,255,0.42)"
            stroke-width="1.2"/>
      <!-- Top shine -->
      <ellipse cx="12" cy="10" rx="6" ry="5"
               fill="rgba(255,255,255,0.22)"
               transform="rotate(-20, 12, 10)"/>
    </svg>
  `;

  return L.divIcon({
    className: 'poi-marker',
    html: `
      <div class="marker-wrap">
        ${tearSvg}
        <img src="${cat.icon}" alt="${category}" class="marker-icon-img"/>
      </div>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 41],
    popupAnchor: [0, -44],
  });
}

function createPopupContent(props, lat, lng) {
  const cat = CATEGORIES[props.category] || CATEGORIES.attractions;

  // Name display
  const nameLine = props.name_en
    ? `${props.name}<span class="popup-name-en">${props.name_en}</span>`
    : props.name;

  // External links (secondary row)
  const linkParts = [];
  if (props.wikipedia) {
    const [lang, article] = props.wikipedia.split(':');
    const wikiUrl = `https://${lang || 'en'}.wikipedia.org/wiki/${encodeURIComponent(article || props.wikipedia)}`;
    linkParts.push(`<a href="${wikiUrl}" target="_blank" rel="noopener">Wikipedia</a>`);
  }
  if (props.wikidata) {
    linkParts.push(`<a href="https://www.wikidata.org/wiki/${props.wikidata}" target="_blank" rel="noopener">Wikidata</a>`);
  }
  if (props.website) {
    linkParts.push(`<a href="${props.website}" target="_blank" rel="noopener">Website</a>`);
  }
  const osmType = props.id.split('/')[0];
  const osmId   = props.id.split('/')[1];
  linkParts.push(`<a href="https://www.openstreetmap.org/${osmType}/${osmId}" target="_blank" rel="noopener">OSM</a>`);

  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const wazeUrl  = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  // Navigation arrow icon (Google Maps)
  const navArrow = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <polygon points="3,11 22,2 13,21 11,13" fill="currentColor"/>
  </svg>`;

  // Waze smiley icon
  const wazeIcon = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="9" cy="10.5" r="1.4" fill="currentColor"/>
    <circle cx="15" cy="10.5" r="1.4" fill="currentColor"/>
    <path d="M8.5 14.5 Q12 17.5 15.5 14.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;

  return `
    <div class="poi-popup">
      <div class="popup-category-pill">${cat.label}</div>
      <h2 class="popup-name">${nameLine}</h2>
      ${props.region ? `<div class="popup-region">${props.region}</div>` : ''}
      <hr class="popup-divider">
      <div class="popup-nav">
        <a class="nav-btn nav-gmaps" href="${gmapsUrl}" target="_blank" rel="noopener">
          ${navArrow} Google Maps
        </a>
        <a class="nav-btn nav-waze" href="${wazeUrl}" target="_blank" rel="noopener">
          ${wazeIcon} Waze
        </a>
      </div>
      ${linkParts.length ? `<div class="popup-links">${linkParts.join('')}</div>` : ''}
    </div>
  `;
}

function createClusterIcon(cluster, color) {
  const count = cluster.getChildCount();
  let size = 'small';
  if (count >= 100) size = 'large';
  else if (count >= 10) size = 'medium';

  return L.divIcon({
    html: `<div class="cluster-icon cluster-${size}" style="background-color: ${color}"><span>${count}</span></div>`,
    className: 'poi-cluster',
    iconSize: size === 'large' ? [52, 52] : size === 'medium' ? [42, 42] : [34, 34],
  });
}
