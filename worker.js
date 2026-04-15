// TNEB Jurisdiction Finder - GIS Web Worker

let boundaries = null;
let offices = null;

// Ray-casting algorithm for Point-in-Polygon check
function isPointInPolygon(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Haversine formula for distance between two points in km
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Map GeoJSON results to the requested hierarchy
function formatJurisdiction(props) {
    return {
        section: props.section_na || 'N/A',
        sectionCode: props.section_co || 'N/A',
        subdivision: props.subdivisio || 'N/A',
        division: props.division_n || 'N/A',
        circle: props.circle_nam || 'N/A',
        region: props.region_nam || 'N/A',
        type: props.section_ty || 'Unknown'
    };
}

// Handle initialization
async function init() {
    try {
        console.log('Worker: Initializing data...');
        const [boundaryRes, officeRes] = await Promise.all([
            fetch('TNEB_Section_Boundary.json'),
            fetch('tneb_section_office.json')
        ]);

        const boundaryData = await boundaryRes.json();
        const officeData = await officeRes.json();

        // Index boundaries with BBoxes
        boundaries = boundaryData.features.map(f => {
            const coords = f.geometry.coordinates[0];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            for (const [lng, lat] of coords) {
                if (lng < minX) minX = lng;
                if (lng > maxX) maxX = lng;
                if (lat < minY) minY = lat;
                if (lat > maxY) maxY = lat;
            }

            return {
                bbox: [minX, minY, maxX, maxY],
                geometry: coords,
                properties: f.properties
            };
        });

        offices = officeData.features;

        self.postMessage({ type: 'READY' });
        console.log('Worker: Data indexed and ready.');
    } catch (err) {
        self.postMessage({ type: 'ERROR', message: err.message });
    }
}

// Search logic
function processLocation(lat, lng) {
    // 1. Find all containing polygons
    const matches = boundaries.filter(b => {
        // Quick BBox check
        if (lng < b.bbox[0] || lng > b.bbox[2] || lat < b.bbox[1] || lat > b.bbox[3]) {
            return false;
        }
        // Accurate PIP check
        return isPointInPolygon([lng, lat], b.geometry);
    });

    // Priority logic: Corporation/Urban > Rural if multiple exist
    // But we'll return all relevant ones, marking the primary match
    const jurisdiction = matches.length > 0 ? formatJurisdiction(matches[0].properties) : null;
    const additionalSections = matches.slice(1).map(m => formatJurisdiction(m.properties));

    // 2. Find nearest office
    let nearest = null;
    let minDistance = Infinity;

    for (const office of offices) {
        const [olng, olat] = office.geometry.coordinates;
        const dist = getDistance(lat, lng, olat, olng);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = {
                name: office.properties.section_na,
                distance: dist.toFixed(2),
                properties: office.properties,
                coords: [olat, olng]
            };
        }
    }

    self.postMessage({
        type: 'RESULT',
        data: {
            jurisdiction,
            additionalSections,
            nearestOffice: nearest,
            coords: { lat, lng }
        }
    });
}

self.onmessage = (e) => {
    if (e.data.type === 'INIT') {
        init();
    } else if (e.data.type === 'PROCESS') {
        processLocation(e.data.lat, e.data.lng);
    }
};
