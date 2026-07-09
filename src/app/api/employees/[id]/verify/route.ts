export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendMail } from '@/services/emailService';
import { jsPDF } from 'jspdf';
import { wrapHandler } from '@/lib/adapter';
import fs from 'fs';
import path from 'path';
import { toTitleCase } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { eventEmitter } from '@/lib/eventEmitter';



export const POST = wrapHandler(async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRoleStr = (user as any)?.role?.toUpperCase() || '';
    const hasAdminRoleArray = user?.roles?.some((r: any) => r.name?.toUpperCase().includes('ADMIN'));
    const isDesignationAdmin = String((user as any)?.designation || '').toUpperCase().includes('ADMIN');
    const isUserTypeAdmin = String((user as any)?.userType || '').toUpperCase().includes('ADMIN');

    const isAdmin = userRoleStr.includes('ADMIN') || hasAdminRoleArray || isDesignationAdmin || isUserTypeAdmin;

    if (!isAdmin) {
      console.log(`Forbidden Error: User attempted admin verification action. User data: `, { id: user.id, userType: user.userType });
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    const { action, baseSalary, salaryAccount } = req.body || {};
    const { id } = req.params;

    const employee = await prisma.user.findUnique({
      where: { id },
      include: { shift: true }
    });

    if (!employee) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validStatuses = ['PENDING_VERIFICATION', 'UNVERIFIED'];
    if (!validStatuses.includes(employee.verificationStatus)) {
      return res.status(400).json({ message: `Cannot perform action. Current status is ${employee.verificationStatus}` });
    }

    if (action === 'APPROVE') {
      if (!employee.documents || (Array.isArray(employee.documents) && employee.documents.length === 0)) {
        return res.status(400).json({ message: 'Cannot approve employee without verified documents.' });
      }

      const baseSalaryNum = parseFloat(baseSalary) || 0;
      const appointmentLetterFilename = `Appointment_Letter_${id}.pdf`;
      const appointmentLetterDbPath = `/uploads/documents/${appointmentLetterFilename}`;
      
      // 1. Update Database First
      await prisma.user.update({
        where: { id },
        data: {
          verificationStatus: 'ACTIVE',
          baseSalary: baseSalaryNum,
          appointmentLetter: appointmentLetterDbPath,
          ...(salaryAccount && { salaryAccount })
        }
      });

      // 2. Attempt PDF & Email (Secondary Goal)
      try {
      // Fetch Tenant Settings for Logo and Colors
      const settings = await prisma.tenantSettings.findFirst();
      const primaryColorHex = settings?.primaryColor || '#4f46e5';
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primaryColorHex);
      const rgb = result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 33, g: 37, b: 41 };
      
      const companyName = settings?.companyName || "FIX ANY PHOTO";
      const companyAddress = toTitleCase(settings?.companyAddress || "salban mistiripara, rangpur, dhaka bangladesh");

      // Generate Professional Corporate PDF
      const doc = new jsPDF();
      
      let currentY = 15;
      let hasLogo = false;
      
      // Header Section
      if (settings?.logoUrl) {
        try {
          const logoFilename = settings.logoUrl.split('/').pop();
          if (logoFilename) {
            const physicalPath = path.join(process.cwd(), 'public', 'storage', logoFilename);
            if (fs.existsSync(physicalPath)) {
              const logoBuffer = fs.readFileSync(physicalPath);
              const logoBase64 = logoBuffer.toString('base64');
              const ext = logoFilename.endsWith('.png') ? 'PNG' : 'JPEG';
              doc.addImage(logoBase64, ext, 20, 15, 25, 25);
              hasLogo = true;
            }
          }
        } catch (err) {
          console.error('Error adding logo to PDF:', err);
        }
      }
      
      const textStartX = hasLogo ? 50 : 20;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(rgb.r, rgb.g, rgb.b); // System Primary Color
      doc.text(companyName.toUpperCase(), textStartX, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(108, 117, 125); 
      doc.text(companyAddress, textStartX, 32);
      
      // Draw a line to separate header
      currentY = 45;
      doc.setDrawColor(200, 200, 200); 
      doc.setLineWidth(0.5);
      doc.line(20, currentY, 190, currentY);

      // Title
      currentY += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
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
      const finalBaseSalary = baseSalary ? baseSalary : employee.baseSalary;
      const salaryStr = finalBaseSalary ? `BDT ${Number(finalBaseSalary).toLocaleString()}` : 'TBD';
      
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

      // Signatures Area & Footer
      // Fetch signatures
      const adminSignatory = await (prisma.user as any).findFirst({
        where: {
          signatureUrl: { not: null },
          OR: [
            { userType: 'Admin' },
            { designation: { contains: 'Admin' } },
            { designation: { contains: 'CEO' } },
            { roles: { some: { name: { contains: 'Admin' } } } }
          ]
        }
      });
      const authorizedSignatureUrl = adminSignatory?.signatureUrl;
      const hrSignatureUrl = (user as any).signatureUrl;
      const employeeSignatureUrl = (employee as any).signatureUrl;

      const getBase64Image = (url: string | null | undefined) => {
        if (!url) return null;
        try {
          const filename = url.replace('/uploads/', '');
          if (!filename || url === filename) return null;
          
          let physicalPath = path.join(process.cwd(), 'public', 'uploads', filename);
          if (!fs.existsSync(physicalPath)) {
            physicalPath = path.join(process.cwd(), 'public', 'storage', filename);
          }
          
          if (fs.existsSync(physicalPath)) {
            const buffer = fs.readFileSync(physicalPath);
            const ext = filename.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
            return { base64: buffer.toString('base64'), ext };
          }
        } catch (e) {
          console.error('Error loading signature image:', e);
        }
        return null;
      };

      const authImg = getBase64Image(authorizedSignatureUrl);
      const hrImg = getBase64Image(hrSignatureUrl);
      const empImg = getBase64Image(employeeSignatureUrl);

      const pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width || 210;
      const pageHeight = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height || 297;
      const signatureY = pageHeight - 35; // Y position for the line

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(33, 37, 41);
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);

      // 1. Authorized Signatory (Left)
      const leftX = 15;
      if (authImg) {
          doc.addImage(authImg.base64, authImg.ext, leftX + 7.5, signatureY - 20, 35, 18);
      }
      doc.line(leftX, signatureY, leftX + 50, signatureY);
      doc.text("Authorized Signatory", leftX, signatureY + 6);

      // 2. HR Signature (Center)
      const centerX = (pageWidth / 2) - 25; 
      if (hrImg) {
          doc.addImage(hrImg.base64, hrImg.ext, centerX + 7.5, signatureY - 20, 35, 18);
      }
      doc.line(centerX, signatureY, centerX + 50, signatureY);
      doc.text("HR Signature", centerX, signatureY + 6);

      // 3. Employee Signature (Right)
      const rightX = pageWidth - 65;
      if (empImg) {
          doc.addImage(empImg.base64, empImg.ext, rightX + 7.5, signatureY - 20, 35, 18);
      }
      doc.line(rightX, signatureY, rightX + 50, signatureY);
      doc.text("Employee Signature", rightX, signatureY + 6);
      
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("This is a system generated document and is valid with authorized physical or digital signature.", 105, pageHeight - 12, { align: "center" });
      
      const currentYear = new Date().getFullYear();
      doc.setFontSize(8);
      doc.text(`© ${currentYear} ${companyName}. All rights reserved.`, 105, pageHeight - 7, { align: "center" });

      const pdfBuffer = doc.output('arraybuffer');
      
      const appointmentLetterFilename = `Appointment_Letter_${employee.id}.pdf`;
      const appointmentLetterPath = path.join(process.cwd(), 'public', 'storage', 'documents', appointmentLetterFilename);
      
      try {
        if (!fs.existsSync(path.join(process.cwd(), 'public', 'storage', 'documents'))) {
          fs.mkdirSync(path.join(process.cwd(), 'public', 'storage', 'documents'), { recursive: true });
        }
        fs.writeFileSync(appointmentLetterPath, Buffer.from(pdfBuffer));
      } catch(err) {
        console.error('Error saving appointment letter', err);
      }
      
      const appointmentLetterDbPath = `/uploads/documents/${appointmentLetterFilename}`;
      
      // Removed redundant second DB update since it is now in the first update

      const attachments: any[] = [
        {
          filename: 'Appointment_Letter.pdf',
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ];

      if (employee.documents && Array.isArray(employee.documents)) {
        for (const docUrl of employee.documents) {
          try {
            if (typeof docUrl !== 'string') continue;
            const urlParts = docUrl.split('/');
            const filename = urlParts[urlParts.length - 1];
            const physicalPath = path.join(process.cwd(), 'public', 'storage', 'documents', filename);
            if (fs.existsSync(physicalPath)) {
              const fileBuffer = fs.readFileSync(physicalPath);
              attachments.push({
                filename: filename,
                content: fileBuffer,
                contentType: filename.endsWith('.pdf') ? 'application/pdf' : (filename.endsWith('.png') ? 'image/png' : 'image/jpeg')
              });
            }
          } catch (e) {
            console.error('Error attaching document', e);
          }
        }
      }

      // Send Email
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;
      
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to the Team!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333333;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #f97316; padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">${companyName.toUpperCase()}</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">Welcome to the Team, ${toTitleCase(employee.name)}!</h2>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                                We are thrilled to have you onboard. Your document verification is complete, and your official Appointment Letter is attached to this email as a PDF.
                            </p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                                Below are your official system login credentials.
                            </p>
                            
                            <!-- Credentials Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; border-left: 4px solid #f97316; border-radius: 4px; margin: 25px 0; padding: 15px;">
                                <tr>
                                    <td style="padding-bottom: 10px; font-size: 15px;"><strong>Email:</strong> ${employee.email}</td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 10px; font-size: 15px;"><strong>Employee ID:</strong> ${employee.employeeId || 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 15px;"><strong>Password:</strong> <span style="background-color: #e5e7eb; padding: 3px 8px; border-radius: 4px; font-family: monospace;">(Created during registration)</span></td>
                                </tr>
                            </table>

                            <!-- Action Button -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="${loginUrl}" style="background-color: #1f2937; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; display: inline-block;">Login to Dashboard</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                                &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.<br>
                                This is an automated message, please do not reply.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      try {
        await sendMail({
          to: employee.email,
          subject: "Welcome to the Team - Login Credentials & Appointment Letter",
          html: emailHtml,
          attachments
        });
      } catch (emailErr) {
        console.error('Email sending failed during verification:', emailErr);
      }

      } catch (backgroundError: any) {
    require('fs').writeFileSync('pdf_crash.txt', backgroundError.stack || String(backgroundError));
    console.error("[PDF/EMAIL_ERROR] Failed to generate/send letter:", backgroundError);
  }

      // 3. Notify the employee via bell notification
      try {
        await prisma.notification.create({
          data: {
            userId: employee.id,
            titleEn: 'Account Activated!',
            titleBn: 'অ্যাকাউন্ট অ্যাক্টিভ হয়েছে!',
            messageEn: 'Congratulations! Your documents have been verified and your account is now active.',
            messageBn: 'অভিনন্দন! আপনার ডকুমেন্ট ভেরিফাই করা হয়েছে এবং আপনার অ্যাকাউন্ট এখন সক্রিয়।',
            type: 'SYSTEM',
            referenceId: employee.id,
          },
        });
        eventEmitter.emit('new-notification', {
          userId: employee.id,
          titleEn: 'Account Activated!',
          messageEn: 'Your documents have been verified. You can now log in to your dashboard.',
          type: 'SYSTEM',
        });
      } catch (notifErr) {
        console.error('[VERIFY] Failed to create activation notification:', notifErr);
      }

      revalidatePath('/dashboard/employees');
      revalidatePath('/dashboard/team/employees');
      // 4. Return Success with the updated user data for instant UI update
      return res.status(200).json({ 
        message: 'User verified successfully',
        employee: {
          id: employee.id,
          verificationStatus: 'ACTIVE',
          baseSalary: parseFloat(baseSalary) || 0,
        }
      });

    } else if (action === 'REJECT') {
      await prisma.user.update({
        where: { id },
        data: {
          verificationStatus: 'REJECTED',
          documents: []
        }
      });

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 30px;">
          <h2>Application Update</h2>
          <p>Dear ${employee.name},</p>
          <p>We regret to inform you that we are unable to proceed with your onboarding at this time as your documents could not be verified.</p>
          <p>Thank you for your interest.</p>
        </div>
      `;

      await sendMail({
        to: employee.email,
        subject: "Update on your onboarding application",
        html: emailHtml
      });

      // Notify the employee their docs were rejected
      try {
        await prisma.notification.create({
          data: {
            userId: employee.id,
            titleEn: 'Documents Rejected',
            titleBn: 'ডকুমেন্ট প্রত্যাখ্যান',
            messageEn: 'Your submitted documents could not be verified. Please re-upload valid documents.',
            messageBn: 'আপনার ডকুমেন্ট ভেরিফাই করা সম্ভব হয়নি। অনুগ্রহ করে পুনরায় আপলোড করুন।',
            type: 'SYSTEM',
            referenceId: employee.id,
          },
        });
        eventEmitter.emit('new-notification', {
          userId: employee.id,
          titleEn: 'Documents Rejected',
          messageEn: 'Your documents were rejected. Please re-upload valid documents.',
          type: 'SYSTEM',
        });
      } catch (notifErr) {
        console.error('[VERIFY] Failed to create rejection notification:', notifErr);
      }

      revalidatePath('/dashboard/employees');
      revalidatePath('/dashboard/team/employees');
      return res.status(200).json({ 
        message: 'User rejected',
        employee: {
          id: employee.id,
          verificationStatus: 'REJECTED',
        }
      });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (error: any) {
    console.error("[VERIFY_ROUTE_FATAL_ERROR]:", error);
    return res.status(500).json({ message: 'Verification failed', error: String(error) });
  }
});
