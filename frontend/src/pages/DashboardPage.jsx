import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Briefcase, 
  Percent, 
  TrendingUp, 
  Download, 
  UserPlus, 
  RefreshCw,
  Building,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  FileSpreadsheet,
  ShieldAlert
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { getDashboardStatsApi, downloadAttendanceCsvApi, API_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatTime12Hour } from '../utils/formatters';

export const DashboardPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getDashboardStatsApi();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Unable to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      await downloadAttendanceCsvApi();
    } catch (err) {
      console.error('Export CSV failed:', err);
      alert('Unable to export attendance report. Please check permissions.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Format weekly data for Recharts
  const chartData = (stats?.weekly_trend || []).map((d) => ({
    name: `${d.day} (${d.date.slice(5)})`,
    presentOnTime: Math.max(0, d.present - d.late),
    late: d.late,
    absent: d.absent,
    total: d.present + d.absent
  }));

  // Colors for department distribution
  const DEPT_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg text-xs space-y-1">
          <p className="font-bold text-slate-800 mb-1.5">{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="flex items-center justify-between space-x-4">
              <span className="text-slate-600 font-medium">{entry.name}:</span>
              <span className="font-mono font-bold">{entry.value} employees</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-slate-800">
      
      {/* CEO Executive Greeting & Quick Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Executive Command View
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Welcome, Dr. Sabarinathan Muthu (CEO)
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Real-time biometric attendance intelligence, workforce analytics, and SQLite logs overview.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('records')}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200 shadow-sm transition-all"
          >
            <Clock className="w-4 h-4 text-cyan-600" />
            <span>Attendance Records</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200 shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{exporting ? 'Exporting CSV...' : 'Export CSV'}</span>
          </button>

          <button
            onClick={fetchStats}
            title="Refresh Data"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 5 Key Metric Cards (Clickable for Instant Drill-Down) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* 1. Total Employees */}
        <div 
          onClick={() => onNavigate('employees')} 
          className="cursor-pointer transform transition-transform hover:-translate-y-1"
        >
          <StatCard
            title="Total Workforce"
            value={stats?.total_employees ?? '--'}
            subtitle="Registered employees"
            icon={Users}
            color="indigo"
            badge={{ label: 'Directory', value: 'View All →', positive: true }}
          />
        </div>

        {/* 2. Present Today */}
        <div 
          onClick={() => onNavigate('records')} 
          className="cursor-pointer transform transition-transform hover:-translate-y-1"
        >
          <StatCard
            title="Present Today"
            value={stats?.present_today ?? '--'}
            subtitle="Clocked in today"
            icon={UserCheck}
            color="emerald"
            badge={{ label: 'Turnout', value: `${stats?.attendance_rate ?? 0}%`, positive: true }}
          />
        </div>

        {/* 3. Absent Today */}
        <div 
          onClick={() => onNavigate('absent-employees')} 
          className="cursor-pointer transform transition-transform hover:-translate-y-1"
        >
          <StatCard
            title="Absent Today"
            value={stats?.absent_today ?? '--'}
            subtitle="Not reported yet"
            icon={UserX}
            color="rose"
            badge={{ label: 'Roster', value: 'View List →', positive: false }}
          />
        </div>

        {/* 4. Late Arrivals */}
        <div 
          onClick={() => onNavigate('late-arrivals')} 
          className="cursor-pointer transform transition-transform hover:-translate-y-1"
        >
          <StatCard
            title="Late Arrivals"
            value={stats?.late_today ?? '--'}
            subtitle="Reported past shift start"
            icon={Clock}
            color="amber"
            badge={{ label: 'Tardiness', value: 'Audit Log →' }}
          />
        </div>

        {/* 5. Currently Working */}
        <div 
          onClick={() => onNavigate('currently-working')} 
          className="cursor-pointer transform transition-transform hover:-translate-y-1"
        >
          <StatCard
            title="Currently Working"
            value={stats?.currently_working ?? '--'}
            subtitle="Active on shift right now"
            icon={Briefcase}
            color="cyan"
            badge={{ label: 'Live Shift', value: 'Monitor →', positive: true }}
          />
        </div>

      </div>

      {/* Visual Analytics with Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Weekly Attendance Trend Chart (Recharts BarChart) - 8 Cols */}
        <div className="lg:col-span-8 rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <span>7-Day Attendance Trend (Recharts)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visual ratio of on-time presents, late arrivals, and absent staff computed from SQLite
              </p>
            </div>
            
            <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Live Database Fed
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 11 }}
                />
                <Bar dataKey="presentOnTime" name="Present On-Time" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="late" name="Late Arrivals" stackId="a" fill="#f59e0b" />
                <Bar dataKey="absent" name="Absent" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Attendance Turnout (4 Cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <Building className="w-5 h-5 text-cyan-600" />
                <span>Department Turnout</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">Today</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Real-time attendance rates per department</p>
          </div>

          <div className="space-y-3.5 my-2">
            {(stats?.department_stats || []).map((dept, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{dept.department}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 text-[11px]">{dept.present}/{dept.total} present</span>
                    <span className="font-bold text-indigo-600">{dept.rate}%</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 transition-all duration-700"
                    style={{ width: `${dept.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Overall Score</span>
            <span className="font-bold text-emerald-600 text-sm">{stats?.attendance_rate || 0}% Company Turnout</span>
          </div>
        </div>

      </div>

      {/* Live Biometric Punch Stream (Today's SQLite Records) */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Today's Live Attendance Records</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live attendance punch timestamps recorded in SQLite database
            </p>
          </div>

          <button
            onClick={() => onNavigate('records')}
            className="flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            <span>Open Master Records Archive</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Employee Name</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Check-In Time</th>
                <th className="px-5 py-3.5">Check-Out Time</th>
                <th className="px-5 py-3.5">Working Hours</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.recent_punches?.length > 0 ? (
                stats.recent_punches.map((punch, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-indigo-600">
                      {punch.code}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs">
                          {punch.name.charAt(0)}
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{punch.name}</p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {punch.department}
                    </td>

                    <td className="px-5 py-3.5 font-mono">
                      {punch.check_in_time ? (
                        <span className="text-emerald-600 font-bold">{formatTime12Hour(punch.check_in_time)}</span>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-mono">
                      {punch.check_out_time ? (
                        <span className="text-cyan-600 font-bold">{formatTime12Hour(punch.check_out_time)}</span>
                      ) : (
                        <span className="text-amber-700 text-[11px] font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Active Shift
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-medium">
                      {punch.working_hours && punch.working_hours > 0 ? (
                        <span className="text-slate-700 font-mono">{punch.working_hours} hrs</span>
                      ) : (
                        <span className="text-slate-400">In Progress</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        punch.status?.includes('Late')
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {punch.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right font-medium">
                      <span className="inline-flex items-center space-x-1 text-slate-500 text-[11px]">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>{punch.verification_method || 'Verified'}</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500 text-xs">
                    No attendance records logged for today yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
