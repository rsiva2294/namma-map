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

// Handle initialization with Persistent Caching
async function init() {
    const CACHE_NAME = 'tneb-gis-v1';
    const FILES = ['TNEB_Section_Boundary.json', 'tneb_section_office.json'];

    try {
        console.log('Worker: Initializing data (Checking Cache)...');
        
        const cache = await caches.open(CACHE_NAME);
        const dataPromises = FILES.map(async (file) => {
            let response = await cache.match(file);
            if (!response) {
                console.log(`Worker: Cache miss for ${file}, fetching from network...`);
                response = await fetch(file);
                // We need to clone it to put it in cache because fetch responses can only be read once
                cache.put(file, response.clone());
            } else {
                console.log(`Worker: Cache hit for ${file}`);
            }
            return response.json();
        });

        const [boundaryData, officeData] = await Promise.all(dataPromises);

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
        console.error('Worker Init Error:', err);
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

    // 2. Priority logic: Corporation > Others
    const sortedMatches = [...matches].sort((a, b) => {
        const typeA = (a.properties.section_ty || '').toLowerCase();
        const typeB = (b.properties.section_ty || '').toLowerCase();
        
        if (typeA.includes('corporation') && !typeB.includes('corporation')) return -1;
        if (!typeA.includes('corporation') && typeB.includes('corporation')) return 1;
        return 0;
    });

    const jurisdiction = sortedMatches.length > 0 ? {
        ...formatJurisdiction(sortedMatches[0].properties),
        geometry: sortedMatches[0].geometry
    } : null;
    const additionalSections = sortedMatches.slice(1).map(m => formatJurisdiction(m.properties));

    // 3. Find Office with Tiered Logic
    let nearest = null;
    let matchMethod = 'PROXIMITY'; // Default

    if (jurisdiction) {
        // SIMPLIFIED MATCH: Section Code + Region Name
        const match = offices.find(o => 
            String(o.properties.section_co) === String(jurisdiction.sectionCode) &&
            String(o.properties.region_nam || '').toLowerCase().trim() === String(jurisdiction.region || '').toLowerCase().trim()
        );

        if (match) {
            nearest = {
                name: match.properties.section_na,
                distance: getDistance(lat, lng, match.geometry.coordinates[1], match.geometry.coordinates[0]).toFixed(2),
                properties: match.properties,
                coords: [match.geometry.coordinates[1], match.geometry.coordinates[0]]
            };
            matchMethod = 'OFFICIAL_HEADQUARTERS';
        } 
    }

    // TIER 3: Proximity Fallback (Previous Logic) if match fails or no jurisdiction
    if (!nearest) {
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
        matchMethod = 'NEAREST_PROXIMITY';
    }

    self.postMessage({
        type: 'RESULT',
        data: {
            jurisdiction,
            additionalSections,
            nearestOffice: nearest,
            matchMethod,
            coords: { lat, lng }
        }
    });
}

// Perform fuzzy search across local boundaries
function performSectionSearch(query) {
    const q = (query || '').toLowerCase().trim();
    if (q.length < 3) return [];

    const results = boundaries
        .filter(b => {
            const name = (b.properties.section_na || '').toLowerCase();
            const sub = (b.properties.subdivisio || '').toLowerCase();
            const reg = (b.properties.region_nam || '').toLowerCase();
            return name.includes(q) || sub.includes(q) || reg.includes(q);
        })
        .slice(0, 5) // Top 5 relevant matches
        .map(b => ({
            name: b.properties.section_na,
            details: `${b.properties.subdivisio} / ${b.properties.region_nam}`,
            center: [ (b.bbox[1] + b.bbox[3]) / 2, (b.bbox[0] + b.bbox[2]) / 2 ],
            properties: b.properties
        }));

    self.postMessage({ type: 'SEARCH_RESULTS', data: results });
}

self.onmessage = (e) => {
    if (e.data.type === 'INIT') {
        init();
    } else if (e.data.type === 'PROCESS') {
        processLocation(e.data.lat, e.data.lng);
    } else if (e.data.type === 'SEARCH') {
        performSectionSearch(e.data.query);
    }
};
