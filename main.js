import L from 'leaflet';
import { createIcons, Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw } from 'lucide';

/**
 * TNEB Jurisdiction Finder v2.0
 * State-Driven Architecture for Performance & Maintainability
 */

const AppState = {
    map: null,
    marker: null,
    worker: null,
    boundaryLayer: null,
    officeMarker: null,
    currentLocation: null,
    isSearching: false,
    searchTimeout: null,
    address: null
};

// --- Initialization ---

function init() {
    initIcons();
    initMap();
    initWorker();
    initEventListeners();
}

function initIcons() {
    createIcons({
        icons: { Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw }
    });
}

function initMap() {
    const tnBounds = L.latLngBounds(L.latLng(8.0, 75.0), L.latLng(14.0, 81.0));

    AppState.map = L.map('map', {
        preferCanvas: true,
        zoomControl: false,
        maxBounds: tnBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 7
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OS contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(AppState.map);

    L.control.zoom({ position: 'bottomright' }).addTo(AppState.map);

    AppState.map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        processLocation(lat, lng);
    });
}

function initWorker() {
    AppState.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    AppState.worker.onmessage = (e) => {
        const { type, data, message } = e.data;
        if (type === 'READY') {
            document.getElementById('loading-overlay').classList.add('fade-out');
            setTimeout(() => document.getElementById('loading-overlay').remove(), 500);
        } else if (type === 'RESULT') {
            UIRenderer.renderResults(data);
        } else if (type === 'SEARCH_RESULTS') {
            UIRenderer.renderSuggestions(data);
        } else if (type === 'ERROR') {
            UIRenderer.renderError("System Error", message);
        }
    };

    AppState.worker.postMessage({ type: 'INIT' });
}

function initEventListeners() {
    document.getElementById('main-gps-btn').onclick = triggerGPS;
    document.getElementById('fab-gps').onclick = triggerGPS;
    
    document.getElementById('explore-btn').onclick = () => {
        document.getElementById('start-panel').classList.add('hidden');
        document.getElementById('fab-gps').classList.remove('hidden');
    };

    // Consumer Search
    const consumerInput = document.getElementById('consumer-number');
    const searchBtn = document.getElementById('consumer-search-btn');
    
    searchBtn.onclick = () => {
        const num = consumerInput.value.trim();
        if (num) processConsumerSearch(num);
    };

    consumerInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            const num = consumerInput.value.trim();
            if (num) processConsumerSearch(num);
        }
    };
}

// --- Location Logic ---

async function processConsumerSearch(number) {
    // Transition UI
    document.getElementById('start-panel').classList.add('hidden');
    document.getElementById('fab-gps').classList.remove('hidden');
    document.getElementById('results-panel').classList.remove('hidden');

    // Pass last known location for tie-breaking if available
    const lastLocation = AppState.currentLocation;
    AppState.worker.postMessage({ type: 'PROCESS_CONSUMER', number, lastLocation });
}


async function processLocation(lat, lng) {
    const isInsideTN = lat >= 8.0 && lat <= 14.0 && lng >= 75.0 && lng <= 81.0;

    // Transition UI
    document.getElementById('start-panel').classList.add('hidden');
    document.getElementById('fab-gps').classList.remove('hidden');
    document.getElementById('results-panel').classList.remove('hidden');

    if (!isInsideTN) {
        UIRenderer.clearOverlays();
        UIRenderer.renderError("📍 Outside Supported Area", "We currently only support TNEB jurisdictions within Tamil Nadu.");
        return;
    }

    // Capture location
    AppState.currentLocation = { lat, lng };
    updateMarker(lat, lng);

    // Get Address (Reverse Geocoding) - Non-blocking
    fetchAddress(lat, lng);

    // Call worker
    AppState.worker.postMessage({ type: 'PROCESS', lat, lng });
}

async function fetchAddress(lat, lng) {
    // Local Geocoding - We'll use the worker result for this
    // We already get the Section/Subdivision info from the PROCESS result
    // This function will now just act as a placeholder or clear the custom address
    AppState.address = null; 
}

