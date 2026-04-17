# TNEB Jurisdiction Finder

A high-performance, privacy-first GIS application designed to help Tamil Nadu electricity consumers identify their exact Section Office and jurisdiction boundaries.

## 🚀 Key Features

- **Deterministic Matching**: Use our **Unified Administrative Index** to resolve your jurisdiction via Consumer Number or Map with O(1) speed.
- **Consumer-First Precedence**: Manual input is prioritized over spatial proximity to ensure absolute administrative accuracy.
- **GPS-Based Discovery**: Automatically find your Section Office and jurisdiction boundary based on your current location with smart fallbacks.
- **Boundary Visualization**: View precise jurisdiction polygons on a high-performance Leaflet-driven interactive map.
- **TopoJSON Optimization**: Leveraging compressed TopoJSON for boundaries, reducing the data payload by up to **75%** while maintaining pixel-perfect topological accuracy.
- **IndexedDB-Backed Indexing**: Offloads the 1.8MB administrative index from RAM to **IndexedDB**, ensuring near-zero memory footprint and instant startup on subsequent visits.
- **Privacy First**: All GIS indexing and matching happen locally in your browser. No consumer data or location information ever leaves your device.
- **Premium Mobile Experience**:
  - **Draggable Bottom Sheet**: Native-feeling gesture controls to expand/collapse results.
  - **Sticky Results Header**: Core actions (Back, Selection Info) remain pinned to the top while scrolling through jurisdiction details.
  - **Smart Visibility**: Search guidance and floating elements automatically adapt to screen state to maximize map visibility.
  - **Quick Navigation**: Instant Google Maps directions from both map popups and detail cards.

## 🎨 Visual Excellence

- **Glassmorphism Design**: Modern, translucent UI components that blend seamlessly with the interactive map.
- **Contextual Search Guidance**: Hoverable region code examples (03-North, 04-Central, etc.) to help users find their 12-digit consumer numbers.
- **Micro-Animations**: Sequential fade-in effects and smooth panel transitions for a premium, alive application feel.
- **Interactive Context**: Visual badges and hierarchy grids clearly display administrative identity.

## 🛠️ How it Works

1. **Initialization**: On load, the app checks **IndexedDB** for the administrative index. On the first visit, it fetches TopoJSON boundaries and a precomputed administrative lookup table, populates the database, and immediately clears the JSON from RAM.
2. **Topology Decoding**: The Web Worker decodes TopoJSON arcs on-the-fly, utilizing **Pre-computed Bounding Boxes (BBoxes)** to skip expensive geometric calculations during startup.
2. **Unified Resolution**: The engine resolves jurisdiction using a strict precedence order (**Consumer Number > Boundary > Proximity**).
3. **Identity Enrichment**: For every match, the app pulls detailed administrative metadata, including Section Name and Subdivision Code, from the unified index to provide a complete jurisdiction profile.

## 📦 Tech Stack

- **GIS Engine**: Custom Web Worker with **TopoJSON decoding** and **IndexedDB** persistence.
- **Mapping**: Leaflet.js for interactive spatial visualization.
- **Data Format**: TopoJSON for high-efficiency boundary storage.
- **UI**: Vanilla HTML5/CSS3 with premium **Glass-morphism** design system.
- **Icons**: Lucide Icons for consistent, modern iconography.
- **Optimization**: Vite-driven build process with offline-first caching and IndexedDB store.

## ⚖️ License

This project is intended for public utility and informational purposes for the citizens of Tamil Nadu.
