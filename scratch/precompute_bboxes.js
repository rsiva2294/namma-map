const fs = require('fs');
const path = require('path');

function processFile(filename) {
    const filePath = path.join(__dirname, '../public', filename);
    if (!fs.existsSync(filePath)) {
        console.log(`File ${filename} not found, skipping.`);
        return;
    }

    console.log(`Processing ${filename}...`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    data.features = data.features.map(f => {
        if (!f.geometry) return f;

        const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const [lng, lat] of coords) {
            if (lng < minX) minX = lng;
            if (lng > maxX) maxX = lng;
            if (lat < minY) minY = lat;
            if (lat > maxY) maxY = lat;
        }

        // Add bbox to the feature object (Standard GeoJSON)
        f.bbox = [minX, minY, maxX, maxY];
        
        // Also add to properties for easier access if needed
        if (!f.properties) f.properties = {};
        f.properties.precomputed_bbox = [minX, minY, maxX, maxY];

        return f;
    });

    fs.writeFileSync(filePath, JSON.stringify(data));
    console.log(`Successfully updated ${filename} with pre-computed BBoxes.`);
}

// Process the main spatial files
processFile('TNEB_Section_Boundary.json');
processFile('Districts_boundary.json');
