
/* ─── Map initialisation ─────────────────────────────────────────────── */

const map = L.map('map', {
  zoomControl: true,
  minZoom: 2,
  maxZoom: 18
}).setView([20, 10], 2);

// ESRI World Imagery (satellite) as base layer
const satellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA'
  }
).addTo(map);

// ESRI World Boundaries and Places overlay — English labels on top of satellite
const labels = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Labels &copy; Esri',
    pane: 'overlayPane'
  }
).addTo(map);

/* ─── State ──────────────────────────────────────────────────────────── */

let activeFilter = 'all'; // 'all' | 'signed' | 'pending'
let searchQuery  = '';
let activeMarker = null;

/* ─── Marker helpers ─────────────────────────────────────────────────── */

const COLOR_SIGNED  = '#2ecc71'; // green
const COLOR_PENDING = '#f39c12'; // orange

function makeIcon(signed) {
  const color = signed ? COLOR_SIGNED : COLOR_PENDING;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z"
          fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <circle cx="13" cy="13" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [26, 34],
    iconAnchor: [13, 34],
    popupAnchor:[0, -36]
  });
}

function makeIconHighlighted(signed) {
  const color = signed ? COLOR_SIGNED : COLOR_PENDING;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 0C7.61 0 0 7.61 0 17c0 12.74 17 27 17 27S34 29.74 34 17C34 7.61 26.39 0 17 0z"
          fill="${color}" stroke="white" stroke-width="2.5"/>
    <circle cx="17" cy="17" r="7" fill="white" opacity="0.95"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [34, 44],
    iconAnchor: [17, 44],
    popupAnchor:[0, -46]
  });
}

/* ─── Build markers ──────────────────────────────────────────────────── */

const markerGroup = L.layerGroup().addTo(map);
const markersByIndex = [];

PROVIDERS.forEach((p, i) => {
  if (p.lat === 0 && p.lon === 0) return;

  const marker = L.marker([p.lat, p.lon], { icon: makeIcon(p.signed) });

  const homepageHtml = p.homepage
    ? `<a href="${p.homepage.startsWith('http') ? p.homepage : 'https://' + p.homepage}" target="_blank" rel="noopener" class="popup-link">Visit website</a>`
    : '';

  const statusLabel = p.signed
    ? `<span class="popup-badge signed">Agreement signed</span>`
    : `<span class="popup-badge pending">Agreement pending</span>`;

  marker.bindPopup(`
    <div class="popup-card">
      <div class="popup-name">${p.name}</div>
      <div class="popup-meta">${p.hqCity ? p.hqCity + ', ' : ''}${p.hqCountry}</div>
      <div class="popup-meta dim">${p.continent}</div>
      ${statusLabel}
      ${homepageHtml}
    </div>
  `, { maxWidth: 280, className: 'custom-popup' });

  marker.on('click', () => {
    highlightListItem(i);
    setActiveMarker(marker, p.signed, i);
  });

  marker.providerIndex = i;
  markerGroup.addLayer(marker);
  markersByIndex[i] = marker;
});

function setActiveMarker(marker, signed, index) {
  // Reset previous
  if (activeMarker && activeMarker._providerIndex !== undefined) {
    const prevP = PROVIDERS[activeMarker._providerIndex];
    if (prevP) markersByIndex[activeMarker._providerIndex]?.setIcon(makeIcon(prevP.signed));
  }
  marker.setIcon(makeIconHighlighted(signed));
  marker._providerIndex = index;
  activeMarker = marker;
}

/* ─── Sidebar elements ───────────────────────────────────────────────── */

const searchInputEl   = document.getElementById('searchInput');
const providerListEl  = document.getElementById('providerList');
const filterAllBtn    = document.getElementById('filterAll');
const filterSignedBtn = document.getElementById('filterSigned');
const filterPendingBtn= document.getElementById('filterPending');
const countSignedEl   = document.getElementById('countSigned');
const countPendingEl  = document.getElementById('countTotal');
const mapStatusEl     = document.getElementById('mapStatus');
const mapSubtextEl    = document.getElementById('mapSubtext');

/* ─── Summary counts ─────────────────────────────────────────────────── */

const totalSigned  = PROVIDERS.filter(p => p.signed).length;
const totalPending = PROVIDERS.filter(p => !p.signed).length;
countSignedEl.textContent  = totalSigned;
countPendingEl.textContent = totalPending;

/* ─── Filtering & rendering ──────────────────────────────────────────── */

function matchesFilter(p) {
  if (activeFilter === 'signed')  return p.signed;
  if (activeFilter === 'pending') return !p.signed;
  return true;
}

function matchesSearch(p) {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  return (
    p.name.toLowerCase().includes(q) ||
    p.country.toLowerCase().includes(q) ||
    p.hqCity.toLowerCase().includes(q) ||
    p.hqCountry.toLowerCase().includes(q) ||
    p.continent.toLowerCase().includes(q)
  );
}

function renderList() {
  providerListEl.innerHTML = '';
  markerGroup.clearLayers();

  const visible = PROVIDERS.filter((p, i) => {
    const show = matchesFilter(p) && matchesSearch(p);
    if (show && p.lat !== 0) {
      const m = markersByIndex[i];
      if (m) markerGroup.addLayer(m);
    }
    return show;
  });

  // Update map status bar
  const label = activeFilter === 'all'     ? 'Showing all providers'
               : activeFilter === 'signed' ? 'Showing signed partners'
               :                             'Showing pending partners';
  mapStatusEl.textContent  = label;
  mapSubtextEl.textContent = `${visible.length} provider${visible.length !== 1 ? 's' : ''} shown`;

  visible.forEach((p, idx) => {
    const origIndex = PROVIDERS.indexOf(p);
    const li = document.createElement('li');
    li.className = 'provider-item';
    li.dataset.index = origIndex;

    const dot = document.createElement('span');
    dot.className = `status-dot ${p.signed ? 'signed' : 'pending'}`;

    const info = document.createElement('div');
    info.className = 'provider-info';
    info.innerHTML = `<span class="provider-name">${p.name}</span>
                      <span class="provider-loc">${p.hqCity ? p.hqCity + ', ' : ''}${p.hqCountry || p.country}</span>`;

    li.appendChild(dot);
    li.appendChild(info);

    li.addEventListener('click', () => {
      const marker = markersByIndex[origIndex];
      if (marker) {
        map.setView([p.lat, p.lon], 12, { animate: true });
        marker.openPopup();
        setActiveMarker(marker, p.signed, origIndex);
      }
      // Highlight in list
      document.querySelectorAll('.provider-item').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
    });

    providerListEl.appendChild(li);
  });
}

function highlightListItem(index) {
  document.querySelectorAll('.provider-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.index) === index);
  });
  const active = providerListEl.querySelector('.provider-item.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ─── Filter buttons ─────────────────────────────────────────────────── */

[filterAllBtn, filterSignedBtn, filterPendingBtn].forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    [filterAllBtn, filterSignedBtn, filterPendingBtn].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderList();
  });
});

/* ─── Search ─────────────────────────────────────────────────────────── */

searchInputEl.addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  renderList();
});

/* ─── Initial render ─────────────────────────────────────────────────── */

renderList();
