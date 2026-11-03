import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Camera, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Upload, 
  X, 
  Sparkles,
  Phone,
  Mail,
  Clock,
  Building,
  UserMinus,
  FileText,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { 
  getEmployeesApi, 
  createEmployeeApi, 
  updateEmployeeApi, 
  deleteEmployeeApi, 
  resignEmployeeApi,
  registerFaceApi, 
  removeFaceApi,
  getDepartmentsApi,
  createDepartmentApi,
  API_BASE_URL 
} from '../services/api';
import { DepartmentModal } from '../components/DepartmentModal';
import { formatTime12Hour } from '../utils/formatters';

export const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [resignReason, setResignReason] = useState('Voluntary Resignation');
  const [resigning, setResigning] = useState(false);

  // Quick department entry state inside add/edit
  const [customDeptInput, setCustomDeptInput] = useState('');
  const [showCustomDept, setShowCustomDept] = useState(false);

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: 'Engineering',
    designation: '',
    shift_start_time: '09:00',
    shift_end_time: '18:00',
  });

  // Face Registration State
  const [consentChecked, setConsentChecked] = useState(false);
  const [faceImageBase64, setFaceImageBase64] = useState(null);
  const [isCapturingWebcam, setIsCapturingWebcam] = useState(false);
  const [faceRegisterLoading, setFaceRegisterLoading] = useState(false);
  const [faceRegisterError, setFaceRegisterError] = useState('');

  const webcamVideoRef = useRef(null);
  const webcamStreamRef = useRef(null);

  // Load dynamic departments
  const loadDepartments = async () => {
    try {
      const data = await getDepartmentsApi();
      setDepartmentsList(data || []);
      if (data && data.length > 0 && !formData.department) {
        setFormData((prev) => ({ ...prev, department: data[0].name }));
      }
    } catch (err) {
      console.error('Failed to load dynamic departments:', err);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const departments = ['All', ...departmentsList.map((d) => d.name)];

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getEmployeesApi({
        department: departmentFilter !== 'All' ? departmentFilter : undefined,
        search: search.trim() ? search.trim() : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
      });
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [departmentFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEmployees();
  };

  // Open Add Modal
  const openAddModal = () => {
    // Generate next suggested code by calculating max numeric suffix across all permanent GSS IDs
    const maxNum = employees.reduce((max, e) => {
      const match = (e.employee_code || e.employee_id || '').match(/\d+/);
      if (match) {
        const val = parseInt(match[0], 10);
        return val > max ? val : max;
      }
      return max;
    }, 1000);
    const nextCode = `GSS-${maxNum + 1}`;
    setFormData({
      employee_code: nextCode,
      first_name: '',
      last_name: '',
      email: '',
      phone: '+91 ',
      department: departmentsList.length > 0 ? departmentsList[0].name : 'Engineering',
      designation: '',
      shift_start_time: '09:00',
      shift_end_time: '18:00',
    });
    setIsAddModalOpen(true);
  };

  // Create Employee
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      await createEmployeeApi(formData);
      setIsAddModalOpen(false);
      setSuccessMsg(`Permanent employee ${formData.first_name} ${formData.last_name} (${formData.employee_code}) created successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create employee');
    }
  };

  // Open Edit Modal
  const openEditModal = (emp) => {
    if (emp.employment_status === 'Resigned' || !emp.is_active) {
      openViewModal(emp);
      return;
    }
    setSelectedEmployee(emp);
    setFormData({
      employee_code: emp.employee_code,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone || '',
      department: emp.department,
      designation: emp.designation,
      shift_start_time: emp.shift_start_time || '09:00',
      shift_end_time: emp.shift_end_time || '18:00',
    });
    setIsEditModalOpen(true);
  };

  // Update Employee
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      await updateEmployeeApi(selectedEmployee.id, formData);
      setIsEditModalOpen(false);
      setSuccessMsg(`Employee details updated successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update employee');
    }
  };

  // Open Resignation Confirmation Modal
  const openResignModal = (emp) => {
    setSelectedEmployee(emp);
    setResignReason('Voluntary Resignation');
    setIsResignModalOpen(true);
  };

  // Confirm Resignation Process
  const handleConfirmResignation = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      setResigning(true);
      await resignEmployeeApi(selectedEmployee.id, resignReason.trim() || 'Voluntary Resignation');
      setIsResignModalOpen(false);
      setSuccessMsg(`Employee ${selectedEmployee.full_name} (${selectedEmployee.employee_code}) marked as Resigned. Permanent record preserved.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to process employee resignation');
    } finally {
      setResigning(false);
    }
  };

  // Open Read-Only View Modal for Resigned/Permanent records
  const openViewModal = (emp) => {
    setSelectedEmployee(emp);
    setIsViewModalOpen(true);
  };

  // Delete/Archive Employee (delegates safely to permanent resignation)
  const handleDeleteEmployee = async (emp) => {
    openResignModal(emp);
  };

  // Open Face Registration Modal
  const openFaceModal = (emp) => {
    setSelectedEmployee(emp);
    setConsentChecked(emp.consent_given || false);
    setFaceImageBase64(null);
    setFaceRegisterError('');
    setIsFaceModalOpen(true);
  };

  // Webcam in Face Modal
  const startModalWebcam = async () => {
    try {
      setIsCapturingWebcam(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      webcamStreamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play();
      }
    } catch (err) {
      console.error('Modal camera error:', err);
      alert('Could not access webcam. Please check permissions.');
      setIsCapturingWebcam(false);
    }
  };

  const stopModalWebcam = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    setIsCapturingWebcam(false);
  };

  const snapModalPhoto = () => {
    const video = webcamVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setFaceImageBase64(dataUrl);
    stopModalWebcam();
  };

  // File Upload handler for face
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFaceImageBase64(event.target.result);
      stopModalWebcam();
    };
    reader.readAsDataURL(file);
  };

  // Register Face with Consent
  const handleSaveFaceRegistration = async () => {
    if (!selectedEmployee) return;
    if (!consentChecked) {
      setFaceRegisterError('Biometric consent is mandatory before registering face data.');
      return;
    }
    if (!faceImageBase64) {
      setFaceRegisterError('Please capture or upload a clear face portrait.');
      return;
    }

    setFaceRegisterLoading(true);
    setFaceRegisterError('');

    try {
      await registerFaceApi(selectedEmployee.id, faceImageBase64, consentChecked);
      setIsFaceModalOpen(false);
      stopModalWebcam();
      setSuccessMsg(`Face biometric enrolled with consent for ${selectedEmployee.full_name}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchEmployees();
    } catch (err) {
      console.error('Face registration error:', err);
      setFaceRegisterError(err.response?.data?.detail || 'Failed to extract face features. Ensure lighting is clear.');
    } finally {
      setFaceRegisterLoading(false);
    }
  };

  // Remove Registered Face
  const handleRemoveFace = async (emp) => {
    if (!window.confirm(`Are you sure you want to remove registered face biometrics for ${emp.full_name}?`)) return;
    try {
      await removeFaceApi(emp.id);
      setSuccessMsg(`Face biometrics removed for ${emp.full_name}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove face data');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              Workforce Directory
            </span>
            <span className="text-xs text-slate-400">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Employee & Biometric Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Register personnel, manage shift parameters, and enroll face encodings with explicit employee consent.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsDeptModalOpen(true)}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all shadow-sm"
          >
            <Building className="w-4 h-4 text-cyan-400" />
            <span>Manage Departments</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Employee</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
        
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by GSS ID, name, or email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-none"
          />
        </form>

        {/* Filter Controls: Status & Department */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {['All', 'Active', 'Resigned'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === st
                    ? st === 'Resigned'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'All' ? 'All Status' : st}
              </button>
            ))}
          </div>

          {/* Department Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setDepartmentFilter(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  departmentFilter === dept
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Employee & GSS ID</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Department & Role</th>
                <th className="px-5 py-3.5">Contact Details</th>
                <th className="px-5 py-3.5">Shift Hours</th>
                <th className="px-5 py-3.5">Face Biometric Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {employees.length > 0 ? (
                employees.map((emp) => {
                  const isResigned = emp.employment_status === 'Resigned' || !emp.is_active;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Employee Profile */}
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3.5">
                          {emp.photo_url ? (
                            <img
                              src={`${API_BASE_URL}${emp.photo_url}`}
                              alt={emp.full_name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400 text-sm">
                              {emp.first_name ? emp.first_name.charAt(0) : (emp.name ? emp.name.charAt(0) : 'E')}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-white text-sm">{emp.full_name || emp.name}</p>
                            <span className="font-mono text-[11px] font-semibold text-indigo-400">
                              {emp.employee_code || emp.employee_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Employment Status Badge */}
                      <td className="px-5 py-4">
                        {isResigned ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="w-3 h-3" />
                              <span>Resigned</span>
                            </span>
                            {emp.resignation_date && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                {new Date(emp.resignation_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* Department & Role */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-200">{emp.department}</p>
                        <p className="text-[11px] text-slate-400">{emp.designation}</p>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4 space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{emp.email}</span>
                        </div>
                        {emp.phone && (
                          <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{emp.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Shift */}
                      <td className="px-5 py-4 font-mono text-slate-300 text-[11px]">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatTime12Hour(emp.shift_start_time || '09:00:00')} - {formatTime12Hour(emp.shift_end_time || '18:00:00')}</span>
                        </div>
                      </td>

                      {/* Biometric Status */}
                      <td className="px-5 py-4">
                        {isResigned ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            <span>Biometrics Revoked</span>
                          </span>
                        ) : emp.face_registered ? (
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Enrolled</span>
                            </span>
                            <button
                              onClick={() => handleRemoveFace(emp)}
                              title="Remove Biometric Data"
                              className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openFaceModal(emp)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 transition-all"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Enroll Face</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isResigned ? (
                            <button
                              onClick={() => openViewModal(emp)}
                              title="View Permanent Record (Read-Only)"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-all flex items-center space-x-1 px-2.5 text-[11px] font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Record</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => openFaceModal(emp)}
                                title="Update Biometrics"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 border border-slate-700 transition-all"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(emp)}
                                title="Edit Details"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openResignModal(emp)}
                                title="Mark as Resigned (Preserves Record & ID)"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/30 transition-all"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400 text-xs">
                    No employees found matching the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FACE REGISTRATION MODAL WITH EXPLICIT BIOMETRIC CONSENT   */}
      {/* ======================================================== */}
      {isFaceModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Enroll Face Recognition Biometrics
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedEmployee.full_name} ({selectedEmployee.employee_code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopModalWebcam();
                  setIsFaceModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {faceRegisterError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{faceRegisterError}</span>
              </div>
            )}

            {/* Webcam / Image Preview area */}
            <div className="relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden flex items-center justify-center">
              {isCapturingWebcam ? (
                <>
                  <video
                    ref={webcamVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 inset-x-0 flex justify-center space-x-2">
                    <button
                      type="button"
                      onClick={snapModalPhoto}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg"
                    >
                      Capture Snapshot
                    </button>
                    <button
                      type="button"
                      onClick={stopModalWebcam}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : faceImageBase64 ? (
                <div className="relative w-full h-full">
                  <img
                    src={faceImageBase64}
                    alt="Captured portrait"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFaceImageBase64(null)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-600 text-xs transition-colors"
                  >
                    Retake
                  </button>
                </div>
              ) : (
                <div className="text-center p-6 space-y-3">
                  <Camera className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Snap a clear frontal photo using your webcam or upload an existing portrait photo.
                  </p>
                  <div className="flex items-center justify-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={startModalWebcam}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm"
                    >
                      Use Webcam
                    </button>
                    <label className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700">
                      Upload File
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
            </div>

            {/* MANDATORY CONSENT CHECKBOX */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-2">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-900"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Biometric Consent Acknowledgment:</strong> I confirm that this employee has provided informed consent for Gateway Software Solutions to compute and store 128-dimensional facial embedding vectors for attendance logging and physical workplace security.
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  stopModalWebcam();
                  setIsFaceModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFaceRegistration}
                disabled={faceRegisterLoading || !consentChecked || !faceImageBase64}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 disabled:opacity-40 transition-all"
              >
                {faceRegisterLoading ? 'Analyzing & Enrolling...' : 'Save Face Biometrics'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD EMPLOYEE MODAL                                       */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>Add Gateway Software Employee</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsDeptModalOpen(true);
                      } else {
                        setFormData({ ...formData, department: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    {departments.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="__NEW__" className="text-indigo-400 font-bold">+ Manage / Add Department...</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@gatewaysoftware.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Job Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Shift Start (Grace +15m)
                  </label>
                  <input
                    type="time"
                    value={formData.shift_start_time}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Shift End
                  </label>
                  <input
                    type="time"
                    value={formData.shift_end_time}
                    onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg"
                >
                  Create Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT EMPLOYEE MODAL                                      */}
      {/* ======================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <span>Edit Employee: {formData.first_name} {formData.last_name}</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsDeptModalOpen(true);
                      } else {
                        setFormData({ ...formData, department: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    {departments.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="__NEW__" className="text-indigo-400 font-bold">+ Manage / Add Department...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Job Designation
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Shift Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.shift_start_time}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EMPLOYEE RESIGNATION CONFIRMATION MODAL                  */}
      {/* ======================================================== */}
      {isResignModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <UserMinus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Mark Employee as Resigned
                  </h3>
                  <p className="text-xs text-slate-400">
                    Permanent Record & Attendance History Preservation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsResignModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Employee Summary Card */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{selectedEmployee.full_name}</p>
                <p className="text-xs text-slate-400">{selectedEmployee.designation} • {selectedEmployee.department}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                  {selectedEmployee.employee_code}
                </span>
                <p className="text-[10px] text-slate-500 mt-1">Permanent GSS ID</p>
              </div>
            </div>

            {/* Permanent Policy Info Box */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Permanent Record & Resignation Policy</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1">
                <li><strong className="text-slate-200">GSS ID Preservation:</strong> The ID <span className="font-mono text-indigo-300">{selectedEmployee.employee_code}</span> will be permanently locked and cannot be reused.</li>
                <li><strong className="text-slate-200">Authentication Revocation:</strong> Login credentials and active JWT sessions are immediately blocked.</li>
                <li><strong className="text-slate-200">Biometrics Revocation:</strong> Face recognition vectors are cleared so the employee cannot check in at kiosks.</li>
                <li><strong className="text-slate-200">Attendance Integrity:</strong> All historical attendance logs and snapshots remain preserved for CEO audits.</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmResignation} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Resignation Reason / Notes
                </label>
                <textarea
                  required
                  rows={2}
                  value={resignReason}
                  onChange={(e) => setResignReason(e.target.value)}
                  placeholder="e.g. Voluntary Resignation, Career Advancement, Relocation..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resigning}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <UserMinus className="w-4 h-4" />
                  <span>{resigning ? 'Processing...' : 'Confirm Resignation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* READ-ONLY PERMANENT RECORD VIEW MODAL                    */}
      {/* ======================================================== */}
      {isViewModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Employee Permanent Record
                  </h3>
                  <p className="text-xs text-slate-400">
                    Read-Only Archive • Gateway Software Solutions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              {selectedEmployee.photo_url ? (
                <img
                  src={`${API_BASE_URL}${selectedEmployee.photo_url}`}
                  alt={selectedEmployee.full_name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-700"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400 text-lg">
                  {selectedEmployee.first_name ? selectedEmployee.first_name.charAt(0) : 'E'}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-white text-base">{selectedEmployee.full_name}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {selectedEmployee.employment_status || 'Resigned'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 font-mono text-xs">
                  <span className="text-indigo-400 font-bold">{selectedEmployee.employee_code}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">{selectedEmployee.designation}</span>
                </div>
                <p className="text-xs text-slate-500">{selectedEmployee.department}</p>
              </div>
            </div>

            {/* Detailed Properties Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Permanent GSS ID</span>
                <span className="font-mono font-bold text-indigo-300">{selectedEmployee.employee_code}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Employment Status</span>
                <span className="font-bold text-amber-400">{selectedEmployee.employment_status || 'Resigned'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Joining Date</span>
                <span className="text-slate-300">{selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Resignation Date</span>
                <span className="text-slate-300">{selectedEmployee.resignation_date ? new Date(selectedEmployee.resignation_date).toLocaleDateString() : 'Recorded'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Email Address</span>
                <span className="text-slate-300 truncate block">{selectedEmployee.email}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Phone Number</span>
                <span className="text-slate-300">{selectedEmployee.phone || 'N/A'}</span>
              </div>
            </div>

            {/* Resignation Reason Box */}
            {selectedEmployee.resignation_reason && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Recorded Resignation Reason</span>
                <p className="text-slate-300 italic">"{selectedEmployee.resignation_reason}"</p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-[11px] text-slate-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Historical attendance records and logs remain permanently linked and accessible in CEO reports.</span>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Department Management Modal */}
      <DepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        onDepartmentsChanged={loadDepartments}
      />

    </div>
  );
};
