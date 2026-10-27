import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Search, 
  Filter, 
  Calendar, 
  Building, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  Camera, 
  UserCheck,
  Flame
} from 'lucide-react';
import { getCurrentlyWorkingApi, getDepartmentsApi, API_BASE_URL } from '../services/api';
import { formatTime12Hour } from '../utils/formatters';

export const CurrentlyWorkingPage = () => {
  const [workingStaff, setWorkingStaff] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [department, setDepartment] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getDepartmentsApi()
      .then((data) => setDepartmentsList(data || []))
      .catch((err) => console.error('Failed to load departments:', err));
  }, []);

  const fetchCurrentlyWorking = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getCurrentlyWorkingApi({
        date: date || undefined,
        department: department !== 'All' ? department : undefined,
        search: search.trim() || undefined,
      });
      setWorkingStaff(data || []);
    } catch (err) {
      console.error('Failed to fetch currently working staff:', err);
      setError('Unable to load active workforce.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentlyWorking();
    // Auto refresh every 30 seconds to update active elapsed hours
    const interval = setInterval(fetchCurrentlyWorking, 30000);
    return () => clearInterval(interval);
  }, [date, department]);

  const filtered = workingStaff.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (emp.employee_name && emp.employee_name.toLowerCase().includes(q)) ||
      (emp.employee_code && emp.employee_code.toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>Active Shift Monitor</span>
            </span>
            <span className="text-xs text-slate-400">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Currently Working Personnel ({date})
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time tracking of staff on shift who have checked in but not checked out yet.
          </p>
        </div>

        <button
          onClick={fetchCurrentlyWorking}
          title="Refresh"
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center space-x-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          
          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>

          {/* Dynamic Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500"
            >
              <option value="All">All Departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Search Active Staff
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, ID, or Dept..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">On Shift Right Now</p>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></span>
            <p className="text-2xl font-extrabold text-cyan-400">{filtered.length} Staff</p>
          </div>
          <p className="text-[11px] text-slate-500">Active on company premises</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mean Active Duration</p>
          <p className="text-2xl font-extrabold text-white">
            {filtered.length > 0 
              ? (filtered.reduce((acc, r) => acc + (r.elapsed_hours || 0), 0) / filtered.length).toFixed(1)
              : '0.0'} hrs
          </p>
          <p className="text-[11px] text-slate-500">Average time elapsed since punch-in</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance Status</p>
          <p className="text-2xl font-extrabold text-emerald-400">100% Verified</p>
          <p className="text-[11px] text-slate-500">Authenticated via Facial Biometrics</p>
        </div>
      </div>

      {/* Currently Working Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Employee Name</th>
                <th className="px-5 py-3.5">Department & Role</th>
                <th className="px-5 py-3.5">Check-In Timestamp</th>
                <th className="px-5 py-3.5">Elapsed Duration</th>
                <th className="px-5 py-3.5">Scheduled Shift</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length > 0 ? (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-cyan-400">
                      {emp.employee_code}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-400 text-xs">
                          {emp.employee_name.charAt(0)}
                        </div>
                        <p className="font-bold text-white text-sm">{emp.employee_name}</p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-200">{emp.department}</p>
                      <p className="text-[11px] text-slate-400">{emp.designation}</p>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>{formatTime12Hour(emp.check_in_time)}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-white font-semibold">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        {emp.elapsed_hours} hrs worked
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-400">
                      {formatTime12Hour(emp.shift_start_time || '09:00:00')} - {formatTime12Hour(emp.shift_end_time || '18:00:00')}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        <span>Active Shift</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400 text-xs">
                    No employees currently active on shift for this date.
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
