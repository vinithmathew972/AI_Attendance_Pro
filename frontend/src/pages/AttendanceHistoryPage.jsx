import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  Building, 
  Camera, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { getAttendanceHistoryApi, downloadAttendanceCsvApi, API_BASE_URL } from '../services/api';
import { formatTime12Hour } from '../utils/formatters';

export const AttendanceHistoryPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [department, setDepartment] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Snapshot preview modal
  const [previewSnapshot, setPreviewSnapshot] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAttendanceHistoryApi({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        department: department !== 'All' ? department : undefined,
        status_filter: statusFilter !== 'All' ? statusFilter : undefined,
      });
      setRecords(data || []);
    } catch (err) {
      console.error('Error fetching attendance history:', err);
      setError('Unable to fetch attendance history records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [department, statusFilter, startDate, endDate]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setDepartment('All');
    setStatusFilter('All');
    setSearch('');
  };

  const filteredRecords = records.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-slate-800">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Audit & Records
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Employee Attendance Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Comprehensive attendance archives, biometric timestamps, and computed working hours.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={async () => {
              try {
                setExporting(true);
                await downloadAttendanceCsvApi({
                  start_date: startDate || undefined,
                  end_date: endDate || undefined,
                  department: department !== 'All' ? department : undefined,
                  status_filter: statusFilter !== 'All' ? statusFilter : undefined,
                  search: search.trim() || undefined,
                });
              } catch (e) {
                alert('Export failed');
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Generating CSV...' : 'Export CSV Report'}</span>
          </button>

          <button
            onClick={fetchHistory}
            title="Refresh"
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search */}
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
                placeholder="Name or ID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
            >
              <option value="All">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="AI & Innovation">AI & Innovation</option>
              <option value="Product & Design">Product & Design</option>
              <option value="DevOps & Cloud">DevOps & Cloud</option>
              <option value="Quality Assurance">Quality Assurance</option>
              <option value="Human Resources">Human Resources</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late Arrivals</option>
              <option value="Completed">Completed Shifts</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>

        </div>

        {(startDate || endDate || department !== 'All' || statusFilter !== 'All' || search) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Check-In</th>
                <th className="px-5 py-3.5">Check-Out</th>
                <th className="px-5 py-3.5">Working Hours</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Biometric Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{rec.employee_name}</p>
                        <p className="text-[11px] font-mono text-indigo-600">{rec.employee_code}</p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {rec.department}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {rec.date}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-semibold text-emerald-600">
                      {formatTime12Hour(rec.check_in_time)}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-semibold text-cyan-600">
                      {rec.check_out_time ? (
                        formatTime12Hour(rec.check_out_time)
                      ) : (
                        <span className="text-amber-700 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                          Active Shift
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-slate-700">
                      {rec.working_hours && rec.working_hours > 0 ? (
                        <span>{rec.working_hours.toFixed(2)} hrs</span>
                      ) : (
                        <span className="text-slate-400 font-normal">In Progress</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.status?.includes('Late')
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {rec.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {rec.snapshot_path ? (
                        <button
                          onClick={() => setPreviewSnapshot(`${API_BASE_URL}${rec.snapshot_path}`)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-indigo-700 text-[11px] font-medium border border-slate-200 transition-all"
                        >
                          <Camera className="w-3 h-3" />
                          <span>View Face Snap</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Direct Log</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-500 text-xs">
                    No attendance records match the selected parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {previewSnapshot && (
        <div 
          onClick={() => setPreviewSnapshot(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-md w-full rounded-3xl bg-white border border-slate-200 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>Webcam Verification Snapshot</span>
              </span>
              <button
                onClick={() => setPreviewSnapshot(null)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <img
              src={previewSnapshot}
              alt="Verification snapshot"
              className="w-full aspect-video object-cover rounded-2xl border border-slate-200"
            />
          </div>
        </div>
      )}

    </div>
  );
};
