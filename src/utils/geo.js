/**
 * Shared Geo Utilities
 */

/**
 * Point-in-Polygon check (Ray-casting)
 */
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

/**
 * General check for MultiPolygon support
 */
export function isPointInGeoJSON(point, geojson) {
    if (!geojson || !geojson.type) return false;
    
    // Handle FeatureCollection
    if (geojson.type === 'FeatureCollection') {
        return geojson.features.some(f => isPointInGeoJSON(point, f.geometry));
    }
    
    // Handle Feature
    if (geojson.type === 'Feature') {
        return isPointInGeoJSON(point, geojson.geometry);
    }

    if (geojson.type === 'Polygon') {
        return isPointInPolygon(point, geojson.coordinates[0]);
    }
    
    if (geojson.type === 'MultiPolygon') {
        return geojson.coordinates.some(poly => isPointInPolygon(point, poly[0]));
    }
    
    return false;
}
