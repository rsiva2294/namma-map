/**
 * Application Constants
 */

export const MAP_CONFIG = {
    INITIAL_VIEW: [11.1271, 78.6569],
    INITIAL_ZOOM: 7,
    MIN_ZOOM: 6,
    MAX_ZOOM: 20,
    BOUNDS: [[8.0, 76.0], [14.0, 80.5]], // Tighter TN Bounds
    TILE_LAYER: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    TILE_ATTRIBUTION: '&copy; OS contributors &copy; CARTO'
};

export const DATA_URLS = {
    STATE_BOUNDARY: '/State_boundary.json',
    DISTRICT_METADATA: '/districts_meta.json',
    DISTRICT_BOUNDARY: '/Districts_boundary.json'
};

export const SELECTORS = {
    MAP: 'map',
    LOADING_OVERLAY: 'loading-overlay',
    PLACE_SEARCH: 'place-search',
    PLACE_RESULTS: 'place-results',
    CONSUMER_NUMBER: 'consumer-number',
    CONSUMER_SEARCH_BTN: 'consumer-search-btn',
    MAIN_GPS_BTN: 'main-gps-btn',
    FAB_GPS: 'fab-gps',
    EXPLORE_BTN: 'explore-btn',
    START_PANEL: 'start-panel',
    RESULTS_PANEL: 'results-panel',
    SIDE_PANEL: 'side-panel',
    DRAG_HANDLE: 'drag-handle',
    RESULTS_STICKY_HEADER: 'results-sticky-header',
    RESULTS_CONTENT: 'results-content',
    SEARCH_SUGGESTIONS: 'search-suggestions',
    STATUS_TOAST: 'status-toast',
    STATUS_TEXT: 'status-text',
    LOCALITY_SEARCH: 'locality-search'
};
