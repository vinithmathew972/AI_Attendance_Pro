import React from 'react';
import { 
  LayoutDashboard, 
  Camera, 
  Users, 
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  FileSpreadsheet, 
  ShieldAlert, 
  Building2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ currentView, setCurrentView }) => {
  const { isCeo } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'CEO Dashboard',
      icon: LayoutDashboard,
      requiresCeo: true,
      badge: 'Live',
    },
    {
      id: 'kiosk',
      label: 'Face Recognition Kiosk',
      icon: Camera,
      requiresCeo: false,
      badge: 'Webcam',
    },
    {
      id: 'records',
      label: 'Attendance Records',
      icon: FileSpreadsheet,
      requiresCeo: true,
      badge: null,
    },
    {
      id: 'late-arrivals',
      label: 'Late Arrivals',
      icon: Clock,
      requiresCeo: true,
      badge: 'Alerts',
    },
    {
      id: 'absent-employees',
      label: 'Absent Personnel',
      icon: UserX,
      requiresCeo: true,
      badge: null,
    },
    {
      id: 'currently-working',
      label: 'Currently Working',
      icon: Briefcase,
      requiresCeo: true,
      badge: 'Active',
    },
    {
      id: 'enrollment',
      label: 'Face Enrollment',
      icon: UserCheck,
      requiresCeo: true,
      badge: 'Biometric',
    },
    {
      id: 'employees',
      label: 'Employee Directory',
      icon: Users,
      requiresCeo: true,
      badge: null,
    },
    {
      id: 'audit',
      label: 'Security & Audit Logs',
      icon: ShieldAlert,
      requiresCeo: true,
      badge: null,
    },
  ];

  // On the initial CEO login page (when not logged in as CEO),
  // show ONLY CEO Dashboard and Face Recognition Kiosk under Executive Controls.
  // On the CEO Dashboard (after CEO login), show all executive navigation controls EXCEPT Face Recognition Kiosk.
  const visibleNavItems = isCeo
    ? navItems.filter((item) => item.id !== 'kiosk')
    : navItems.filter((item) => item.id === 'dashboard' || item.id === 'kiosk');

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 min-h-[calc(100vh-65px)]">
      <div className="p-4 space-y-6">
        
        {/* Navigation Category */}
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Executive Controls
          </p>
          <nav className="space-y-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id || (item.id === 'dashboard' && currentView === 'login');
              const isLocked = item.requiresCeo && !isCeo;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : item.badge === 'Alerts'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : item.badge === 'Active'
                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      CEO
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* System Status info box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Biometric Engine</span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-medium text-emerald-600">OpenCV Ready</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            128-D Euclidean Vector Matching active with real-time SQLite persistence.
          </p>
        </div>

      </div>

      {/* Footer Organization Info */}
      <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">Gateway Software Solutions</p>
        <p className="text-[11px] mt-0.5">Enterprise Attendance Suite v2.2</p>
      </div>
    </aside>
  );
};
