import fs from 'fs';
import path from 'path';

const BASE = path.resolve('/home/z/my-project/StaySuite-HospitalityOS/src/components');

const DIR_NAMESPACE = {
  admin: 'admin', settings: 'settings', channels: 'channels', crm: 'crm',
  marketing: 'marketing', automation: 'automation', inventory: 'inventory',
  events: 'events', ai: 'ai', notifications: 'notifications', staff: 'staff',
  integrations: 'integrations', webhooks: 'webhooks', help: 'help',
  parking: 'parking', iot: 'iot', chain: 'chain', ads: 'ads', auth: 'auth',
  portal: 'portal', gdpr: 'gdpr', audit: 'audit', common: 'common',
  communication: 'communication', layout: 'layout', profile: 'profile',
};

// Known common keys to skip
const COMMON_KEYS = new Set([
  'save', 'cancel', 'delete', 'edit', 'add', 'create', 'update', 'search',
  'filter', 'export', 'import', 'refresh', 'loading', 'noData', 'confirm',
  'back', 'next', 'previous', 'submit', 'reset', 'clear', 'close', 'view',
  'download', 'upload', 'copy', 'copied', 'select', 'selectAll', 'deselectAll',
  'actions', 'status', 'details', 'settings', 'help', 'error', 'success',
  'warning', 'info', 'yes', 'no', 'all', 'none', 'enabled', 'disabled',
  'active', 'inactive', 'profile', 'notifications', 'language', 'theme',
  'logout', 'login', 'email', 'password', 'name', 'description',
  'quickActions', 'markAllRead', 'noNotifications', 'allCaughtUp', 'viewAll',
  'searchAnything', 'toggleMenu', 'selectLanguage', 'pending', 'inProgress',
  'completed',
]);

// Known status keys to skip
const STATUS_KEYS = new Set([
  'active', 'inactive', 'pending', 'confirmed', 'checkedIn', 'checkedOut',
  'cancelled', 'noShow', 'available', 'occupied', 'maintenance', 'outOfOrder',
  'dirty', 'clean', 'inspected', 'processing', 'completed', 'failed', 'draft',
  'published', 'expired', 'trial', 'suspended', 'verified', 'rejected',
]);

