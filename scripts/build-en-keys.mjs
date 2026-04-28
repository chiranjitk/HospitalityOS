import fs from 'fs';
import path from 'path';

// Load extracted keys
const extracted = JSON.parse(fs.readFileSync('/home/z/my-project/StaySuite-HospitalityOS/scripts/extracted-keys.json', 'utf-8'));

// Load existing en.json
const en = JSON.parse(fs.readFileSync('/home/z/my-project/StaySuite-HospitalityOS/src/messages/en.json', 'utf-8'));

// Filter out noise keys
function isNoiseKey(key, value) {
  // Skip numeric keys
  if (/^\d+$/.test(key)) return true;
  // Skip very short keys that are just numbers
  if (/^\d/.test(key) && value.length < 20) return true;
  // Skip placeholder examples
  if (['john', 'doe', 'johncompanycom', '15550100', 'egfrontdesklead', 'egfrontdesklead', '0012Decimals', '011Decimal', '1WholeNumber', 'eg29abcde1234f1z5', 'eggstvatservicecharge'].includes(key)) return true;
  // Skip keys that are just symbols
  if (/^[•\s]+$/.test(value)) return true;
  // Skip empty string values
  if (!value || value.trim() === '') return true;
  // Skip template literal expressions (these shouldn't be translated via t())
  if (value.includes('${') && (value.includes('?') || value.includes('!'))) return true;
  // Skip values that are just HTML entities
  if (/^&[a-z]+;$/.test(value.trim())) return true;
  return false;
}

// Clean and merge keys
for (const [ns, keys] of Object.entries(extracted)) {
  if (!en[ns]) en[ns] = {};
  
  for (const [key, value] of Object.entries(keys)) {
    if (isNoiseKey(key, value)) continue;
    
    // Don't overwrite existing keys
    if (en[ns][key]) continue;
    
    // Clean up the value
    let cleanValue = String(value)
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    
    en[ns][key] = cleanValue;
  }
}

// Add layout keys for command palette
if (!en.layout) en.layout = {};
en.layout.commandPalette = 'Command Palette';
en.layout.noResultsFound = 'No results found';
en.layout.tryDifferentSearch = 'Try a different search term';
en.layout.navigationGroup = 'Navigation';
en.layout.actionsGroup = 'Actions';
en.layout.navigate = 'navigate';
en.layout.select = 'select';

// Add common keys for error boundary
if (!en.common) en.common = {};
en.common.somethingWentWrong = 'Something went wrong';
en.common.failedToLoad = 'Failed to load';
en.common.anUnexpectedErrorOccurredWhileLoadingThisSection = 'An unexpected error occurred while loading this section.';
en.common.tryAgain = 'Try Again';
en.common.unauthorizedAccess = 'Unauthorized Access';
en.common.accessDenied = 'Access Denied';
en.common.youDoNotHavePermissionToAccessThisSection = 'You do not have permission to access this section.';
en.common.noDataAvailable = 'No data available';
en.common.loadingData = 'Loading data...';
en.common.exportData = 'Export Data';
en.common.exportFormat = 'Export format';
en.common.exportComplete = 'Export complete';

// Write back en.json
fs.writeFileSync('/home/z/my-project/StaySuite-HospitalityOS/src/messages/en.json', JSON.stringify(en, null, 2) + '\n');

// Count keys per namespace
const counts = {};
for (const [ns, keys] of Object.entries(en)) {
  if (typeof keys === 'object') counts[ns] = Object.keys(keys).length;
}
console.log('Updated en.json with keys:');
for (const [ns, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ns}: ${count} keys`);
}
console.log(`Total namespaces: ${Object.keys(counts).length}`);
