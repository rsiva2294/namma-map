import L from 'leaflet';
import { createIcons, Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide';

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
    expandTimeout: null,
    address: null,
    districts: [],
    districtLayer: null
};

// --- Initialization ---

function init() {
    initIcons();
    initMap();
    initWorker();
    initStateBoundary();
    initDistrictBoundaries();
    initEventListeners();
}

function initIcons() {
    createIcons({
        icons: { Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw, ArrowLeft }
    });
}

function initMap() {
    const tnBounds = L.latLngBounds(L.latLng(8.0, 75.0), L.latLng(14.0, 81.0));

    AppState.map = L.map('map', {
        preferCanvas: true,
        zoomControl: false,
        maxBoundsViscosity: 1.0,
        minZoom: 6
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

    AppState.map.on('popupopen', () => {
        initIcons();
    });
}

async function initStateBoundary() {
    try {
        const response = await fetch('/State_boundary.json');
        const data = await response.json();
        
        L.geoJSON(data, {
            style: {
                color: '#2563eb',
                weight: 2,
                dashArray: '5, 10',
                fillOpacity: 0,
                interactive: false
            }
        }).addTo(AppState.map);
    } catch (err) {
        console.error('Failed to load state boundary for visualization:', err);
    }
}

async function initDistrictBoundaries() {
    try {
        const response = await fetch('/Districts_boundary.json');
        const data = await response.json();
        
        AppState.districts = data.features.map(f => ({
            name: f.properties.district_n,
            bounds: L.geoJSON(f).getBounds(),
            feature: f
        })).sort((a, b) => a.name.localeCompare(b.name));

        // Data is maintained in AppState.districts for the search dropdown, 
        // but we don't need to render the visual layer as the base map already shows it.
        AppState.districtLayer = null; 

        setupDistrictSearch();
    } catch (err) {
        console.error('Failed to load district boundaries:', err);
    }
}

function setupDistrictSearch() {
    const input = document.getElementById('district-search');
    const results = document.getElementById('district-results');

    if (!input || !results) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            results.classList.add('hidden');
            return;
        }

        const filtered = AppState.districts.filter(d => 
            d.name.toLowerCase().includes(query)
        );

        renderDistrictResults(filtered);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.classList.add('hidden');
        }
    });

    // Show all districts on focus if empty
    input.addEventListener('focus', () => {
        if (!input.value.trim()) {
            renderDistrictResults(AppState.districts);
        }
    });
}

function renderDistrictResults(list) {
    const results = document.getElementById('district-results');
    results.innerHTML = '';
    
    if (list.length === 0) {
        results.innerHTML = '<div class="district-item no-results">No districts found</div>';
    } else {
        list.forEach(d => {
            const div = document.createElement('div');
            div.className = 'district-item';
            div.textContent = d.name;
            div.onclick = () => selectDistrict(d);
            results.appendChild(div);
        });
    }
    
    results.classList.remove('hidden');
}

function selectDistrict(district) {
    const input = document.getElementById('district-search');
    const results = document.getElementById('district-results');
    
    input.value = district.name;
    results.classList.add('hidden');

    // 1. Clear previous highlight
    if (AppState.districtLayer) {
        AppState.map.removeLayer(AppState.districtLayer);
    }

    // 2. Draw selected district border
    AppState.districtLayer = L.geoJSON(district.feature, {
        style: {
            color: '#2563eb',
            weight: 3,
            fillOpacity: 0.1,
            fillColor: '#3b82f6',
            interactive: false
        }
    }).addTo(AppState.map);

    AppState.map.flyToBounds(district.bounds, {
        padding: [50, 50],
        duration: 1.5
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

    // Mobile Bottom Sheet Gesture Logic
    initDraggableSheet();
}

function initDraggableSheet() {
    const handle = document.getElementById('drag-handle');
    const panel = document.getElementById('side-panel');
    const searchContainer = document.querySelector('.consumer-search-container');
    if (!handle || !panel) return;

    // Stop clicks/touches from passing through to the map
    L.DomEvent.disableClickPropagation(panel);
    if (searchContainer) L.DomEvent.disableClickPropagation(searchContainer);
    L.DomEvent.disableScrollPropagation(panel);
    
    // Initial Peak State on Load
    if (window.innerWidth <= 640 && !AppState.isSearching) {
        panel.style.height = '42vh';
    }

    let startY, startHeight;
    let isDragging = false;

    handle.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 640) return;
        startY = e.touches[0].clientY;
        startHeight = panel.offsetHeight;
        isDragging = true;
        panel.classList.add('no-transition');
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const delta = startY - currentY;
        const newHeight = startHeight + delta;
        
        // Boundaries: 20vh to 85vh
        const maxHeight = window.innerHeight * 0.85;
        const minHeight = window.innerHeight * 0.2; 
        if (newHeight >= minHeight && newHeight <= maxHeight) {
            panel.style.height = `${newHeight}px`;
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        panel.classList.remove('no-transition');
        
        const currentHeight = panel.offsetHeight;
        const delta = currentHeight - startHeight;
        
        // Threshold: 15% of screen height OR a fixed delta of 60px
        const threshold = Math.min(window.innerHeight * 0.15, 60);
        
        // Clear the inline style (including the initial 42vh) to let CSS classes take over
        panel.style.height = ''; 
        
        if (delta > threshold) {
            // Dragged Up
            panel.classList.add('expanded');
        } else if (delta < -threshold) {
            // Dragged Down
            panel.classList.remove('expanded');
        } else {
            // Minor drag: stay in the most logical state
            if (currentHeight > window.innerHeight * 0.5) {
                panel.classList.add('expanded');
            } else {
                panel.classList.remove('expanded');
            }
        }
    });

    // Optional: Click to toggle still works
    handle.addEventListener('click', () => {
        if (window.innerWidth <= 640 && !isDragging) {
            panel.classList.toggle('expanded');
        }
    });
}

