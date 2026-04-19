/**
 * TNEB Jurisdiction Finder - Main Orchestrator
 */
import { AppState, updateState } from './state';
import { SELECTORS, MAP_CONFIG, DATA_URLS } from './constants';
import { initMap, updateMarker, clearOverlays, drawBoundary, addOfficeMarker, drawDistrictLayer, flashBoundary, isInsideTamilNadu, drawSearchArea } from './map-engine';
import { UIController } from './ui-controller';
import { initWorker, requestProcess, requestConsumerSearch, requestPlaceSearch } from './worker-client';
import { decryptData } from './utils/format';
import { initPWA } from './pwa';
import { feature } from 'topojson-client';

async function init() {
    initPWA();
    UIController.initIcons();
    
    // 1. Init Map
    initMap(
        (lat, lng) => processLocation(lat, lng), // onMapClick
        () => UIController.initIcons()         // onPopupOpen (for lucide icons in popups)
    );

    // 2. Init Worker
    initWorker(
        () => { // onReady
            const loader = document.getElementById(SELECTORS.LOADING_OVERLAY);
            if (loader) {
                loader.classList.add('fade-out');
                setTimeout(() => loader.remove(), 500);
            }
        },
        (data) => {
            // 1. Render UI Components
            UIController.renderResults(data, {
                onReset: () => resetApp(false), // Back button doesn't zoom
                formatHItem: (l, v) => `<div class="h-item"><span class="h-label">${l}</span><span class="h-value">${v}</span></div>`
            });

            // 2. Clear previous map state
            clearOverlays();

            // 3. Draw Jurisdiction Boundary
            if (data.boundary && data.boundary.geometry) {
                drawBoundary(data.boundary.geometry);
            }

            // 4. Place Office Marker
            if (data.office && data.office.coords) {
                const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.office.coords[0]},${data.office.coords[1]}`;
                addOfficeMarker(data.office.coords, data.office.name, navUrl, () => UIController.initIcons());
            }

            // 5. Handle Zooming for searches
            if (!data.boundary && data.coords) {
                AppState.map.flyTo([data.coords.lat, data.coords.lng], 14, { animate: true });
            }
        },
        (msg) => UIController.renderError("System Error", msg), // onError
        (suggestions) => { // onSuggestions
            UIController.renderPlaceResults(suggestions, (place) => {
                handlePlaceSelect(place);
            });
        }
    );

    // 3. Init UI Bindings
    UIController.bindEvents({
        onGPS: triggerGPS,
        onExplore: () => {}, 
        onConsumerSearch: (num) => processConsumerSearch(num),
        onPlaceSearch: (query) => requestPlaceSearch(query),
        onPlaceSelect: (p) => handlePlaceSelect(p),
        onReset: resetApp
    });

    // 4. Initial Data
    initDistrictBoundaries();
}

async function initDistrictBoundaries() {
    try {
        const response = await fetch(DATA_URLS.DISTRICT_METADATA);
        const buffer = await response.arrayBuffer();
        const districts = JSON.parse(decryptData(buffer, import.meta.env.VITE_GIS_SECRET_KEY));
        updateState({ districts });
    } catch (err) {
        console.error('Failed to load district metadata:', err);
    }
}

async function handlePlaceSelect(place) {
    if (!place || !place.center) return;
    
    // Boundary Guard
    if (!isInsideTamilNadu(place.center[0], place.center[1])) {
        UIController.renderError("📍 Location Not Supported", "The selected location is outside Tamil Nadu.");
        return;
    }

    // 1. Clear previous state
    clearOverlays();
    if (AppState.marker) {
        AppState.map.removeLayer(AppState.marker);
        updateState({ marker: null });
    }

    // 2. Visual Feedback
    if (place.geometry) {
        drawSearchArea(place.geometry);
        UIController.showSearchHint("Tap on the map to select your exact location");
    } else {
        AppState.map.flyTo(place.center, 15, { animate: true, duration: 1.5 });
        UIController.showSearchHint("Select your exact location on the map");
    }
    UIController.toggleMobileSheet(false);
}

async function selectDistrict(district) {
    // Deprecated in favor of Unified Search, but keeping logic if needed
    // or just map it to handlePlaceSelect if we had district geometry here.
    // For now, let's keep it simple.
}

function triggerGPS() {
    if (navigator.geolocation) {
        UIController.setGPSLoading(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            UIController.setGPSLoading(false);
            const { latitude, longitude } = pos.coords;
            processLocation(latitude, longitude, true); // Zoom on GPS lock
        }, (err) => {
            UIController.setGPSLoading(false);
            UIController.renderError("📍 GPS Error", "Could not detect location.");
        }, { enableHighAccuracy: true, timeout: 10000 });
    }
}

function processLocation(lat, lng, zoom = false) {
    if (!isInsideTamilNadu(lat, lng)) {
        UIController.renderError("📍 Location Not Supported", "This application only supports jurisdictions within Tamil Nadu.");
        return;
    }

    if (zoom) {
        AppState.map.flyTo([lat, lng], 14, { animate: true });
    }

    UIController.hideSearchHint();

    UIController.togglePanel(SELECTORS.SEARCH_CARD, false);
    document.body.classList.add('showing-results');
    UIController.togglePanel(SELECTORS.RESULTS_PANEL, true);
    UIController.toggleMobileSheet(false);

    const ql = document.getElementById('quick-links-panel');
    if (ql) {
        ql.classList.remove('init-view');
        ql.classList.add('compact-view');
    }

    document.getElementById(SELECTORS.SIDE_PANEL).classList.remove('hidden');
    document.getElementById(SELECTORS.RESULTS_PANEL).classList.remove('hidden');

    document.getElementById(SELECTORS.SIDE_PANEL).classList.remove('hidden');
    document.getElementById(SELECTORS.RESULTS_PANEL).classList.remove('hidden');

    updateState({ currentLocation: { lat, lng } });
    updateMarker(lat, lng, (nLat, nLng) => processLocation(nLat, nLng, false));
    
    requestProcess(lat, lng);
}

function processConsumerSearch(number) {
    UIController.togglePanel(SELECTORS.SEARCH_CARD, false);
    document.body.classList.add('showing-results');
    UIController.togglePanel(SELECTORS.RESULTS_PANEL, true);

    const ql = document.getElementById('quick-links-panel');
    if (ql) {
        ql.classList.remove('init-view');
        ql.classList.add('compact-view');
    }

    UIController.toggleMobileSheet(false);
    requestConsumerSearch(number, AppState.currentLocation);
}

function resetApp(zoom = true) {
    clearOverlays();
    UIController.hideSearchHint();
    if (AppState.marker) {
        AppState.map.removeLayer(AppState.marker);
        updateState({ marker: null });
    }
    if (AppState.districtLayer) {
        AppState.map.removeLayer(AppState.districtLayer);
        updateState({ districtLayer: null });
    }

    updateState({ currentLocation: null, address: null });

    const consumerInput = document.getElementById(SELECTORS.CONSUMER_NUMBER);
    const localityInput = document.getElementById(SELECTORS.LOCALITY_SEARCH);
    if (consumerInput) consumerInput.value = '';
    if (localityInput) localityInput.value = '';

    UIController.togglePanel(SELECTORS.SEARCH_CARD, true);
    UIController.togglePanel(SELECTORS.RESULTS_PANEL, false);
    UIController.togglePanel(SELECTORS.FAB_GPS, false);
    
    document.getElementById(SELECTORS.SIDE_PANEL).classList.remove('hidden');

    // Reset to Locality Tab by default
    const localityTabBtn = document.querySelector('[data-tab="locality-tab"]');
    if (localityTabBtn) localityTabBtn.click();

    // Reset Quick Links to Initial View
    document.body.classList.remove('showing-results');
    
    const panel = document.getElementById(SELECTORS.SIDE_PANEL);
    if (panel) {
        panel.classList.remove('showing-results');
        panel.classList.remove('expanded');
        panel.classList.remove('minimized');
    }
    
    const ql = document.getElementById('quick-links-panel');
    if (ql) {
        ql.classList.remove('compact-view');
        ql.classList.add('init-view');
    }

    if (zoom) {
        AppState.map.flyTo(MAP_CONFIG.INITIAL_VIEW, MAP_CONFIG.INITIAL_ZOOM);
    }
}

// Global exposure for legacy onclick handlers if any remain in HTML (ideally bind all)
window.resetApp = resetApp;

window.addEventListener('DOMContentLoaded', init);
