import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'indigo', badge }) => {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      border: 'border-indigo-100',
      gradient: 'from-indigo-100/50 to-transparent',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      gradient: 'from-emerald-100/50 to-transparent',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
      gradient: 'from-amber-100/50 to-transparent',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-100',
      gradient: 'from-rose-100/50 to-transparent',
    },
    cyan: {
      bg: 'bg-cyan-50',
      text: 'text-cyan-600',
      border: 'border-cyan-100',
      gradient: 'from-cyan-100/50 to-transparent',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100',
      gradient: 'from-purple-100/50 to-transparent',
    },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      <div className={`absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-gradient-to-br ${scheme.gradient} blur-xl pointer-events-none`}></div>
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>

        <div className={`p-3 rounded-xl ${scheme.bg} ${scheme.text} border ${scheme.border}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">{badge.label}</span>
          <span className={`font-semibold ${
            badge.positive === true
              ? 'text-emerald-600'
              : badge.positive === false
              ? 'text-rose-600'
              : 'text-slate-600'
          }`}>
            {badge.value}
          </span>
        </div>
      )}
    </div>
  );
};
