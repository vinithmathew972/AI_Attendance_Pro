import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ShieldCheck, 
  User, 
  Building, 
  Clock, 
  Trash2, 
  RefreshCw, 
  Sparkles,
  ChevronRight,
  Check,
  X
} from 'lucide-react';
import { 
  getEmployeesApi, 
  registerFaceApi, 
  removeFaceApi, 
  API_BASE_URL 
} from '../services/api';
import { sound } from '../utils/audio';

export const FaceEnrollmentPage = ({ onEnrollmentComplete }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [search, setSearch] = useState('');

  // Camera & Image state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await getEmployeesApi();
      setEmployees(data || []);
      // Auto select first unregistered if none selected
      if (!selectedEmpId && data && data.length > 0) {
        const firstUnreg = data.find((e) => !e.face_registered) || data[0];
        setSelectedEmpId(String(firstUnreg.id));
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setFeedback({ type: 'error', message: 'Unable to load employee directory.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const selectedEmployee = employees.find((e) => String(e.id) === String(selectedEmpId));

  // Reset photo & consent when employee changes
  useEffect(() => {
    setCapturedImage(null);
    setConsentGiven(selectedEmployee?.consent_given || false);
    setFeedback(null);
  }, [selectedEmpId]);

  // Webcam controls
  const startCamera = async () => {
    setFeedback(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setFeedback({
        type: 'error',
        message: 'Could not access laptop webcam. Please grant camera permissions or upload an image file.',
      });
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  // Register Face
  const handleRegisterFace = async () => {
    if (!selectedEmployee) return;
    if (!consentGiven) {
      setFeedback({
        type: 'error',
        message: 'Explicit employee biometric consent is required before saving facial feature data.',
      });
      return;
    }
    if (!capturedImage) {
      setFeedback({
        type: 'error',
        message: 'Please take a webcam snapshot or upload a portrait photo.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await registerFaceApi(selectedEmployee.id, capturedImage, consentGiven);
      sound.playSuccess();
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      } catch (e) {}

      setFeedback({
        type: 'success',
        message: `Face biometrics enrolled successfully for ${selectedEmployee.name}! 128-dimensional embedding stored in database.`,
      });

      // Refresh list
      await fetchEmployees();
      if (onEnrollmentComplete) onEnrollmentComplete();
    } catch (err) {
      console.error('Face registration error:', err);
      sound.playAlert();
      const msg = err.response?.data?.detail || 'Failed to extract biometric face features. Ensure lighting is clear and look directly at camera.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // Remove Face
  const handleRemoveFace = async () => {
    if (!selectedEmployee) return;
    if (!window.confirm(`Are you sure you want to remove registered face biometrics for ${selectedEmployee.name}?`)) return;

    try {
      await removeFaceApi(selectedEmployee.id);
      setFeedback({
        type: 'success',
        message: `Biometric data removed for ${selectedEmployee.name}.`,
      });
      setCapturedImage(null);
      await fetchEmployees();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to clear biometric data.' });
    }
  };

  // Filter employee list
  const filteredEmployees = employees.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employee_id.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    );
  });

  const enrolledCount = employees.filter((e) => e.face_registered).length;
  const totalCount = employees.length;
  const enrolledPercent = totalCount > 0 ? Math.round((enrolledCount / totalCount) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Title & Progress Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              Admin & CEO Portal
            </span>
            <span className="text-xs text-slate-400">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Employee Face Biometric Enrollment
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Capture, extract 128-D facial embeddings, and enroll personnel into the biometric attendance engine with explicit employee consent.
          </p>
        </div>

        {/* Enrollment Progress Badge */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center space-x-4">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Enrollment Progress</p>
            <p className="text-sm font-extrabold text-white mt-0.5">
              {enrolledCount} of {totalCount} Staff Enrolled ({enrolledPercent}%)
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-sm">
            {enrolledPercent}%
          </div>
        </div>
      </div>

      {/* Main Enrollment Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Employee Selector & Directory (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Select Employee to Enroll</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">{filteredEmployees.length} available</span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, ID, or dept..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Employee List */}
          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
            {filteredEmployees.map((emp) => {
              const isSelected = String(emp.id) === String(selectedEmpId);
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmpId(String(emp.id))}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {emp.photo_url ? (
                      <img
                        src={`${API_BASE_URL}${emp.photo_url}`}
                        alt={emp.name}
                        className="w-10 h-10 rounded-xl object-cover border border-white/20"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-400 border border-slate-700'
                      }`}>
                        {emp.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-xs">{emp.name}</p>
                      <p className={`text-[11px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {emp.employee_id} • {emp.department}
                      </p>
                    </div>
                  </div>

                  <div>
                    {emp.face_registered ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        <Check className="w-2.5 h-2.5" />
                        <span>Enrolled</span>
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        Pending
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Camera Capture, Consent & Enrollment (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Selected Employee Summary Card */}
          {selectedEmployee && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-extrabold text-indigo-400 text-lg">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                    <span>{selectedEmployee.name}</span>
                    <span className="text-xs font-mono font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      {selectedEmployee.employee_id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedEmployee.designation} • {selectedEmployee.department}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-mono">Shift: {selectedEmployee.shift_start_time} - {selectedEmployee.shift_end_time}</span>
                {selectedEmployee.face_registered && (
                  <button
                    onClick={handleRemoveFace}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700 transition-all text-xs flex items-center space-x-1"
                    title="Remove Biometric Data"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Face</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-4 rounded-2xl text-xs flex items-start space-x-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              )}
              <span className="font-medium leading-relaxed">{feedback.message}</span>
            </div>
          )}

          {/* Webcam / Portrait Capture Viewport */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Face Biometric Capture Viewport
              </span>
              <span className="text-xs text-indigo-400 font-medium">OpenCV 128-D Vector Model</span>
            </div>

            {/* Video or Photo Frame */}
            <div className="relative aspect-video w-full rounded-2xl bg-black border border-slate-800 overflow-hidden flex items-center justify-center">
              
              {/* Live Video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* Captured Photo Preview */}
              {capturedImage && !isCameraActive && (
                <div className="relative w-full h-full">
                  <img
                    src={capturedImage}
                    alt="Captured portrait"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Portrait Ready for Vectorization</span>
                  </div>
                </div>
              )}

              {/* Oval Face Guide Overlay when Camera is Active */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-64 rounded-[50%] border-2 border-dashed border-indigo-400/70 shadow-[0_0_50px_rgba(99,102,241,0.25)] flex items-center justify-center">
                    <span className="text-[11px] font-bold text-indigo-300 bg-black/60 px-2 py-0.5 rounded-full">
                      Align Face Here
                    </span>
                  </div>
                </div>
              )}

              {/* Idle State when Camera is Off and No Photo is captured */}
              {!isCameraActive && !capturedImage && (
                <div className="text-center p-8 space-y-4">
                  {selectedEmployee?.photo_url ? (
                    <div className="space-y-3">
                      <img
                        src={`${API_BASE_URL}${selectedEmployee.photo_url}`}
                        alt="Current registered face"
                        className="w-32 h-32 rounded-2xl object-cover mx-auto border-2 border-indigo-500 shadow-xl"
                      />
                      <p className="text-xs font-semibold text-emerald-400">
                        Face already enrolled. You can take a new snapshot to update it.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
                        <Camera className="w-8 h-8 text-indigo-400" />
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Open your laptop camera or upload a clear frontal portrait photo to compute biometric encodings.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-center space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Start Laptop Webcam</span>
                    </button>

                    <label className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer transition-all">
                      <Upload className="w-4 h-4 text-indigo-400" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons when Camera is Active */}
              {isCameraActive && (
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center space-x-3">
                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-2xl transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Snapshot</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Retake Button if image is captured */}
              {capturedImage && !isCameraActive && (
                <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-semibold transition-all backdrop-blur-md"
                  >
                    Retake Webcam
                  </button>
                  <label className="px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-semibold transition-all backdrop-blur-md cursor-pointer">
                    Upload Other
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

            </div>

            {/* MANDATORY BIOMETRIC CONSENT CHECKBOX */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 space-y-2">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-900"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Employee Biometric Consent Verification:</strong> I confirm that the employee <span className="text-indigo-400 font-semibold">{selectedEmployee?.name || 'the employee'}</span> has given explicit consent for Gateway Software Solutions to capture, compute, and store 128-dimensional biometric facial embedding vectors for workplace attendance authentication and physical building security.
                </span>
              </label>
            </div>

            {/* Final Save Action Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                {capturedImage ? '✓ Portrait ready for analysis' : '• Waiting for photo capture'}
              </span>

              <button
                type="button"
                onClick={handleRegisterFace}
                disabled={submitting || !consentGiven || !capturedImage}
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-extrabold shadow-xl shadow-emerald-600/30 disabled:opacity-40 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{submitting ? 'Analyzing & Saving Biometrics...' : 'Register Face Biometrics'}</span>
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
