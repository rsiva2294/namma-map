/**
 * App State Management
 */

export const AppState = {
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
    districtLayer: null,
    districtGeoJSON: null // Lazy loaded full data
};

export function updateState(updates) {
    Object.assign(AppState, updates);
}
