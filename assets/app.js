
/* ═══════════════════════════════════════════════════════════════════════
   Global Assistance Partners Network — Interactive Map
   ═══════════════════════════════════════════════════════════════════════ */

/* ─── Map initialisation ─────────────────────────────────────────────── */

const map = L.map('map', {
  zoomControl: true,
  minZoom: 2,
  maxZoom: 18
}).setView([20, 10], 2);

// ESRI World Imagery (satellite)
L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA' }
).addTo(map);

// ESRI English labels overlay
L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Labels &copy; Esri', pane: 'overlayPane' }
).addTo(map);

/* ─── State ──────────────────────────────────────────────────────────── */

let activeCategoryId = 'tpa';   // currently shown category
let activeFilter     = 'all';   // 'all' | 'signed' | 'pending'
let searchQuery      = '';
let activeMarker     = null;
let markersByIndex   = [];
const markerGroup    = L.layerGroup().addTo(map);

/* ─── Marker icons ───────────────────────────────────────────────────── */

const COLOR_SIGNED  = '#2ecc71';
const COLOR_PENDING = '#f39c12';

function makeIcon(signed, small = false) {
  const color = signed ? COLOR_SIGNED : COLOR_PENDING;
  const w = small ? 22 : 26, h = small ? 29 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 26 34">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z"
          fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <circle cx="13" cy="13" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [w, h], iconAnchor: [w/2, h], popupAnchor: [0, -(h+2)] });
}

function makeIconHighlighted(signed) {
  const color = signed ? COLOR_SIGNED : COLOR_PENDING;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 0C7.61 0 0 7.61 0 17c0 12.74 17 27 17 27S34 29.74 34 17C34 7.61 26.39 0 17 0z"
          fill="${color}" stroke="white" stroke-width="2.5"/>
    <circle cx="17" cy="17" r="7" fill="white" opacity="0.95"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [34, 44], iconAnchor: [17, 44], popupAnchor: [0, -46] });
}

/* ─── Popup builder ──────────────────────────────────────────────────── */

function buildPopup(p, catFullLabel) {
  const statusLabel = p.signed
    ? `<span class="popup-badge signed">Agreement signed</span>`
    : `<span class="popup-badge pending">Agreement pending</span>`;

  const locationParts = [p.hqCity, p.hqCountry || p.country].filter(Boolean);
  const locationLine  = locationParts.join(', ');

  const emailHtml = p.email
    ? `<div class="popup-contact-row">
         <span class="popup-contact-icon">✉</span>
         <a href="mailto:${p.email}" class="popup-contact-link">${p.email}</a>
       </div>` : '';

  const phoneHtml = p.phone
    ? `<div class="popup-contact-row">
         <span class="popup-contact-icon">✆</span>
         <a href="tel:${p.phone.replace(/\s/g,'')}" class="popup-contact-link">${p.phone}</a>
       </div>` : '';

  const webHtml = p.homepage
    ? `<div class="popup-contact-row">
         <span class="popup-contact-icon">⊕</span>
         <a href="${p.homepage}" target="_blank" rel="noopener" class="popup-contact-link">${p.homepage.replace(/^https?:\/\//,'')}</a>
       </div>` : '';

  const contactBlock = (emailHtml || phoneHtml || webHtml)
    ? `<div class="popup-divider"></div><div class="popup-contacts">${emailHtml}${phoneHtml}${webHtml}</div>` : '';

  return `
    <div class="popup-card">
      <div class="popup-category">${catFullLabel}</div>
      <div class="popup-name">${p.name}</div>
      ${locationLine ? `<div class="popup-location">${locationLine}</div>` : ''}
      ${p.country && p.country !== locationLine ? `<div class="popup-continent">${p.country}</div>` : ''}
      ${statusLabel}
      ${contactBlock}
    </div>`;
}

/* ─── Build all markers (once per category load) ─────────────────────── */

function buildMarkers(providers, catFullLabel) {
  markerGroup.clearLayers();
  markersByIndex = [];
  if (activeMarker) { activeMarker = null; }

  providers.forEach((p, i) => {
    if (!p.lat && !p.lon) return;
    const isSmall = providers.length > 150; // use smaller icons for dense datasets
    const marker = L.marker([p.lat, p.lon], { icon: makeIcon(p.signed, isSmall) });
    marker.bindPopup(buildPopup(p, catFullLabel), { maxWidth: 310, className: 'custom-popup' });
    marker.on('click', () => {
      highlightListItem(i);
      setActiveMarker(marker, p.signed, i);
    });
    marker._providerIndex = i;
    markersByIndex[i] = marker;
  });
}

