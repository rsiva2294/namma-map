/**
 * Core Jurisdiction Resolution Logic
 */
import { getDistance, isPointInPolygon, buildKey, formatJurisdiction, normalize, toTitleCase } from './spatial';
import { IDB } from './db';

export function parseConsumerNumber(num) {
    const cleanNum = String(num || "").trim();
    if (!/^\d+$/.test(cleanNum) || cleanNum.length < 8) return null;

    // [Region (2)] + [Section Office (3)] + [Sub-section (3)] + [Consumer ID]
    return {
        region: cleanNum.slice(0, 2).padStart(2, "0"),
        section: cleanNum.slice(2, 5).padStart(3, "0"),
        subSection: cleanNum.slice(5, 8).padStart(3, "0"),
        id: cleanNum.slice(8)
    };
}

export async function processRequest({ lat, lng, consumerNumber, boundaries, offices, statePolygons }) {
    let matchedBoundary = null;
    let sectionKey = null;
    let indexEntry = null;
    let matchType = 'unmatched';
    let confidence = 'low';
    let driver = 'proximity';

    // 0. State Boundary Check
    if (lat && lng) {
        let insideState = false;
        for (const multi of statePolygons) {
            for (const poly of multi) {
                if (isPointInPolygon([lng, lat], poly)) {
                    insideState = true;
                    break;
                }
            }
            if (insideState) break;
        }

        if (!insideState) {
            return { type: 'RESULT', data: { match_type: 'outside_state', coords: { lat, lng } } };
        }
    }

    // 1. Spatial Resolution
    if (lat && lng) {
        matchedBoundary = boundaries.find(b => {
            if (lng < b.bbox[0] || lng > b.bbox[2] || lat < b.bbox[1] || lat > b.bbox[3]) return false;
            return isPointInPolygon([lng, lat], b.geometry);
        });
    }

    // 2. Consumer Input Resolution
    const parsedConsumer = parseConsumerNumber(consumerNumber);
    const consumerKey = parsedConsumer ? buildKey(parsedConsumer.region, parsedConsumer.section) : null;
    const consumerEntry = consumerKey ? await IDB.get(consumerKey) : null;

    // 3. Logic Orchestration
    if (consumerEntry) {
        sectionKey = consumerKey;
        indexEntry = consumerEntry;
        driver = 'consumer';
        matchType = 'official';
        confidence = 'high';
        
        if (!matchedBoundary || buildKey(matchedBoundary.properties.region_cod, matchedBoundary.properties.section_co) !== consumerKey) {
             matchedBoundary = boundaries.find(b => buildKey(b.properties.region_cod, b.properties.section_co) === consumerKey);
        }
    } else if (matchedBoundary) {
        const bProps = matchedBoundary.properties;
        sectionKey = buildKey(bProps.region_cod, bProps.section_co);
        indexEntry = await IDB.get(sectionKey);
        
        driver = 'boundary';
        if (indexEntry) {
            matchType = 'official';
            confidence = 'high';
        } else {
            matchType = 'boundary_only';
            confidence = 'low';
        }
    }

    // 4. Proximity Fallback
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
            indexEntry = await IDB.get(sectionKey);
        }
    }

    // 5. Response Formatting
    const office = indexEntry?.office || matchedBoundary?.properties?.office || fallbackOffice?.properties || null;
    const formattedOffice = office ? {
        name: toTitleCase(office.office_name || office.section_na || 'Unknown Office'),
        coords: office.lat ? [office.lat, office.lng] : (office.geometry ? [office.geometry.coordinates[1], office.geometry.coordinates[0]] : null),
        distance: (lat && lng && office.lat) ? getDistance(lat, lng, office.lat, office.lng).toFixed(2) : "N/A"
    } : null;

    const result = {
        match_type: matchType,
        confidence: confidence,
        driver: driver,
        section_key: sectionKey,
        boundary: matchedBoundary ? { ...formatJurisdiction(matchedBoundary.properties), geometry: matchedBoundary.geometry } : null,
        office: formattedOffice,
        section_name: toTitleCase(indexEntry?.section_name || matchedBoundary?.properties?.section_na || 'Unknown Section'),
        subdivision_code: indexEntry?.subdivision_code || matchedBoundary?.properties?.subdivisio || 'N/A',
        distributions: (indexEntry?.distribution_codes || []).slice(0, 5),
        validation: {
            location_section: toTitleCase(matchedBoundary ? (await IDB.get(buildKey(matchedBoundary.properties.region_cod, matchedBoundary.properties.section_co)))?.section_name || 'N/A' : 'N/A'),
            consumer_section: toTitleCase(consumerEntry ? consumerEntry.section_name : 'N/A'),
            status: 'none'
        }
    };

    if (driver === 'boundary' && matchedBoundary && consumerEntry) {
        const locationKey = buildKey(matchedBoundary.properties.region_cod, matchedBoundary.properties.section_co);
        result.validation.status = locationKey === consumerKey ? 'match' : 'mismatch';
    }

    result.coords = (lat && lng) ? { lat, lng } : (formattedOffice?.coords ? { lat: formattedOffice.coords[0], lng: formattedOffice.coords[1] } : null);
    result.consumer_number = consumerNumber;

    return { type: 'RESULT', data: result };
}

// Deprecated or integrated: processConsumerLocation logic is now largely integrated in processRequest 
// but keeping for compatibility if specific entry points needed.
