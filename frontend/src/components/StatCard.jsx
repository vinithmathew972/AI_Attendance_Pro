import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', badge }) => {
  const colorMap = {
    blue: {
      bg: 'bg-[#DDF2FF]',
      text: 'text-[#078BD0]',
      border: 'border-[#078BD0]/20',
      gradient: 'from-[#DDF2FF]/70 to-transparent',
    },
    orange: {
      bg: 'bg-[#FFF0E3]',
      text: 'text-[#F07824]',
      border: 'border-[#F07824]/20',
      gradient: 'from-[#FFF0E3]/70 to-transparent',
    },
    indigo: {
      bg: 'bg-[#DDF2FF]',
      text: 'text-[#078BD0]',
      border: 'border-[#078BD0]/20',
      gradient: 'from-[#DDF2FF]/70 to-transparent',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      gradient: 'from-emerald-100/50 to-transparent',
    },
    amber: {
      bg: 'bg-[#FFF0E3]',
      text: 'text-[#F07824]',
      border: 'border-[#F07824]/20',
      gradient: 'from-[#FFF0E3]/70 to-transparent',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-100',
      gradient: 'from-rose-100/50 to-transparent',
    },
    cyan: {
      bg: 'bg-sky-50',
      text: 'text-sky-600',
      border: 'border-sky-100',
      gradient: 'from-sky-100/50 to-transparent',
    },
    purple: {
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      border: 'border-violet-100',
      gradient: 'from-violet-100/50 to-transparent',
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm transition-all hover:shadow-md hover:border-[#078BD0]/30">
      <div className={`absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-gradient-to-br ${scheme.gradient} blur-xl pointer-events-none`}></div>
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-[#12345A] mt-2 tracking-tight">{value}</h3>
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
