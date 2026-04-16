// TNEB Jurisdiction Finder - GIS Web Worker

let boundaries = null;
let offices = null;
let indexMap = new Map();

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
        section: props.section_na || props.section_name || 'N/A',
        sectionCode: props.section_co || props.section_code || 'N/A',
        subdivision: props.subdivisio || props.subdivision_code || 'N/A',
        division: props.division_n || 'N/A',
        circle: props.circle_nam || 'N/A',
        region: props.region_nam || 'N/A',
        type: props.section_ty || 'Unknown'
    };
}

// Helpers
function buildKey(region, section) {
    return `${String(region || "").padStart(2, '0')}_${String(section || "").padStart(3, '0')}`;
}

function scoreDistribution(name) {
    const n = String(name || "").toLowerCase();
    if (n.includes("zone")) return 0;
    if (n.includes("nagar")) return 1;
    return 2;
}

// Handle initialization with Persistent Caching
async function init() {
    const CACHE_NAME = 'tneb-gis-v1';
    const FILES = ['/TNEB_Section_Boundary.json', '/tneb_section_office.json', '/unified_index.json'];

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

        const [boundaryData, officeData, indexData] = await Promise.all(dataPromises);

        // Index boundaries with BBoxes
        boundaries = boundaryData.features.map(f => {
            const geometry = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            for (const [lng, lat] of geometry) {
                if (lng < minX) minX = lng;
                if (lng > maxX) maxX = lng;
                if (lat < minY) minY = lat;
                if (lat > maxY) maxY = lat;
            }

            return {
                bbox: [minX, minY, maxX, maxY],
                geometry: geometry,
                properties: f.properties
            };
        });

        offices = officeData.features;
        
        // Build Index Map
        indexMap = new Map(Object.entries(indexData));

        self.postMessage({ type: 'READY' });
        console.log('Worker: Data indexed and ready.');
    } catch (err) {
        console.error('Worker Init Error:', err);
        self.postMessage({ type: 'ERROR', message: err.message });
    }
}

// Safe normalization helper
function normalize(val) {
    return String(val || "").trim();
}

