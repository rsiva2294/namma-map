import L from 'leaflet';
import { createIcons, Zap, Locate, Search, MapPin, Navigation, Info } from 'lucide';

// Store state
let map = null;
let marker = null;
let worker = null;
let currentCoords = null;

// Initialize Lucide Icons
function initIcons() {
    createIcons({
        icons: { Zap, Locate, Search, MapPin, Navigation, Info }
    });
}

// Initialize Leaflet Map
function initMap() {
    // Tamil Nadu focus
    map = L.map('map', {
        preferCanvas: true,
        zoomControl: false
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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
    
    // Update search UI
    document.getElementById('search-input').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// UI Helpers
function displayResults(data) {
    const panel = document.getElementById('results-panel');
    panel.classList.remove('hidden');
    
    const { jurisdiction, nearestOffice, additionalSections } = data;

    let html = '';

    if (jurisdiction) {
        html += `
            <div class="glass-panel jurisdiction-card card">
                <h3><i data-lucide="zap"></i> Jurisdiction Found</h3>
                <div class="hierarchy-grid">
                    <div class="h-item"><span class="h-label">SECTION</span><span class="h-value">${jurisdiction.section}</span></div>
                    <div class="h-item"><span class="h-label">SUBDIVISION</span><span class="h-value">${jurisdiction.subdivision}</span></div>
                    <div class="h-item"><span class="h-label">DIVISION</span><span class="h-value">${jurisdiction.division}</span></div>
                    <div class="h-item"><span class="h-label">CIRCLE</span><span class="h-value">${jurisdiction.circle}</span></div>
                    <div class="h-item"><span class="h-label">REGION</span><span class="h-value">${jurisdiction.region}</span></div>
                    <div class="h-item"><span class="h-label">CODE</span><span class="h-value">${jurisdiction.sectionCode}</span></div>
                </div>
            </div>
        `;
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
                <h3><i data-lucide="map-pin"></i> Nearest Section Office</h3>
                <div class="office-info">
                    <div class="office-name">${nearestOffice.name}</div>
                    <div class="office-detail"><i data-lucide="navigation"></i> Approximately ${nearestOffice.distance} km away</div>
                    <div class="office-detail"><i data-lucide="info"></i> ${nearestOffice.properties.subdivisio} / ${nearestOffice.properties.division_n}</div>
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
document.getElementById('gps-btn').onclick = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            map.flyTo([latitude, longitude], 14);
            processLocation(latitude, longitude);
        }, (err) => {
            alert('Geolocation failed: ' + err.message);
        });
    }
};

// Start
window.addEventListener('DOMContentLoaded', () => {
    initIcons();
    initMap();
    initWorker();
});
