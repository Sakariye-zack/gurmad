const fs = require('fs');
const filePath = 'c:/Users/abuus/Downloads/gurmad/gurmad system/src/components/CustomerView.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings for matching
const normalized = content.replace(/\r\n/g, '\n');

// Check what we have
console.log('Has Route Priority?', normalized.includes('Route Priority'));
console.log('Has -- Dooro Collector --?', normalized.includes('-- Dooro Collector --'));
console.log('Has Google Maps Location Search?', normalized.includes('Google Maps Location Search'));

// Find line 739 context
const lines = normalized.split('\n');
console.log('\nLines 737-762:');
lines.slice(736, 762).forEach((l, i) => console.log(`${737+i}: ${l}`));

process.exit(0);
