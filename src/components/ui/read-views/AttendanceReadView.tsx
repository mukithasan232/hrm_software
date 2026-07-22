'use client';
import { useTranslation } from '@/context/LanguageContext';
import { Clock, Calendar, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, TrashIcon, Smartphone, Globe, Pencil } from 'lucide-react';
import { toBDDisplay } from '@/lib/dateUtils';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatMinutes } from '@/utils/attendanceUtils';

interface AttendanceReadViewProps {
  id: string | number;
  initialData?: any;
}

export default function AttendanceReadView({ id, initialData }: AttendanceReadViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  // ── RBAC: derive admin status from the current logged-in user ──────────────
  const { user: currentUser } = useAuth();
  const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'hrm manager'];
  const designName = typeof currentUser?.designation === 'object'
    ? (currentUser?.designation as any)?.name
    : currentUser?.designation;
  const isAdmin =
    ADMIN_DESIGNATIONS.includes((designName || '').toLowerCase()) ||
    (currentUser as any)?.roles?.some((r: any) =>
      ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase())
    ) ||
    false;
  
  if (!initialData) {
    return <div className="text-center p-6 text-slate-500">No attendance data provided.</div>;
  }

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteSession = async (session: any) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) return;
    
    // Extract valid IDs from the session object
    const idsToDelete = [session.id, session.checkIn?.id, session.checkOut?.id].filter(Boolean);
    
    if (idsToDelete.length === 0) return;
    
    setIsDeleting(session.id || 'deleting');
    try {
      const response = await fetch(`/api/attendance/delete-logs`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToDelete })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to delete logs');
      }

    toast.success('Session deleted successfully');
    window.location.reload(); 
  } catch (error: any) {
    console.error('Delete Session Error:', error);
    toast.error(error.message || 'Failed to delete session');
  } finally {
      setIsDeleting(null);
    }
  };

  const {
    employeeName,
    employeeId,
    date,
    lateMinutes,
    overtimeMinutes,
    systemCalculatedOtMinutes,
    otBadge,
    status,
    punchTimeline
  } = initialData;

  // --- NATIVE DATABASE PAIRING (Using True Device States) ---
  const pairedSessions = (punchTimeline || []).map((session: any) => ({
    id: session.id, // Explicitly pass the main DB record ID
    checkIn: { timestamp: session.timestamp, id: session.id },
    checkOut: session.checkOut ? { timestamp: session.checkOut } : null,
    inSource: session.deviceId,
    outSource: session.checkOutDeviceId,
    isManualIn: session.isManualIn || (session.deviceId || '').includes('Manual'),
    isManualOut: session.isManualOut || (session.checkOutDeviceId || '').includes('Manual'),
    inLatitude: session.latitude,
    inLongitude: session.longitude,
    inAddress: session.locationAddress,
    outLatitude: session.checkOut ? session.latitude : null,
    outLongitude: session.checkOut ? session.longitude : null,
    outAddress: session.checkOut ? session.locationAddress : null
  }));

  let totalValidMinutes = 0;
  pairedSessions.forEach((s: any) => {
    if (s.checkIn && s.checkOut) {
       totalValidMinutes += Math.floor((new Date(s.checkOut.timestamp).getTime() - new Date(s.checkIn.timestamp).getTime()) / 60000);
    }
  });

  const checkInRaw = pairedSessions[0]?.checkIn?.timestamp;
  const checkOutRaw = pairedSessions[pairedSessions.length - 1]?.checkOut?.timestamp;
  const isMissingOut = pairedSessions.length > 0 && !pairedSessions[pairedSessions.length - 1].checkOut;
  const totalValidMs = totalValidMinutes * 60000;
  const totalHours = formatMinutes(totalValidMinutes);

  const handleOtAction = async (actionStatus: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    try {
      const targetUserId = employeeId; 
      const targetDate = date;

      if (!targetUserId || !targetDate) {
        toast.error("Error: Missing User ID or Date.");
        return;
      }

      // 🚀 NEW: Point to the new bulk update route
      await axios.patch('/api/attendance/ot-status', {
        userId: targetUserId,
        date: targetDate,
        otStatus: actionStatus
      });
      
      toast.success(`Overtime ${actionStatus.toLowerCase()} successfully!`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update Overtime");
    }
  };
  const renderPunchSource = (sourceType: string | null | undefined, ipAddress: string | null | undefined, isManual: boolean | undefined) => {
    if (isManual || sourceType?.toUpperCase() === 'MANUAL' || sourceType === 'Manual Entry' || sourceType === 'MANUAL_WEB') {
      return (
        <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 text-xs font-medium whitespace-nowrap ml-1">
          <Pencil className="w-3 h-3 mr-1 inline" /> Manual
        </span>
      );
    }
    if (sourceType?.toUpperCase() === 'MACHINE' || sourceType?.toUpperCase() === 'DEVICE') {
      return (
        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20 text-xs font-medium whitespace-nowrap ml-1">
          <Smartphone className="w-3 h-3 mr-1 inline" /> Machine
        </span>
      );
    }
    // Default to Web/Remote
    return (
      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-medium whitespace-nowrap ml-1">
        <Globe className="w-3 h-3 mr-1 inline" /> {ipAddress || 'Web'}
      </span>
    );
  };
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{employeeName}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">ID: {employeeId} • Date: {date}</p>
        <div className="mt-4 px-4 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full text-sm font-semibold text-slate-700 dark:text-slate-300">
          Status: {status === 'Present' ? <span className="text-emerald-600 dark:text-emerald-400">Present</span> : status === 'Late' ? <span className="text-amber-500 dark:text-amber-400">Late</span> : status === 'Half-Day' ? <span className="text-orange-500">Half-Day</span> : status === 'Off Day' ? <span className="text-slate-500 dark:text-slate-400 font-semibold">Off Day</span> : status === 'WEEKEND_WORK' ? <span className="text-xs font-medium px-2 py-1 rounded bg-purple-100 text-purple-700">⭐ Weekend Work</span> : <span className="text-red-500">Absent</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Check In</span>
          {checkInRaw ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {toBDDisplay(checkInRaw, 'hh:mm a')}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 italic font-medium">Missing</span>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Check Out</span>
          {checkOutRaw ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {toBDDisplay(checkOutRaw, 'hh:mm a')}
                {initialData.isAutoCheckout && (
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold border border-orange-200">Auto-Checkout</span>
                )}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 italic font-medium">
              {isMissingOut ? 'Missing / Working' : 'Missing'}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Time Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <p className="text-sm font-medium text-slate-500 mb-1">Total Valid Hours</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalValidMs > 0 ? (
                `${Math.floor(totalValidMs / 3600000)}h ${Math.floor((totalValidMs % 3600000) / 60000)}m`
              ) : '0h 0m'}
            </p>
          </div>
          
          <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
            <p className="text-sm font-medium text-red-500 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Late By
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatMinutes(lateMinutes)}
            </p>
          </div>
          
          <div className={`p-4 rounded-xl border ${
            otBadge === 'Approved' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700/50' : 
            otBadge === 'Rejected' ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-700/50' :
            systemCalculatedOtMinutes > 0 ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-700/50' :
            'bg-slate-50 border-slate-100 dark:bg-slate-900/50 dark:border-slate-700/50'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-sm font-medium ${
                otBadge === 'Approved' ? 'text-emerald-600 dark:text-emerald-400' :
                otBadge === 'Rejected' ? 'text-red-500' :
                systemCalculatedOtMinutes > 0 ? 'text-amber-600 dark:text-amber-400' :
                'text-slate-500'
              }`}>
                Overtime {otBadge !== 'None' && `(${otBadge})`}
              </p>
            </div>
            <p className={`text-2xl font-bold ${
              otBadge === 'Approved' ? 'text-emerald-700 dark:text-emerald-300' :
              otBadge === 'Rejected' ? 'text-red-600 dark:text-red-400' :
              systemCalculatedOtMinutes > 0 ? 'text-amber-700 dark:text-amber-300' :
              'text-slate-900 dark:text-white'
            }`}>
              {otBadge === 'Approved' ? formatMinutes(overtimeMinutes) : formatMinutes(systemCalculatedOtMinutes || 0)}
            </p>
            
            {/* ── Dynamic Badges and Action Buttons — ADMIN ONLY ─────────── */}
            {isAdmin ? (
              <>
                {otBadge === 'Pending' && systemCalculatedOtMinutes > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button
                      onClick={() => handleOtAction('APPROVED')}
                      className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md hover:bg-emerald-200 transition"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleOtAction('REJECTED')}
                      className="text-[11px] font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-md hover:bg-red-200 transition"
                    >
                      ❌ Reject
                    </button>
                  </div>
                )}
                {otBadge === 'Approved' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block w-max border border-emerald-100">✓ Approved</span>
                    <button onClick={() => handleOtAction('PENDING')} className="text-[10px] text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer">Undo</button>
                  </div>
                )}
                {otBadge === 'Rejected' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded inline-block w-max border border-red-100">✗ Rejected</span>
                    <button onClick={() => handleOtAction('PENDING')} className="text-[10px] text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer">Undo</button>
                  </div>
                )}
              </>
            ) : (
              /* ── Read-only status badge for regular employees ── */
              <div className="mt-3">
                {otBadge === 'Approved' && (
                  <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block w-max border border-emerald-100">✓ Approved</span>
                )}
                {otBadge === 'Rejected' && (
                  <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded inline-block w-max border border-red-100">✗ Rejected</span>
                )}
                {otBadge === 'Pending' && systemCalculatedOtMinutes > 0 && (
                  <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded inline-block w-max border border-amber-100">⏳ Status: Pending</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Place this BELOW the Time Summary Cards */}
        {punchTimeline && punchTimeline.length > 0 && (
          <div className="mt-6 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                View Shift Details ({pairedSessions.length} Sessions)
              </span>
              {showDetails ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            
            {showDetails && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                {pairedSessions.map((session: any, index: number) => (
                  <div key={session.checkIn?.id || index} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-md mb-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Session {session.sessionNumber}</span>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">IN:</span> 
                          {new Date(session.checkIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                          {renderPunchSource(session.checkIn.source, session.checkIn.source, session.checkIn.isManual)}
                          {session.checkIn.latitude && session.checkIn.longitude && (
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${session.checkIn.latitude},${session.checkIn.longitude}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] text-blue-600 underline ml-1 flex items-center"
                            >
                              📍 {session.checkIn.address ? `${session.checkIn.address.substring(0, 20)}...` : "View Map"}
                            </a>
                          )}
                        </div>
                        {'➔'}
                        {!session.checkOut ? (
                          <span className="text-red-500 font-medium bg-red-100 dark:bg-red-900/30 px-1 rounded">⚠️ Missing Punch-Out</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-amber-600 dark:text-amber-400 font-medium">OUT:</span> 
                            {new Date(session.checkOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                            {(() => {
                              const checkInDate = new Date(session.checkIn.timestamp);
                              const checkOutDate = new Date(session.checkOut.timestamp);
                              const isNextDay = checkOutDate.getDate() !== checkInDate.getDate() || checkOutDate.getMonth() !== checkInDate.getMonth() || checkOutDate.getFullYear() !== checkInDate.getFullYear();
                              return isNextDay ? <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold ml-0.5">(+1 Day)</span> : null;
                            })()}
                            {renderPunchSource(session.checkOut.source, session.checkOut.source, session.checkOut.isManual)}
                            {session.checkOut.latitude && session.checkOut.longitude && (
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${session.checkOut.latitude},${session.checkOut.longitude}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[10px] text-blue-600 underline ml-1 flex items-center"
                              >
                                📍 {session.checkOut.address ? `${session.checkOut.address.substring(0, 20)}...` : "View Map"}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {session.checkOut ? formatMinutes(session.durationMinutes) : '--'}
                      </div>
                      {session.checkIn?.id && isAdmin && (
                        <button 
                          onClick={() => handleDeleteSession(session)}
                          disabled={isDeleting === session.checkIn.id}
                          className="text-red-400 hover:text-red-600 transition-colors p-1 disabled:opacity-50"
                          title="Delete this session"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-xs text-center text-slate-400 mt-2 italic">
                  * Break times between sessions are automatically excluded from valid hours.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
