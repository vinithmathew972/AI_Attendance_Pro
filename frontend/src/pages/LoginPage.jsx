import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle
} from 'lucide-react';

export const LoginPage = ({ onLoginSuccess, onSwitchToKiosk }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email.trim(), password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail || 'Invalid email or password. Only Gateway CEO has access.';
      setError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-xl shadow-indigo-500/20">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Gateway Software Solutions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Chief Executive Officer (CEO) Portal
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xl relative overflow-hidden">
          
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"></div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                CEO Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ceo@gatewaysoftware.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Executive Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span>Authenticating CEO Access...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Access CEO Dashboard</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

          </form>

          {/* Quick link to Face Kiosk */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onSwitchToKiosk}
              className="text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors"
            >
              Looking for Employee Face Attendance Kiosk? <span className="text-indigo-600 underline ml-1">Open Kiosk</span>
            </button>
          </div>

        </div>

        {/* Security Notice */}
        <p className="text-center text-[11px] text-slate-500">
          Gateway Software Solutions • Restricted Access • All sessions logged and audited.
        </p>

      </div>
    </div>
  );
};
