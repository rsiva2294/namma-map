import L from 'leaflet';
import { createIcons, Zap, Locate, Search, MapPin, Navigation, Info, Map } from 'lucide';

// Store state
let map = null;
let marker = null;
let worker = null;

// Initialize Lucide Icons
function initIcons() {
    createIcons({
        icons: { Zap, Locate, Search, MapPin, Navigation, Info, Map }
    });
}


// Initialize Leaflet Map
function initMap() {
    // Tamil Nadu focus
    map = L.map('map', {
        preferCanvas: true,
        zoomControl: false
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
    // Transition from Start Panel to Results Panel
    const startPanel = document.getElementById('start-panel');
    const resultsPanel = document.getElementById('results-panel');
    
    if (startPanel) {
        startPanel.classList.add('hidden');
    }
    resultsPanel.classList.remove('hidden');

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

// UI Helpers
function displayResults(data) {
    const panel = document.getElementById('results-panel');
    
    const { jurisdiction, nearestOffice, additionalSections, coords } = data;

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
        html += `
            <div class="glass-panel office-card card">
                <div class="card-header">
                    <i data-lucide="map-pin" class="icon-primary"></i>
                    <h3>Nearest Section Office</h3>
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
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            map.flyTo([latitude, longitude], 14);
            processLocation(latitude, longitude);
        }, (err) => {
            alert('Geolocation failed: ' + err.message);
        });
    }
}

// Start
window.addEventListener('DOMContentLoaded', () => {
    initIcons();
    initMap();
    initWorker();

    document.getElementById('main-gps-btn').onclick = triggerGPS;
    
    document.getElementById('explore-btn').onclick = () => {
        document.getElementById('start-panel').classList.add('hidden');
    };
});
