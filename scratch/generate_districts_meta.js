const fs = require('fs');

const data = fs.readFileSync('public/Districts_boundary.json', 'utf8');
const json = JSON.parse(data);

const meta = json.features.map(f => {
    // We use a temporary leaflet-like bounds or just calculate it manually
    // Since we don't have Leaflet in Node, we'll calculate the BBox
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    
    // Simplistic flattening for MultiPolygon/Polygon
    const coords = f.geometry.coordinates.flat(Infinity);
    for (let i = 0; i < coords.length; i += 2) {
        const lng = coords[i];
        const lat = coords[i+1];
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }

    return {
        name: f.properties.district_n,
        bounds: [[minLat, minLng], [maxLat, maxLng]]
    };
}).sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync('public/districts_meta.json', JSON.stringify(meta));
console.log('Generated districts_meta.json');
console.log('Original Size:', (data.length / 1024 / 1024).toFixed(2), 'MB');
console.log('Meta Size:', (JSON.stringify(meta).length / 1024).toFixed(2), 'KB');
