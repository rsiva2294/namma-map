const fs = require('fs');
const path = require('path');

// Basic .env parser to avoid extra dependencies
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const SECRET_KEY = env.VITE_GIS_SECRET_KEY || 'tneb-gis-secure-key-2024'; 
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const FILES_TO_ENCRYPT = [
    'TNEB_Section_Boundary.json',
    'tneb_section_office.json',
    'State_boundary.json',
    'unified_index_cleaned.json',
    'PIN_code_Boundary.json',
    'Districts_boundary.json',
    'districts_meta.json'
];

function transform(buffer, key) {
    const keyBuffer = Buffer.from(key);
    const result = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        result[i] = buffer[i] ^ keyBuffer[i % keyBuffer.length];
    }
    return result;
}

console.log('Starting data encryption...');

FILES_TO_ENCRYPT.forEach(file => {
    const inputPath = path.join(PUBLIC_DIR, file);
    const outputPath = path.join(PUBLIC_DIR, file.replace('.json', '.dat'));

    if (fs.existsSync(inputPath)) {
        const inputBuffer = fs.readFileSync(inputPath);
        const encryptedBuffer = transform(inputBuffer, SECRET_KEY);
        fs.writeFileSync(outputPath, encryptedBuffer);
        console.log(`✅ Encrypted: ${file} -> ${path.basename(outputPath)}`);
    } else {
        console.warn(`⚠️ File not found: ${file}`);
    }
});

console.log('Encryption complete! You can now remove the original .json files from the public folder (after testing).');
