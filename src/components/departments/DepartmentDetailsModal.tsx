import React from 'react';
import { X, Clock, Users, User, Coffee, Utensils } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  employeeId: string;
  designation: {
    name: string;
  } | null;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  lunchStartTime?: string;
  lunchEndTime?: string;
  snacksStartTime?: string;
  snacksEndTime?: string;
  employees?: Employee[];
}

interface DepartmentDetailsModalProps {
  department: Department;
  onClose: () => void;
}

export default function DepartmentDetailsModal({ department, onClose }: DepartmentDetailsModalProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex items-start justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {department.name}
            </h2>
            {department.description && (
              <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">{department.description}</p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 flex-1">
          
          {/* Configuration Grid */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Shift & Break Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
                  <Clock className="w-4 h-4" /> Regular Shift
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {department.shiftStartTime || 'N/A'} - {department.shiftEndTime || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold mb-1">
                  <Utensils className="w-4 h-4" /> Lunch Break
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {department.lunchStartTime || 'N/A'} - {department.lunchEndTime || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-white/5 md:col-span-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold mb-1">
                  <Coffee className="w-4 h-4" /> Snacks Break
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {department.snacksStartTime || 'N/A'} - {department.snacksEndTime || 'N/A'}
                </p>
              </div>
            </div>
          </section>

          {/* Employees List */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Employees in this Department
            </h3>
            
            {(!department.employees || department.employees.length === 0) ? (
              <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 border-dashed">
                <User className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No employees assigned yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {department.employees.map(emp => (
                  <div key={emp.id} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(emp.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-900 dark:text-white font-semibold truncate" title={emp.name}>
                        {emp.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                          {emp.employeeId}
                        </span>
                        <span className="truncate" title={emp.designation?.name || 'No designation'}>
                          {emp.designation?.name || 'No designation'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex justify-end sticky bottom-0 bg-white dark:bg-slate-900 z-10">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl transition-all font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
