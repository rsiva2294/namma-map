const fs = require('fs');

function simplify(coords, tolerance) {
    if (coords.length <= 2) return coords;

    const sqTolerance = tolerance * tolerance;

    function getSqDist(p1, p2) {
        let dx = p1[0] - p2[0];
        let dy = p1[1] - p2[1];
        return dx * dx + dy * dy;
    }

    function getSqSegDist(p, p1, p2) {
        let x = p1[0], y = p1[1], dx = p2[0] - x, dy = p2[1] - y;
        if (dx !== 0 || dy !== 0) {
            let t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) { x = p2[0]; y = p2[1]; }
            else if (t > 0) { x += dx * t; y += dy * t; }
        }
        dx = p[0] - x; dy = p[1] - y;
        return dx * dx + dy * dy;
    }

    function simplifyDPStep(points, first, last, sqTolerance, simplified) {
        let maxSqDist = sqTolerance, index;
        for (let i = first + 1; i < last; i++) {
            let sqDist = getSqSegDist(points[i], points[first], points[last]);
            if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
        }
        if (maxSqDist > sqTolerance) {
            if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
            simplified.push(points[index]);
            if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
        }
    }

    let simplified = [coords[0]];
    simplifyDPStep(coords, 0, coords.length - 1, sqTolerance, simplified);
    simplified.push(coords[coords.length - 1]);
    return simplified;
}

const data = JSON.parse(fs.readFileSync('public/State_boundary.json', 'utf8'));

// Handle MultiPolygon
data.features.forEach(f => {
    if (f.geometry.type === 'MultiPolygon') {
        f.geometry.coordinates = f.geometry.coordinates.map(poly => 
            poly.map(ring => simplify(ring, 0.005)) // ~0.005 deg tolerance is quite aggressive but good for states
        );
    } else if (f.geometry.type === 'Polygon') {
        f.geometry.coordinates = f.geometry.coordinates.map(ring => simplify(ring, 0.005));
    }
});

fs.writeFileSync('public/State_boundary_simple.json', JSON.stringify(data));
console.log('Simplified state boundary created.');
console.log('Original Size:', (fs.statSync('public/State_boundary.json').size / 1024).toFixed(2), 'KB');
console.log('New Size:', (fs.statSync('public/State_boundary_simple.json').size / 1024).toFixed(2), 'KB');
