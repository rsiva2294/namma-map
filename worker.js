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

// Safe normalization helper
function normalize(val) {
    return String(val || "").trim();
}

// Search logic
function processLocation(lat, lng) {
    // 1. Find all containing polygons (Phase 1)
    const matches = boundaries.filter(b => {
        // Quick BBox check
        if (lng < b.bbox[0] || lng > b.bbox[2] || lat < b.bbox[1] || lat > b.bbox[3]) {
            return false;
        }
        // Accurate PIP check
        return isPointInPolygon([lng, lat], b.geometry);
    });

    // 2. Priority logic: Corporation > Others (Sort priority, not filter)
    const sortedMatches = [...matches].sort((a, b) => {
        const typeA = normalize(a.properties.section_ty).toLowerCase();
        const typeB = normalize(b.properties.section_ty).toLowerCase();
        
        const isCorpA = typeA.includes('corporation');
        const isCorpB = typeB.includes('corporation');

        if (isCorpA && !isCorpB) return -1;
        if (!isCorpA && isCorpB) return 1;
        return 0;
    });

    const matchedBoundary = sortedMatches.length > 0 ? sortedMatches[0] : null;

    // 3. Find Office with Refined Tiered Logic (Phase 2)
    let matchedOffice = null;
    let matchType = 'unmatched';

    if (matchedBoundary) {
        const bProps = matchedBoundary.properties;
        const bCircle = normalize(bProps.circle_cod);
        const bSection = normalize(bProps.section_co);
        const bRegion = normalize(bProps.region_cod);

        // TIER 1: Official Administrative Match (Primary)
        // Find all candidates matching {circle_cod}_{section_co}
        const candidates = offices.filter(o => {
            const oCircle = normalize(o.properties.circle_cod);
            const oSection = normalize(o.properties.section_co);
            return oCircle === bCircle && oSection === bSection;
        });

        if (candidates.length > 0) {
            // TIE-BREAKER: If multiple matching offices, choose nearest
            let bestCandidate = candidates[0];
            let minDist = Infinity;

            for (const cand of candidates) {
                const dist = getDistance(lat, lng, cand.geometry.coordinates[1], cand.geometry.coordinates[0]);
                if (dist < minDist) {
                    minDist = dist;
                    bestCandidate = cand;
                }
            }

            matchedOffice = {
                name: bestCandidate.properties.section_na,
                distance: minDist.toFixed(2),
                properties: bestCandidate.properties,
                coords: [bestCandidate.geometry.coordinates[1], bestCandidate.geometry.coordinates[0]]
            };

            // VALIDATION: Cross-verify Region
            const oRegion = normalize(bestCandidate.properties.region_id);
            if (bRegion === oRegion) {
                matchType = 'official';
            } else {
                matchType = 'official_with_warning';
            }
        }
    }

    // TIER 2: Proximity Fallback (if no jurisdiction or Tier 1 match failed)
    if (!matchedOffice) {
        let minDistance = Infinity;
        let nearestOffice = null;

        for (const office of offices) {
            const [olng, olat] = office.geometry.coordinates;
            const dist = getDistance(lat, lng, olat, olng);
            if (dist < minDistance) {
                minDistance = dist;
                nearestOffice = office;
            }
        }

        if (nearestOffice) {
            matchedOffice = {
                name: nearestOffice.properties.section_na,
                distance: minDistance.toFixed(2),
                properties: nearestOffice.properties,
                coords: [nearestOffice.geometry.coordinates[1], nearestOffice.geometry.coordinates[0]]
            };
            matchType = 'proximity';
        }
    }

    // Prepare result payload
    self.postMessage({
        type: 'RESULT',
        data: {
            matched_boundary: matchedBoundary ? {
                ...formatJurisdiction(matchedBoundary.properties),
                geometry: matchedBoundary.geometry
            } : null,
            matched_office: matchedOffice,
            match_type: matchType,
            coords: { lat, lng }
        }
    });
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
        processLocation(e.data.lat, e.data.lng);
    } else if (e.data.type === 'PROCESS_CONSUMER') {
        processConsumerLocation(e.data.number, e.data.lastLocation);
    } else if (e.data.type === 'SEARCH') {
        performSectionSearch(e.data.query);
    }
};

