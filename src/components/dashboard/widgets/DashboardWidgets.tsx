import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { LogIn, LogOut, Clock, UserMinus, CalendarRange, CalendarCheck2, Megaphone, Trash2, X, BarChart3, PieChart as PieChartIcon, RefreshCw, AlertTriangle } from 'lucide-react';
import { toBDDisplay, getBDToday } from '@/lib/dateUtils';
import { useLiveOfficeHour } from '@/hooks/useLiveOfficeHour';
import dynamic from 'next/dynamic';
import Avatar from '@/components/ui/Avatar';

const WeeklyChart = dynamic(() => import('@/components/charts/WeeklyChart'), { ssr: false });
const LateTodayWidget = dynamic(() => import('@/components/dashboard/LateTodayWidget'), { ssr: false });
const CheckedOutWidget = dynamic(() => import('@/components/dashboard/CheckedOutWidget'), { ssr: false });
import { BreakCountdownWidget } from '@/components/dashboard/BreakCountdownWidget';
export const PunchStatusWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { t } = useTranslation();
  const { isAdmin, stats, loading, punchStatus, latestPunch, assignedShift, todayWorkingHours } = data;

  const activeCheckInTime = punchStatus?.isIn && latestPunch ? latestPunch.timestamp : null;
  const liveHours = useLiveOfficeHour(activeCheckInTime);

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-sm dark:shadow-md h-full">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider truncate">
            {isAdmin ? t("presentNow") : "Today's Punch"}
          </p>
          <div className={`p-1.5 rounded-lg flex-shrink-0 ${punchStatus?.isIn || (isAdmin && stats.activeNow > 0) ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-100 dark:bg-white/5 text-slate-400"}`}>
            {punchStatus?.isIn ? <LogIn className="w-4 h-4" /> : latestPunch ? <LogOut className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>
        </div>
        <div className="mt-2">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${stats.activeNow > 0 ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{loading ? "-" : stats.activeNow}</p>
            </div>
          ) : (
            <p className={`text-sm font-bold truncate ${punchStatus?.isIn ? "text-emerald-600 dark:text-emerald-400" : latestPunch ? "text-orange-500 dark:text-orange-400" : "text-slate-500 dark:text-gray-400"}`}>
              {punchStatus?.label || 'Not Punched In'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Full view
  if (isAdmin) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col w-full h-full min-h-[300px] shadow-sm dark:shadow-md">
        <h3 className="text-lg font-semibold mb-4 border-b border-slate-100 dark:border-white/10 pb-2 text-slate-800 dark:text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Currently Present Employees ({data.presentEmployees?.length || 0})
        </h3>
        <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {data.presentEmployees && data.presentEmployees.length > 0 ? (
            <div className="w-full overflow-x-auto rounded-lg shadow-sm">
<table className="w-full text-left text-sm min-w-max">
               <thead>
                 <tr className="text-slate-400 text-xs uppercase tracking-wider">
                   <th className="pb-3 font-semibold">Employee</th>
                   <th className="pb-3 font-semibold hidden sm:table-cell">Designation</th>
                   <th className="pb-3 font-semibold">Check-In</th>
                 </tr>
               </thead>
               <tbody>
                 {data.presentEmployees.map((emp: any) => (
                   <tr key={emp.id} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                     <td className="py-3 flex items-center gap-3">
                       <Avatar 
                          src={emp.avatar} 
                          name={emp.name} 
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" 
                          fallbackClassName="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs border border-indigo-200 dark:border-indigo-500/30"
                        />
                       <span className="font-medium text-slate-800 dark:text-slate-200">{emp.name}</span>
                     </td>
                     <td className="py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{emp?.designation?.name || emp?.designation || 'N/A'}</td>
                     <td className="py-3 text-emerald-600 dark:text-emerald-400 font-medium">
                       {toBDDisplay(emp.checkIn, 'hh:mm a')}
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
</div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 min-h-[150px]">
              <Clock className="w-8 h-8 mb-2" />
              <p className="text-sm">No employees present right now.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-sm dark:shadow-md h-full">
      <div className="flex items-start justify-between w-full">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
            Today's Punch Status
          </p>
          <div className="mt-2">
            {loading ? (
              <p className="text-lg font-bold text-slate-400">—</p>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${latestPunch ? (punchStatus?.isIn ? "bg-emerald-500 animate-pulse" : "bg-orange-400") : "bg-slate-300"}`} />
                <p className={`text-sm font-bold leading-tight ${punchStatus?.isIn ? "text-emerald-600 dark:text-emerald-400" : latestPunch ? "text-orange-500 dark:text-orange-400" : "text-slate-500 dark:text-gray-400"}`}>
                  {punchStatus?.label}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 ${punchStatus?.isIn ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-100 dark:bg-white/5 text-slate-400"}`}>
          {punchStatus?.isIn ? <LogIn className="w-5 h-5" /> : latestPunch ? <LogOut className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between w-full">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Shift</span>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {assignedShift ? `${assignedShift.start} - ${assignedShift.end}` : <span className="text-slate-400 font-normal italic">Not Assigned</span>}
        </span>
      </div>
      
      {todayWorkingHours && (
        <div className="mt-2 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between w-full">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Office Hour</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {punchStatus?.isIn ? (
                 <span className="flex items-center gap-2">
                   <span className="relative flex h-2 w-2">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                   </span>
                   {liveHours} <span className="text-xs font-normal text-emerald-500/70">(Live)</span>
                 </span>
              ) : (
                todayWorkingHours || '—'
              )}
            </span>
          </div>
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500 flex-shrink-0 border border-indigo-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      )}
    </div>
  );
};

export const AbsentDaysWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { t } = useTranslation();
  const { isAdmin, stats, loading } = data;

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-orange-500/50 transition-all shadow-sm dark:shadow-md h-full">
        <div className="flex items-center justify-between">
           <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider truncate">
             {isAdmin ? "Total Absent" : "Absent Days"}
           </p>
           <div className="p-1.5 bg-orange-500/20 rounded-lg text-orange-500 dark:text-orange-400 flex-shrink-0">
             <UserMinus className="w-4 h-4" />
           </div>
        </div>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{loading ? "-" : stats.totalAbsent}</p>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col w-full h-full min-h-[300px] shadow-sm dark:shadow-md">
        <h3 className="text-lg font-semibold mb-4 border-b border-slate-100 dark:border-white/10 pb-2 text-slate-800 dark:text-white flex items-center gap-2">
          <UserMinus className="w-5 h-5 text-orange-500" />
          Absent Employees ({data.absentEmployees?.length || 0})
        </h3>
        <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {data.absentEmployees && data.absentEmployees.length > 0 ? (
            <div className="w-full overflow-x-auto rounded-lg shadow-sm">
<table className="w-full text-left text-sm min-w-max">
               <thead>
                 <tr className="text-slate-400 text-xs uppercase tracking-wider">
                   <th className="pb-3 font-semibold">Employee</th>
                   <th className="pb-3 font-semibold">Department</th>
                 </tr>
               </thead>
               <tbody>
                 {data.absentEmployees.map((emp: any) => (
                   <tr key={emp.id} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer relative">
                     <td className="py-3 flex items-center gap-3">
                       <Link href={`/dashboard/team/employees`} className="absolute inset-0 z-0" />
                       <Avatar 
                          src={emp.profileImage || emp.avatar} 
                          name={emp.name} 
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 relative z-10" 
                          fallbackClassName="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 relative z-10"
                        />
                       <div className="flex flex-col min-w-0 relative z-10">
                         <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{emp.name}</span>
                         <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                           Shift: {(() => {
                             const t = emp.shift?.startTime || emp.shiftStartTime || emp.department?.shiftStartTime || emp.customDepartment?.shiftStartTime || '09:00';
                             const [h, m] = t.split(':');
                             const hr = parseInt(h, 10);
                             const ampm = hr >= 12 ? 'PM' : 'AM';
                             return `${hr % 12 || 12}:${m || '00'} ${ampm}`;
                           })()}
                         </span>
                       </div>
                     </td>
                     <td className="py-3 text-slate-500 dark:text-slate-400 relative z-10">
                       <span className="bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md text-xs border border-slate-200 dark:border-white/10 group-hover:bg-orange-50 dark:group-hover:bg-orange-500/10 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                         {emp?.department?.name || emp?.department || 'Unassigned'}
                       </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
</div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 min-h-[150px]">
              <UserMinus className="w-8 h-8 mb-2" />
              <p className="text-sm">No employees are absent today.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between hover:border-orange-500/50 transition-all shadow-sm dark:shadow-md h-full">
      <div>
        <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
          Absent Days
        </p>
        <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">
          {loading ? "-" : stats.totalAbsent}
        </p>
      </div>
      <div className="p-3 bg-orange-500/20 rounded-xl text-orange-500 dark:text-orange-400 flex-shrink-0">
        <UserMinus className="w-5 h-5" />
      </div>
    </div>
  );
};

export const LeavesRemainingWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { t } = useTranslation();
  const { isAdmin, stats, loading, ANNUAL_LEAVE_QUOTA } = data;

  if (isCompact) {
    const cardContent = (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-purple-500/50 transition-all shadow-sm dark:shadow-md h-full hover:-translate-y-1 hover:shadow-md cursor-pointer">
        <div className="flex items-center justify-between">
           <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider truncate">
             {isAdmin ? t("pendingLeaves") : "Remaining Leaves"}
           </p>
           <div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-500 dark:text-purple-400 flex-shrink-0">
             <CalendarRange className="w-4 h-4" />
           </div>
        </div>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{loading ? "-" : isAdmin ? stats.pendingLeaves : stats.remainingLeaves}</p>
      </div>
    );
    
    return (
      <Link href="/leaves" className="block h-full">
        {cardContent}
      </Link>
    );
  }

  if (isAdmin) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col w-full h-full min-h-[300px] shadow-sm dark:shadow-md">
        <h3 className="text-lg font-semibold mb-4 border-b border-slate-100 dark:border-white/10 pb-2 text-slate-800 dark:text-white flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-purple-500" />
          Pending Leave Requests ({stats.pendingLeaves})
        </h3>
        <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {data.pendingLeavesList && data.pendingLeavesList.length > 0 ? (
            <div className="space-y-3">
              {data.pendingLeavesList.map((leave: any) => (
                <div key={leave.id} className="flex items-center justify-between p-3 border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-800 dark:text-white text-sm">{leave.employeeName || leave.user?.name || "Unknown"}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-medium">
                        {leave.leaveType}
                      </span>
                      <span>
                        {toBDDisplay(leave.startDate, 'MMM dd')} - {toBDDisplay(leave.endDate, 'MMM dd')}
                      </span>
                    </div>
                  </div>
                  <button className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all font-medium text-slate-700 dark:text-slate-300">
                    View
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 min-h-[150px]">
              <CalendarCheck2 className="w-8 h-8 mb-2" />
              <p className="text-sm">No pending leave requests.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between hover:border-purple-500/50 transition-all shadow-sm dark:shadow-md h-full">
      <div>
        <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
          Remaining Leaves
        </p>
        <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">
          {loading ? "-" : stats.remainingLeaves}
        </p>
        {!loading && (
          <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">
            of {ANNUAL_LEAVE_QUOTA} days/year
          </p>
        )}
      </div>
      <div className="p-3 bg-purple-500/20 rounded-xl text-purple-500 dark:text-purple-400 flex-shrink-0">
        <CalendarRange className="w-5 h-5" />
      </div>
    </div>
  );
};

export const LeavesPendingWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { stats, loading } = data;
  if (data.isAdmin) return null;

  if (isCompact) {
    const cardContent = (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-sky-500/50 transition-all shadow-sm dark:shadow-md h-full hover:-translate-y-1 hover:shadow-md cursor-pointer">
         <div className="flex items-center justify-between">
           <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider truncate">
             Pending Leaves
           </p>
           <div className="p-1.5 bg-sky-500/20 rounded-lg text-sky-500 dark:text-sky-400 flex-shrink-0">
             <CalendarCheck2 className="w-4 h-4" />
           </div>
        </div>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{loading ? "-" : stats.pendingLeaves}</p>
      </div>
    );
    
    return (
      <Link href="/leaves" className="block h-full">
        {cardContent}
      </Link>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col w-full h-full min-h-[300px] shadow-sm dark:shadow-md">
      <h3 className="text-lg font-semibold mb-4 border-b border-slate-100 dark:border-white/10 pb-2 text-slate-800 dark:text-white flex items-center gap-2">
        <CalendarCheck2 className="w-5 h-5 text-sky-500" />
        My Pending Leaves ({stats.pendingLeaves})
      </h3>
      <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
        {data.pendingLeavesList && data.pendingLeavesList.length > 0 ? (
          <div className="space-y-3">
            {data.pendingLeavesList.map((leave: any) => (
              <div key={leave.id} className="flex items-center justify-between p-3 border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-800 dark:text-white text-sm">{leave.leaveType}</span>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {toBDDisplay(leave.startDate, 'MMM dd')} - {toBDDisplay(leave.endDate, 'MMM dd')}
                  </div>
                </div>
                <button className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all font-medium text-slate-700 dark:text-slate-300">
                  View
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 min-h-[150px]">
            <CalendarCheck2 className="w-8 h-8 mb-2" />
            <p className="text-sm">No pending leave requests.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const NoticeBoardWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { isAdmin, announcements, handleClearBoard, handleDeleteNotice } = data;
  
  if (announcements.length === 0) return null;

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/20 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-indigo-500" />
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Notices</h3>
        </div>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{announcements.length}</p>
        <p className="text-xs text-slate-400 truncate mt-1">{announcements[0]?.title || ''}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/20 rounded-3xl p-6 shadow-md dark:shadow-2xl h-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Notice Board</h3>
        </div>
        {isAdmin && (
          <button
            onClick={handleClearBoard}
            className="text-xs flex items-center gap-1 font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Clear All
          </button>
        )}
      </div>
      <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
        {announcements.map((notice: any) => {
          const isNew = new Date().getTime() - new Date(notice.createdAt).getTime() < 24 * 60 * 60 * 1000;
          return (
            <div key={notice.id} className="p-4 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 relative group">
              {isNew && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse">NEW</span>}
              {isAdmin && (
                <button
                  onClick={() => handleDeleteNotice(notice.id)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Announcement"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <h4 className="font-bold text-slate-800 dark:text-white text-sm md:text-base pr-6">{notice.title}</h4>
              <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm mt-1 whitespace-pre-wrap">{notice.message}</p>
              <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500 dark:text-slate-400">
                <span>By {notice.author?.name || "Admin"}</span>
                <span>{toBDDisplay(notice.createdAt, "MMM dd, hh:mm a")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const MyPunchesWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { t } = useTranslation();
  const { isAdmin, selectedDate, setSelectedDate, loading, myPunches } = data;
  const punches = myPunches || [];

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Activity</h3>
        </div>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{punches.length}</p>
        <p className="text-xs text-slate-400 mt-1">Punches logged today</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {isAdmin ? t("liveActivity") : "My Punches"}
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-bold px-2 py-1.5 bg-emerald-500/10 rounded-lg">
          {t("realTime")}
        </span>
      </div>

      <div className="space-y-4 flex-1">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 animate-pulse">
                <div className="flex flex-col gap-2 w-[70%]">
                  <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-32 bg-slate-300 dark:bg-slate-600 rounded" />
                  <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>
            ))}
          </div>
        ) : punches.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 gap-2 opacity-50 py-8">
            <Clock className="w-8 h-8" />
            <p className="text-sm italic">{t("waitingForPunches")}</p>
          </div>
        ) : (
          punches.map((log: any, i: number) => {
            const isCheckIn = log.punchType?.toLowerCase().includes("in");
            return (
              <div key={log.id || i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 animate-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col gap-1 min-w-0 max-w-[75%]">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono truncate block">{log.employeeId}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{log.employeeName || "Unknown Employee"}</span>
                    {isCheckIn && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {toBDDisplay(log.timestamp, "hh:mm a")}
                  </span>
                </div>
                <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md border shrink-0 ${isCheckIn ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"}`}>
                  {isCheckIn ? t("checkIn") || "Check In" : t("checkOut") || "Check Out"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const WeeklyAttendanceWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { isAdmin, loading, chartData } = data;

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-primary" />
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Weekly</h3>
        </div>
        <p className="text-xs text-slate-400 mt-2">Expand to view full weekly analytics chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-brand-primary/20 rounded-lg text-brand-primary">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {isAdmin ? "Weekly Attendance" : "My Weekly Attendance"}
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">Mon – Sat · Working days only</p>
        </div>
      </div>
      <div className="w-full relative">
        {loading ? (
          <div className="h-72 flex items-center justify-center min-h-[300px]">
            <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-slate-400 text-sm min-h-[300px]">
            No data available
          </div>
        ) : (
          <WeeklyChart chartData={chartData} />
        )}
      </div>
    </div>
  );
};

export const LateTodayWidgetWrapper = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-red-500" />
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Late Today</h3>
        </div>
        <p className="text-xs text-slate-400 mt-2">Expand to view late employees.</p>
      </div>
    );
  }
  return (
    <div className="h-96 w-full">
      <LateTodayWidget lateList={data.stats?.lateList || []} />
    </div>
  );
};

import EarlyTodayWidget from '../EarlyTodayWidget';

export const EarlyTodayWidgetWrapper = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-green-500" />
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Early Today</h3>
        </div>
        <p className="text-xs text-slate-400 mt-2">Expand to view early birds.</p>
      </div>
    );
  }
  return (
    <div className="h-96 w-full">
      <EarlyTodayWidget recentList={data.recentAttendance || []} />
    </div>
  );
};

export const TopLatePersonsWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const [topLate, setTopLate] = React.useState<any[]>([]);
  const [limit, setLimit] = React.useState(3);
  const [loading, setLoading] = React.useState(false);

  const fetchTopLate = async (currentLimit: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/top-late?limit=${currentLimit}`);
      const json = await res.json();
      if (json.success) {
        setTopLate(json.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    if (data.isAdmin) {
      fetchTopLate(limit);
    }
  }, [data.isAdmin, limit]);

  if (!data.isAdmin) return null;

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Top Late</h3>
        </div>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{loading ? "-" : topLate.length}</p>
        <p className="text-xs text-slate-400 mt-1">Highest late records</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Top Late Persons</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Show Top:</label>
          <input 
            type="number" 
            min="1" 
            max="50" 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value) || 3)}
            className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-red-500"
          />
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full min-h-[150px]">
            <RefreshCw className="w-6 h-6 text-red-500 animate-spin" />
          </div>
        ) : topLate.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 min-h-[150px]">
            <AlertTriangle className="w-8 h-8 mb-2" />
            <p className="text-sm">No late records this month.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topLate.map((emp: any, idx: number) => (
              <div key={emp.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 hover:border-red-200 dark:hover:border-red-900/50 transition-colors relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-amber-500' : 'bg-slate-300'}`} />
                <div className="flex items-center gap-3 pl-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold text-[10px] flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <Avatar 
                    src={emp.avatar} 
                    name={emp.name} 
                    className="w-8 h-8 rounded-full object-cover" 
                    fallbackClassName="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-slate-800 dark:text-white">{emp.name}</span>
                    <span className="text-[10px] text-slate-500">{emp.department}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-red-600">{emp.lateCount} days late</span>
                  <span className="text-[10px] text-slate-400">{Math.floor(emp.totalLateMinutes / 60)}h {emp.totalLateMinutes % 60}m total</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const CheckedOutWidgetWrapper = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <LogOut className="w-4 h-4 text-indigo-500" />
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Checked Out</h3>
        </div>
        <p className="text-xs text-slate-400 mt-2">Expand to view.</p>
      </div>
    );
  }
  return (
    <div className="h-96 w-full">
      <CheckedOutWidget />
    </div>
  );
};

// Map widget IDs to their components
export const WidgetMap: Record<string, React.FC<any>> = {
  'punch-status': PunchStatusWidget,
  'absent-days': AbsentDaysWidget,
  'leaves-remaining': LeavesRemainingWidget,
  'leaves-pending': LeavesPendingWidget,
  'notice-board': NoticeBoardWidget,
  'my-punches': MyPunchesWidget,
  'weekly-attendance': WeeklyAttendanceWidget,
  'late-today': LateTodayWidgetWrapper,
  'early-today': EarlyTodayWidgetWrapper,
  'checked-out': CheckedOutWidgetWrapper,
  'break-countdown': BreakCountdownWidget,
  'top-late': TopLatePersonsWidget,
};
