# TNEB Section Finder: Developer Guide

This guide provides technical insights into the architecture and data structures of the TNEB Jurisdiction Finder for contributors and maintainers.

## 🏗️ Architecture: Background GIS Worker

To ensure a smooth 60fps UI experience while processing large GeoJSON datasets (boundaries + offices), all spatial computing is offloaded to `worker.js`.

### Initialization Flow
1. `main.js` spawns the Web Worker.
2. The Worker fetches `TNEB_Section_Boundary.json` and `tneb_section_office.json`.
3. The Worker indexes the data and sends an `INIT_COMPLETE` message to dismiss the UI loading overlay.

## 🔑 Administrative Hierarchy & Matching

The core of the application is a deterministic administrative lookup.

### Data Keys
- **Region**: Represented by `region_id` (Offices) or `region_cod` (Boundaries).
- **Section**: Represented by `section_co`.

### Deterministic Matching (Consumer Number)
The system treats the consumer number as an authoritative primary key:
- **Digits 1-2**: Region Code (Normalized to 2 digits).
- **Digits 3-5**: Section Office Code (Normalized to 3 digits).

```javascript
// match_type = "official" only if:
office.properties.region_id === parsed.region && 
office.properties.section_co === parsed.section
```

## 📍 Spatial Matching (GPS)

Spatial lookups happen in two phases:
1. **Geometric Match**: A point-in-polygon check is performed against all boundary polygons to identify the current jurisdiction.
2. **Proximity Sort**: A Haversine distance sort identifies the nearest office point for the user.

## 💾 Data Updates

To update the dataset:
1. Replace `TNEB_Section_Boundary.json` or `tneb_section_office.json`.
2. Ensure the property names (`region_id`, `section_co`, etc.) remain consistent.
3. The Worker will automatically re-index the new data on the next reload.

## 🚀 Performance Notes

- **Normalization**: All administrative codes are string-padded (`05` vs `5`) during indexing to ensure lookup speed.
- **Memory**: The GeoJSON objects are kept in the Worker's memory space, keeping the Main thread lightweight for Leaflet rendering.
