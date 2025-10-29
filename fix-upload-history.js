/**
 * Fix Upload History - Convert numeric batchNumber to string
 * 
 * This script reads the .upload-history.json file and ensures all
 * batchNumber values are strings instead of numbers.
 */

const fs = require('fs');
const path = require('path');

// Get the file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Please provide the path to .upload-history.json');
  console.error('Usage: node fix-upload-history.js "path/to/.upload-history.json"');
  process.exit(1);
}

try {
  console.log('📖 Reading file:', filePath);
  
  // Read the file
  const content = fs.readFileSync(filePath, 'utf8');
  const history = JSON.parse(content);
  
  if (!Array.isArray(history)) {
    console.error('❌ File content is not an array');
    process.exit(1);
  }
  
  console.log(`Found ${history.length} records`);
  
  // Convert all batchNumber to strings
  let fixedCount = 0;
  const fixedHistory = history.map(record => {
    if (typeof record.batchNumber === 'number') {
      fixedCount++;
      return {
        ...record,
        batchNumber: String(record.batchNumber)
      };
    }
    return record;
  });
  
  // Create backup
  const backupPath = filePath + '.backup';
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`✅ Backup created: ${backupPath}`);
  
  // Write fixed version
  fs.writeFileSync(filePath, JSON.stringify(fixedHistory, null, 2), 'utf8');
  console.log(`✅ Fixed ${fixedCount} records`);
  console.log(`✅ File updated: ${filePath}`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
