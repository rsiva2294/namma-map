/**
 * TNEB Jurisdiction Finder - Main Orchestrator
 */
import { AppState, updateState } from './state';
import { SELECTORS, MAP_CONFIG, DATA_URLS } from './constants';
import { initMap, updateMarker, clearOverlays, drawBoundary, addOfficeMarker, drawDistrictLayer } from './map-engine';
import { UIController } from './ui-controller';
import { initWorker, requestProcess, requestConsumerSearch } from './worker-client';
import { feature } from 'topojson-client';

async function init() {
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
                onReset: resetApp,
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
            // If we have a boundary, drawBoundary already handled fitBounds.
            // If not (e.g., proximity/consumer only coords), we flyTo the coords.
            if (!data.boundary && data.coords) {
                AppState.map.flyTo([data.coords.lat, data.coords.lng], 14, { animate: true });
            }
        },
        (msg) => UIController.renderError("System Error", msg), // onError
        (suggestions) => UIController.renderSuggestions(suggestions, (lat, lng, name) => { // onSuggestions
            AppState.map.flyTo([lat, lng], 14);
            processLocation(lat, lng);
            const searchInput = document.getElementById(SELECTORS.LOCALITY_SEARCH);
            if (searchInput) searchInput.value = name;
        })
    );

    // 3. Init UI Bindings
    UIController.bindEvents({
        onGPS: triggerGPS,
        onExplore: () => {}, // Handled in UIController internally for panels
        onConsumerSearch: (num) => processConsumerSearch(num),
        onDistrictSelect: (d) => selectDistrict(d),
        onReset: resetApp
    });

    // 4. Initial Data
    initDistrictBoundaries();
}

async function initDistrictBoundaries() {
    try {
        const response = await fetch(DATA_URLS.DISTRICT_METADATA);
        const districts = await response.json();
        updateState({ districts });
    } catch (err) {
        console.error('Failed to load district metadata:', err);
    }
}

async function selectDistrict(district) {
    if (AppState.districtLayer) {
        AppState.map.removeLayer(AppState.districtLayer);
    }

    AppState.map.flyToBounds(district.bounds, { padding: [50, 50], duration: 1.5 });

    try {
        if (!AppState.districtGeoJSON) {
            const response = await fetch(DATA_URLS.DISTRICT_BOUNDARY);
            let data = await response.json();
            if (data.type === 'Topology') {
                AppState.districtGeoJSON = feature(data, data.objects.Districts_boundary);
            } else {
                AppState.districtGeoJSON = data;
            }
        }

        const featureData = AppState.districtGeoJSON.features.find(f => 
            f.properties.district_n === district.name
        );

        if (featureData) {
            drawDistrictLayer(featureData);
        }
    } catch (err) {
        console.error('Failed to load district geometry:', err);
    }
}

function triggerGPS() {
    if (navigator.geolocation) {
        UIController.setGPSLoading(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            UIController.setGPSLoading(false);
            const { latitude, longitude } = pos.coords;
            AppState.map.flyTo([latitude, longitude], 14);
            processLocation(latitude, longitude);
        }, (err) => {
            UIController.setGPSLoading(false);
            UIController.renderError("📍 GPS Error", "Could not detect location.");
        }, { enableHighAccuracy: true, timeout: 10000 });
    }
}

function processLocation(lat, lng) {
    UIController.togglePanel(SELECTORS.START_PANEL, false);
    UIController.togglePanel(SELECTORS.FAB_GPS, true);
    UIController.togglePanel(SELECTORS.SIDE_PANEL, false); // Toggle for mobility
    UIController.togglePanel(SELECTORS.RESULTS_PANEL, false);
    
    // Ensure side-panel is visible
    document.getElementById(SELECTORS.SIDE_PANEL).classList.remove('hidden');
    document.getElementById(SELECTORS.RESULTS_PANEL).classList.remove('hidden');

    // Mobile: Hide search hint
    if (window.innerWidth <= 640) {
        document.querySelector('.consumer-search-container')?.classList.add('hidden');
    }

    if (AppState.expandTimeout) clearTimeout(AppState.expandTimeout);
    AppState.expandTimeout = setTimeout(() => {
        UIController.toggleMobileSheet(true);
    }, 2500);

    updateState({ currentLocation: { lat, lng } });
    updateMarker(lat, lng, (nLat, nLng) => processLocation(nLat, nLng));
    
    requestProcess(lat, lng);
}

function processConsumerSearch(number) {
    UIController.togglePanel(SELECTORS.START_PANEL, false);
    UIController.togglePanel(SELECTORS.FAB_GPS, true);
    UIController.togglePanel(SELECTORS.SIDE_PANEL, false);
    UIController.togglePanel(SELECTORS.RESULTS_PANEL, false);

    document.getElementById(SELECTORS.SIDE_PANEL).classList.remove('hidden');
    document.getElementById(SELECTORS.RESULTS_PANEL).classList.remove('hidden');

    if (window.innerWidth <= 640) {
        document.querySelector('.consumer-search-container')?.classList.add('hidden');
    }

    if (AppState.expandTimeout) clearTimeout(AppState.expandTimeout);
    AppState.expandTimeout = setTimeout(() => {
        UIController.toggleMobileSheet(true);
    }, 3000);

    requestConsumerSearch(number, AppState.currentLocation);
}

function resetApp() {
    clearOverlays();
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
    const districtInput = document.getElementById(SELECTORS.DISTRICT_SEARCH);
    if (consumerInput) consumerInput.value = '';
    if (districtInput) districtInput.value = '';

    UIController.togglePanel(SELECTORS.START_PANEL, true);
    UIController.togglePanel(SELECTORS.RESULTS_PANEL, false);
    UIController.togglePanel(SELECTORS.FAB_GPS, false);
    
    document.getElementById(SELECTORS.SIDE_PANEL).classList.remove('hidden');
    document.querySelector('.consumer-search-container')?.classList.remove('hidden');

    AppState.map.flyTo(MAP_CONFIG.INITIAL_VIEW, MAP_CONFIG.INITIAL_ZOOM);
}

// Global exposure for legacy onclick handlers if any remain in HTML (ideally bind all)
window.resetApp = resetApp;

window.addEventListener('DOMContentLoaded', init);
