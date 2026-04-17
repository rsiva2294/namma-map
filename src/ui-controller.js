/**
 * UI Controller - DOM & Rendering
 */
import { createIcons, Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw, ArrowLeft, Phone, ExternalLink, X } from 'lucide';
import { SELECTORS } from './constants';
import { AppState } from './state';
import L from 'leaflet';

export const UIController = {
    initIcons() {
        createIcons({
            icons: { Zap, Locate, Search, MapPin, Navigation, Info, Map, AlertTriangle, RefreshCw, ArrowLeft, Phone, ExternalLink, X }
        });
    },

    bindEvents({ 
        onGPS, onConsumerSearch, onPlaceSelect, onPlaceSearch, onReset 
    }) {
        const mainGps = document.getElementById(SELECTORS.MAIN_GPS_BTN);
        const fabGps = document.getElementById(SELECTORS.FAB_GPS);
        
        if (mainGps) mainGps.onclick = onGPS;
        if (fabGps) fabGps.onclick = onGPS;
        
        const consumerBtn = document.getElementById(SELECTORS.CONSUMER_SEARCH_BTN);
        const consumerInput = document.getElementById(SELECTORS.CONSUMER_NUMBER);
        
        if (consumerBtn && consumerInput) {
            const doConsumerSearch = () => {
                const num = consumerInput.value.trim();
                if (num) onConsumerSearch(num);
            };
            consumerBtn.onclick = doConsumerSearch;
            consumerInput.onkeypress = (e) => { if (e.key === 'Enter') doConsumerSearch(); };
        }

        this.initTabs();
        this.initDraggableSheet();
        this.setupPlaceSearch(onPlaceSearch, onPlaceSelect);
    },

    initTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const panels = document.querySelectorAll('.tab-panel');

        tabBtns.forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.dataset.tab;
                
                // Toggle Buttons
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Toggle Panels
                panels.forEach(p => p.classList.remove('active'));
                document.getElementById(targetId)?.classList.add('active');

                // If switching to consumer tab, focus input
                if (targetId === 'consumer-tab') {
                    document.getElementById(SELECTORS.CONSUMER_NUMBER)?.focus();
                } else {
                    document.getElementById(SELECTORS.LOCALITY_SEARCH)?.focus();
                }
            };
        });
    },

    togglePanel(id, show) {
        const el = document.getElementById(id);
        if (!el) return;
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    },

    toggleMobileSheet(expand = true) {
        if (window.innerWidth <= 640) {
            const sidePanel = document.getElementById(SELECTORS.SIDE_PANEL);
            if (expand) sidePanel.classList.add('expanded');
            else sidePanel.classList.remove('expanded');
        }
    },

    initDraggableSheet() {
        const handle = document.getElementById(SELECTORS.DRAG_HANDLE);
        const panel = document.getElementById(SELECTORS.SIDE_PANEL);
        const searchCard = document.getElementById(SELECTORS.SEARCH_CARD);
        if (!handle || !panel) return;

        L.DomEvent.disableClickPropagation(panel);
        if (searchCard) L.DomEvent.disableClickPropagation(searchCard);
        L.DomEvent.disableScrollPropagation(panel);
        
        if (window.innerWidth <= 640 && !AppState.isSearching) {
            panel.style.height = '35vh'; // Slightly lower default for the compact tabs
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
            const threshold = Math.min(window.innerHeight * 0.15, 60);
            
            panel.style.height = ''; 
            
            if (delta > threshold) panel.classList.add('expanded');
            else if (delta < -threshold) panel.classList.remove('expanded');
            else {
                if (currentHeight > window.innerHeight * 0.5) panel.classList.add('expanded');
                else panel.classList.remove('expanded');
            }
        });

        handle.addEventListener('click', () => {
            if (window.innerWidth <= 640 && !isDragging) {
                panel.classList.toggle('expanded');
            }
        });
    },

    setupPlaceSearch(onSearch, onSelect) {
        const input = document.getElementById(SELECTORS.LOCALITY_SEARCH);
        const results = document.getElementById(SELECTORS.PLACE_RESULTS);

        if (!input || !results) return;

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (!query || query.length < 2) {
                results.classList.add('hidden');
                return;
            }
            onSearch(query);
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.classList.add('hidden');
            }
        });
    },

    renderPlaceResults(list, onSelect) {
        const results = document.getElementById(SELECTORS.PLACE_RESULTS);
        if (!results) return;
        results.innerHTML = '';
        
        if (list.length === 0) {
            results.innerHTML = '<div class="district-item no-results">No places found</div>';
        } else {
            list.forEach(p => {
                const div = document.createElement('div');
                div.className = 'district-item';
                div.innerHTML = `
                    <div class="suggestion-content">
                        <span class="suggestion-name">${p.name}</span>
                        <span class="suggestion-details">${p.details}</span>
                    </div>
                `;
                div.onclick = () => {
                    document.getElementById(SELECTORS.LOCALITY_SEARCH).value = p.name;
                    results.classList.add('hidden');
                    onSelect(p);
                };
                results.appendChild(div);
            });
        }
        results.classList.remove('hidden');
    },

    setGPSLoading(loading) {
        const toast = document.getElementById(SELECTORS.STATUS_TOAST);
        const mainBtn = document.getElementById(SELECTORS.MAIN_GPS_BTN);
        const fabBtn = document.getElementById(SELECTORS.FAB_GPS);

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
    },

    renderSuggestions(results, onSelect) {
        const container = document.getElementById(SELECTORS.SEARCH_SUGGESTIONS);
        const wrapper = document.getElementById('search-suggestions-wrapper'); // Verify if exists, otherwise use container
        
        if (!results || results.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.innerHTML = results.map(r => `
            <div class="suggestion-item" data-lat="${r.center[0]}" data-lng="${r.center[1]}">
                <span class="name">${r.name}</span>
                <span class="address">${r.details}</span>
            </div>
        `).join('');

        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.onclick = () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                onSelect(lat, lng, item.querySelector('.name').innerText);
                container.classList.add('hidden');
            };
        });

        container.classList.remove('hidden');
    },

    renderResults(data, { onReset, onNavigate, formatHItem }) {
        const header = document.getElementById(SELECTORS.RESULTS_STICKY_HEADER);
        const content = document.getElementById(SELECTORS.RESULTS_CONTENT);
        
        const { 
            match_type, driver, section_key,
            boundary, office, section_name, subdivision_code,
            validation, coords, consumer_number 
        } = data;

        if (match_type === 'outside_state') {
            this.renderError("📍 Outside Tamil Nadu", "Location outside selection boundary.");
            return;
        }

        // 1. Badge resolve
        const badges = {
            official: { label: 'Verified Match', class: 'status-official' },
            consumer_only: { label: 'From Consumer Number', class: 'status-consumer' },
            boundary_only: { label: 'Limited Data', class: 'status-warning' },
            approximate: { label: 'Approximate (Nearest)', class: 'status-unmatched' }
        };
        const badge = badges[match_type] || { label: 'Unknown', class: 'status-unmatched' };

        // 2. Header
        const isConsumerDriver = driver === 'consumer';
        header.innerHTML = `
            <div class="results-toolbar">
                <button class="back-link-btn" id="results-back-btn" title="Return to Search">
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
        document.getElementById('results-back-btn').onclick = onReset;

        // 3. Content
        let contentHtml = '';
        if (validation?.status === 'mismatch') {
            contentHtml += `
                <div class="glass-panel warning-card card mismatch-warning fade-in">
                    <div class="card-header">
                        <i data-lucide="alert-triangle" class="icon-warning"></i>
                        <h3 class="text-warning">Jurisdiction Mismatch</h3>
                    </div>
                    <div class="mismatch-details">
                        <div class="mismatch-item"><span>Consumer:</span> <b>${validation.consumer_section}</b></div>
                        <div class="mismatch-item"><span>Location:</span> <b>${validation.location_section}</b></div>
                    </div>
                </div>
            `;
        }

        contentHtml += `
            <div class="glass-panel jurisdiction-card card fade-in">
                <div class="card-header">
                    <i data-lucide="zap" class="icon-primary"></i>
                    <h3>Jurisdiction Details</h3>
                    <span class="badge ${badge.class}">${badge.label}</span>
                </div>
                <div class="hierarchy-grid">
                    ${formatHItem("SECTION", section_name)}
                    ${formatHItem("SUBDIVISION", subdivision_code)}
                    ${boundary ? formatHItem("DIVISION", boundary.division) : ''}
                    ${boundary ? formatHItem("CIRCLE", boundary.circle) : ''}
                    ${boundary ? formatHItem("REGION", boundary.region) : ''}
                </div>
            </div>
        `;

        if (office) {
            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${office.coords[0]},${office.coords[1]}`;
            contentHtml += `
                <div class="glass-panel office-card card fade-in">
                    <div class="card-header">
                        <i data-lucide="navigation" class="icon-primary"></i>
                        <h3>Section Office</h3>
                    </div>
                    <div class="card-content">
                        <div class="office-info">
                            <div class="office-name">${office.name}</div>
                            <div class="office-confidence">
                                <i data-lucide="info"></i>
                                <span>${data.confidence.toUpperCase()} (${office.distance} km)</span>
                            </div>
                        </div>
                        <a href="${navUrl}" target="_blank" class="nav-btn" style="width: auto; padding: 10px 16px; margin: 0;">
                            <i data-lucide="navigation"></i> Locate
                        </a>
                    </div>
                </div>
            `;
        }

        content.innerHTML = contentHtml;
        content.scrollTop = 0;
        this.initIcons();
    },

    renderError(title, msg) {
        const header = document.getElementById(SELECTORS.RESULTS_STICKY_HEADER);
        const content = document.getElementById(SELECTORS.RESULTS_CONTENT);
        header.innerHTML = '<div class="results-toolbar"><button class="back-link-btn" onclick="window.resetApp()"><i data-lucide="arrow-left"></i><span>Back</span></button></div>';
        content.innerHTML = `<div class="glass-panel error-card card fade-in"><h3>${title}</h3><p>${msg}</p></div>`;
        this.initIcons();
    }
};
