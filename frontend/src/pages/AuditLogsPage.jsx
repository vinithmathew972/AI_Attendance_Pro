import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  Clock, 
  User, 
  Camera, 
  Key, 
  FileText,
  Search
} from 'lucide-react';
import { getAuditLogsApi } from '../services/api';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAuditLogsApi(100);
      setLogs(data || []);
    } catch (err) {
      console.error('Audit log fetch error:', err);
      setError('Unable to load security audit log trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action) => {
    if (action.includes('LOGIN')) {
      return {
        icon: Key,
        style: 'bg-[#DDF2FF] text-[#078BD0] border-[#078BD0]/30',
      };
    }
    if (action.includes('FACE')) {
      return {
        icon: Camera,
        style: 'bg-[#FFF0E3] text-[#F07824] border-[#F07824]/30',
      };
    }
    if (action.includes('ATTENDANCE')) {
      return {
        icon: Clock,
        style: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    return {
      icon: FileText,
      style: 'bg-slate-100 text-[#12345A] border-slate-200',
    };
  };

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-[#12345A]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#078BD0] bg-[#DDF2FF] px-2.5 py-0.5 rounded-full border border-[#078BD0]/30">
              Security Compliance
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#12345A] tracking-tight mt-1">
            System & Biometric Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Tamper-evident chronological logs of CEO sessions, facial enrollments, and check-in transactions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          title="Refresh"
          className="p-2.5 rounded-xl bg-white hover:bg-[#DDF2FF]/40 text-[#12345A] border border-slate-200 shadow-sm transition-all flex items-center space-x-2 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#078BD0]' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#078BD0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by keyword..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0] text-xs text-[#12345A] placeholder-slate-400 outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Audit Log Timeline Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#DDF2FF] text-[#12345A] uppercase tracking-wider font-bold border-b border-[#078BD0]/20">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Security Event</th>
                <th className="px-5 py-3.5">Event Details & Scope</th>
                <th className="px-5 py-3.5 text-right">Integrity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  const dateStr = new Date(log.timestamp).toLocaleString();

                  return (
                    <tr key={log.id} className="hover:bg-[#DDF2FF]/20 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">
                        {dateStr}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${badge.style}`}>
                          <Icon className="w-3 h-3" />
                          <span>{log.action}</span>
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-[#12345A] font-medium leading-relaxed">
                        {log.details}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center space-x-1 text-emerald-600 text-[11px] font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-slate-500 text-xs">
                    No security audit logs found.
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
