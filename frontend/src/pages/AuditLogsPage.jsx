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
        style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      };
    }
    if (action.includes('FACE')) {
      return {
        icon: Camera,
        style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      };
    }
    if (action.includes('ATTENDANCE')) {
      return {
        icon: Clock,
        style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      };
    }
    return {
      icon: FileText,
      style: 'bg-slate-800 text-slate-300 border-slate-700',
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              Security Compliance
            </span>
            <span className="text-xs text-slate-400">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            System & Biometric Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tamper-evident chronological logs of CEO sessions, facial enrollments, and check-in transactions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          title="Refresh"
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center space-x-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by keyword..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>
      </div>

      {/* Audit Log Timeline Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Timestamp (UTC)</th>
                <th className="px-5 py-3.5">Security Event</th>
                <th className="px-5 py-3.5">Event Details & Scope</th>
                <th className="px-5 py-3.5 text-right">Integrity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  const dateStr = new Date(log.timestamp).toLocaleString();

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                        {dateStr}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${badge.style}`}>
                          <Icon className="w-3 h-3" />
                          <span>{log.action}</span>
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-200 font-medium leading-relaxed">
                        {log.details}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px] font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-slate-400 text-xs">
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
