# TNEB Section Finder: Developer Guide

This guide provides technical insights into the architecture and data structures of the TNEB Jurisdiction Finder.

## 🏗️ Architecture: Unified Resolution Engine

To ensure a smooth UI experience while processing large GeoJSON datasets and administrative mappings, all spatial and logical computing is offloaded to `worker.js`.

### Initialization Flow
1. `main.js` spawns the Web Worker.
2. The Worker checks **IndexedDB** (`TNEB_INDEX_DB`) for administrative records.
3. If database is empty:
   - Fetches `TNEB_Section_Boundary.json` (TopoJSON) and `unified_index_cleaned.json`.
   - Populates IndexedDB and clears the index JSON from RAM.
4. The Worker decodes the TopoJSON arcs into GeoJSON features on-the-fly.
5. Uses **Pre-computed BBoxes** to index the boundaries in O(1) time without reading all vertices.

## 🔑 Resolution Precedence

The application follows a strict precedence order to determine the primary jurisdiction:

1. **Consumer Number** (Highest): Overrides all other inputs if valid.
2. **Boundary** (Spatial): Point-in-polygon match based on map location.
3. **Proximity** (Last Resort): Nearest office if no boundary or consumer is found.

## 📊 Data Architecture & Schema

The application relies on a multi-layered data system to balance precision, speed, and memory efficiency.

### File Manifest & Usage

| File Name | Purpose | Format | Hydration |
| :--- | :--- | :--- | :--- |
| `unified_index_cleaned.dat` | Master administrative lookup table. | Encrypted JSON | IndexedDB (`admin_index`) |
| `TNEB_Section_Boundary.dat` | Spatial boundaries for all TNEB Sections. | Encrypted TopoJSON | RAM (Feature Collection) |
| `tneb_section_office.dat` | Office coordinates for proximity fallback. | Encrypted GeoJSON | RAM (Feature Collection) |
| `PIN_code_Boundary.dat` | PIN code polygons for search suggestions. | Encrypted TopoJSON | IndexedDB (`places_index`) |
| `State_boundary.dat` | Tamil Nadu boundary for validity checks. | Encrypted GeoJSON | RAM (Polygon Array) |
| `Districts_boundary.dat` | District-level polygons for visualization. | Encrypted TopoJSON | Leaflet Layer |
| `districts_meta.dat` | Metadata for district bounding boxes. | Encrypted JSON | RAM |

### Key-Value Schemas

#### 1. Administrative Index (`admin_index`)
Used for resolving Region/Section codes (from Consumer Numbers or Spatial hits) into office details.
- **Primary Key**: `"{region}_{section}"` (e.g., `"01_071"`)
- **Schema**:
    - `region`: (String) 2-digit TNEB Region code.
    - `section`: (String) 3-digit Section Office code.
    - `section_name`: (String) Human-readable name (e.g., `"Agaram"`).
    - `subdivision_code`: (String) Unique subdivision identifier.
    - `office`: (Object)
        - `office_name`: Official office title.
        - `lat` / `lng`: GPS coordinates for office location.
    - `distribution_codes`: (Array<String>) 3-digit sub-section codes used in consumer numbers.

#### 2. Spatial Boundary Features (`TNEB_Section_Boundary`)
Properties within the GeoJSON features used for spatial matching.
- `region_cod`: (String) Maps to `region`.
- `section_co`: (String) Maps to `section`.
- `section_na`: (String) Section name.
- `subdivisio`: (String) Subdivision name.
- `bbox`: (Array) Pre-computed `[minLng, minLat, maxLng, maxLat]`.

#### 3. Search Suggestions (`places_index`)
Hydrated from `PIN_code_Boundary` for real-time address/PIN search.
- **Schema**:
    - `pin_code`: (String) 6-digit PIN.
    - `office_nam`: (String) Post office name.
    - `district`: (String) District name.
    - `center`: (Array) `[lat, lng]` for map centering.
    - `geometry`: (Object) GeoJSON geometry for boundary highlighting.

