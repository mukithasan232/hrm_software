import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
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

export const exportToPDF = async (elementId: string, filename: string, title: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("Target PDF element not found in DOM");
    throw new Error('Target element not found');
  }

  const canvas = await html2canvas(element, {
    scale: 2, // Improves PDF quality
    useCORS: true, // Allows external images/avatars to render
    allowTaint: true,
    logging: true, // Enable temporarily to see what fails in the console
  });
  const imgData = canvas.toDataURL('image/png');
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 14, 15);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 22);

  pdf.addImage(imgData, 'PNG', 10, 30, pdfWidth - 20, pdfHeight - 20);

  pdf.save(`${filename}.pdf`);
};
