import L from 'leaflet';
import { createIcons, Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw } from 'lucide';

// Store state
let map = null;
let marker = null;
let worker = null;
let boundaryLayer = null;
let officeMarker = null;

// Initialize Lucide Icons
function initIcons() {
    createIcons({
        icons: { Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw }
    });
}

function clearOverlays() {
    if (boundaryLayer) {
        map.removeLayer(boundaryLayer);
        boundaryLayer = null;
    }
    if (officeMarker) {
        map.removeLayer(officeMarker);
        officeMarker = null;
    }
}


// Initialize Leaflet Map
function initMap() {
    // Tamil Nadu focus
    // Tamil Nadu Bounding Box
    const tnBounds = L.latLngBounds(
        L.latLng(8.0, 75.0), // Southwest
        L.latLng(14.0, 81.0) // Northeast
    );

    map = L.map('map', {
        preferCanvas: true,
        zoomControl: false,
        maxBounds: tnBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 7
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Map click handler
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        processLocation(lat, lng);
    });
}

// Worker Communication
function initWorker() {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
        const { type, data, message } = e.data;
        if (type === 'READY') {
            onWorkerReady();
        } else if (type === 'RESULT') {
            displayResults(data);
        } else if (type === 'ERROR') {
            showError(message);
        }
    };

    worker.postMessage({ type: 'INIT' });
}

function onWorkerReady() {
    const loader = document.getElementById('loading-overlay');
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 500);
}

// Main logic entry
function processLocation(lat, lng) {
    // Tamil Nadu Bounds Check
    const isInsideTN = lat >= 8.0 && lat <= 14.0 && lng >= 75.0 && lng <= 81.0;

    // Transition from Start Panel to Results Panel
    const startPanel = document.getElementById('start-panel');
    const resultsPanel = document.getElementById('results-panel');
    
    if (startPanel) {
        startPanel.classList.add('hidden');
        document.getElementById('fab-gps').classList.remove('hidden');
    }
    resultsPanel.classList.remove('hidden');

    if (!isInsideTN) {
        clearOverlays();
        displayError("📍 Outside Supported Area", "We currently only support TNEB jurisdictions within Tamil Nadu. Please select a location within the state boundaries.");
        return;
    }

    // Update marker
    if (!marker) {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="pulse-ring"></div>',
            iconSize: [20, 20]
        });
        marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
        marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            processLocation(pos.lat, pos.lng);
        });
    } else {
        marker.setLatLng([lat, lng]);
    }

    // Call worker
    worker.postMessage({ type: 'PROCESS', lat, lng });
}

// Simple Error display
function displayError(title, msg) {
    const panel = document.getElementById('results-panel');
    panel.innerHTML = `
        <div class="glass-panel error-card card">
            <div class="card-header">
                <i data-lucide="alert-triangle" style="color: var(--danger)"></i>
                <h3 style="color: var(--danger)">${title}</h3>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px;">${msg}</p>
            <button onclick="location.reload()" class="secondary-btn" style="width: 100%">
                <i data-lucide="refresh-cw"></i> Try Again
            </button>
        </div>
    `;
    initIcons();
}