## 📱 Mobile Gesture & UI System

The application implements a custom **3-stage adaptive bottom sheet** for mobile devices (`initDraggableSheet`) with the following logic:

### Draggable Sheet Logic
- **Real-time Tracking**: Uses `touchstart` and `touchmove` to track vertical finger movement on the drag handle.
- **3-Stage Snapping**:
  - **Minimized (< 120px)**: Snaps to a "peek" state showing only the drag handle and core search status.
  - **Compact (Middle)**: Default state when results are shown but not full-screen.
  - **Expanded (> 50% screen)**: Snaps to 85vh for full-detail reading.
- **Threshold Snapping**: Autonomously calculates the nearest state based on current velocity and a 30px displacement threshold.
- **UX Breathing Room**: Implements a 2.5s-3s delay before auto-expanding the panel during location detection to prevent jarring UI shifts.

### Smart Panel Management
- **Explore on Map**: Clicking explore or interacting with the map minimizes the bottom sheet entirely to clear the map view.
- **Typography Compaction**: Aggressive `0.48rem` to `0.75rem` font sizes for mobile to ensure complex administrative hierarchies fit on single lines.
- **Map Interaction Blocking**: Uses `L.DomEvent.disableClickPropagation` and `disableScrollPropagation` on UI elements to prevent phantom map clicks or scrolling while interacting with the sheet.

## ✨ UI Architecture & Aesthetic Tokens

- **Glassmorphism**: Implementation uses `backdrop-filter: blur()`, `--glass-bg` (translucent), and `--glass-border`.
- **Consistent Side-padding**: Enforced 20px-24px padding on desktop and 16px-20px on mobile to maintain visual rhythm.
- **Sequential Animations**: Uses CSS animations (`fade-in`, `slide-in-bottom`) and transition classes (`panel-transition`) to manage state changes.
- **Mobile Scrolling**: Specific inner-containers like `.scrollable-results` use `overflow-y: auto` with `-webkit-overflow-scrolling: touch`.

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

- **TopoJSON Migration**: Replaced large GeoJSON polygons with TopoJSON, reducing Section boundaries by ~43% and District boundaries by ~76%. Decoding is handled via `topojson-client`.
- **IndexedDB Persistence**: The 1.8MB administrative index is stored persistently in the user's browser. Lookups are asynchronous and high-speed, eliminating the memory overhead of a 3,000+ entry JavaScript Map.
- **Pre-computed BBoxes**: Every boundary feature includes a `bbox` property. The Worker skips the expensive vertex-iteration loop during initialization, enabling near-instant GIS engine readiness.
- **Persistent Caching**: Core assets and TopoJSON files are stored in the browser's Cache API via `vite-plugin-pwa`.
- **Off-Main-Thread**: All resolution, sorting, and geometric checks happen in the background Worker, keeping the UI at 60fps even during complex spatial lookups.

## 🔒 Data Safeguarding & Security

To prevent unauthorized scraping and reuse of the cleaned TNEB dataset, all static assets in the `public/` folder are encrypted at rest using a multi-byte XOR transformation.

### Encryption Workflow
1. Raw `.json` data files are processed using `scripts/encrypt-data.js`.
2. The script reads the `VITE_GIS_SECRET_KEY` from the `.env` file.
3. Encrypted binary files are saved with the `.dat` extension.
4. Only `.dat` files are committed to the repository and deployed.

### Decryption Flow
- **Worker Thread**: On initialization, the worker fetches `.dat` files, decrypts them in memory using the same secret key, and parses the resulting JSON.
- **Main Thread**: Used for spatial validity checks (State boundary) and district visualization metadata.

### Adding New Data
If you update any data file:
1. Place the new `.json` file in `public/`.
2. Run `node scripts/encrypt-data.js`.
3. Delete the original `.json` file.
4. Commit the new `.dat` file.
