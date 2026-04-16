# TNEB Section Finder: Developer Guide

This guide provides technical insights into the architecture and data structures of the TNEB Jurisdiction Finder.

## 🏗️ Architecture: Unified Resolution Engine

To ensure a smooth UI experience while processing large GeoJSON datasets and administrative mappings, all spatial and logical computing is offloaded to `worker.js`.

### Initialization Flow
1. `main.js` spawns the Web Worker.
2. The Worker fetches three primary data sources:
   - `TNEB_Section_Boundary.json`: Geometric polygons for jurisdictions.
   - `tneb_section_office.json`: Point locations for section offices.
   - `unified_index.json`: A precomputed administrative lookup table.
3. The Worker builds an `indexMap` for O(1) lookups and an spatial index for boundary polygons.

## 🔑 Resolution Precedence

The application follows a strict precedence order to determine the primary jurisdiction:

1. **Consumer Number** (Highest): Overrides all other inputs if valid.
2. **Boundary** (Spatial): Point-in-polygon match based on map location.
3. **Proximity** (Last Resort): Nearest office if no boundary or consumer is found.

## 📱 Mobile Gesture & UI System

The application implements a custom draggable bottom sheet for mobile devices (`initDraggableSheet`) with several advanced behaviors:

### Draggable Sheet Logic
- **Real-time Tracking**: Uses `touchstart` and `touchmove` to track vertical finger movement on the drag handle.
- **Threshold Snapping**: Autonomously snaps to "expanded" (85vh) or "collapsed" (120px) states based on a 15% height delta threshold.
- **UX Breathing Room**: Implements a 2.5s-3s delay before auto-expanding the panel (`toggleMobilePanel(true)`) to allow users to visually confirm their selection.

### Smart Panel Management
- **Explore on Map**: Clicking explore minimizes the bottom sheet entirely on mobile (`classList.add('hidden')`) to clear the map view.
- **Dynamic Visibility**: The consumer search guidance is automatically hidden when results are active on mobile to reclaim vertical space.
- **Sticky Architecture**: The results panel uses a split layout: `#results-sticky-header` for controls and `#results-content` for scrollable content.
- **Map Interaction Blocking**: Uses `L.DomEvent.disableClickPropagation` on UI elements to prevent phantom map clicks.

## ✨ UI Architecture & Aesthetic Tokens

- **Glassmorphism**: Implementation uses `backdrop-filter: blur()`, `--glass-bg` (translucent), and `--glass-border`.
- **Sequential Animations**: Uses CSS animations (`fade-in`, `slide-in-bottom`) and transition classes (`panel-transition`) to manage state changes.
- **Mobile Scrolling**: Specific inner-containers like `.start-card` and `.scrollable-results` use `overflow-y: auto` to ensure content accessibility within height-constrained panels.

## 🚀 Deployment

The project is configured for **Firebase Hosting**:

- **Build Output**: The app uses Vite for bundling. The official build directory is `dist/`.
- **Firebase Config**: `firebase.json` points to `dist` as the public folder.
- **Deployment Command**:
  ```bash
  npm run build
  npx firebase-tools deploy
  ```

## 🚀 Performance Optimization

- **Persistent Caching**: Data files are stored in the browser's Cache API during initialization to speed up subsequent loads.
- **Precomputed Metadata**: The `unified_index.json` avoids expensive string matching by providing pre-linked metadata for every section key.
- **Off-Main-Thread**: All resolution, sorting, and geometric checks happen in the background Worker, keeping the UI responsive.