// UI Helpers
function displayResults(data) {
    const panel = document.getElementById('results-panel');
    clearOverlays();
    
    const { jurisdiction, nearestOffice, additionalSections, coords, matchMethod } = data;

    // DEBUG LOGGING
    console.group('TNEB Debug Info');
    console.log('Match Method:', matchMethod);
    console.log('Matched Jurisdiction JSON:', JSON.stringify(jurisdiction, null, 2));
    console.log('Matched Office JSON:', JSON.stringify(nearestOffice, null, 2));
    console.groupEnd();

    // 1. Render Section Boundary
    if (jurisdiction && jurisdiction.geometry) {
        // Swap [lng, lat] to [lat, lng] for Leaflet polygon
        const latLngs = jurisdiction.geometry.map(p => [p[1], p[0]]);
        boundaryLayer = L.polygon(latLngs, {
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 10'
        }).addTo(map);
    }

    // 2. Render Office Marker
    if (nearestOffice && nearestOffice.coords) {
        const zapIcon = L.divIcon({
            className: 'office-marker',
            html: '<div class="zap-icon-bg"><i data-lucide="zap"></i></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        officeMarker = L.marker([nearestOffice.coords[0], nearestOffice.coords[1]], { icon: zapIcon }).addTo(map);
        
        const popupMsg = data.matchMethod.includes('OFFICIAL') 
            ? `<b>${nearestOffice.name}</b><br>Section Office`
            : `<b>${nearestOffice.name}</b><br>Nearest Section Office (Proximity Fallback)`;
        
        officeMarker.bindPopup(popupMsg);
    }

    let html = `
        <div class="selection-header">
            <i data-lucide="map-pin" class="icon-primary"></i>
            <div class="selection-info">
                <span class="selection-label">SELECTED LOCATION</span>
                <span class="selection-coords">${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}</span>
            </div>
        </div>
    `;

    if (jurisdiction) {
        html += `
            <div class="glass-panel jurisdiction-card card">
                <div class="card-header">
                    <i data-lucide="zap" class="icon-primary"></i>
                    <h3>Primary Jurisdiction</h3>
                </div>
                <div class="hierarchy-grid">
                    <div class="h-item"><span class="h-label">SECTION</span><span class="h-value">${jurisdiction.section}</span></div>
                    <div class="h-item"><span class="h-label">SUBDIVISION</span><span class="h-value">${jurisdiction.subdivision}</span></div>
                    <div class="h-item"><span class="h-label">DIVISION</span><span class="h-value">${jurisdiction.division}</span></div>
                    <div class="h-item"><span class="h-label">CIRCLE</span><span class="h-value">${jurisdiction.circle}</span></div>
                    <div class="h-item"><span class="h-label">REGION</span><span class="h-value">${jurisdiction.region}</span></div>
                    <div class="h-item"><span class="h-label">TYPE</span><span class="h-value">${jurisdiction.type}</span></div>
                </div>
            </div>
        `;

        if (additionalSections && additionalSections.length > 0) {
            html += `
                <div class="glass-panel overlaps-card card">
                    <div class="card-header">
                        <i data-lucide="info" class="icon-muted"></i>
                        <h3>Also Applicable Sections</h3>
                    </div>
                    <div class="overlaps-list">
                        ${additionalSections.map(s => `
                            <div class="overlap-item">
                                <span class="overlap-name">${s.section}</span>
                                <span class="overlap-detail">${s.subdivision} / ${s.division}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    } else {
        html += `
            <div class="glass-panel jurisdiction-card card error">
                <p>Location outside known TNEB boundaries.</p>
            </div>
        `;
    }

    if (nearestOffice) {
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${nearestOffice.coords[0]},${nearestOffice.coords[1]}`;
        const matchLabel = data.matchMethod === 'OFFICIAL_HEADQUARTERS' ? 'Headquarters' : 
                          data.matchMethod === 'OFFICIAL_MATCH' ? 'Matched Section Office' : 'Nearest Office (Proximity)';
        const labelClass = data.matchMethod.includes('OFFICIAL') ? 'status-official' : 'status-proximity';

        html += `
            <div class="glass-panel office-card card">
                <div class="card-header">
                    <i data-lucide="map-pin" class="icon-primary"></i>
                    <h3>Section Office</h3>
                    <span class="badge ${labelClass}">${matchLabel}</span>
                </div>
                <div class="office-info">
                    <div class="office-name">${nearestOffice.name}</div>
                    <div class="office-detail"><i data-lucide="navigation" class="icon-muted"></i> Approximately ${nearestOffice.distance} km away</div>
                    <div class="office-detail"><i data-lucide="info" class="icon-muted"></i> ${nearestOffice.properties.subdivisio} / ${nearestOffice.properties.division_n}</div>
                    <a href="${navUrl}" target="_blank" class="nav-btn">
                        <i data-lucide="navigation"></i> Get Directions
                    </a>
                </div>
            </div>
        `;
    }

    panel.innerHTML = html;
    initIcons(); // Re-init icons for dynamic content
}

function showError(msg) {
    console.error('GIS Engine Error:', msg);
    alert('Failed to process spatial data: ' + msg);
}

// GPS trigger
function triggerGPS() {
    const mainBtn = document.getElementById('main-gps-btn');
    const fabBtn = document.getElementById('fab-gps');
    
    const setLoader = (loading) => {
        [mainBtn, fabBtn].forEach(btn => {
            if (!btn) return;
            if (loading) {
                btn.classList.add('loading-gps');
                const span = btn.querySelector('span');
                if (span) {
                    btn._oldText = span.innerText;
                    span.innerText = 'Detecting...';
                }
            } else {
                btn.classList.remove('loading-gps');
                const span = btn.querySelector('span');
                if (span && btn._oldText) {
                    span.innerText = btn._oldText;
                }
            }
        });
    };

    if (navigator.geolocation) {
        setLoader(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            setLoader(false);
            const { latitude, longitude } = pos.coords;
            map.flyTo([latitude, longitude], 14);
            processLocation(latitude, longitude);
        }, (err) => {
            setLoader(false);
            let msg = "Could not detect location.";
            if (err.code === 1) msg = "Location access denied. Please enable GPS.";
            else if (err.code === 2) msg = "Location unavailable. Check your network.";
            else if (err.code === 3) msg = "GPS request timed out.";
            
            displayError("📍 GPS Error", msg);
        }, { enableHighAccuracy: true, timeout: 10000 });
    } else {
        displayError("📍 Geolocation Not Supported", "Your browser does not support location services.");
    }
}

// Start
window.addEventListener('DOMContentLoaded', () => {
    initIcons();
    initMap();
    initWorker();

    document.getElementById('main-gps-btn').onclick = triggerGPS;
    document.getElementById('fab-gps').onclick = triggerGPS;
    
    document.getElementById('explore-btn').onclick = () => {
        document.getElementById('start-panel').classList.add('hidden');
        document.getElementById('fab-gps').classList.remove('hidden');
    };
});
