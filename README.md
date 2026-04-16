# TNEB Jurisdiction Finder

A high-performance, privacy-first GIS application designed to help Tamil Nadu electricity consumers identify their exact Section Office and jurisdiction boundaries.

## 🚀 Key Features

- **Deterministic Matching**: Enter your 12-digit Consumer Number to instantly resolve your administrative Section without guessing.
- **GPS-Based Discovery**: Automatically find the nearest Section Office and jurisdiction boundary based on your current location.
- **Boundary Visualization**: View detailed jurisdiction polygons on an interactive map for precise spatial context.
- **Privacy First**: All GIS indexing and matching happen locally in your browser using a Web Worker. No consumer data ever leaves your device.
- **Premium UX**: A dark-mode, glass-morphism interface optimized for both desktop and mobile devices.

## 🛠️ How it Works

1. **Initialization**: On load, the app indexes thousands of TNEB boundary polygons and office points into a spatial index within a background Web Worker.
2. **Deterministic Lookup**: By parsing the **Region** (digits 1-2) and **Section Office** (digits 3-5) from your consumer number, the app performs an authoritative match against the TNEB administrative hierarchy.
3. **Spatial Search**: For GPS lookups, the app performs a point-in-polygon check to find your current jurisdiction and high-speed proximity sorting for the nearest office point.

## 📦 Tech Stack

- **GIS Engine**: Custom JavaScript Web Worker with spatial indexing.
- **Mapping**: Leaflet.js for interactive visualization.
- **UI**: Vanilla HTML5/CSS3 with premium glass-morphism aesthetics.
- **Icons**: Lucide Icons for modern, sharp iconography.

## ⚖️ License

This project is intended for public utility and informational purposes for the citizens of Tamil Nadu.
