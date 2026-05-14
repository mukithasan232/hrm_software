'use client';
import { useState, useEffect } from 'react';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/logs');
      // API returns { total, page, logs } — extract the array safely
      const data = res.data;
      const logsArray = Array.isArray(data) ? data : (data?.logs ?? []);
      setLogs(logsArray);
      setTotalLogs(data?.total ?? logsArray.length);
    } catch (error) {
      toast.error('Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/attendance/sync-live');
      const { stats } = res.data;
      toast.success(`Synced ${stats?.synced ?? 0} new records (${stats?.skipped ?? 0} duplicates skipped)`);
      fetchLogs();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Device sync failed — check network/device connection');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Attendance Logs</h1>
          <p className="text-gray-400 mt-1 text-sm">{totalLogs} total records in database.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync Device
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition-all">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search employee ID..." 
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-gray-400 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Employee ID</th>
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Device IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No raw logs found in database. Click Sync Device.</td></tr>
              ) : (
                logs.filter(log => log.employeeId.includes(searchTerm)).map((row) => (
                  <tr key={row._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{row.employeeId}</td>
                    <td className="px-6 py-4 text-gray-300">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                        {row.punchType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500 text-sm">{row.deviceId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
