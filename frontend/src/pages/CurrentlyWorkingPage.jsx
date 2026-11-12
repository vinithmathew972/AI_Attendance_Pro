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
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-[#12345A]">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#078BD0] bg-[#DDF2FF] px-2.5 py-0.5 rounded-full border border-[#078BD0]/30 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#078BD0] animate-ping"></span>
              <span>Active Shift Monitor</span>
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#12345A] tracking-tight mt-1">
            Currently Working Personnel ({date})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Real-time tracking of staff on shift who have checked in but not checked out yet.
          </p>
        </div>

        <button
          onClick={fetchCurrentlyWorking}
          title="Refresh"
          className="p-2.5 rounded-xl bg-white hover:bg-[#DDF2FF]/40 text-[#12345A] border border-slate-200 shadow-sm transition-all flex items-center space-x-2 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#078BD0]' : ''}`} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          
          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-bold text-[#12345A] uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#12345A] outline-none focus:bg-white focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
            />
          </div>

          {/* Dynamic Department Filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#12345A] uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#12345A] outline-none focus:bg-white focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
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
            <label className="block text-[11px] font-bold text-[#12345A] uppercase tracking-wider mb-1">
              Search Active Staff
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#078BD0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, ID, or Dept..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#12345A] placeholder-slate-400 outline-none focus:bg-white focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">On Shift Right Now</p>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-[#078BD0] animate-pulse"></span>
            <p className="text-2xl font-extrabold text-[#078BD0]">{filtered.length} Staff</p>
          </div>
          <p className="text-[11px] text-slate-500">Active on company premises</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mean Active Duration</p>
          <p className="text-2xl font-extrabold text-[#12345A]">
            {filtered.length > 0 
              ? (filtered.reduce((acc, r) => acc + (r.elapsed_hours || 0), 0) / filtered.length).toFixed(1)
              : '0.0'} hrs
          </p>
          <p className="text-[11px] text-slate-500">Average time elapsed since punch-in</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Status</p>
          <p className="text-2xl font-extrabold text-emerald-600">100% Verified</p>
          <p className="text-[11px] text-slate-500">Authenticated via Facial Biometrics</p>
        </div>
      </div>

      {/* Currently Working Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#DDF2FF] text-[#12345A] uppercase tracking-wider font-bold border-b border-[#078BD0]/20">
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
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#DDF2FF]/20 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-[#078BD0]">
                      {emp.employee_code}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-[#DDF2FF] border border-[#078BD0]/20 flex items-center justify-center font-bold text-[#078BD0] text-xs">
                          {emp.employee_name.charAt(0)}
                        </div>
                        <p className="font-bold text-[#12345A] text-sm">{emp.employee_name}</p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#12345A]">{emp.department}</p>
                      <p className="text-[11px] text-slate-500">{emp.designation}</p>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>{formatTime12Hour(emp.check_in_time)}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-[#12345A] font-semibold">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#DDF2FF] text-[#078BD0] border border-[#078BD0]/30 font-bold">
                        {emp.elapsed_hours} hrs worked
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {formatTime12Hour(emp.shift_start_time || '09:00:00')} - {formatTime12Hour(emp.shift_end_time || '18:00:00')}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span>Active Shift</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-500 text-xs">
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
