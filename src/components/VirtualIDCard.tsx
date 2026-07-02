'use client';
import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, RotateCw, MapPin, Phone, Mail, Globe } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

interface IDCardProps {
  user: any;
  brand: any;
  avatarSrc: string | null;
  imgError: boolean;
  onImgError: () => void;
}

export default function VirtualIDCard({ user, brand, avatarSrc, imgError, onImgError }: IDCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const designation = (user as any)?.designation?.name || (user as any)?.designation || 'Employee';
  const employeeId = (user as any)?.employeeId || '—';
  const companyName = brand?.companyName || 'FIX ANY PHOTO';
  const logoUrl = brand?.logoUrl ? `${BACKEND}${brand.logoUrl}` : null;
  const companyPhone = brand?.phone || '+880 1234 567890';
  const companyEmail = brand?.email || 'hr@fixanyphoto.com';
  const companyWebsite = brand?.website || 'www.fixanyphoto.com';
  const companyAddress = brand?.companyAddress || 'Salban, Rangpur, Bangladesh';

  const downloadHighResIDCard = async () => {
    if (!printRef.current) return;
    try {
      setIsDownloading(true);
      const canvas = await html2canvas(printRef.current, { scale: 4, useCORS: true, backgroundColor: null });
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // CR80 dimension (landscape containing both front and back side-by-side)
      // Standard CR80 is 54mm x 86mm. Two side-by-side is 108mm x 86mm.
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [108, 86] });
      pdf.addImage(imgData, 'PNG', 0, 0, 108, 86);
      pdf.save(`ID_Card_${employeeId}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const FrontCardUI = () => (
    <div className="w-[260px] h-[410px] bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200 flex flex-col relative text-center">
      {/* Lanyard Hole */}
      <div className="w-12 h-3 bg-gray-300 rounded-full mx-auto mt-3 shadow-inner" />
      
      {/* Header */}
      <div className="mt-4 mb-2 px-2 flex flex-col items-center justify-center h-12">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="max-h-8 object-contain mb-1" />
        ) : null}
        <h2 className="text-sm font-bold text-slate-800 leading-tight uppercase">{companyName}</h2>
      </div>

      {/* Middle Section (Photo) */}
      <div className="flex h-40 w-full relative">
        <div className="w-1/6 bg-[#007bff]" />
        <div className="w-4/6 h-full relative bg-gray-100 flex items-center justify-center overflow-hidden">
          {avatarSrc && !imgError ? (
            <img src={avatarSrc} alt="Profile" onError={onImgError} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-300 bg-gray-100">{initials}</div>
          )}
        </div>
        <div className="w-1/6 bg-[#e6005c]" />
      </div>

      {/* Footer Section */}
      <div className="flex-1 bg-white flex flex-col items-center pt-3 pb-4">
        <h1 className="text-xl font-extrabold text-gray-900 uppercase tracking-wide mt-2 px-2">{user?.name}</h1>
        <p className="text-sm font-bold text-[#e6005c] uppercase tracking-widest mt-1 border-b border-[#e6005c] inline-block pb-1 px-4">{designation}</p>
        
        <div className="mt-auto">
          <p className="text-xs font-bold text-gray-800 bg-gray-100 px-4 py-1.5 rounded-full uppercase tracking-widest border border-gray-200 shadow-sm">ID NO. {employeeId}</p>
        </div>
      </div>
    </div>
  );

  const BackCardUI = () => (
    <div className="w-[260px] h-[410px] bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200 flex flex-col relative">
      {/* Lanyard Hole */}
      <div className="w-12 h-3 bg-gray-300 rounded-full mx-auto mt-3 shadow-inner" />
      
      {/* Header */}
      <div className="mt-3 px-4 text-center">
        <h2 className="text-xs font-bold text-slate-800 uppercase leading-tight">{companyName}</h2>
      </div>

      {/* Terms & Conditions */}
      <div className="px-4 mt-3 flex-1">
        <h3 className="text-[10px] font-bold text-gray-900 mb-1 border-b pb-0.5 inline-block">Term & Condition</h3>
        <ol className="text-[8.5px] text-left text-gray-600 list-decimal pl-3 space-y-0.5 leading-snug">
          <li>This card is the property of {companyName}.</li>
          <li>It must be carried at all times while on duty.</li>
          <li>Transfer or misuse of this card is strictly prohibited.</li>
          <li>If found, please return to the company address.</li>
        </ol>
      </div>

      {/* Bottom Color Blocks & QR Code */}
      <div className="relative h-36 flex flex-col w-full">
        <div className="h-8 bg-[#007bff]" />
        <div className="h-28 bg-[#e6005c] pt-9 px-4 flex flex-col justify-end pb-3">
          {/* Contact Info */}
          <div className="space-y-1 mt-auto">
             <div className="flex items-center gap-1.5 text-white text-[8px]">
               <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
               <span className="truncate leading-none pt-0.5">{companyAddress}</span>
             </div>
             <div className="flex items-center gap-1.5 text-white text-[8px]">
               <Phone className="w-2.5 h-2.5 flex-shrink-0" />
               <span className="truncate leading-none pt-0.5">{companyPhone}</span>
             </div>
             <div className="flex items-center gap-1.5 text-white text-[8px]">
               <Mail className="w-2.5 h-2.5 flex-shrink-0" />
               <span className="truncate leading-none pt-0.5">{companyEmail}</span>
             </div>
             <div className="flex items-center gap-1.5 text-white text-[8px]">
               <Globe className="w-2.5 h-2.5 flex-shrink-0" />
               <span className="truncate leading-none pt-0.5">{companyWebsite}</span>
             </div>
          </div>
        </div>
        
        {/* QR Code */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 border-4 border-white bg-white w-16 h-16 rounded shadow-sm flex items-center justify-center">
          <QRCodeSVG value={employeeId} size={54} level="M" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Virtual ID Card</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsFlipped(f => !f)}
            className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/20 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            {isFlipped ? 'Front' : 'Back'}
          </button>
          <button
            onClick={downloadHighResIDCard}
            disabled={isDownloading}
            className="text-xs px-3 py-1.5 bg-brand-primary text-white hover:bg-brand-primary/90 rounded-lg font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> 
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Web View 3D Flippable Container */}
      <div className="w-[260px] h-[410px] mx-auto perspective-[1200px]">
        <div
          className="relative w-full h-full transition-transform duration-700 preserve-3d"
          style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Web FRONT */}
          <div className="absolute inset-0 backface-hidden">
            <FrontCardUI />
          </div>

          {/* Web BACK */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(180deg)' }}>
            <BackCardUI />
          </div>
        </div>
      </div>

      {/* Hidden container for High-Res HTML2Canvas capture (Side-by-side) */}
      <div className="absolute -left-[9999px] top-0 pointer-events-none opacity-0">
        <div ref={printRef} className="flex gap-0 bg-transparent p-4" style={{ width: '552px' }}> {/* 260+260 + 32 padding */}
          <FrontCardUI />
          <div className="w-8" /> {/* Gap between cards */}
          <BackCardUI />
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-2">Click "Back" to flip • Download for printing</p>
      
      <style dangerouslySetInnerHTML={{__html: `
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
      `}} />
    </div>
  );
}