// Search logic
function processRequest(lat, lng, consumerNumber) {
    let matchedBoundary = null;
    let indexEntry = null;
    let matchType = 'unmatched';
    let confidence = 'low';
    let driver = 'proximity';
    let sectionKey = null;

    // 1. Resolve Boundary (Spatial Truth)
    if (lat && lng) {
        matchedBoundary = boundaries.find(b => {
            if (lng < b.bbox[0] || lng > b.bbox[2] || lat < b.bbox[1] || lat > b.bbox[3]) return false;
            return isPointInPolygon([lng, lat], b.geometry);
        });
    }

    // 2. Resolve Consumer Input
    const parsedConsumer = parseConsumerNumber(consumerNumber);
    const consumerKey = parsedConsumer ? buildKey(parsedConsumer.region, parsedConsumer.section) : null;
    const consumerEntry = consumerKey ? indexMap.get(consumerKey) : null;

    // 3. Resolve Execution (Precedence: Consumer > Boundary > Proximity)
    if (consumerEntry) {
        sectionKey = consumerKey;
        indexEntry = consumerEntry;
        driver = 'consumer';
        matchType = 'official';
        confidence = 'high';
        
        // Find the geometric boundary for this consumer section if not already matched
        if (!matchedBoundary || buildKey(matchedBoundary.properties.region_cod, matchedBoundary.properties.section_co) !== consumerKey) {
             matchedBoundary = boundaries.find(b => buildKey(b.properties.region_cod, b.properties.section_co) === consumerKey);
        }
    } else if (matchedBoundary) {
        const bProps = matchedBoundary.properties;
        sectionKey = buildKey(bProps.region_cod, bProps.section_co);
        indexEntry = indexMap.get(sectionKey);
        
        driver = 'boundary';
        if (indexEntry) {
            matchType = 'official';
            confidence = 'high';
        } else {
            matchType = 'boundary_only';
            confidence = 'low';
        }
    }

    // 4. Fallback: Proximity (only if no boundary and no consumer match)
    let fallbackOffice = null;
    if (!matchedBoundary && !consumerEntry && lat && lng) {
        let minDistance = Infinity;
        for (const office of offices) {
            const [olng, olat] = office.geometry.coordinates;
            const dist = getDistance(lat, lng, olat, olng);
            if (dist < minDistance) {
                minDistance = dist;
                fallbackOffice = office;
            }
        }
        if (fallbackOffice) {
            driver = 'proximity';
            matchType = 'approximate';
            confidence = 'low';
            sectionKey = buildKey(fallbackOffice.properties.region_id, fallbackOffice.properties.section_co);
            indexEntry = indexMap.get(sectionKey);
        }
    }

    // 5. Build Standardized Response
    const office = indexEntry?.office || matchedBoundary?.properties?.office || fallbackOffice?.properties || null;
    const formattedOffice = office ? {
        name: office.office_name || office.section_na || 'Unknown Office',
        coords: office.lat ? [office.lat, office.lng] : (office.geometry ? [office.geometry.coordinates[1], office.geometry.coordinates[0]] : null),
        distance: (lat && lng && office.lat) ? getDistance(lat, lng, office.lat, office.lng).toFixed(2) : "N/A"
    } : null;

    const distributions = (indexEntry?.distributions || [])
        .sort((a, b) => scoreDistribution(a.name) - scoreDistribution(b.name) || a.name.localeCompare(b.name))
        .slice(0, 3);

    const result = {
        match_type: matchType,
        confidence: confidence,
        driver: driver,
        section_key: sectionKey,
        
        boundary: matchedBoundary ? {
            ...formatJurisdiction(matchedBoundary.properties),
            geometry: matchedBoundary.geometry
        } : null,
        
        office: formattedOffice,
        
        section_name: indexEntry?.section_name || matchedBoundary?.properties?.section_na || 'Unknown Section',
        subdivision_code: indexEntry?.subdivision_code || matchedBoundary?.properties?.subdivisio || 'N/A',
        distributions: distributions,

        validation: {
            location_section: matchedBoundary ? indexMap.get(buildKey(matchedBoundary.properties.region_cod, matchedBoundary.properties.section_co))?.section_name || 'N/A' : 'N/A',
            consumer_section: consumerEntry ? consumerEntry.section_name : 'N/A',
            status: 'none'
        }
    };

    // Cross-check status (only if driven by boundary - consumer input overrides mismatch)
    if (driver === 'boundary' && matchedBoundary && consumerEntry) {
        const locationKey = buildKey(matchedBoundary.properties.region_cod, matchedBoundary.properties.section_co);
        result.validation.status = locationKey === consumerKey ? 'match' : 'mismatch';
    } else {
        result.validation.status = 'none';
    }

    result.coords = (lat && lng) ? { lat, lng } : (formattedOffice?.coords ? { lat: formattedOffice.coords[0], lng: formattedOffice.coords[1] } : null);
    result.consumer_number = consumerNumber;

    self.postMessage({ type: 'RESULT', data: result });
}


// Consumer Number Parsing & Logic
// Consumer Number Parsing & Logic
function parseConsumerNumber(num) {
    const cleanNum = String(num || "").trim();
    if (!/^\d+$/.test(cleanNum) || cleanNum.length < 8) return null;

    // Corrected Hierarchy extraction
    // [Region (2)] + [Section Office (3)] + [Sub-section (3)] + [Consumer ID]
    return {
        region: cleanNum.slice(0, 2).padStart(2, "0"),
        section: cleanNum.slice(2, 5).padStart(3, "0"), // Corrected mapping to section_co
        subSection: cleanNum.slice(5, 8).padStart(3, "0"),
        id: cleanNum.slice(8)
    };
}