function extractStrings(filePath, namespace) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const strings = [];
  
  // Skip files that don't have the hook yet
  if (!content.includes("useTranslations('" + namespace + "')") && 
      !content.includes(`useTranslations("${namespace}")`)) {
    return strings;
  }

  // Pattern 1: >Text content< (JSX text)
  const jsxTextRegex = />\s*([A-Z][a-zA-Z\s&;'()\-/:,.!?]+?)\s*</g;
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && s.length < 100 && !s.includes('{') && !s.includes('}')) {
      strings.push(s);
    }
  }

  // Pattern 2: placeholder="Some text"
  const placeholderRegex = /placeholder="([^"]+)"/g;
  while ((match = placeholderRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && s.length < 80) {
      strings.push(s);
    }
  }

  // Pattern 3: title="Some text"
  const titleRegex = /title="([^"]+)"/g;
  while ((match = titleRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && s.length < 80) {
      strings.push(s);
    }
  }

  // Pattern 4: CardTitle/CardDescription content
  const cardDescRegex = /<CardDescription>([^<]+)<\/CardDescription>/g;
  while ((match = cardDescRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2) strings.push(s);
  }

  // Pattern 5: DialogTitle content
  const dialogTitleRegex = /<DialogTitle>([^<{]+)<\/DialogTitle>/g;
  while ((match = dialogTitleRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && !s.includes('}')) strings.push(s);
  }

  // Pattern 6: DialogDescription content  
  const dialogDescRegex = /<DialogDescription>([^<{]+)<\/DialogDescription>/g;
  while ((match = dialogDescRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && !s.includes('}')) strings.push(s);
  }

  // Pattern 7: toast.error/success("text")
  const toastRegex = /toast\.(error|success|warning|info)\(['"`]([^'"`]+)['"`]\)/g;
  while ((match = toastRegex.exec(content)) !== null) {
    const s = match[2].trim();
    if (s.length >= 2) strings.push(s);
  }

  // Pattern 8: TableHead content
  const tableHeadRegex = /<TableHead[^>]*>([^<]+)<\/TableHead>/g;
  while ((match = tableHeadRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && s.length < 50) strings.push(s);
  }

  // Pattern 9: h2/h3 text content
  const headingRegex = /<h[23][^>]*>\s*([^<{<]+?)\s*<\/h[23]>/g;
  while ((match = headingRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 3 && !s.includes('}')) strings.push(s);
  }

  // Pattern 10: CardTitle content
  const cardTitleRegex = /<CardTitle[^>]*>([^<{]+?)\s*<\/CardTitle>/g;
  while ((match = cardTitleRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && !s.includes('}')) strings.push(s);
  }
  
  // Pattern 11: Label content
  const labelRegex = /<Label[^>]*>([^<{]+?)\s*<\/Label>/g;
  while ((match = labelRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 1 && !s.includes('}') && s.length < 50) strings.push(s);
  }

  // Pattern 12: SelectItem content
  const selectItemRegex = /<SelectItem[^>]*>([^<{]+?)\s*<\/SelectItem>/g;
  while ((match = selectItemRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 1 && !s.includes('}') && s.length < 50) strings.push(s);
  }

  // Pattern 13: <p> text content in empty states
  const pTagRegex = /<p className="[^"]*text-muted-foreground[^"]*">\s*([^<{<]+?)\s*<\/p>/g;
  while ((match = pTagRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 3 && !s.includes('}')) strings.push(s);
  }

  // Pattern 14: AlertDialogTitle content
  const alertTitleRegex = /<AlertDialogTitle>([^<{]+)<\/AlertDialogTitle>/g;
  while ((match = alertTitleRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && !s.includes('}')) strings.push(s);
  }

  // Pattern 15: AlertDialogDescription content
  const alertDescRegex = /<AlertDialogDescription>([^<{]+)<\/AlertDialogDescription>/g;
  while ((match = alertDescRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && !s.includes('}')) strings.push(s);
  }

  // Pattern 16: DropdownMenuItem text after icon
  const dropdownRegex = />\s*([A-Z][a-zA-Z\s]+?)\s*<\/DropdownMenuItem>/g;
  while ((match = dropdownRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && s.length < 40) strings.push(s);
  }

  // Pattern 17: TooltipContent
  const tooltipRegex = /<TooltipContent>([^<]+)<\/TooltipContent>/g;
  while ((match = tooltipRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2) strings.push(s);
  }

  // Pattern 18: AlertTitle
  const alertTitle2Regex = /<AlertTitle>([^<]+)<\/AlertTitle>/g;
  while ((match = alertTitle2Regex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2) strings.push(s);
  }

  // Pattern 19: AlertDescription
  const alertDesc2Regex = /<AlertDescription>([^<{]+)<\/AlertDescription>/g;
  while ((match = alertDesc2Regex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && !s.includes('}')) strings.push(s);
  }

  // Pattern 20: span text content
  const spanRegex = /<span className="[^"]*text-sm[^"]*">\s*([^<{<]+?)\s*<\/span>/g;
  while ((match = spanRegex.exec(content)) !== null) {
    const s = match[1].trim();
    if (s.length >= 2 && !s.includes('}') && !/^\d/.test(s) && s.length < 60) strings.push(s);
  }

  return [...new Set(strings)];
}

function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function toSnakeCase(str) {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .join('_');
}

// Process all files
const nsStrings = {};
for (const [dir, ns] of Object.entries(DIR_NAMESPACE)) {
  const dirPath = path.join(BASE, dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.tsx'))) {
    const strings = extractStrings(path.join(dirPath, f), ns);
    if (strings.length > 0) {
      if (!nsStrings[ns]) nsStrings[ns] = [];
      for (const s of strings) {
        nsStrings[ns].push({ file: f, string: s, key: toCamelCase(s) });
      }
    }
  }
}

// Generate JSON output
const output = {};
for (const [ns, items] of Object.entries(nsStrings)) {
  output[ns] = {};
  const keyCount = {};
  for (const item of items) {
    let key = item.key;
    // Deduplicate keys
    if (keyCount[key] !== undefined) {
      keyCount[key]++;
      key = `${key}_${keyCount[key]}`;
    } else {
      keyCount[key] = 0;
    }
    if (!output[ns][key]) {
      output[ns][key] = item.string;
    }
  }
}

// Write output
fs.writeFileSync('/home/z/my-project/StaySuite-HospitalityOS/scripts/extracted-keys.json', JSON.stringify(output, null, 2));
console.log('Extracted keys written to scripts/extracted-keys.json');

// Print summary
for (const [ns, keys] of Object.entries(output)) {
  console.log(`${ns}: ${Object.keys(keys).length} keys`);
}
