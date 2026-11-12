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
  const [isDeleting, setIsDeleting] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState({});
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Safe error extraction helper for strings, objects, and FastAPI validation arrays
  const extractErrorMessage = (err, fallbackMessage) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map((d) => d?.msg || JSON.stringify(d)).join('; ');
    }
    if (detail && typeof detail === 'object') {
      return JSON.stringify(detail);
    }
    if (err?.message) {
      return err.message;
    }
    return fallbackMessage;
  };

  // Safe audio playback helper that catches potential promise or autoplay rejections
  const safePlaySound = (type) => {
    try {
      if (!sound) return;
      if (type === 'success') {
        if (typeof sound.playSuccess === 'function') sound.playSuccess();
        else if (typeof sound.success === 'function') sound.success();
      } else if (type === 'error') {
        if (typeof sound.playAlert === 'function') sound.playAlert();
        else if (typeof sound.error === 'function') sound.error();
      } else if (type === 'click') {
        if (typeof sound.click === 'function') sound.click();
      }
    } catch (e) {
      console.warn('Audio playback error suppressed:', e);
    }
  };

  // Image load error fallback handler
  const handleImageError = (id) => {
    setBrokenImageIds((prev) => ({ ...prev, [id]: true }));
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await getEmployeesApi({ status: 'Active' });
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
    return () => {
      // Ensure webcam tracks are safely released on component unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
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

  // Snapshot from video element
  const snapPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
    safePlaySound('click');
  };

  // Upload photo file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    // Reset file input value so selecting the same file again triggers onChange
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Please upload a valid JPEG or PNG image.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result);
      stopCamera();
      safePlaySound('click');
    };
    reader.readAsDataURL(file);
  };

  // Submit enrollment
  const handleRegisterFace = async () => {
    if (!selectedEmpId) {
      setFeedback({ type: 'error', message: 'Please select an employee first.' });
      return;
    }
    if (!capturedImage) {
      setFeedback({ type: 'error', message: 'Please capture a webcam photo or upload an image.' });
      return;
    }
    if (!consentGiven) {
      setFeedback({ type: 'error', message: 'Mandatory: Employee biometric consent acknowledgment required.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await registerFaceApi(
        parseInt(selectedEmpId, 10),
        capturedImage,
        consentGiven
      );

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
      safePlaySound('success');

      setCapturedImage(null);
      setFeedback({
        type: 'success',
        message: `Success! 128-D biometric vector encoded & saved for ${res.employee_name || selectedEmployee?.name || 'employee'}.`,
      });

      await fetchEmployees();
      if (onEnrollmentComplete) {
        setTimeout(() => {
          onEnrollmentComplete();
        }, 1500);
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      safePlaySound('error');
      const msg = extractErrorMessage(err, 'Face registration failed. Ensure exactly one clear face is visible in good lighting.');
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // Clear existing face
  const handleRemoveFace = async () => {
    if (!selectedEmpId || isDeleting) return;
    if (!window.confirm('Are you sure you want to delete this employee biometric facial encoding?')) return;

    setIsDeleting(true);
    try {
      await removeFaceApi(selectedEmpId);
      setFeedback({ type: 'success', message: 'Biometric face data successfully cleared.' });
      setCapturedImage(null);
      await fetchEmployees();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to clear biometric data.');
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-[#12345A]">
      
      {/* Title & Progress Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#078BD0] bg-[#DDF2FF] px-2.5 py-0.5 rounded-full border border-[#078BD0]/30">
              Admin & CEO Portal
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#12345A] tracking-tight mt-1">
            Employee Face Biometric Enrollment
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Capture, extract 128-D facial embeddings, and enroll personnel into the biometric attendance engine with explicit employee consent.
          </p>
        </div>

        {/* Enrollment Progress Badge */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center space-x-4">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Enrollment Progress</p>
            <p className="text-sm font-extrabold text-[#12345A] mt-0.5">
              {enrolledCount} of {totalCount} Staff Enrolled ({enrolledPercent}%)
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#DDF2FF] border border-[#078BD0]/30 flex items-center justify-center font-bold text-[#078BD0] text-sm">
            {enrolledPercent}%
          </div>
        </div>
      </div>

      {/* Main Enrollment Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Employee Selector & Directory (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#12345A] flex items-center space-x-2">
              <User className="w-4 h-4 text-[#078BD0]" />
              <span>Select Employee to Enroll</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {loading ? 'Loading...' : `${filteredEmployees.length} available`}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#078BD0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, ID, or dept..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#12345A] placeholder-slate-400 outline-none focus:bg-white focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
            />
          </div>

          {/* Employee List */}
          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-[#078BD0] border-t-transparent rounded-full animate-spin" />
                  <span>Loading employees...</span>
                </div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No employees found matching filter.
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = String(emp.id) === String(selectedEmpId);
                const hasPhoto = emp.photo_url && !brokenImageIds[emp.id];
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmpId(String(emp.id))}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#078BD0] text-white shadow-md shadow-[#078BD0]/20'
                        : 'hover:bg-[#DDF2FF]/40 text-[#12345A]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {hasPhoto ? (
                        <img
                          src={`${API_BASE_URL}${emp.photo_url}`}
                          alt={emp.name}
                          onError={() => handleImageError(emp.id)}
                          className="w-10 h-10 rounded-xl object-cover border border-white/20"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#DDF2FF] text-[#078BD0] border border-[#078BD0]/20'
                        }`}>
                          {emp.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-xs">{emp.name}</p>
                        <p className={`text-[11px] font-mono ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                          {emp.employee_id} • {emp.department}
                        </p>
                      </div>
                    </div>

                    <div>
                      {emp.face_registered ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                          isSelected
                            ? 'bg-emerald-400/25 text-emerald-100 border border-emerald-300/40'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <Check className="w-2.5 h-2.5" />
                          <span>Enrolled</span>
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-amber-400/25 text-amber-100 border border-amber-300/40'
                            : 'bg-[#FFF0E3] text-[#F07824] border border-[#F07824]/30'
                        }`}>
                          Pending
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Camera Capture, Consent & Enrollment (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Selected Employee Summary Card */}
          {selectedEmployee && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#DDF2FF] border border-[#078BD0]/30 flex items-center justify-center font-extrabold text-[#078BD0] text-lg">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h3 className="text-base font-extrabold text-[#12345A]">{selectedEmployee.name}</h3>
                    <span className="text-xs font-mono font-bold text-[#078BD0] bg-[#DDF2FF] px-2 py-0.5 rounded-md border border-[#078BD0]/30">
                      {selectedEmployee.employee_id}
                    </span>
                    {/* Enrollment Status Label */}
                    {selectedEmployee.face_registered ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                        <Check className="w-2.5 h-2.5" />
                        <span>Enrolled</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF0E3] text-[#F07824] border border-[#F07824]/30">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedEmployee.designation} • {selectedEmployee.department}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono">Shift: {selectedEmployee.shift_start_time} - {selectedEmployee.shift_end_time}</span>
                {selectedEmployee.face_registered && (
                  <button
                    type="button"
                    onClick={handleRemoveFace}
                    disabled={isDeleting}
                    className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition-all text-xs flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove Biometric Data"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleting ? 'Clearing...' : 'Clear Face'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-4 rounded-2xl text-xs flex items-start space-x-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              )}
              <span className="font-medium leading-relaxed">
                {typeof feedback.message === 'string'
                  ? feedback.message
                  : JSON.stringify(feedback.message)}
              </span>
            </div>
          )}

          {/* Webcam / Portrait Capture Viewport */}
          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Face Biometric Capture Viewport
              </span>
              <span className="text-xs text-[#078BD0] font-semibold">OpenCV 128-D Vector Model</span>
            </div>

            {/* Video or Photo Frame */}
            <div className="relative aspect-video w-full rounded-2xl bg-black border border-slate-200 overflow-hidden flex items-center justify-center">
              
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
                  <div className="w-48 h-64 rounded-[50%] border-2 border-dashed border-[#078BD0]/80 shadow-[0_0_50px_rgba(7,139,208,0.3)] flex items-center justify-center">
                    <span className="text-[11px] font-bold text-white bg-[#078BD0]/80 px-2 py-0.5 rounded-full">
                      Align Face Here
                    </span>
                  </div>
                </div>
              )}

              {/* Idle State when Camera is Off and No Photo is captured */}
              {!isCameraActive && !capturedImage && (
                <div className="text-center p-8 space-y-4">
                  {selectedEmployee?.photo_url && !brokenImageIds[`selected-${selectedEmployee.id}`] ? (
                    <div className="space-y-3">
                      <img
                        src={`${API_BASE_URL}${selectedEmployee.photo_url}`}
                        alt="Current registered face"
                        onError={() => handleImageError(`selected-${selectedEmployee.id}`)}
                        className="w-32 h-32 rounded-2xl object-cover mx-auto border-2 border-[#078BD0] shadow-xl"
                      />
                      <p className="text-xs font-semibold text-emerald-600">
                        Face already enrolled. You can take a new snapshot to update it.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-16 h-16 rounded-3xl bg-[#DDF2FF]/40 border border-[#078BD0]/20 flex items-center justify-center text-[#078BD0] mx-auto">
                        <Camera className="w-8 h-8 text-[#078BD0]" />
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Open your laptop camera or upload a clear frontal portrait photo to compute biometric encodings.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-center space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-bold shadow-lg shadow-[#078BD0]/25 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Start Laptop Webcam</span>
                    </button>

                    <label className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#12345A] text-xs font-semibold border border-slate-200 cursor-pointer transition-all shadow-sm">
                      <Upload className="w-4 h-4 text-[#078BD0]" />
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
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-2xl transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Snapshot</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2.5 rounded-xl bg-white/90 text-[#12345A] text-xs font-semibold hover:bg-white transition-all cursor-pointer"
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
                    className="px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-semibold transition-all backdrop-blur-md cursor-pointer"
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
            <div className="p-4 rounded-2xl bg-[#DDF2FF]/40 border border-[#078BD0]/20 space-y-2">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#078BD0] focus:ring-[#078BD0] w-4 h-4 bg-white"
                />
                <span className="text-xs text-[#12345A] leading-relaxed">
                  <strong className="text-[#12345A]">Employee Biometric Consent Verification:</strong> I confirm that the employee <span className="text-[#078BD0] font-bold">{selectedEmployee?.name || 'the employee'}</span> has given explicit consent for Gateway Software Solutions to capture, compute, and store 128-dimensional biometric facial embedding vectors for workplace attendance authentication and physical building security.
                </span>
              </label>
            </div>

            {/* Final Save Action Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                {capturedImage ? '✓ Portrait ready for analysis' : '• Waiting for photo capture'}
              </span>

              <button
                type="button"
                onClick={handleRegisterFace}
                disabled={submitting || !consentGiven || !capturedImage}
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-extrabold shadow-xl shadow-[#078BD0]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