function toggleMobilePanel(expand = true) {
    if (window.innerWidth <= 640) {
        const sidePanel = document.getElementById('side-panel');
        if (expand) sidePanel.classList.add('expanded');
        else sidePanel.classList.remove('expanded');
    }
}

// --- Location Logic ---

async function processConsumerSearch(number) {
    // Transition UI
    document.getElementById('start-panel').classList.add('hidden');
    document.getElementById('fab-gps').classList.remove('hidden');
    document.getElementById('results-panel').classList.remove('hidden');
    
    // Give breathing room to see selection on map
    if (AppState.expandTimeout) clearTimeout(AppState.expandTimeout);
    AppState.expandTimeout = setTimeout(() => {
        toggleMobilePanel(true);
    }, 3000);

    // Pass last known location for tie-breaking if available
    const lastLocation = AppState.currentLocation;
    AppState.worker.postMessage({ type: 'PROCESS_CONSUMER', number, lastLocation });
}


async function processLocation(lat, lng) {
    // Transition UI
    document.getElementById('start-panel').classList.add('hidden');
    document.getElementById('fab-gps').classList.remove('hidden');
    document.getElementById('results-panel').classList.remove('hidden');
    
    // Give breathing room to see selection on map
    if (AppState.expandTimeout) clearTimeout(AppState.expandTimeout);
    AppState.expandTimeout = setTimeout(() => {
        toggleMobilePanel(true);
    }, 2500);

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
        const toast = document.getElementById('status-toast');
        if (loading) toast.classList.remove('hidden');
        else toast.classList.add('hidden');

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
        
        const { 
            match_type, confidence, driver, section_key,
            boundary, office, section_name, subdivision_code, distributions,
            validation, coords, consumer_number 
        } = data;

        if (match_type === 'outside_state') {
            this.renderError("📍 Outside Tamil Nadu", "The selected location is outside the state boundary. Please select a location within Tamil Nadu.");
            if (coords) updateMarker(coords.lat, coords.lng);
            return;
        }

        // 1. Render Polygons/Markers
        if (boundary?.geometry) {
            AppState.boundaryLayer = L.polygon(boundary.geometry.map(p => [p[1], p[0]]), {
                color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '5, 10'
            }).addTo(AppState.map);
            
            // Smart Centering
            const isMobile = window.innerWidth <= 640;
            AppState.map.fitBounds(AppState.boundaryLayer.getBounds(), { 
                padding: isMobile ? [20, 20, 150, 20] : [50, 50, 50, 50], 
                maxZoom: 15 
            });
        } else if (office?.coords) {
            AppState.map.setView(office.coords, 15);
        }

        if (office?.coords) {
            const zapIcon = L.divIcon({
                className: 'office-marker',
                html: '<div class="zap-icon-bg"><i data-lucide="zap"></i></div>',
                iconSize: [32, 32], iconAnchor: [16, 32]
            });
            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${office.coords[0]},${office.coords[1]}`;
            AppState.officeMarker = L.marker(office.coords, { icon: zapIcon }).addTo(AppState.map);
            AppState.officeMarker.bindPopup(`
                <div style="text-align: center; padding: 5px;">
                    <b style="font-size: 1rem; display: block; margin-bottom: 4px;">${office.name}</b>
                    <span style="font-size: 0.8rem; color: #64748b; display: block; margin-bottom: 8px;">Section Office</span>
                    <a href="${navUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #2563eb; color: white; text-decoration: none; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">
                        <i data-lucide="navigation" style="width: 14px; height: 14px;"></i> Directions
                    </a>
                </div>
            `);
        }

        // 2. Build Badge info
        let badgeLabel = 'Unknown';
        let badgeClass = 'status-unmatched';
        
        switch (match_type) {
            case 'official':
                badgeLabel = 'Verified Match';
                badgeClass = 'status-official';
                break;
            case 'consumer_only':
                badgeLabel = 'From Consumer Number';
                badgeClass = 'status-consumer';
                break;
            case 'boundary_only':
                badgeLabel = 'Limited Data';
                badgeClass = 'status-warning';
                break;
            case 'approximate':
                badgeLabel = 'Approximate (Nearest)';
                badgeClass = 'status-unmatched';
                break;
        }

        // 3. Build HTML
        const isConsumerDriver = driver === 'consumer';
        let html = `
            <div class="results-toolbar">
                <button class="back-link-btn" onclick="resetApp()" title="Return to Search">
                    <i data-lucide="arrow-left"></i>
                    <span>Back to Search</span>
                </button>
            </div>
            
            <div class="selection-summary">
                <i data-lucide="${isConsumerDriver ? 'zap' : 'map-pin'}" class="icon-primary"></i>
                <div class="selection-info">
                    <span class="selection-label">${isConsumerDriver ? 'CONSUMER NUMBER' : 'SELECTED LOCATION'}</span>
                    <span class="selection-address">${isConsumerDriver ? consumer_number : (section_name + ', ' + subdivision_code)}</span>
                    <span class="selection-coords">${section_key ? `ID: ${section_key}` : (coords ? coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4) : '')}</span>
                </div>
            </div>
        `;

        // 4. Validation Warning
        if (validation.status === 'mismatch') {
            html += `
                <div class="glass-panel warning-card card mismatch-warning">
                    <div class="card-header">
                        <i data-lucide="alert-triangle" class="icon-warning"></i>
                        <h3 class="text-warning">Jurisdiction Mismatch</h3>
                    </div>
                    <div class="mismatch-details">
                        <div class="mismatch-item"><span>Consumer:</span> <b>${validation.consumer_section}</b></div>
                        <div class="mismatch-item"><span>Location:</span> <b>${validation.location_section}</b></div>
                    </div>
                    <p class="mismatch-note">Consumer number belongs to a different EB section than your current location.</p>
                </div>
            `;
        }

        // 5. Jurisdiction Card
        html += `
            <div class="glass-panel jurisdiction-card card">
                <div class="card-header">
                    <i data-lucide="info" class="icon-primary"></i>
                    <h3>Jurisdiction Details</h3>
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                </div>
                <div class="hierarchy-grid">
                    ${this.renderHItem("SECTION", section_name)}
                    ${this.renderHItem("SUBDIVISION", subdivision_code)}
                    ${boundary ? this.renderHItem("DIVISION", boundary.division) : ''}
                    ${boundary ? this.renderHItem("CIRCLE", boundary.circle) : ''}
                    ${boundary ? this.renderHItem("REGION", boundary.region) : ''}
                </div>
            </div>
        `;

        // 6. Office Card
        if (office) {
            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${office.coords[0]},${office.coords[1]}`;
            html += `
                <div class="glass-panel office-card card">
                    <div class="card-header">
                        <i data-lucide="navigation" class="icon-primary"></i>
                        <h3>Section Office</h3>
                    </div>
                    <div class="office-info">
                        <div class="office-name">${office.name}</div>
                        <div class="office-detail">
                            <i data-lucide="info" class="icon-muted"></i> 
                            Confidence: ${confidence.toUpperCase()} ${office.distance !== 'N/A' ? `(${office.distance} km)` : ''}
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

function resetApp() {
    // 1. Clear State
    AppState.currentLocation = null;
    AppState.address = null;
    UIRenderer.clearOverlays();
    
    if (AppState.marker) {
        AppState.map.removeLayer(AppState.marker);
        AppState.marker = null;
    }

    if (AppState.districtLayer) {
        AppState.map.removeLayer(AppState.districtLayer);
        AppState.districtLayer = null;
    }

    // 2. Clear Inputs
    const consumerInput = document.getElementById('consumer-number');
    const districtInput = document.getElementById('district-search');
    if (consumerInput) consumerInput.value = '';
    if (districtInput) districtInput.value = '';

    // 3. Toggle Panels
    document.getElementById('start-panel').classList.remove('hidden');
    document.getElementById('results-panel').classList.add('hidden');
    document.getElementById('fab-gps').classList.add('hidden');

    // 4. Reset Map View
    AppState.map.flyTo([11.1271, 78.6569], 7);
}

// Make resetApp global for onclick handlers
window.resetApp = resetApp;

window.addEventListener('DOMContentLoaded', init);
