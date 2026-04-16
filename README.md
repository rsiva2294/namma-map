# TNEB Jurisdiction Finder

A high-performance, privacy-first GIS application designed to help Tamil Nadu electricity consumers identify their exact Section Office and jurisdiction boundaries.

## 🚀 Key Features

- **Deterministic Matching**: Use our **Unified Administrative Index** to resolve your jurisdiction via Consumer Number or Map with O(1) speed.
- **Consumer-First Precedence**: Manual input is prioritized over spatial proximity to ensure absolute administrative accuracy.
- **GPS-Based Discovery**: Automatically find your Section Office and jurisdiction boundary based on your current location with smart fallbacks.
- **Boundary Visualization**: View precise jurisdiction polygons on a high-performance Leaflet-driven interactive map.
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

1. **Initialization**: On load, the app indexes boundary polygons, office points, and a precomputed administrative lookup table (`unified_index.json`) into an O(1) spatial index within a Web Worker.
2. **Unified Resolution**: The engine resolves jurisdiction using a strict precedence order (**Consumer Number > Boundary > Proximity**).
3. **Identity Enrichment**: For every match, the app pulls detailed administrative metadata, including Section Name and Subdivision Code, from the unified index to provide a complete jurisdiction profile.

## 📦 Tech Stack

- **GIS Engine**: Custom Web Worker with **Unified Indexing** for O(1) lookups.
- **Mapping**: Leaflet.js for interactive spatial visualization.
- **UI**: Vanilla HTML5/CSS3 with premium **Glass-morphism** design system.
- **Icons**: Lucide Icons for consistent, modern iconography.
- **Optimization**: Vite-driven build process with offline-first caching strategies.

## ⚖️ License

This project is intended for public utility and informational purposes for the citizens of Tamil Nadu.
