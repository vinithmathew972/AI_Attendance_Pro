import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  LogOut, 
  Camera, 
  LayoutDashboard,
  CheckCircle2,
  UserCheck,
  KeyRound
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

export const Navbar = ({ currentView, setCurrentView }) => {
  const { user, logout, isCeo } = useAuth();
  const [time, setTime] = useState(new Date());
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-black/5">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">Gateway</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                SOFTWARE SOLUTIONS
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">AI Biometric Attendance Command Center</p>
          </div>
        </div>

        {/* Center Live Clock */}
        <div className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-sm">
          <Clock className="w-4 h-4 text-indigo-600 animate-pulse" />
          <span className="font-mono font-medium">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500 text-xs font-medium">
            {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center space-x-3">
          
          {/* Quick Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(!isCeo || currentView === 'kiosk') && (
              <button
                onClick={() => setCurrentView('kiosk')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'kiosk'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Face Kiosk</span>
              </button>
            )}
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>CEO Dashboard</span>
            </button>
          </div>

          {/* User profile / Logout */}
          {user ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900 flex items-center justify-end space-x-1">
                  <span>Dr. Sabarinathan Muthu</span>
                  {isCeo && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" title="Chief Executive Officer" />}
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold">CEO • Executive Access</span>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                title="Change CEO Password"
                className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-amber-600 border border-slate-200 shadow-sm transition-all flex items-center space-x-1"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-lg bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 shadow-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentView('login')}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>CEO Login</span>
            </button>
          )}

        </div>

      </div>

      {/* CEO Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
};