function setActiveMarker(marker, signed, index) {
  if (activeMarker && activeMarker._providerIndex !== undefined) {
    const prev = currentProviders()[activeMarker._providerIndex];
    if (prev && markersByIndex[activeMarker._providerIndex]) {
      markersByIndex[activeMarker._providerIndex].setIcon(makeIcon(prev.signed, currentProviders().length > 150));
    }
  }
  marker.setIcon(makeIconHighlighted(signed));
  marker._providerIndex = index;
  activeMarker = marker;
}

/* ─── Category helpers ───────────────────────────────────────────────── */

function currentCategory() { return CATEGORIES[activeCategoryId]; }
function currentProviders() { return currentCategory().providers; }

/* ─── Sidebar DOM refs ───────────────────────────────────────────────── */

const categoryTabsEl   = document.getElementById('categoryTabs');
const searchInputEl    = document.getElementById('searchInput');
const providerListEl   = document.getElementById('providerList');
const filterAllBtn     = document.getElementById('filterAll');
const filterSignedBtn  = document.getElementById('filterSigned');
const filterPendingBtn = document.getElementById('filterPending');
const countSignedEl    = document.getElementById('countSigned');
const countPendingEl   = document.getElementById('countPending');
const mapStatusEl      = document.getElementById('mapStatus');
const mapSubtextEl     = document.getElementById('mapSubtext');
const catLabelEl       = document.getElementById('catFullLabel');

/* ─── Category tabs (dynamic) ────────────────────────────────────────── */

Object.values(CATEGORIES).forEach(cat => {
  const btn = document.createElement('button');
  btn.className = 'btn-cat' + (cat.id === activeCategoryId ? ' active' : '');
  btn.dataset.cat = cat.id;
  btn.textContent = cat.label;
  btn.addEventListener('click', () => switchCategory(cat.id));
  categoryTabsEl.appendChild(btn);
});

function switchCategory(id) {
  activeCategoryId = id;
  activeFilter = 'all';
  searchQuery  = '';
  searchInputEl.value = '';
  activeMarker = null;

  // Update tab buttons
  document.querySelectorAll('.btn-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === id));
  // Reset filter buttons
  [filterAllBtn, filterSignedBtn, filterPendingBtn].forEach(b => b.classList.remove('active'));
  filterAllBtn.classList.add('active');

  const cat = CATEGORIES[id];
  catLabelEl.textContent = cat.fullLabel;

  // Update stats
  const signed  = cat.providers.filter(p => p.signed).length;
  const pending  = cat.providers.filter(p => !p.signed).length;
  countSignedEl.textContent  = signed;
  countPendingEl.textContent = pending;

  // Rebuild markers
  buildMarkers(cat.providers, cat.fullLabel);
  renderList();
}

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
    (p.country  || '').toLowerCase().includes(q) ||
    (p.hqCity   || '').toLowerCase().includes(q) ||
    (p.hqCountry|| '').toLowerCase().includes(q)
  );
}

function renderList() {
  providerListEl.innerHTML = '';
  markerGroup.clearLayers();

  const providers = currentProviders();
  const cat = currentCategory();

  const visible = providers.filter((p, i) => {
    const show = matchesFilter(p) && matchesSearch(p);
    if (show && markersByIndex[i]) markerGroup.addLayer(markersByIndex[i]);
    return show;
  });

  const label = activeFilter === 'all'     ? `Showing all ${cat.label} providers`
               : activeFilter === 'signed' ? `Showing signed ${cat.label} partners`
               :                             `Showing pending ${cat.label} partners`;
  mapStatusEl.textContent  = label;
  mapSubtextEl.textContent = `${visible.length} provider${visible.length !== 1 ? 's' : ''} shown`;

  visible.forEach(p => {
    const origIndex = providers.indexOf(p);
    const li = document.createElement('li');
    li.className = 'provider-item';
    li.dataset.index = origIndex;

    const dot = document.createElement('span');
    dot.className = `status-dot ${p.signed ? 'signed' : 'pending'}`;

    const locParts = [p.hqCity, p.hqCountry || p.country].filter(Boolean);

    const info = document.createElement('div');
    info.className = 'provider-info';
    info.innerHTML = `<span class="provider-name">${p.name}</span>
                      <span class="provider-loc">${locParts.join(', ')}</span>`;

    li.appendChild(dot);
    li.appendChild(info);

    li.addEventListener('click', () => {
      const marker = markersByIndex[origIndex];
      if (marker) {
        map.setView([p.lat, p.lon], 12, { animate: true });
        marker.openPopup();
        setActiveMarker(marker, p.signed, origIndex);
      }
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

/* ─── Boot ───────────────────────────────────────────────────────────── */

switchCategory(activeCategoryId);
