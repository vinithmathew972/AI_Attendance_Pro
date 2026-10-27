import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Camera, 
  CheckCircle2, 
  LogOut, 
  LogIn, 
  UserCheck, 
  AlertCircle, 
  AlertTriangle,
  Sparkles, 
  Clock, 
  Building, 
  User, 
  RefreshCw,
  Search,
  Check,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { WebcamCapture } from '../components/WebcamCapture';
import { 
  recognizeFrameApi, 
  checkInApi, 
  checkOutApi, 
  getTodayAttendanceApi,
  getEmployeesApi,
  API_BASE_URL 
} from '../services/api';
import { sound } from '../utils/audio';
import { formatTime12Hour } from '../utils/formatters';

export const KioskPage = ({ onNavigateToEnrollment }) => {
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [unknownFace, setUnknownFace] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }
  const [todayPunches, setTodayPunches] = useState([]);
  const [loadingPunches, setLoadingPunches] = useState(false);

  // Fallback manual selector list
  const [allEmployees, setAllEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  // Fetch today's punches & registered employees
  const loadKioskData = useCallback(async () => {
    try {
      setLoadingPunches(true);
      const [todayData, empsData] = await Promise.all([
        getTodayAttendanceApi(),
        getEmployeesApi().catch(() => [])
      ]);
      setTodayPunches(todayData || []);
      setAllEmployees(empsData || []);
    } catch (err) {
      console.error('Failed to load kiosk data:', err);
    } finally {
      setLoadingPunches(false);
    }
  }, []);

  useEffect(() => {
    loadKioskData();
  }, [loadKioskData]);

  // Frame recognition handler (called by WebcamCapture)
  const handleFrameCapture = useCallback(async (base64Image) => {
    setSelectedSnapshot(base64Image);
    try {
      const res = await recognizeFrameApi(base64Image);
      setDetectedFaces(res.matches || []);

      if (res.faces_detected > 0) {
        // 1. Check for registered employee match
        const matched = res.matches.find((m) => m.employee_id > 0 && m.confidence >= 55);
        if (matched) {
          setActiveEmployee(matched);
          setUnknownFace(null);
        } else {
          // 2. Face is detected but not recognized in database
          const unknown = res.matches.find((m) => m.employee_id === 0);
          if (unknown) {
            setActiveEmployee(null);
            setUnknownFace(unknown);
          }
        }
      } else {
        // No faces in frame
        // Keep active employee for 4s then clear
      }
    } catch (err) {
      // Ignore scan error
    }
  }, []);

  // Handle Check-In
  const handleCheckIn = async (empId = null) => {
    const targetId = empId || activeEmployee?.employee_id;
    if (!targetId) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await checkInApi({
        employee_id: targetId,
        snapshot_base64: selectedSnapshot,
        confidence: activeEmployee?.confidence || 98.5,
        notes: 'Webcam Face Recognition Punch',
      });

      // Sound & celebration
      sound.playSuccess();
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (e) {}

      setFeedback({
        type: 'success',
        message: `Check-In Successful! Welcome, ${res.employee_name}. Time: ${res.check_in_time} (${res.attendance_status || res.status})`,
      });

      // Refresh today's list
      loadKioskData();

      // Reset after short delay
      setTimeout(() => {
        setActiveEmployee(null);
        setFeedback(null);
      }, 5000);
    } catch (err) {
      console.error('Check-in error:', err);
      sound.playAlert();
      const msg = err.response?.data?.detail || 'Check-in failed. Please retry.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async (empId = null) => {
    const targetId = empId || activeEmployee?.employee_id;
    if (!targetId) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await checkOutApi({
        employee_id: targetId,
        snapshot_base64: selectedSnapshot,
        notes: 'Webcam Face Recognition Check-out',
      });

      sound.playCheckOut();
      try {
        confetti({
          particleCount: 50,
          spread: 50,
          origin: { y: 0.7 }
        });
      } catch (e) {}

      setFeedback({
        type: 'success',
        message: `Check-Out Recorded! Goodbye, ${res.employee_name}. Total hours worked: ${res.working_hours} hrs.`,
      });

      loadKioskData();

      setTimeout(() => {
        setActiveEmployee(null);
        setFeedback(null);
      }, 5000);
    } catch (err) {
      console.error('Check-out error:', err);
      sound.playAlert();
      const msg = err.response?.data?.detail || 'Check-out failed. Please retry.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Select employee manually from dropdown/search
  const handleSelectManual = (emp) => {
    const punch = todayPunches.find((p) => p.employee_id === emp.id);
    setActiveEmployee({
      employee_id: emp.id,
      employee_code: emp.employee_id || emp.employee_code,
      full_name: emp.name || `${emp.first_name} ${emp.last_name}`,
      department: emp.department,
      designation: emp.designation,
      photo_url: emp.photo_url,
      confidence: 100.0,
      already_checked_in: punch ? !!punch.check_in_time : false,
      already_checked_out: punch ? !!punch.check_out_time : false,
      check_in_time: punch?.check_in_time,
      check_out_time: punch?.check_out_time,
      today_status: punch?.attendance_status || punch?.status,
    });
    setUnknownFace(null);
    setSearchQuery('');
  };

  const filteredEmployees = allEmployees.filter((emp) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    const name = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`;
    const code = emp.employee_id || emp.employee_code || '';
    return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-slate-800">
      
      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Biometric Attendance Terminal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Gateway Software Solutions • Face Attendance
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Open your laptop webcam. The biometric engine will recognize registered personnel and record attendance into the database.
        </p>
      </div>

      {/* Main Terminal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Live Webcam with Bounding Boxes (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <WebcamCapture
            onFrameCapture={handleFrameCapture}
            detectedFaces={detectedFaces}
            autoScanInterval={1800}
            enableAutoScan={true}
            overlayMessage={
              activeEmployee
                ? `Recognized: ${activeEmployee.full_name} (${activeEmployee.confidence}% match)`
                : unknownFace
                ? '⚠️ Unknown Face Detected (Unregistered)'
                : null
            }
          />

          {/* Quick Manual Search Fallback */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>Manual Verification Fallback</span>
              </span>
              <span className="text-[11px] text-slate-500">If camera lighting is low</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee by name or ID (e.g. GSS-1002, Rajesh)..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-xs text-slate-900 placeholder-slate-400 outline-none"
              />

              {filteredEmployees.length > 0 && (
                <div className="absolute z-20 inset-x-0 mt-1.5 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-2xl divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectManual(emp)}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {emp.name || `${emp.first_name} ${emp.last_name}`}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {emp.employee_id || emp.employee_code} • {emp.department}
                        </p>
                      </div>
                      <span className="text-[10px] text-indigo-700 font-semibold px-2 py-0.5 rounded bg-indigo-50">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Biometric Recognition Card & Action Buttons (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Recognition Card */}
          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-cyan-400"></div>

            {/* Header Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Biometric Status Card
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                activeEmployee
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : unknownFace
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                {activeEmployee ? 'Face Recognized' : unknownFace ? 'Unknown Face' : 'Waiting for Face'}
              </span>
            </div>

            {/* STATE 1: Recognized Registered Employee */}
            {activeEmployee ? (
              <div className="space-y-5">
                
                {/* Profile row: Name, ID, Department, Designation */}
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    {activeEmployee.photo_url ? (
                      <img
                        src={`${API_BASE_URL}${activeEmployee.photo_url}`}
                        alt={activeEmployee.full_name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-extrabold text-white text-xl shadow-md shadow-indigo-600/20">
                        {activeEmployee.full_name.charAt(0)}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                      {activeEmployee.full_name}
                    </h3>
                    <p className="text-xs font-mono font-semibold text-indigo-600 mt-0.5">
                      Employee ID: {activeEmployee.employee_code}
                    </p>
                    <p className="text-xs text-slate-500">
                      Department: <strong className="text-slate-800">{activeEmployee.department}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {activeEmployee.designation}
                    </p>
                  </div>
                </div>

                {/* Match Confidence Bar */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Biometric Similarity Match</span>
                    <span className="font-bold text-emerald-600">{activeEmployee.confidence}% Confidence</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, activeEmployee.confidence)}%` }}
                    />
                  </div>
                </div>

                {/* Today's Punch Status Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Today's Shift Status:</span>
                    <span className="font-semibold text-slate-800">
                      {activeEmployee.already_checked_out
                        ? 'Shift Completed'
                        : activeEmployee.already_checked_in
                        ? 'Currently Checked In'
                        : 'Not Checked In Yet'}
                    </span>
                  </div>

                  {activeEmployee.already_checked_in && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Check-In Time:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {formatTime12Hour(activeEmployee.check_in_time)}
                      </span>
                    </div>
                  )}

                  {activeEmployee.already_checked_out && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Check-Out Time:</span>
                      <span className="font-mono font-bold text-cyan-600">
                        {formatTime12Hour(activeEmployee.check_out_time)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons: Check-In and Check-Out */}
                <div className="space-y-2.5 pt-2">
                  
                  {/* Check-In Button */}
                  {!activeEmployee.already_checked_in && (
                    <button
                      type="button"
                      onClick={() => handleCheckIn()}
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                    >
                      <LogIn className="w-5 h-5" />
                      <span>{isSubmitting ? 'Recording Check-In in SQLite...' : 'Confirm Check-In'}</span>
                    </button>
                  )}

                  {/* Check-Out Button */}
                  {activeEmployee.already_checked_in && !activeEmployee.already_checked_out && (
                    <button
                      type="button"
                      onClick={() => handleCheckOut()}
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>{isSubmitting ? 'Recording Check-Out in SQLite...' : 'Confirm Check-Out'}</span>
                    </button>
                  )}

                  {/* If already completed shift */}
                  {activeEmployee.already_checked_in && activeEmployee.already_checked_out && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold text-center flex items-center justify-center space-x-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Shift completed today! Both Check-In and Check-Out recorded.</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveEmployee(null);
                      setUnknownFace(null);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all"
                  >
                    Clear / Scan Next Employee
                  </button>
                </div>

              </div>
            ) : unknownFace ? (
              /* STATE 2: Unknown Face Detected (Requirement 9 & Important Note) */
              <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-4 animate-fadeIn">
                <div className="flex items-start space-x-3.5">
                  <div className="p-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-amber-800">
                      Unknown Face Detected
                    </h3>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      This person is <strong>not registered</strong> in Gateway Software Solutions employee records.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-amber-200 text-[11px] text-slate-600 space-y-1">
                  <p>• Biometric attendance cannot be marked for unregistered visitors.</p>
                  <p>• If you are an employee, please ask the CEO or Admin to enroll your face in the Face Enrollment portal.</p>
                </div>

                {onNavigateToEnrollment && (
                  <button
                    type="button"
                    onClick={onNavigateToEnrollment}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Go to Employee Face Enrollment</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setUnknownFace(null)}
                  className="w-full py-1.5 rounded-lg text-slate-500 hover:text-slate-700 text-xs font-medium"
                >
                  Dismiss Alert
                </button>
              </div>
            ) : (
              /* STATE 3: Idle Prompt */
              <div className="py-12 px-4 text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shadow-inner">
                  <Camera className="w-10 h-10 animate-pulse text-indigo-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900">Look at the Webcam</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    The OpenCV facial engine will detect your features and highlight your details automatically.
                  </p>
                </div>
              </div>
            )}

            {/* Notification Feedback Toast */}
            {feedback && (
              <div className={`p-4 rounded-2xl text-xs flex items-start space-x-2.5 animate-fadeIn ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span className="font-medium leading-relaxed">{feedback.message}</span>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Today's Kiosk Activity Stream */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Today's Logged Attendance Records</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved in SQLite database with real-time biometric timestamps
            </p>
          </div>

          <button
            onClick={loadKioskData}
            title="Refresh"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPunches ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Check-In</th>
                <th className="px-4 py-3">Check-Out</th>
                <th className="px-4 py-3">Late Mins</th>
                <th className="px-4 py-3">Working Hours</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayPunches.length > 0 ? (
                todayPunches.map((punch) => (
                  <tr key={punch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">{punch.employee_name}</p>
                        <p className="text-[11px] font-mono text-slate-500">{punch.employee_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{punch.department}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600 font-semibold">{formatTime12Hour(punch.check_in_time)}</td>
                    <td className="px-4 py-3 font-mono text-cyan-600 font-semibold">{formatTime12Hour(punch.check_out_time)}</td>
                    <td className="px-4 py-3 font-mono">
                      {punch.late_minutes && punch.late_minutes > 0 ? (
                        <span className="text-amber-700 font-semibold">{punch.late_minutes} min</span>
                      ) : (
                        <span className="text-slate-400">0 min</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {punch.working_hours && punch.working_hours > 0 ? `${punch.working_hours} hrs` : 'In Progress'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (punch.attendance_status || punch.status)?.includes('Late')
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {punch.attendance_status || punch.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-slate-500 text-xs">
                    No attendance records logged for today yet.
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
