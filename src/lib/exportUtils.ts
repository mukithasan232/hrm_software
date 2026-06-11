import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBDDisplay } from './dateUtils';

export const exportToExcel = async (data: any[], filename: string, reportPeriod: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Export Data');

  if (data.length === 0) return;

  // Task 1: Corporate Header Setup
  // Row 1: Title
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Company Name';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 2: Subtitle
  worksheet.mergeCells('A2:J2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = `Attendance & Payroll Report - ${reportPeriod}`;
  subtitleCell.font = { bold: true, size: 12, italic: true };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 3: Empty spacing
  worksheet.addRow([]);

  // Task 2: Data Headers (Row 4)
  const headers = Object.keys(data[0]);
  worksheet.addRow(headers);

  // Task 4: Professional Styling for Header Row (Row 4)
  const headerRow = worksheet.getRow(4);
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
      if (rowNumber > 3) { // Only consider header and data rows
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
  brand?: { companyName: string; logoUrl: string | null }
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
    } catch (e) {
      doc.setFontSize(18);
      doc.setTextColor(30, 40, 50);
      doc.setFont('helvetica', 'bold');
      doc.text(brand?.companyName || 'HRM Portal', 40, startY + 25);
    }
    startY += 60;
  } else {
    doc.setFontSize(18);
    doc.setTextColor(30, 40, 50);
    doc.setFont('helvetica', 'bold');
    doc.text(brand?.companyName || 'HRM Portal', 40, startY + 15);
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

  const tableData = data.map(log => {
    const empName = log.employeeName || 'Unknown Employee';
    const timestampStr = log.formattedTimestamp || (log.timestamp ? toBDDisplay(log.timestamp, 'yyyy-MM-dd hh:mm:ss a') : 'N/A');
    const rawType = (log.punchType || '').toLowerCase();
    const punchType = rawType === 'checkin' ? 'Check In' : rawType === 'checkout' ? 'Check Out' : log.punchType;
    
    return [
      empName,
      timestampStr,
      punchType,
      log.deviceId || 'Manual/Network'
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Employee Name', 'Timestamp', 'Punch Type', 'Device / Location']],
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
      if (data.section === 'body' && data.column.index === 2) {
        if (data.cell.raw === 'Check In') {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'Check Out') {
          data.cell.styles.textColor = [249, 115, 22];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  doc.save(`${filename}.pdf`);
};
