import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { KioskPage } from './pages/KioskPage';
import { AttendanceRecordsPage } from './pages/AttendanceRecordsPage';
import { LateArrivalsPage } from './pages/LateArrivalsPage';
import { AbsentEmployeesPage } from './pages/AbsentEmployeesPage';
import { CurrentlyWorkingPage } from './pages/CurrentlyWorkingPage';
import { FaceEnrollmentPage } from './pages/FaceEnrollmentPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

const AppContent = () => {
  const { isAuthenticated, isCeo, loading } = useAuth();
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('gss_token') ? 'dashboard' : 'kiosk';
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FCFF] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl border-4 border-[#078BD0]/20 border-t-[#078BD0] animate-spin"></div>
        <p className="text-xs font-semibold text-[#12345A] tracking-wider uppercase">
          Initializing Gateway Attendance Suite...
        </p>
      </div>
    );
  }

  // Render Page Content based on currentView
  const renderView = () => {
    // Protected views requiring CEO Authentication
    const ceoViews = [
      'dashboard', 
      'records', 
      'history', 
      'late-arrivals', 
      'absent-employees', 
      'currently-working', 
      'enrollment', 
      'employees', 
      'audit'
    ];

    if (ceoViews.includes(currentView) && (!isAuthenticated || !isCeo)) {
      return (
        <LoginPage
          onLoginSuccess={() => setCurrentView('dashboard')}
          onSwitchToKiosk={() => setCurrentView('kiosk')}
        />
      );
    }

    switch (currentView) {
      case 'login':
        return (
          <LoginPage
            onLoginSuccess={() => setCurrentView('dashboard')}
            onSwitchToKiosk={() => setCurrentView('kiosk')}
          />
        );
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentView} />;
      case 'kiosk':
        return <KioskPage onNavigateToEnrollment={() => setCurrentView('enrollment')} />;
      case 'records':
      case 'history':
        return <AttendanceRecordsPage />;
      case 'late-arrivals':
        return <LateArrivalsPage />;
      case 'absent-employees':
        return <AbsentEmployeesPage />;
      case 'currently-working':
        return <CurrentlyWorkingPage />;
      case 'enrollment':
        return <FaceEnrollmentPage onEnrollmentComplete={() => setCurrentView('kiosk')} />;
      case 'employees':
        return <EmployeesPage />;
      case 'audit':
        return <AuditLogsPage />;
      default:
        return <DashboardPage onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="relative min-h-screen bg-[#F8FCFF] text-[#12345A] flex flex-col font-sans selection:bg-[#078BD0] selection:text-white">
      {/* Decorative Corporate Brand Accent Waves (matching Reference Design) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-right soft light blue accent */}
        <div className="absolute -top-28 -right-28 w-96 h-96 rounded-full bg-gradient-to-br from-[#DDF2FF]/80 to-[#BAE6FD]/30 blur-2xl"></div>

        {/* Bottom-left curved wave accent */}
        <svg
          className="absolute -bottom-8 -left-8 w-[420px] h-[250px] opacity-60"
          viewBox="0 0 500 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-40 300 C 100 270, 160 170, 90 110 C 20 50, 200 20, 300 140 C 360 210, 460 240, 520 300 Z"
            fill="url(#blueWaveLeft)"
          />
          <path
            d="M-40 300 C 50 260, 110 220, 190 235 C 270 250, 330 270, 420 300 Z"
            fill="#078BD0"
            fillOpacity="0.2"
          />
          <defs>
            <linearGradient id="blueWaveLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DDF2FF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#078BD0" stopOpacity="0.35" />
            </linearGradient>
          </defs>
        </svg>

        {/* Bottom-right curved corporate accent */}
        <svg
          className="absolute -bottom-8 -right-8 w-[460px] h-[270px] opacity-75"
          viewBox="0 0 500 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M540 300 C 390 280, 290 210, 350 130 C 410 50, 250 40, 140 160 C 70 240, -10 270, -40 300 Z"
            fill="url(#blueWaveRight)"
          />
          <path
            d="M540 300 C 410 270, 310 240, 240 270 C 170 290, 90 300, 0 300 Z"
            fill="url(#orangeAccentRight)"
          />
          <defs>
            <linearGradient id="blueWaveRight" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#078BD0" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#DDF2FF" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#078BD0" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="orangeAccentRight" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#F07824" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#FFF0E3" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Top Navbar */}
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {/* Main Body Layout */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Sidebar - always visible on desktop */}
        <div className="hidden md:block">
          <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
        </div>

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-65px)] pb-12 text-[#12345A]">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