function updateMarker(lat, lng) {
    if (!AppState.marker) {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="pulse-ring"></div>',
            iconSize: [20, 20]
        });
        AppState.marker = L.marker([lat, lng], { draggable: true, icon }).addTo(AppState.map);
        AppState.marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            processLocation(pos.lat, pos.lng);
        });
    } else {
        AppState.marker.setLatLng([lat, lng]);
    }
}

function triggerGPS() {
    const mainBtn = document.getElementById('main-gps-btn');
    const fabBtn = document.getElementById('fab-gps');
    
    const setLoader = (loading) => {
        [mainBtn, fabBtn].forEach(btn => {
            if (!btn) return;
            if (loading) {
                btn.classList.add('loading-gps');
                const span = btn.querySelector('span');
                if (span) { btn._oldText = span.innerText; span.innerText = 'Detecting...'; }
            } else {
                btn.classList.remove('loading-gps');
                const span = btn.querySelector('span');
                if (span && btn._oldText) { span.innerText = btn._oldText; }
            }
        });
    };

    if (navigator.geolocation) {
        setLoader(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            setLoader(false);
            const { latitude, longitude } = pos.coords;
            AppState.map.flyTo([latitude, longitude], 14);
            processLocation(latitude, longitude);
        }, (err) => {
            setLoader(false);
            displayGPSError(err);
        }, { enableHighAccuracy: true, timeout: 10000 });
    }
}

function displayGPSError(err) {
    let msg = "Could not detect location.";
    if (err.code === 1) msg = "Location access denied. Please enable GPS.";
    else if (err.code === 2) msg = "Location unavailable.";
    UIRenderer.renderError("📍 GPS Error", msg);
}

// --- Search Logic ---

function handleSearchInput(query) {
    if (AppState.searchTimeout) clearTimeout(AppState.searchTimeout);
    if (!query || query.length < 3) {
        UIRenderer.toggleSuggestions(false);
        return;
    }

    AppState.searchTimeout = setTimeout(() => {
        AppState.worker.postMessage({ type: 'SEARCH', query });
    }, 200);
}

// --- UI Rendering ---

