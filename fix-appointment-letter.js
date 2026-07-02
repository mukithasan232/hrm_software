import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

const prisma = new PrismaClient();

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 33, g: 37, b: 41 };
}

export function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

async function main() {
  const email = 'mdmukithasan689@gmail.com';
  const employee = await prisma.user.findUnique({ 
    where: { email },
    include: { shift: true }
  });

  if (!employee) {
    console.log("User not found!");
    return;
  }

  const settings = await prisma.tenantSettings.findFirst();
  const primaryColorHex = settings?.primaryColor || '#4f46e5';
  const rgb = hexToRgb(primaryColorHex);
  const companyName = settings?.companyName || "FIX ANY PHOTO";
  const companyAddress = toTitleCase(settings?.companyAddress || "salban mistiripara, rangpur, dhaka bangladesh");

  const doc = new jsPDF();
  
  let currentY = 15;
  let hasLogo = false;
  
  // Header Section
  if (settings?.logoUrl) {
    try {
      const filename = settings.logoUrl.split('/').pop();
      const physicalPath = path.join(process.cwd(), 'public', 'storage', filename);
      if (fs.existsSync(physicalPath)) {
        const logoBuffer = fs.readFileSync(physicalPath);
        const logoBase64 = logoBuffer.toString('base64');
        const ext = filename.endsWith('.png') ? 'PNG' : 'JPEG';
        // Logo at Top Left Corner
        doc.addImage(logoBase64, ext, 20, 15, 25, 25);
        hasLogo = true;
      }
    } catch (err) {
      console.error('Error adding logo to PDF:', err);
    }
  }
  
  // Company Name & Address (Beside Logo or Left Aligned)
  const textStartX = hasLogo ? 50 : 20;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(rgb.r, rgb.g, rgb.b); // System Primary Color
  doc.text(companyName.toUpperCase(), textStartX, 25);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(108, 117, 125); 
  doc.text(companyAddress, textStartX, 32);
  
  // Line separator
  currentY = 45;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(20, currentY, 190, currentY);

  // Title
  currentY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16); // Smaller to save space
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text("APPOINTMENT LETTER", 105, currentY, { align: "center" });

  // Reference & Date
  currentY += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41); 
  const refNo = `Ref: FAP-HR/${new Date().getFullYear()}/${employee.employeeId || employee.id.substring(0,6)}`;
  doc.text(refNo, 20, currentY);
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Date: ${currentDate}`, 150, currentY);

  // Recipient Details
  currentY += 10;
  doc.setFont("helvetica", "bold");
  doc.text(`To,`, 20, currentY);
  doc.text(`${toTitleCase(employee.name)}`, 20, currentY + 5);
  doc.setFont("helvetica", "normal");
  doc.text(`Employee ID: ${employee.employeeId || 'N/A'}`, 20, currentY + 10);
  doc.text(`Email: ${employee.email}`, 20, currentY + 15);

  // Subject
  currentY += 25;
  doc.setFont("helvetica", "bold");
  doc.text(`Subject: Offer of Appointment for the position of ${toTitleCase(employee.designation || 'Employee')}`, 20, currentY);

  // Salutation
  currentY += 10;
  doc.setFont("helvetica", "normal");
  doc.text(`Dear ${toTitleCase(employee.name)},`, 20, currentY);

  // Body Paragraphs
  const bodyText1 = `With reference to your application and the subsequent interviews you had with us, we are pleased to offer you the position of "${toTitleCase(employee.designation || 'Employee')}" at ${companyName}. Your skills and experience will be an ideal fit for our creative and dynamic team.`;
  
  const joiningDateStr = new Date(employee.joiningDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const salaryStr = employee.baseSalary ? `BDT ${Number(employee.baseSalary).toLocaleString()}` : 'TBD';
  
  let empTypeStr = "Full-Time";
  if (employee.employeeType === "REMOTE") empTypeStr = "Remote";
  else if (employee.employeeType === "HYBRID") empTypeStr = "Hybrid";
  else if (employee.employeeType === "IN_HOUSE") empTypeStr = "In-House";
  
  const shiftStr = employee.shift ? `${toTitleCase(employee.shift.name)} (${employee.shift.startTime} - ${employee.shift.endTime})` : (employee.shiftStartTime && employee.shiftEndTime ? `${employee.shiftStartTime} - ${employee.shiftEndTime}` : 'Standard Working Hours');

  const bodyText2 = `Your employment details are as follows:`;

  // Render Text
  currentY += 8;
  const splitText1 = doc.splitTextToSize(bodyText1, 170);
  doc.text(splitText1, 20, currentY);
  
  currentY += (splitText1.length * 5) + 3;
  doc.text(bodyText2, 20, currentY);
  
  currentY += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Date of Joining:", 30, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(joiningDateStr, 70, currentY);

  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Department:", 30, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(toTitleCase(employee.department || 'General'), 70, currentY);

  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Employee Type:", 30, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(toTitleCase(empTypeStr), 70, currentY);

  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Working Shift:", 30, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(shiftStr, 70, currentY);

  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Base Salary:", 30, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${salaryStr} per month`, 70, currentY);
  
  currentY += 10;
  const bodyText3 = `You will be bound by the rules and regulations of ${companyName}, which may be amended from time to time. You are expected to perform your duties with utmost dedication and maintain strict confidentiality regarding all company affairs.`;
  const splitText3 = doc.splitTextToSize(bodyText3, 170);
  doc.text(splitText3, 20, currentY);

  currentY += (splitText3.length * 5) + 3;
  const bodyText4 = `We welcome you to the ${companyName} family and look forward to a long and mutually beneficial association. Please sign and return the duplicate copy of this letter as a token of your acceptance.`;
  const splitText4 = doc.splitTextToSize(bodyText4, 170);
  doc.text(splitText4, 20, currentY);

  // Signatures Area
  currentY += 30; // Push signatures safely below text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text(`For ${companyName}`, 20, currentY - 15);
  doc.text("Accepted By:", 140, currentY - 15);
  
  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(20, currentY, 70, currentY); // HR Signature line
  doc.line(140, currentY, 190, currentY); // Employee Signature line
  
  doc.text("Authorized Signatory", 20, currentY + 5);
  doc.text("Employee Signature", 140, currentY + 5);
  
  // Footer
  const pageHeight = doc.internal.pageSize.height || 297;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a system generated document and is valid with authorized physical or digital signature.", 105, pageHeight - 10, { align: "center" });

  const pdfBuffer = doc.output('arraybuffer');
  
  const appointmentLetterFilename = `Appointment_Letter_${employee.id}.pdf`;
  const appointmentLetterPath = path.join(process.cwd(), 'public', 'storage', 'documents', appointmentLetterFilename);
  
  fs.writeFileSync(appointmentLetterPath, Buffer.from(pdfBuffer));
  
  console.log("Appointment letter updated perfectly for:", employee.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
