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
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-4 lg:px-8 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand / Official Gateway Logo */}
        <div 
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={() => setCurrentView(isCeo ? 'dashboard' : 'kiosk')}
          title="Gateway Software Solutions"
        >
          <img 
            src="/gateway-logo.png" 
            alt="Gateway Software Solutions Logo" 
            className="h-9 sm:h-10 w-auto object-contain"
          />
        </div>

        {/* Center Live Clock (matching reference design pill) */}
        <div className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#DDF2FF]/70 border border-[#078BD0]/30 text-[#12345A] text-xs font-semibold shadow-xs">
          <Clock className="w-3.5 h-3.5 text-[#078BD0]" />
          <span className="font-mono font-bold text-[#12345A]">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-[#078BD0] font-bold">•</span>
          <span className="text-slate-600 text-[11px] font-medium">
            {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center space-x-2.5">
          
          {/* Quick Mode Buttons (Face Kiosk, CEO Dashboard, CEO Login) */}
          <div className="flex items-center space-x-2">
            {/* Face Kiosk Button */}
            {(!isCeo || currentView === 'kiosk') && (
              <button
                onClick={() => setCurrentView('kiosk')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentView === 'kiosk'
                    ? 'bg-[#078BD0] text-white shadow-sm shadow-[#078BD0]/30'
                    : 'bg-[#DDF2FF] text-[#078BD0] hover:bg-[#c9eaff] border border-[#078BD0]/30'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Face Kiosk</span>
              </button>
            )}

            {/* CEO Dashboard Button */}
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-[#078BD0] text-white shadow-sm shadow-[#078BD0]/30'
                  : isCeo
                  ? 'bg-[#DDF2FF] text-[#078BD0] hover:bg-[#c9eaff] border border-[#078BD0]/30'
                  : 'text-[#12345A] hover:bg-[#DDF2FF]/60 hover:text-[#078BD0] border border-slate-200'
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
                <span className="text-xs font-bold text-[#12345A] flex items-center justify-end space-x-1">
                  <span>Dr. Sabarinathan Muthu</span>
                  {isCeo && <ShieldCheck className="w-3.5 h-3.5 text-[#F07824]" title="Chief Executive Officer" />}
                </span>
                <span className="text-[10px] text-[#078BD0] font-bold">CEO • Executive Access</span>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                title="Change CEO Password"
                className="p-2 rounded-lg bg-white hover:bg-[#FFF0E3] text-slate-600 hover:text-[#F07824] border border-slate-200 shadow-xs transition-all flex items-center space-x-1"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 shadow-xs transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentView('login')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                currentView === 'login'
                  ? 'bg-[#F07824] text-white shadow-md shadow-[#F07824]/20'
                  : 'bg-[#F07824] hover:bg-[#db6516] text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
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