const UIRenderer = {
    clearOverlays() {
        if (AppState.boundaryLayer) AppState.map.removeLayer(AppState.boundaryLayer);
        if (AppState.officeMarker) AppState.map.removeLayer(AppState.officeMarker);
        AppState.boundaryLayer = null;
        AppState.officeMarker = null;
    },

    toggleSuggestions(show) {
        const el = document.getElementById('search-suggestions');
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    },

    renderSuggestions(results) {
        const container = document.getElementById('search-suggestions');
        if (!results || results.length === 0) {
            this.toggleSuggestions(false);
            return;
        }

        container.innerHTML = results.map(r => `
            <div class="suggestion-item" data-lat="${r.center[0]}" data-lng="${r.center[1]}">
                <span class="name">${r.name}</span>
                <span class="address">${r.details}</span>
            </div>
        `).join('');

        // Bind clicks
        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.onclick = () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                AppState.map.flyTo([lat, lng], 14);
                processLocation(lat, lng);
                this.toggleSuggestions(false);
                document.getElementById('locality-search').value = item.querySelector('.name').innerText;
            };
        });

        this.toggleSuggestions(true);
    },

    renderResults(data) {
        const panel = document.getElementById('results-panel');
        this.clearOverlays();
        
        const { matched_boundary, matched_office, match_type, coords, source, consumer_number, match_confidence, ambiguous } = data;

        // Update Address context
        if (matched_boundary) {
            AppState.address = `${matched_boundary.section}, ${matched_boundary.subdivision}`;
        } else {
            AppState.address = source === 'CONSUMER_NUMBER' ? "Administrative Match" : "Unknown Location";
        }

        // 1. Render Polygons/Markers
        if (matched_boundary?.geometry) {
            AppState.boundaryLayer = L.polygon(matched_boundary.geometry.map(p => [p[1], p[0]]), {
                color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '5, 10'
            }).addTo(AppState.map);
            
            // Smart Centering: Fit to Boundary
            AppState.map.fitBounds(AppState.boundaryLayer.getBounds(), { padding: [50, 50], maxZoom: 15 });
        } else if (matched_office?.coords) {
            // Fallback: Center on Office point
            AppState.map.setView(matched_office.coords, 15);
        }

        if (matched_office?.coords) {
            const zapIcon = L.divIcon({
                className: 'office-marker',
                html: '<div class="zap-icon-bg"><i data-lucide="zap"></i></div>',
                iconSize: [32, 32], iconAnchor: [16, 32]
            });
            AppState.officeMarker = L.marker(matched_office.coords, { icon: zapIcon }).addTo(AppState.map);
            AppState.officeMarker.bindPopup(`<b>${matched_office.name}</b><br>Section Office`);
        }

        // 2. Build HTML
        const isConsumer = source === 'CONSUMER_NUMBER';
        let html = `
            <div class="selection-header">
                <i data-lucide="${isConsumer ? 'zap' : 'map-pin'}" class="icon-primary"></i>
                <div class="selection-info">
                    <span class="selection-label">${isConsumer ? 'CONSUMER NUMBER' : 'SELECTED LOCATION'}</span>
                    <span class="selection-address">${isConsumer ? consumer_number : AppState.address}</span>
                    <span class="selection-coords">${isConsumer ? `Region: ${data.parsed.region_code} | Section: ${data.parsed.section_code}` : coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4)}</span>
                </div>
            </div>
        `;

        if (matched_boundary) {
            html += `
                <div class="glass-panel jurisdiction-card card">
                    <div class="card-header">
                        <i data-lucide="info" class="icon-primary"></i>
                        <h3>Primary Jurisdiction</h3>
                    </div>
                    <div class="hierarchy-grid">
                        ${this.renderHItem("SECTION", matched_boundary.section)}
                        ${this.renderHItem("SUBDIVISION", matched_boundary.subdivision)}
                        ${this.renderHItem("DIVISION", matched_boundary.division)}
                        ${this.renderHItem("CIRCLE", matched_boundary.circle)}
                        ${this.renderHItem("REGION", matched_boundary.region)}
                        ${this.renderHItem("TYPE", matched_boundary.type)}
                    </div>
                </div>
            `;
        }

        if (matched_office) {
            let label = 'Unknown';
            let labelClass = '';

            if (match_type === 'official') {
                label = 'Matched';
                labelClass = 'status-official';
            } else {
                label = 'No Official Match';
                labelClass = 'status-unmatched';
            }

            if (ambiguous) {
                label += ' (AMBIGUOUS)';
            }



            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${matched_office.coords[0]},${matched_office.coords[1]}`;

            html += `
                <div class="glass-panel office-card card">
                    <div class="card-header">
                        <i data-lucide="navigation" class="icon-primary"></i>
                        <h3>Section Office</h3>
                        <span class="badge ${labelClass}">${label}</span>
                    </div>
                    <div class="office-info">
                        <div class="office-name">${matched_office.name}</div>
                        <div class="office-detail">
                            <i data-lucide="info" class="icon-muted"></i> 
                            ${match_confidence ? 'Confidence: ' + match_confidence.toUpperCase() : '~' + matched_office.distance + ' km'}
                        </div>
                        <a href="${navUrl}" target="_blank" class="nav-btn">
                            <i data-lucide="navigation"></i> Directions
                        </a>
                    </div>
                </div>
            `;
        }

        panel.innerHTML = html;
        initIcons();
    },



    renderHItem(label, value) {
        return `<div class="h-item"><span class="h-label">${label}</span><span class="h-value">${value}</span></div>`;
    },

    renderError(title, msg) {
        const panel = document.getElementById('results-panel');
        panel.innerHTML = `
            <div class="glass-panel error-card card">
                <div class="card-header">
                    <i data-lucide="alert-triangle" style="color: var(--danger)"></i>
                    <h3 style="color: var(--danger)">${title}</h3>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5;">${msg}</p>
                <button onclick="location.reload()" class="secondary-btn" style="width: 100%; margin-top: 20px;">
                    <i data-lucide="refresh-cw"></i> Refresh App
                </button>
            </div>
        `;
        initIcons();
    }
};

window.addEventListener('DOMContentLoaded', init);
