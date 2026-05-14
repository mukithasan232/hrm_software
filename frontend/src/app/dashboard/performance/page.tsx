'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Star, Award, Search, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PerformancePage() {
  const { user } = useAuth();
  const isManager = ['Admin', 'HR', 'Manager'].includes(user?.role || '');

  const [employees, setEmployees] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Rate Form State
  const [selectedEmp, setSelectedEmp] = useState('');
  const [taskScore, setTaskScore] = useState(80);
  const [managerRating, setManagerRating] = useState(4);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isManager) {
          const empRes = await api.get('/users');
          setEmployees(empRes.data);
          
          // Fetch performance for all (mocking by fetching first employee for now)
          if (empRes.data.length > 0) {
            setSelectedEmp(empRes.data[0]._id);
          }
        } else if (user) {
          const res = await api.get(`/performance/${user.id}`);
          setPerformanceData(res.data);
        }
      } catch (e) {
        toast.error('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user, isManager]);

  const fetchSpecificEmpStats = async (empId: string) => {
    setSelectedEmp(empId);
    try {
      const res = await api.get(`/performance/${empId}`);
      setPerformanceData(res.data);
    } catch (e) {
      toast.error('Failed to load employee stats');
    }
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      await api.post('/performance/rate', {
        employeeId: selectedEmp,
        month: currentMonth,
        year: currentYear,
        taskScore,
        managerRating,
        feedback
      });
      toast.success('Rating submitted successfully');
      fetchSpecificEmpStats(selectedEmp);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCalculateEOTM = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const res = await api.post('/performance/eotm', { month: currentMonth, year: currentYear });
      toast.success(res.data.message);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to calculate EOTM');
    }
  };

  // Process data for charts
  const chartData = performanceData.map(p => ({
    name: `${p.month}/${p.year}`,
    Task: p.taskScore,
    Punctuality: p.punctualityScore,
    Overall: p.calculatedOverallScore
  })).reverse(); // Oldest to newest

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Performance Analytics</h1>
          <p className="text-gray-400 mt-1">Track, analyze, and manage employee performance metrics.</p>
        </div>
        {isManager && (
          <button onClick={handleCalculateEOTM} className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-xl flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(202,138,4,0.3)]">
            <Award className="w-5 h-5" /> Calculate EOTM
          </button>
        )}
      </div>

      {isManager ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Rate Employee Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                <Star className="w-5 h-5 text-yellow-400" /> Rate Employee
              </h2>
              <form onSubmit={handleRate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Select Employee</label>
                  <select 
                    value={selectedEmp} onChange={(e) => fetchSpecificEmpStats(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                  >
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id} className="bg-slate-900">{emp.name} ({emp.employeeId})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Task Completion Score (0-100)</label>
                  <input type="number" min="0" max="100" required value={taskScore} onChange={(e) => setTaskScore(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Manager Rating (1-5 Stars)</label>
                  <select value={managerRating} onChange={(e) => setManagerRating(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                    {[1,2,3,4,5].map(v => <option key={v} value={v} className="bg-slate-900">{v} Stars</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Feedback</label>
                  <textarea required value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"></textarea>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-3 mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all">
                  Submit Rating
                </button>
              </form>
            </div>
          </div>

          {/* Performance Data Display */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl h-96">
              <h2 className="text-xl font-semibold text-white mb-6">Historical Trends (Selected Employee)</h2>
              {performanceData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">No performance data recorded yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="80%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                    <YAxis stroke="rgba(255,255,255,0.5)" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Overall" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Task" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="Punctuality" stroke="#f59e0b" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Latest Record Summary */}
            {performanceData.length > 0 && (
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Latest Evaluation ({performanceData[0].month}/{performanceData[0].year})</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                    <p className="text-gray-400 text-sm">Overall Score</p>
                    <p className="text-3xl font-bold text-blue-400">{performanceData[0].calculatedOverallScore.toFixed(1)}%</p>
                  </div>
                  <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                    <p className="text-gray-400 text-sm">Manager Rating</p>
                    <div className="flex text-yellow-400 text-xl mt-1">
                      {[...Array(5)].map((_, i) => <Star key={i} className={i < performanceData[0].managerRating ? "fill-current" : "opacity-20"} />)}
                    </div>
                  </div>
                  <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                    <p className="text-gray-400 text-sm">Punctuality</p>
                    <p className="text-3xl font-bold text-green-400">{performanceData[0].punctualityScore}%</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-300 italic border-l-2 border-blue-500 pl-3">"{performanceData[0].feedback}"</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Executive / Employee View */
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl h-[500px]">
          <h2 className="text-xl font-semibold text-white mb-6">My Performance Trends</h2>
          {performanceData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">No performance evaluations yet. Keep up the good work!</div>
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white' }} />
                <Legend />
                <Line type="monotone" dataKey="Overall" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="Task" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="Punctuality" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
