import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBDDisplay } from './dateUtils';
import { format } from 'date-fns';

export const exportToExcel = async (
  data: any[],
  filename: string,
  reportPeriod: string,
  brand?: { companyName: string; companyAddress?: string | null; logoUrl?: string | null }
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Export Data');

  if (data.length === 0) return;

  // Task 1: Corporate Header Setup
  // Row 1: Title
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = brand?.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Fix Any Photo';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  let currentHeaderRow = 1;

  // Optional Row: Company Address
  if (brand?.companyAddress) {
    currentHeaderRow++;
    worksheet.mergeCells(`A${currentHeaderRow}:J${currentHeaderRow}`);
    const addressCell = worksheet.getCell(`A${currentHeaderRow}`);
    addressCell.value = brand.companyAddress;
    addressCell.font = { size: 10, italic: true };
    addressCell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // Next Row: Subtitle
  currentHeaderRow++;
  worksheet.mergeCells(`A${currentHeaderRow}:J${currentHeaderRow}`);
  const subtitleCell = worksheet.getCell(`A${currentHeaderRow}`);
  subtitleCell.value = reportPeriod.includes('Report') ? reportPeriod : `Attendance & Payroll Report - ${reportPeriod === 'All Time' ? 'All Time' : format(new Date(), 'MMM dd, yyyy')}`;
  subtitleCell.font = { bold: true, size: 12, italic: true };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Empty spacing
  worksheet.addRow([]);

  // Task 2: Data Headers
  const headers = Object.keys(data[0]);
  const dataHeaderRowNumber = currentHeaderRow + 2;
  worksheet.addRow(headers);

  // Task 4: Professional Styling for Header Row
  const headerRow = worksheet.getRow(dataHeaderRowNumber);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo/Light Blue
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add data rows
  data.forEach((item) => {
    const row = worksheet.addRow(Object.values(item));
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  });

  // Task 4: Dynamically adjust column widths
  worksheet.columns.forEach((column, index) => {
    if (!column) return;
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > dataHeaderRowNumber - 1) { // Only consider header and data rows
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      }
    });
    // Give "Employee Name" extra width naturally
    column.width = maxLength < 12 ? 12 : maxLength + 2;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const exportToPDF = async (
  data: any[],
  filename: string,
  title: string,
  brand?: { companyName: string; companyAddress?: string | null; logoUrl?: string | null }
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'A4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let startY = 40;

  if (brand?.logoUrl) {
    try {
      doc.addImage(brand.logoUrl, 'PNG', 40, startY, 40, 40);
      doc.setFontSize(18);
      doc.setTextColor(30, 40, 50);
      doc.setFont('helvetica', 'bold');
      doc.text(brand.companyName || 'HRM Portal', 90, startY + 25);
      if (brand.companyAddress) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(brand.companyAddress, 90, startY + 40);
        startY += 10;
      }
    } catch (e) {
      doc.setFontSize(18);
      doc.setTextColor(30, 40, 50);
      doc.setFont('helvetica', 'bold');
      doc.text(brand?.companyName || 'HRM Portal', 40, startY + 25);
      if (brand?.companyAddress) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(brand.companyAddress, 40, startY + 40);
        startY += 10;
      }
    }
    startY += 60;
  } else {
    doc.setFontSize(18);
    doc.setTextColor(30, 40, 50);
    doc.setFont('helvetica', 'bold');
    doc.text(brand?.companyName || 'HRM Portal', 40, startY + 15);
    if (brand?.companyAddress) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(brand.companyAddress, 40, startY + 30);
      startY += 10;
    }
    startY += 50;
  }

  doc.setFontSize(14);
  doc.setTextColor(50, 60, 70);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 40, startY);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated Date: ${new Date().toLocaleString()}`, 40, startY + 15);

  startY += 35;

  const formatMs = (ms: number) => {
    if (!ms || ms <= 0) return '0h 0m';
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const tableData = data.map(session => {
    const empName = session.employeeName || 'Unknown Employee';
    const dateStr = session.date || 'N/A';
    
    const checkInTime = session.checkInRaw ? toBDDisplay(session.checkInRaw, 'hh:mm a') : 'Missing';
    
    let checkOutTime = 'Missing / Working';
    if (session.checkOutRaw) {
      checkOutTime = toBDDisplay(session.checkOutRaw, 'hh:mm a');
      if (session.isAutoCheckout) {
        checkOutTime += ' (Auto)';
      }
    } else if (session.isMissingOut) {
      checkOutTime = 'Missing';
    }

    const totalHours = formatMs(session.totalValidMs);
    
    return [
      empName,
      dateStr,
      checkInTime,
      checkOutTime,
      totalHours
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Employee Name', 'Date', 'Check In Time', 'Check Out Time', 'Total Hours']],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: [50, 50, 50],
      lineColor: [230, 230, 230],
      lineWidth: 0.5,
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [253, 253, 253],
    },
    didParseCell: function (data) {
      if (data.section === 'body') {
        if (data.column.index === 3) {
          if (data.cell.raw && typeof data.cell.raw === 'string' && data.cell.raw.includes('(Auto)')) {
            data.cell.styles.textColor = [249, 115, 22]; // Orange for Auto-Checkout
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    }
  });

  doc.save(`${filename}.pdf`);
};
