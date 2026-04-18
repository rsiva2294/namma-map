/**
 * Converts a string to Title Case (e.g., "MADURAI METRO" -> "Madurai Metro")
 * Handles special abbreviations like O&M and Roman numerals.
 */
export function toTitleCase(str) {
    if (!str || str === 'N/A') return str;
    
    // Initial title case
    let title = str.toLowerCase().split(' ').map(word => {
        if (!word) return "";
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');

    // Handle special cases
    return title
        .replace(/ O&m /g, ' O&M ')
        .replace(/ O&m$/g, ' O&M')
        .replace(/\bIi\b/g, 'II')
        .replace(/\bIii\b/g, 'III')
        .replace(/\bIv\b/g, 'IV');
}

/**
 * Decrypts data using XOR transformation
 */
export function decryptData(buffer, key) {
    const keyBuffer = new TextEncoder().encode(key);
    const data = new Uint8Array(buffer);
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ keyBuffer[i % keyBuffer.length];
    }
    return new TextDecoder().decode(result);
}