function processConsumerLocation(consumerNumber, lastKnownLocation) {
    const parsed = parseConsumerNumber(consumerNumber);
    if (!parsed) {
        self.postMessage({ type: 'ERROR', message: 'Invalid Consumer Number format.' });
        return;
    }

    const { region, section } = parsed;
    
    // Debugging Logs
    console.log("--- TNEB Consumer Search Logic (Strict & Corrected) ---");
    console.log("Parsed Codes:", { region, section });

    let matchedOffice = null;
    let matchedBoundary = null;
    let matchType = 'unmatched';
    let matchConfidence = 'low';
    let ambiguous = false;

    // 1. Strict Match Only (No Fallback)
    const exactMatches = offices.filter(o => 
        normalize(o.properties.region_id).padStart(2, "0") === region &&
        normalize(o.properties.section_co).padStart(3, "0") === section
    );

    if (exactMatches.length > 0) {
        matchType = 'official';
        matchConfidence = 'high';
        
        // Tie-breaker: If multiple exact matches exist
        if (exactMatches.length > 1) {
            if (lastKnownLocation) {
                let minDist = Infinity;
                for (const cand of exactMatches) {
                    const dist = getDistance(lastKnownLocation.lat, lastKnownLocation.lng, cand.geometry.coordinates[1], cand.geometry.coordinates[0]);
                    if (dist < minDist) {
                        minDist = dist;
                        matchedOffice = cand;
                    }
                }
                ambiguous = false;
            } else {
                matchedOffice = exactMatches[0];
                ambiguous = true;
            }
        } else {
            matchedOffice = exactMatches[0];
        }
    } else {
        matchType = 'unmatched';
        matchConfidence = 'low';
        console.log(`Status: No exact Region (${region}) + Section (${section}) match found.`);
    }

    // 2. Boundary Match (Strict Only)
    const officialBoundary = boundaries.find(b => 
        normalize(b.properties.region_cod).padStart(2, "0") === region &&
        normalize(b.properties.section_co).padStart(3, "0") === section
    );

    if (officialBoundary) {
        matchedBoundary = officialBoundary;
    }

    // Formatted result for Office
    const formattedOffice = matchedOffice ? {
        name: matchedOffice.properties.section_na,
        distance: lastKnownLocation ? getDistance(lastKnownLocation.lat, lastKnownLocation.lng, matchedOffice.geometry.coordinates[1], matchedOffice.geometry.coordinates[0]).toFixed(2) : "N/A",
        properties: matchedOffice.properties,
        coords: [matchedOffice.geometry.coordinates[1], matchedOffice.geometry.coordinates[0]]
    } : null;

    console.log("Final Outcome:", { matchType, confidence: matchConfidence, ambiguous });
    console.log("-----------------------------------");

    self.postMessage({
        type: 'RESULT',
        data: {
            consumer_number: consumerNumber,
            parsed: {
                region_code: region,
                section_code: section
            },
            match_key: `${region}_${section}`,
            match_confidence: matchConfidence,
            matched_boundary: matchedBoundary ? {
                ...formatJurisdiction(matchedBoundary.properties),
                geometry: matchedBoundary.geometry
            } : null,
            matched_office: formattedOffice,
            match_type: matchType,
            ambiguous,
            coords: lastKnownLocation || (formattedOffice ? { lat: formattedOffice.coords[0], lng: formattedOffice.coords[1] } : null),
            source: 'CONSUMER_NUMBER'
        }
    });
}




self.onmessage = (e) => {
    if (e.data.type === 'INIT') {
        init();
    } else if (e.data.type === 'PROCESS') {
        processRequest(e.data.lat, e.data.lng, null);
    } else if (e.data.type === 'PROCESS_CONSUMER') {
        processRequest(e.data.lastLocation?.lat, e.data.lastLocation?.lng, e.data.number);
    } else if (e.data.type === 'SEARCH') {
        performSectionSearch(e.data.query);
    }
};

