const fs = require('fs');

const data = fs.readFileSync('public/Districts_boundary.json', 'utf8');
const json = JSON.parse(data);
if (json.features && json.features.length > 0) {
    console.log('Property Keys:', Object.keys(json.features[0].properties));
    console.log('Sample Properties:', json.features[0].properties);
} else {
    console.log('No features found');
}
