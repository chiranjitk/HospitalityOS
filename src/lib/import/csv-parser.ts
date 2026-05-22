/**
 * Simple CSV Parser
 *
 * Handles quoted fields, commas within values, different line endings (\\r\\n, \\n, \\r).
 * Returns an array of objects using CSV headers as keys.
 */

export interface CsvParseOptions {
  /** Custom delimiter (default: ',') */
  delimiter?: string;
  /** Maximum number of rows to parse (default: 10000) */
  maxRows?: number;
}

export interface CsvParseError {
  row: number;
  column: string;
  value: string;
  message: string;
}

export interface CsvParseResult<T = Record<string, string>> {
  headers: string[];
  rows: T[];
  totalRows: number;
  errors: CsvParseError[];
}

/**
 * Parse a CSV string into an array of objects.
 */
export function parseCsv<T = Record<string, string>>(
  csv: string,
  options: CsvParseOptions = {},
): CsvParseResult<T> {
  const { delimiter = ',', maxRows = 10000 } = options;

  // Normalize line endings
  const normalized = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errors: [] };
  }

  // Parse header row
  const headers = parseCsvLine(lines[0], delimiter);
  const rows: T[] = [];
  const errors: CsvParseError[] = [];

  for (let i = 1; i < lines.length && i <= maxRows; i++) {
    const values = parseCsvLine(lines[i], delimiter);

    if (values.length === 0 || (values.length === 1 && values[0] === '')) {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim();
      const value = (values[j] || '').trim();
      row[header] = value;
    }

    rows.push(row as T);
  }

  return { headers, rows, totalRows: rows.length, errors };
}

/**
 * Parse a single CSV line respecting quoted fields.
 * Quoted fields can contain commas, newlines, and escaped quotes ("").
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Validate a row of guest data for bulk import.
 * Returns an array of error messages (empty if valid).
 */
export function validateGuestRow(
  row: Record<string, string>,
  rowIndex: number,
): string[] {
  const errors: string[] = [];

  if (!row.firstName || row.firstName.trim().length === 0) {
    errors.push(`Row ${rowIndex + 1}: firstName is required`);
  }
  if (!row.lastName || row.lastName.trim().length === 0) {
    errors.push(`Row ${rowIndex + 1}: lastName is required`);
  }

  if (row.email && row.email.trim().length > 0) {
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email.trim())) {
      errors.push(`Row ${rowIndex + 1}: Invalid email format "${row.email}"`);
    }
  }

  if (row.phone && row.phone.trim().length > 0) {
    // Phone: allow digits, spaces, +, -, (, )
    const phoneRegex = /^[\d\s\-\+(\)]+$/;
    if (!phoneRegex.test(row.phone.trim())) {
      errors.push(`Row ${rowIndex + 1}: Invalid phone format "${row.phone}"`);
    }
  }

  // Validate idType if provided
  const validIdTypes = ['passport', 'national_id', 'drivers_license', 'aadhaar', 'ssn', 'other'];
  if (row.idType && !validIdTypes.includes(row.idType.trim().toLowerCase())) {
    errors.push(`Row ${rowIndex + 1}: Invalid idType "${row.idType}". Must be one of: ${validIdTypes.join(', ')}`);
  }

  return errors;
}
