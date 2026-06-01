import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

function getDaysArray(start: Date, end: Date) {
  const arr: Date[] = [];
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    arr.push(new Date(dt));
  }
  return arr;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    // Default to last 7 days if not provided
    const endDate = endParam ? new Date(endParam) : new Date();
    const startDate = startParam ? new Date(startParam) : new Date();
    if (!startParam) {
      startDate.setDate(endDate.getDate() - 6);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const days = getDaysArray(startDate, endDate);

    // Fetch users and their attendance within range
    const users = await prisma.user.findMany({
      where: { 
        customDesignation: { name: 'Employee' }, 
        isActive: true 
      },
      include: {
        customDesignation: true,
        attendanceLogs: {
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      orderBy: { employeeId: 'asc' },
    });

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HRM System';
    const worksheet = workbook.addWorksheet('Wages Sheet');

    // --- 1. COMPANY HEADER BLOCK ---
    worksheet.mergeCells('A1:P1'); // Assuming ~16 cols base + date cols
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Fix Any Photo';
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:P2');
    const addressCell = worksheet.getCell('A2');
    addressCell.value = 'Mistiripara, Shalbon, Rangpur, Bangladesh';
    addressCell.font = { name: 'Arial', size: 11 };
    addressCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A3:P3');
    const subtitleCell = worksheet.getCell('A3');
    const startStr = startDate.toLocaleDateString('en-GB');
    const endStr = endDate.toLocaleDateString('en-GB');
    subtitleCell.value = `Worker Wages Sheet for the Day Between ${startStr} and ${endStr}`;
    subtitleCell.font = { name: 'Arial', size: 12, bold: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Spacer
    worksheet.addRow([]);

    // --- 2. SUB-TABLE GRID ARCHITECTURE ---
    const headerRow5 = worksheet.getRow(5);
    const headerRow6 = worksheet.getRow(6);

    // Define Base Columns
    const baseColsBefore = ['SL', 'ID NO', 'NAME', 'DESIGNATION', '8-Hour Basic\nSalary Rate'];
    let colIdx = 1;

    baseColsBefore.forEach((colName) => {
      worksheet.mergeCells(5, colIdx, 6, colIdx);
      const cell = worksheet.getCell(5, colIdx);
      cell.value = colName;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      colIdx++;
    });

    // Dynamic Date Columns Header (Merged 'Working Hours')
    const dateStartCol = colIdx;
    const dateEndCol = colIdx + days.length - 1;
    if (days.length > 0) {
      worksheet.mergeCells(5, dateStartCol, 5, dateEndCol);
      const workHoursHeader = worksheet.getCell(5, dateStartCol);
      workHoursHeader.value = 'Working Hours';
      workHoursHeader.alignment = { horizontal: 'center', vertical: 'middle' };
      workHoursHeader.font = { bold: true };
      workHoursHeader.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      days.forEach((day, i) => {
        const cell = worksheet.getCell(6, dateStartCol + i);
        cell.value = day.getDate(); // Just the date number
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        colIdx++;
      });
    }

    // Base Columns After Dates
    const baseColsAfter = [
      'Basic\nWork Hour', 'Extra\nOT Hour', 'Total\nWork Hour', 
      'Basic\nSalary', 'Extra Working\nSalary', 'Night\nAllow.', 
      'Attend\nBonus', 'Total\nSalary', 'Account No', 'REMARKS'
    ];

    baseColsAfter.forEach((colName) => {
      worksheet.mergeCells(5, colIdx, 6, colIdx);
      const cell = worksheet.getCell(5, colIdx);
      cell.value = colName;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      colIdx++;
    });

    const totalColumns = colIdx - 1;
    // Fix merge limits for the titles now that we know the total columns
    worksheet.unMergeCells('A1:P1'); worksheet.mergeCells(1, 1, 1, totalColumns);
    worksheet.unMergeCells('A2:P2'); worksheet.mergeCells(2, 1, 2, totalColumns);
    worksheet.unMergeCells('A3:P3'); worksheet.mergeCells(3, 1, 3, totalColumns);

    // Set row heights
    headerRow5.height = 25;
    headerRow6.height = 25;

    // Set Column Widths roughly
    worksheet.getColumn(1).width = 5;  // SL
    worksheet.getColumn(2).width = 12; // ID
    worksheet.getColumn(3).width = 25; // NAME
    worksheet.getColumn(4).width = 18; // DESIGNATION
    worksheet.getColumn(5).width = 12; // Basic Rate

    // Date cols width
    for (let i = 0; i < days.length; i++) {
      worksheet.getColumn(dateStartCol + i).width = 6;
    }

    // Adjust remaining cols
    for (let i = dateEndCol + 1; i <= totalColumns; i++) {
      worksheet.getColumn(i).width = 12;
    }
    worksheet.getColumn(totalColumns).width = 20; // REMARKS

    // --- 3. DYNAMIC DATA & FORMULAS ---
    let currentRow = 7;
    users.forEach((user, index) => {
      const row = worksheet.getRow(currentRow);
      
      // Basic Info
      row.getCell(1).value = index + 1;
      row.getCell(2).value = user.employeeId;
      row.getCell(3).value = user.name;
      row.getCell(4).value = user.customDesignation?.name || 'Worker';
      
      const basicSalaryRate = user.baseSalary > 0 ? user.baseSalary : 500; // default 500
      row.getCell(5).value = basicSalaryRate;

      let totalRegularHours = 0;
      let totalOvertimeHours = 0;

      // Real logic calculating actual hours based on earliest CheckIn and latest CheckOut
      days.forEach((day, i) => {
        const logsForDay = user.attendanceLogs.filter(log => 
          new Date(log.timestamp).toDateString() === day.toDateString()
        ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        let regularHours = 0;
        let overtimeHours = 0;
        let cellString = '0/0';
        
        if (logsForDay.length > 0) {
          const checkIns = logsForDay.filter(l => l.punchType === 'CheckIn');
          const checkOuts = logsForDay.filter(l => l.punchType === 'CheckOut');
          
          if (checkIns.length > 0 && checkOuts.length > 0) {
            const firstCheckIn = new Date(checkIns[0].timestamp);
            const lastCheckOut = new Date(checkOuts[checkOuts.length - 1].timestamp);
            
            if (lastCheckOut > firstCheckIn) {
              const diffMs = lastCheckOut.getTime() - firstCheckIn.getTime();
              const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
              
              if (totalHours > 8) {
                regularHours = 8;
                overtimeHours = Math.round((totalHours - 8) * 100) / 100;
              } else {
                regularHours = totalHours;
              }
              
              cellString = `${regularHours}/${overtimeHours}`;
            }
          }
        }
        
        totalRegularHours += regularHours;
        totalOvertimeHours += overtimeHours;
        row.getCell(dateStartCol + i).value = cellString;
      });

      // Let's build cell references for formulas
      const getColLetter = (colNum: number) => worksheet.getColumn(colNum).letter;
      
      const basicRateCol = getColLetter(5);
      const basicWorkHrCol = getColLetter(dateEndCol + 1);
      const extraOtHrCol = getColLetter(dateEndCol + 2);
      const basicSalaryCol = getColLetter(dateEndCol + 4);
      const extraWorkSalCol = getColLetter(dateEndCol + 5);
      const nightAllowCol = getColLetter(dateEndCol + 6);
      const attendBonusCol = getColLetter(dateEndCol + 7);

      // Formulas / Values
      // Basic Work Hour & Extra OT Hour directly calculated instead of horizontal SUM
      row.getCell(dateEndCol + 1).value = Math.round(totalRegularHours * 100) / 100;
      row.getCell(dateEndCol + 2).value = Math.round(totalOvertimeHours * 100) / 100; 
      
      // Total Work Hour: Basic + Extra OT
      row.getCell(dateEndCol + 3).value = { formula: `${basicWorkHrCol}${currentRow}+${extraOtHrCol}${currentRow}`, date1904: false };
      
      // Basic Salary: (BasicWorkHr / 8) * BasicRate
      row.getCell(dateEndCol + 4).value = { formula: `(${basicWorkHrCol}${currentRow}/8)*${basicRateCol}${currentRow}`, date1904: false };
      
      // Extra Working Salary (mock 0)
      row.getCell(dateEndCol + 5).value = 0;
      
      // Night Allowance (mock 0)
      row.getCell(dateEndCol + 6).value = 0;
      
      // Attend Bonus (mock 0)
      row.getCell(dateEndCol + 7).value = 0;
      
      // Total Salary: BasicSalary + ExtraSal + Night + Bonus
      row.getCell(dateEndCol + 8).value = { 
        formula: `SUM(${basicSalaryCol}${currentRow},${extraWorkSalCol}${currentRow},${nightAllowCol}${currentRow},${attendBonusCol}${currentRow})`,
        date1904: false 
      };

      // Account No
      row.getCell(dateEndCol + 9).value = 'N/A';
      
      // REMARKS
      row.getCell(dateEndCol + 10).value = '';

      // Apply borders and center alignment
      for (let c = 1; c <= totalColumns; c++) {
        const cell = row.getCell(c);
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      currentRow++;
    });

    // --- 4. PAGE TOTALS & STYLING GUARDS ---
    const totalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, dateEndCol);
    const totalLabelCell = totalRow.getCell(1);
    totalLabelCell.value = 'PAGE TOTAL / GRAND TOTAL';
    totalLabelCell.font = { bold: true };
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Summation Formulas for Totals
    const startDataRow = 7;
    const endDataRow = currentRow - 1;
    
    // Add border to merged total label
    for (let c = 1; c <= dateEndCol; c++) {
      totalRow.getCell(c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    if (users.length > 0) {
      for (let c = dateEndCol + 1; c <= totalColumns - 2; c++) {
        const colLetter = worksheet.getColumn(c).letter;
        const cell = totalRow.getCell(c);
        cell.value = { formula: `SUM(${colLetter}${startDataRow}:${colLetter}${endDataRow})`, date1904: false };
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
    
    // Borders for remaining empty cells in total row
    totalRow.getCell(totalColumns - 1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    totalRow.getCell(totalColumns).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    currentRow++;

    // Tk. In Word
    const wordRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, totalColumns);
    const wordCell = wordRow.getCell(1);
    wordCell.value = 'Tk. In Word: _________________________________________________________________________________';
    wordCell.font = { italic: true, bold: true };
    wordCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Wages_Sheet_${startStr.replace(/\//g, '-')}_to_${endStr.replace(/\//g, '-')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return NextResponse.json({ error: 'Failed to generate Excel file' }, { status: 500 });
  }
}
