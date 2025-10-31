// Simple icon generator for the CORS bypass extension
// Run this with Node.js to generate basic PNG icons

const fs = require('fs');
const path = require('path');

// Minimal valid PNG (1x1 transparent pixel) - base64 encoded
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Create icons of different sizes (all will be 1x1 but valid PNG format)
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const filename = `icon${size}.png`;
  fs.writeFileSync(path.join(__dirname, filename), minimalPNG);
  console.log(`✓ Created ${filename}`);
});

console.log('\n📝 Note: These are minimal placeholder icons (1x1 transparent pixel).');
console.log('For better visuals, replace these with proper PNG images:');
console.log('  - icon16.png (16x16 pixels)');
console.log('  - icon48.png (48x48 pixels)');
console.log('  - icon128.png (128x128 pixels)');
