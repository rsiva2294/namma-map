/**
 * Spatial Utilities & Algorithms
 */

// Ray-casting algorithm for Point-in-Polygon check
export function isPointInPolygon(point, vs) {
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
export function getDistance(lat1, lon1, lat2, lon2) {
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
export function formatJurisdiction(props) {
    return {
        section: toTitleCase(props.section_na || props.section_name || 'N/A'),
        sectionCode: props.section_co || props.section_code || 'N/A',
        subdivision: toTitleCase(props.subdivisio || props.subdivision_code || 'N/A'),
        division: toTitleCase(props.division_n || 'N/A'),
        circle: toTitleCase(props.circle_nam || 'N/A'),
        region: toTitleCase(props.region_nam || 'N/A'),
        type: toTitleCase(props.section_ty || 'Unknown')
    };
}

// Helpers
export function buildKey(region, section) {
    return `${String(region || "").padStart(2, '0')}_${String(section || "").padStart(3, '0')}`;
}

export function normalize(val) {
    return String(val || "").trim().toLowerCase();
}

/**
 * Converts a string to Title Case (e.g., "MADURAI METRO" -> "Madurai Metro")
 */
export function toTitleCase(str) {
    if (!str || str === 'N/A') return str;
    return str.toLowerCase().split(' ').map(word => {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
}
