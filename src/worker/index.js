/**
 * TNEB Jurisdiction Finder - GIS Web Worker Entry
 */
import { feature } from 'topojson-client';
import { IDB } from './db';
import { processRequest } from './logic';

let boundaries = null;
let offices = null;
let statePolygons = null;

async function init() {
    const CACHE_NAME = 'tneb-gis-v1';
    const indexCount = await IDB.count().catch(() => 0);
    const indexNeedsPopulating = indexCount === 0;

    const FILES = ['/TNEB_Section_Boundary.json', '/tneb_section_office.json', '/State_boundary.json'];
    if (indexNeedsPopulating) {
        FILES.push('/unified_index_cleaned.json');
    }

    try {
        const cache = await caches.open(CACHE_NAME);
        const dataPromises = FILES.map(async (file) => {
            let response = await cache.match(file);
            if (!response) {
                response = await fetch(file);
                cache.put(file, response.clone());
            }
            return response.json();
        });

        const results = await Promise.all(dataPromises);
        let boundaryData = results[0];
        const officeData = results[1];
        const stateData = results[2];
        const indexData = indexNeedsPopulating ? results[3] : null;

        // Decode Sections
        if (boundaryData.type === 'Topology') {
            boundaryData = feature(boundaryData, boundaryData.objects.TNEB_Section_Boundary);
        }

        // Populate Index
        if (indexNeedsPopulating && indexData) {
            await IDB.putAll(indexData);
        }

        // Process State Boundary
        const stateGeometry = stateData.features[0].geometry;
        statePolygons = stateGeometry.type === 'MultiPolygon' ? stateGeometry.coordinates : [stateGeometry.coordinates];

        // Index boundaries with BBox
        boundaries = boundaryData.features.map(f => {
            const geometry = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
            let bbox = f.bbox || f.properties?.precomputed_bbox;
            
            if (!bbox) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const [lng, lat] of geometry) {
                    if (lng < minX) minX = lng;
                    if (lng > maxX) maxX = lng;
                    if (lat < minY) minY = lat;
                    if (lat > maxY) maxY = lat;
                }
                bbox = [minX, minY, maxX, maxY];
            }

            return { bbox, geometry, properties: f.properties };
        });

        offices = officeData.features;

        self.postMessage({ type: 'READY' });
    } catch (err) {
        console.error('Worker Init Error:', err);
        self.postMessage({ type: 'ERROR', message: err.message });
    }
}

self.onmessage = async (e) => {
    const { type, lat, lng, number, lastLocation } = e.data;

    switch (type) {
        case 'INIT':
            await init();
            break;
        case 'PROCESS':
            const res = await processRequest({ lat, lng, boundaries, offices, statePolygons });
            self.postMessage(res);
            break;
        case 'PROCESS_CONSUMER':
            // Logic integrated in processRequest, using coords from lastLocation if provided
            const cres = await processRequest({ 
                lat: lastLocation?.lat, 
                lng: lastLocation?.lng, 
                consumerNumber: number, 
                boundaries, 
                offices, 
                statePolygons 
            });
            self.postMessage(cres);
            break;
    }
};
