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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
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

  const isFullWidthKiosk = currentView === 'login';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {/* Main Body Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - shown unless in standalone login */}
        {!isFullWidthKiosk && (
          <div className="hidden md:block">
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
          </div>
        )}

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-65px)] pb-12 bg-slate-50 text-slate-900">
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
