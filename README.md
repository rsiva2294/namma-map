# TNEB Jurisdiction Finder

A high-performance, privacy-first GIS application designed to help Tamil Nadu electricity consumers identify their exact Section Office and jurisdiction boundaries.

## 🚀 Key Features

- **Deterministic Matching**: Use our **Unified Administrative Index** to resolve your jurisdiction via Consumer Number or Map with O(1) speed.
- **Consumer-First Precedence**: Manual input is prioritized over spatial proximity to ensure absolute administrative accuracy.
- **GPS-Based Discovery**: Automatically find your Section Office and jurisdiction boundary based on your current location with smart fallbacks.
- **Boundary Visualization**: View precise jurisdiction polygons on a high-performance Leaflet-driven interactive map.
- **Privacy First**: All GIS indexing and matching happen locally in your browser. No consumer data or location information ever leaves your device.
- **Premium UX**: A mobile-optimized glass-morphism interface with real-time feedback and detailed hierarchy information.

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
