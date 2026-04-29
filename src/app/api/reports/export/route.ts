import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

interface ExportColumn {
  key: string;
  label: string;
}

/**
 * GET /api/reports/export - Export report data in various formats
 * Query params:
 *   - format: csv | pdf | xlsx
 *   - reportType: revenue | adr-revpar | occupancy | general
 *   - title: Report title
 *   - columns: JSON array of {key, label}
 *   - data: JSON array of data rows
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'reports.view') && !hasPermission(user, 'reports.export')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions to export reports' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const reportType = searchParams.get('reportType') || 'general';
    const title = searchParams.get('title') || 'Report';
    const columnsStr = searchParams.get('columns');
    const dataStr = searchParams.get('data');

    if (!dataStr) {
      return NextResponse.json(
        { success: false, error: 'No data provided for export' },
        { status: 400 }
      );
    }

    let columns: ExportColumn[] = [];
    let data: Record<string, unknown>[];

    try {
      columns = columnsStr ? JSON.parse(columnsStr) : [];
      data = JSON.parse(dataStr);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON data or columns' },
        { status: 400 }
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Data must be a non-empty array' },
        { status: 400 }
      );
    }

    const generatedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const tenant = user.tenant ? `${user.tenant.name}` : 'StaySuite';

    if (format === 'csv') {
      const csvContent = generateCSV(data, columns);
      const BOM = '\uFEFF';
      return new NextResponse(BOM + csvContent, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="${sanitizeFilename(title)}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (format === 'xlsx') {
      const csvContent = generateCSV(data, columns);
      const BOM = '\uFEFF';
      return new NextResponse(BOM + csvContent, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${sanitizeFilename(title)}-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
      const htmlContent = generateHTML(data, columns, title, generatedAt, tenant);
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html;charset=utf-8',
          'Content-Disposition': `inline; filename="${sanitizeFilename(title)}-${new Date().toISOString().split('T')[0]}.html"`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported format: ${format}. Use csv, pdf, or xlsx.` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function generateCSV(data: Record<string, unknown>[], columns: ExportColumn[]): string {
  const useColumns = columns.length > 0
    ? columns
    : Object.keys(data[0]).map(key => ({ key, label: key }));

  const headerRow = useColumns.map(col => escapeCSVValue(col.label)).join(',');
  const dataRows = data.map(row =>
    useColumns.map(col => escapeCSVValue(row[col.key])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

function generateHTML(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  title: string,
  generatedAt: string,
  tenant: string
): string {
  const useColumns = columns.length > 0
    ? columns
    : Object.keys(data[0]).map(key => ({ key, label: key }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e;
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }
    .header .meta {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .badge {
      display: inline-block;
      background: #f1f5f9;
      color: #475569;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead th {
      background: #f8fafc;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid #e2e8f0;
      color: #334155;
      white-space: nowrap;
    }
    thead th.text-right {
      text-align: right;
    }
    tbody td {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #475569;
    }
    tbody tr:nth-child(even) {
      background: #fafbfc;
    }
    tbody tr:hover {
      background: #f1f5f9;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .no-print {
      margin-bottom: 20px;
      text-align: center;
    }
    .btn-print {
      background: #0f172a;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-print:hover {
      background: #1e293b;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1>${title}</h1>
      <div class="meta">
        ${tenant} &middot; Generated on ${generatedAt}
      </div>
    </div>
    <div>
      <span class="badge">${data.length} records</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${useColumns.map(col => `<th>${col.label}</th>`).join('\n        ')}
      </tr>
    </thead>
    <tbody>
      ${data.map(row => `
      <tr>
        ${useColumns.map(col => `<td>${row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '-'}</td>`).join('\n        ')}
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>StaySuite HospitalityOS</span>
    <span>Confidential - For internal use only</span>
  </div>
</body>
</html>`;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}
