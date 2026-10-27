import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Camera, 
  Building,
  User,
  X
} from 'lucide-react';
import { getLateArrivalsApi, downloadAttendanceCsvApi, getDepartmentsApi, API_BASE_URL } from '../services/api';
import { formatTime12Hour } from '../utils/formatters';

export const LateArrivalsPage = () => {
  const [lateRecords, setLateRecords] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  
  // Filters
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [department, setDepartment] = useState('All');
  const [search, setSearch] = useState('');
  const [previewSnapshot, setPreviewSnapshot] = useState(null);

  useEffect(() => {
    getDepartmentsApi()
      .then((data) => setDepartmentsList(data || []))
      .catch((err) => console.error('Failed to load departments:', err));
  }, []);

  const fetchLateArrivals = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getLateArrivalsApi({
        date: date || undefined,
        department: department !== 'All' ? department : undefined,
        search: search.trim() || undefined,
      });
      setLateRecords(data || []);
    } catch (err) {
      console.error('Failed to fetch late arrivals:', err);
      setError('Unable to load late arrival records.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      await downloadAttendanceCsvApi({
        start_date: date,
        end_date: date,
        status_filter: 'Late',
        department: department !== 'All' ? department : undefined,
        search: search.trim() || undefined,
      });
    } catch (err) {
      console.error('Export CSV error:', err);
      alert('Unable to export late report.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchLateArrivals();
  }, [date, department]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLateArrivals();
  };

  const filtered = lateRecords.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-slate-800">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Late Arrival Monitoring</span>
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Late Arrivals Audit ({date})
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tracks personnel reporting after their scheduled shift start time and calculates exact tardiness minutes.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-amber-600" />
            <span>{exporting ? 'Generating CSV...' : 'Export Late Report'}</span>
          </button>

          <button
            onClick={fetchLateArrivals}
            title="Refresh"
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500"
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
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500"
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
              Search Employee
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Employee name or ID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-amber-500"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Late Arrivals Count</p>
          <p className="text-2xl font-extrabold text-amber-600">{filtered.length}</p>
          <p className="text-[11px] text-slate-400">Employees arriving after grace limit</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Delay Duration</p>
          <p className="text-2xl font-extrabold text-slate-900">
            {filtered.length > 0 
              ? Math.round(filtered.reduce((acc, r) => acc + (r.late_minutes || 0), 0) / filtered.length) 
              : 0} min
          </p>
          <p className="text-[11px] text-slate-400">Mean tardiness across units</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Max Single Delay</p>
          <p className="text-2xl font-extrabold text-rose-600">
            {filtered.length > 0 ? Math.max(...filtered.map((r) => r.late_minutes || 0)) : 0} min
          </p>
          <p className="text-[11px] text-slate-400">Highest recorded late punch</p>
        </div>
      </div>

      {/* Late Arrivals Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Employee Name</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Shift Start Time</th>
                <th className="px-5 py-3.5">Actual Check-In</th>
                <th className="px-5 py-3.5">Late Minutes</th>
                <th className="px-5 py-3.5">Working Hours</th>
                <th className="px-5 py-3.5">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-amber-700">
                      {r.employee_code}
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900 text-sm">{r.employee_name}</p>
                      <span className="text-[11px] text-slate-500">{r.designation}</span>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {r.department}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-500">
                      {formatTime12Hour(r.shift_start_time || '09:00:00')}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-rose-600">
                      {formatTime12Hour(r.check_in_time)}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                        +{r.late_minutes} min late
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-slate-700">
                      {r.working_hours && r.working_hours > 0 ? `${r.working_hours.toFixed(2)} hrs` : 'In Progress'}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {r.attendance_status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-500 text-xs">
                    🎉 No late arrivals recorded for this date. All reporting employees arrived on time!
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
