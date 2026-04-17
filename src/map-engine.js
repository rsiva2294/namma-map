/**
 * Map Engine - Leaflet Encapsulation
 */
import L from 'leaflet';
import { AppState } from './state';
import { MAP_CONFIG, DATA_URLS, SELECTORS } from './constants';
import { isPointInGeoJSON } from './utils/geo';

export function initMap(onMapClick, onPopupOpen) {
    AppState.map = L.map(SELECTORS.MAP, {
        preferCanvas: true,
        zoomControl: false,
        maxBoundsViscosity: 1.0,
        minZoom: MAP_CONFIG.MIN_ZOOM
    }).setView(MAP_CONFIG.INITIAL_VIEW, MAP_CONFIG.INITIAL_ZOOM);

    AppState.map.setMaxBounds(MAP_CONFIG.BOUNDS);

    L.tileLayer(MAP_CONFIG.TILE_LAYER, {
        attribution: MAP_CONFIG.TILE_ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: MAP_CONFIG.MAX_ZOOM
    }).addTo(AppState.map);

    L.control.zoom({ position: 'bottomright' }).addTo(AppState.map);

    AppState.map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        onMapClick(lat, lng);
    });

    AppState.map.on('popupopen', () => {
        onPopupOpen();
    });

    initStateBoundary();
}

async function initStateBoundary() {
    try {
        const response = await fetch(DATA_URLS.STATE_BOUNDARY);
        const data = await response.json();
        AppState.stateBoundaryGeoJSON = data;
        
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
        console.error('Failed to load state boundary:', err);
    }
}

export function updateMarker(lat, lng, onDragEnd) {
    if (!AppState.marker) {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="pulse-ring"></div>',
            iconSize: [20, 20]
        });
        AppState.marker = L.marker([lat, lng], { draggable: true, icon }).addTo(AppState.map);
        AppState.marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            onDragEnd(pos.lat, pos.lng);
        });
    } else {
        AppState.marker.setLatLng([lat, lng]);
    }
}

export function clearOverlays() {
    if (AppState.boundaryLayer) AppState.map.removeLayer(AppState.boundaryLayer);
    if (AppState.officeMarker) AppState.map.removeLayer(AppState.officeMarker);
    AppState.boundaryLayer = null;
    AppState.officeMarker = null;
}

export function drawBoundary(geometry) {
    AppState.boundaryLayer = L.polygon(geometry.map(p => [p[1], p[0]]), {
        color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '5, 10'
    }).addTo(AppState.map);
    
    const isMobile = window.innerWidth <= 640;
    AppState.map.fitBounds(AppState.boundaryLayer.getBounds(), { 
        padding: isMobile ? [20, 20, 150, 20] : [50, 50, 50, 50], 
        maxZoom: 15 
    });
}

export function addOfficeMarker(coords, title, navUrl, onPopupOpen) {
    const zapIcon = L.divIcon({
        className: 'office-marker',
        html: '<div class="zap-icon-bg"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>',
        iconSize: [32, 32], iconAnchor: [16, 32]
    });
    
    AppState.officeMarker = L.marker(coords, { icon: zapIcon }).addTo(AppState.map);
    AppState.officeMarker.bindPopup(`
        <div style="text-align: center; padding: 5px;">
            <b style="font-size: 1rem; display: block; margin-bottom: 4px;">${title}</b>
            <span style="font-size: 0.8rem; color: #64748b; display: block; margin-bottom: 8px;">Section Office</span>
            <a href="${navUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #2563eb; color: white; text-decoration: none; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">
                <i data-lucide="navigation" style="width: 14px; height: 14px;"></i> Directions
            </a>
        </div>
    `);
}

export function drawDistrictLayer(featureData) {
    if (AppState.districtLayer) {
        AppState.map.removeLayer(AppState.districtLayer);
    }
    AppState.districtLayer = L.geoJSON(featureData, {
        style: {
            color: '#2563eb',
            weight: 3,
            fillOpacity: 0.1,
            fillColor: '#3b82f6',
            interactive: false
        }
    }).addTo(AppState.map);
}

export function flashBoundary(geometry) {
    if (!geometry) return;
    const flashLayer = L.geoJSON({ type: 'Feature', geometry: geometry }, {
        style: {
            color: '#f59e0b',
            weight: 4,
            fillOpacity: 0.3,
            fillColor: '#fbbf24',
            interactive: false
        }
    }).addTo(AppState.map);
    
    setTimeout(() => {
        let opacity = 0.3;
        const fade = setInterval(() => {
            opacity -= 0.05;
            if (opacity <= 0) {
                clearInterval(fade);
                AppState.map.removeLayer(flashLayer);
            } else {
                flashLayer.setStyle({ fillOpacity: opacity, opacity: opacity * 3 });
            }
        }, 40);
    }, 1200);
}

/**
 * Check if a coordinate is within Tamil Nadu
 */
export function isInsideTamilNadu(lat, lng) {
    if (!AppState.stateBoundaryGeoJSON) return true; // Fail-safe (allow until loaded)
    return isPointInGeoJSON([lng, lat], AppState.stateBoundaryGeoJSON); // LatLng -> LngLat
}
