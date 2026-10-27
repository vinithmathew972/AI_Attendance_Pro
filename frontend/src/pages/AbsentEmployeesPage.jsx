import React, { useState, useEffect } from 'react';
import { 
  UserX, 
  Search, 
  Filter, 
  Calendar, 
  Building, 
  Mail, 
  Phone, 
  Clock, 
  RefreshCw, 
  AlertCircle,
  Download
} from 'lucide-react';
import { getAbsentEmployeesApi, getDepartmentsApi, API_BASE_URL } from '../services/api';
import { formatTime12Hour } from '../utils/formatters';

export const AbsentEmployeesPage = () => {
  const [absentEmps, setAbsentEmps] = useState([]);
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

  const fetchAbsent = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAbsentEmployeesApi({
        date: date || undefined,
        department: department !== 'All' ? department : undefined,
        search: search.trim() || undefined,
      });
      setAbsentEmps(data || []);
    } catch (err) {
      console.error('Failed to fetch absent employees:', err);
      setError('Unable to load absent employees data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAbsent();
  }, [date, department]);

  const filtered = absentEmps.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employee_id.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-slate-800">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center space-x-1">
              <UserX className="w-3.5 h-3.5" />
              <span>Absenteeism Monitoring</span>
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Absent Personnel Roster ({date})
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Active employees who have not clocked in via facial recognition for their scheduled workday.
          </p>
        </div>

        <button
          onClick={fetchAbsent}
          title="Refresh"
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all flex items-center space-x-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          
          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Attendance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500"
            />
          </div>

          {/* Dynamic Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500"
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
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Search Absent Staff
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, ID, or Email..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-rose-500"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unreported Staff Today</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {filtered.length} Employee{filtered.length !== 1 ? 's' : ''} Absent
            </h3>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-mono hidden sm:block">
          Queried directly from SQLite Database
        </span>
      </div>

      {/* Absent Employees Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Employee Name</th>
                <th className="px-5 py-3.5">Department & Role</th>
                <th className="px-5 py-3.5">Contact Details</th>
                <th className="px-5 py-3.5">Scheduled Shift</th>
                <th className="px-5 py-3.5 text-right">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-indigo-600">
                      {emp.employee_id}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                          {emp.name.charAt(0)}
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{emp.name}</p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{emp.department}</p>
                      <p className="text-[11px] text-slate-500">{emp.designation}</p>
                    </td>

                    <td className="px-5 py-3.5 space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-slate-700">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{emp.email}</span>
                      </div>
                      {emp.phone && (
                        <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatTime12Hour(emp.shift_start_time)} - {formatTime12Hour(emp.shift_end_time)}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Absent
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-500 text-xs">
                    🎉 100% Workforce Turnout! All employees have checked in for this date.
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
