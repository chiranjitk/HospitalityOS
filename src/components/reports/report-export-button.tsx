'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react';
import { toast } from 'sonner';

interface ExportColumn {
  key: string;
  label: string;
}

interface ReportExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  columns: ExportColumn[];
  reportTitle?: string;
  reportType?: string;
}

export function ReportExportButton({
  data,
  filename,
  columns,
  reportTitle = filename,
  reportType = 'general',
}: ReportExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'pdf' | 'xlsx') => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        reportType,
        title: reportTitle,
        columns: JSON.stringify(columns),
        data: JSON.stringify(data),
      });

      const response = await fetch(`/api/reports/export?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      if (format === 'pdf') {
        // For PDF, open the HTML in a new window for printing
        const html = await response.text();
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(html);
          newWindow.document.close();
        } else {
          toast.info('Please allow popups to open the print dialog');
        }
        toast.success('Report opened for printing');
      } else {
        // For CSV and XLSX, trigger download
        const contentType = response.headers.get('content-type') || '';
        const contentDisposition = response.headers.get('content-disposition') || '';
        const blob = await response.blob();

        // Extract filename from content-disposition or generate one
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        const downloadFilename = filenameMatch?.[1]?.replace(/['"]/g, '') || `${filename}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exported as ${format.toUpperCase()} successfully`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={exporting || !data || data.length === 0}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <File className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
