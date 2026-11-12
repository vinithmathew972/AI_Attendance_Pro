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
  getEmployeeDeletionPreviewApi,
  permanentlyDeleteEmployeeApi,
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
  const [warningMsg, setWarningMsg] = useState('');

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

  // Permanent Delete Modal State (Resigned Employees Only)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState(null);
  const [loadingDeletePreview, setLoadingDeletePreview] = useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [isDeletingPermanent, setIsDeletingPermanent] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  // Open Permanent Deletion Modal (Resigned Employees Only)
  const openDeleteModal = async (emp) => {
    setSelectedEmployee(emp);
    setDeleteConfirmChecked(false);
    setDeleteError('');
    setDeletePreview(null);
    setIsDeleteModalOpen(true);
    try {
      setLoadingDeletePreview(true);
      const preview = await getEmployeeDeletionPreviewApi(emp.id);
      setDeletePreview(preview);
    } catch (err) {
      console.error('Failed to load deletion preview:', err);
      setDeleteError(err.response?.data?.detail || 'Failed to load employee deletion preview.');
    } finally {
      setLoadingDeletePreview(false);
    }
  };

  // Execute Permanent Deletion (Requires Explicit Two-Step Checkbox Confirmation)
  const handleConfirmPermanentDelete = async (e) => {
    if (e) e.preventDefault();
    if (!selectedEmployee || !deleteConfirmChecked || isDeletingPermanent) return;
    try {
      setIsDeletingPermanent(true);
      setDeleteError('');
      const res = await permanentlyDeleteEmployeeApi(selectedEmployee.id);
      setIsDeleteModalOpen(false);

      if (res.isPartialSuccess || res.partial_success || (res.failed_file_count && res.failed_file_count > 0)) {
        const failedCount = res.failed_file_count || res.files_failed_count || 1;
        setWarningMsg(
          `Partial Cleanup: Resigned employee ${selectedEmployee.full_name} (${selectedEmployee.employee_code}) and ${res.deleted_attendances ?? 0} attendance record(s) were permanently removed from the database. However, ${failedCount} physical snapshot file(s) could not be removed from disk.`
        );
        setTimeout(() => setWarningMsg(''), 8000);
      } else {
        setSuccessMsg(
          `Resigned employee ${selectedEmployee.full_name} (${selectedEmployee.employee_code}) and ${res.deleted_attendances ?? 0} attendance record(s) permanently deleted.`
        );
        setTimeout(() => setSuccessMsg(''), 6000);
      }

      fetchEmployees();
    } catch (err) {
      console.error('Permanent deletion failed:', err);
      setDeleteError(err.response?.data?.detail || 'Failed to permanently delete employee.');
    } finally {
      setIsDeletingPermanent(false);
    }
  };

  // Delete/Archive Employee (delegates safely to permanent resignation or deletion depending on status)
  const handleDeleteEmployee = async (emp) => {
    const isResigned = emp.employment_status === 'Resigned' || !emp.is_active;
    if (isResigned) {
      openDeleteModal(emp);
    } else {
      openResignModal(emp);
    }
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full overflow-x-hidden text-[#12345A]">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#078BD0] bg-[#DDF2FF] px-2.5 py-0.5 rounded-full border border-[#078BD0]/30">
              Workforce Directory
            </span>
            <span className="text-xs text-slate-500">• Gateway Software Solutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#12345A] tracking-tight mt-1">
            Employee & Biometric Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Register personnel, manage shift parameters, and enroll face encodings with explicit employee consent.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setIsDeptModalOpen(true)}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#DDF2FF]/40 text-[#12345A] text-xs font-bold border border-slate-200 transition-all shadow-xs cursor-pointer"
          >
            <Building className="w-4 h-4 text-[#078BD0]" />
            <span>Manage Departments</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Employee</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Partial Cleanup Warning Banner */}
      {warningMsg && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{warningMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Status Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#078BD0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by GSS ID, name, or email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 focus:border-[#078BD0] focus:ring-2 focus:ring-[#DDF2FF] text-xs text-[#12345A] placeholder-slate-400 outline-none shadow-xs transition-all"
          />
        </form>

        {/* Status Filter */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs shrink-0">
          {['All', 'Active', 'Resigned'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? st === 'Resigned'
                    ? 'bg-[#FFF0E3] text-[#F07824] border border-[#F07824]/30 shadow-xs'
                    : 'bg-[#078BD0] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#12345A] hover:bg-slate-50'
              }`}
            >
              {st === 'All' ? 'All Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Department Filter Bar - Independent Horizontal Scroll Container */}
      <div className="w-full max-w-full min-w-0 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs">
        <div 
          className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap py-1 px-1 scrollbar-thin"
          style={{ overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap' }}
        >
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 shrink-0 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-[#078BD0]" />
              <span>Dept:</span>
            </span>
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setDepartmentFilter(dept)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                  departmentFilter === dept
                    ? 'bg-[#078BD0] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-[#12345A] hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Employees Table - Light Theme with Stationary Positioning */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs w-full">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#DDF2FF] text-[#12345A] uppercase tracking-wider font-bold border-b border-[#078BD0]/20">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap">Register Number</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Employee</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Department</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Shift Timings</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 text-xs">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-[#078BD0] border-t-transparent rounded-full animate-spin" />
                      <span>Loading employees...</span>
                    </div>
                  </td>
                </tr>
              ) : employees.length > 0 ? (
                employees.map((emp) => {
                  const isResigned = emp.employment_status === 'Resigned' || !emp.is_active;
                  return (
                    <tr key={emp.id} className="hover:bg-[#DDF2FF]/20 transition-colors">
                      {/* 1. Register Number */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-[#078BD0] bg-[#DDF2FF] border border-[#078BD0]/30 px-2.5 py-1 rounded-lg">
                          {emp.employee_code || emp.employee_id}
                        </span>
                      </td>

                      {/* 2. Employee Info & Photo */}
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3.5">
                          {emp.photo_url ? (
                            <img
                              src={`${API_BASE_URL}${emp.photo_url}`}
                              alt={emp.full_name || emp.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-[#DDF2FF] border border-[#078BD0]/20 flex items-center justify-center font-bold text-[#078BD0] text-sm shadow-xs shrink-0">
                              {emp.first_name ? emp.first_name.charAt(0) : (emp.name ? emp.name.charAt(0) : 'E')}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-[#12345A] text-sm truncate">{emp.full_name || emp.name}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 text-slate-500 text-xs mt-0.5">
                              <span className="flex items-center space-x-1 truncate">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{emp.email}</span>
                              </span>
                              {emp.phone && (
                                <>
                                  <span className="hidden sm:inline text-slate-300">•</span>
                                  <span className="flex items-center space-x-1 shrink-0">
                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{emp.phone}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Department & Designation */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="font-semibold text-slate-800 text-xs">{emp.department}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{emp.designation || 'Staff'}</p>
                      </td>

                      {/* 4. Shift Timings */}
                      <td className="px-5 py-4 font-mono text-slate-700 text-xs whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {formatTime12Hour(emp.shift_start_time || '09:00:00')} - {formatTime12Hour(emp.shift_end_time || '18:00:00')}
                          </span>
                        </div>
                      </td>

                      {/* 5. Status & Biometric Indicator */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {isResigned ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>Resigned</span>
                              </span>
                              {emp.resignation_date && (
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {new Date(emp.resignation_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </span>
                          )}

                          {/* Biometric Status Pill */}
                          {!isResigned && (
                            emp.face_registered ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-600 font-medium pl-0.5">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                <span>Face Enrolled</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openFaceModal(emp)}
                                className="inline-flex items-center space-x-1 text-[10px] text-[#078BD0] hover:text-[#0675b0] font-bold pl-0.5 hover:underline cursor-pointer"
                              >
                                <Camera className="w-3 h-3" />
                                <span>Enroll Face</span>
                              </button>
                            )
                          )}
                        </div>
                      </td>

                      {/* 6. Actions - Eye (View), Pencil (Edit), Trash (Delete) */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Eye icon - View employee details */}
                          <button
                            type="button"
                            onClick={() => openViewModal(emp)}
                            title="View employee details"
                            aria-label="View employee details"
                            className="p-2 rounded-lg bg-[#DDF2FF] text-[#078BD0] hover:bg-[#cbe8fd] border border-[#078BD0]/30 transition-colors shadow-xs cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Pencil/Edit icon - Edit employee details */}
                          <button
                            type="button"
                            onClick={() => openEditModal(emp)}
                            title="Edit employee details"
                            aria-label="Edit employee details"
                            className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-[#DDF2FF]/40 hover:text-[#078BD0] border border-slate-200 transition-colors shadow-xs cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Trash/Delete icon - Delete employee */}
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp)}
                            title={isResigned ? "Permanently Delete Resigned Employee" : "Delete / Mark as Resigned"}
                            aria-label="Delete employee"
                            className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200 transition-colors shadow-xs cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 text-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 text-[#12345A]">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-[#DDF2FF] text-[#078BD0] border border-[#078BD0]/30">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#12345A]">
                    Enroll Face Recognition Biometrics
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedEmployee.full_name} ({selectedEmployee.employee_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopModalWebcam();
                  setIsFaceModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {faceRegisterError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{faceRegisterError}</span>
              </div>
            )}

            {/* Webcam / Image Preview area */}
            <div className="relative aspect-video rounded-2xl bg-slate-900 border border-slate-200 overflow-hidden flex items-center justify-center">
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
                  <Camera className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-300">
                    Snap a clear frontal photo using your webcam or upload an existing portrait photo.
                  </p>
                  <div className="flex items-center justify-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={startModalWebcam}
                      className="px-3.5 py-1.5 rounded-lg bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Use Webcam
                    </button>
                    <label className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700">
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
            <div className="p-3.5 rounded-2xl bg-[#DDF2FF]/40 border border-[#078BD0]/30 space-y-2">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#078BD0] focus:ring-[#078BD0] w-4 h-4 bg-white"
                />
                <span className="text-xs text-[#12345A] leading-relaxed">
                  <strong className="text-[#12345A]">Biometric Consent Acknowledgment:</strong> I confirm that this employee has provided informed consent for Gateway Software Solutions to compute and store 128-dimensional facial embedding vectors for attendance logging and physical workplace security.
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  stopModalWebcam();
                  setIsFaceModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#12345A] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFaceRegistration}
                disabled={faceRegisterLoading || !consentChecked || !faceImageBase64}
                className="px-5 py-2 rounded-xl bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-bold shadow-xs disabled:opacity-40 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 text-[#12345A]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-[#12345A] flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-[#078BD0]" />
                <span>Add Gateway Software Employee</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#12345A] uppercase tracking-wider mb-1">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-[#12345A] outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
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
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-[#12345A] outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  >
                    {departments.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="__NEW__" className="text-[#078BD0] font-bold">+ Manage / Add Department...</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@gatewaysoftware.com"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Job Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Shift Start (Grace +15m)
                  </label>
                  <input
                    type="time"
                    value={formData.shift_start_time}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Shift End
                  </label>
                  <input
                    type="time"
                    value={formData.shift_end_time}
                    onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-bold shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 text-[#12345A]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-[#12345A] flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-[#078BD0]" />
                <span>Edit Employee: {formData.first_name} {formData.last_name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
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
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-[#12345A] outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  >
                    {departments.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="__NEW__" className="text-[#078BD0] font-bold">+ Manage / Add Department...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Job Designation
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Shift Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.shift_start_time}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Shift End Time
                </label>
                <input
                  type="time"
                  value={formData.shift_end_time}
                  onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:border-[#078BD0] focus:ring-1 focus:ring-[#078BD0]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-bold shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <UserMinus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Mark Employee as Resigned
                  </h3>
                  <p className="text-xs text-slate-500">
                    Permanent Record & Attendance History Preservation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResignModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Employee Summary Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{selectedEmployee.full_name}</p>
                <p className="text-xs text-slate-500">{selectedEmployee.designation} • {selectedEmployee.department}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  {selectedEmployee.employee_code}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">Permanent GSS ID</p>
              </div>
            </div>

            {/* Permanent Policy Info Box */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1.5 text-slate-700">
              <div className="flex items-center space-x-1.5 text-amber-800 font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Permanent Record & Resignation Policy</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                <li><strong className="text-slate-800">GSS ID Preservation:</strong> The ID <span className="font-mono text-indigo-700">{selectedEmployee.employee_code}</span> will be permanently locked and cannot be reused.</li>
                <li><strong className="text-slate-800">Authentication Revocation:</strong> Login credentials and active JWT sessions are immediately blocked.</li>
                <li><strong className="text-slate-800">Biometrics Revocation:</strong> Face recognition vectors are cleared so the employee cannot check in at kiosks.</li>
                <li><strong className="text-slate-800">Attendance Integrity:</strong> All historical attendance logs and snapshots remain preserved for CEO audits.</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmResignation} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Resignation Reason / Notes
                </label>
                <textarea
                  required
                  rows={2}
                  value={resignReason}
                  onChange={(e) => setResignReason(e.target.value)}
                  placeholder="e.g. Voluntary Resignation, Career Advancement, Relocation..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resigning}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center space-x-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Employee Permanent Record
                  </h3>
                  <p className="text-xs text-slate-500">
                    Read-Only Archive • Gateway Software Solutions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              {selectedEmployee.photo_url ? (
                <img
                  src={`${API_BASE_URL}${selectedEmployee.photo_url}`}
                  alt={selectedEmployee.full_name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-indigo-600 text-lg shadow-xs">
                  {selectedEmployee.first_name ? selectedEmployee.first_name.charAt(0) : 'E'}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-slate-900 text-base">{selectedEmployee.full_name}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {selectedEmployee.employment_status || 'Resigned'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 font-mono text-xs">
                  <span className="text-indigo-700 font-bold">{selectedEmployee.employee_code}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{selectedEmployee.designation}</span>
                </div>
                <p className="text-xs text-slate-500">{selectedEmployee.department}</p>
              </div>
            </div>

            {/* Detailed Properties Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Permanent GSS ID</span>
                <span className="font-mono font-bold text-indigo-700">{selectedEmployee.employee_code}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Employment Status</span>
                <span className="font-bold text-amber-700">{selectedEmployee.employment_status || 'Resigned'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Joining Date</span>
                <span className="text-slate-700">{selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Resignation Date</span>
                <span className="text-slate-700">{selectedEmployee.resignation_date ? new Date(selectedEmployee.resignation_date).toLocaleDateString() : 'Recorded'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Email Address</span>
                <span className="text-slate-700 truncate block">{selectedEmployee.email}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Phone Number</span>
                <span className="text-slate-700">{selectedEmployee.phone || 'N/A'}</span>
              </div>
            </div>

            {/* Resignation Reason Box */}
            {selectedEmployee.resignation_reason && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Recorded Resignation Reason</span>
                <p className="text-slate-700 italic">"{selectedEmployee.resignation_reason}"</p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-slate-600 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Historical attendance records and logs remain permanently linked and accessible in CEO reports.</span>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PERMANENT DELETE MODAL FOR RESIGNED EMPLOYEES             */}
      {/* ======================================================== */}
      {isDeleteModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative text-slate-900">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Permanently Delete Employee</h3>
                  <p className="text-xs text-rose-600 font-medium mt-0.5">
                    Critical Administrative Action • Resigned Staff Only
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDeletingPermanent && setIsDeleteModalOpen(false)}
                disabled={isDeletingPermanent}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Alert */}
            {deleteError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Employee Details Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{selectedEmployee.full_name}</h4>
                  <p className="font-mono text-xs text-indigo-700 font-semibold">{selectedEmployee.employee_code}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {selectedEmployee.employment_status || 'Resigned'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Department</span>
                  <p className="text-slate-700 font-medium">{selectedEmployee.department}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Designation</span>
                  <p className="text-slate-700 font-medium">{selectedEmployee.designation}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Associated Attendance Records:</span>
                {loadingDeletePreview ? (
                  <span className="text-slate-400 animate-pulse text-[11px]">Counting records...</span>
                ) : (
                  <span className="font-bold font-mono text-amber-700">
                    {deletePreview?.attendance_count ?? 0} record(s)
                  </span>
                )}
              </div>
            </div>

            {/* Critical Warning Banner */}
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold text-rose-700 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Warning: Irreversible Deletion</span>
              </p>
              <p className="text-[11px] leading-relaxed text-rose-700">
                This will permanently remove this employee record, their biometric face profile, and all {deletePreview?.attendance_count ?? 0} attendance records from the database. This action CANNOT be undone.
              </p>
            </div>

            {/* Two-Step Confirmation Checkbox */}
            <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
              <input
                type="checkbox"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                disabled={isDeletingPermanent || loadingDeletePreview}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 bg-white shrink-0"
              />
              <span className="text-xs text-slate-700 select-none">
                I understand this deletion is permanent and explicitly authorize the removal of this resigned employee and their associated records.
              </span>
            </label>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingPermanent}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={!deleteConfirmChecked || isDeletingPermanent || loadingDeletePreview}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeletingPermanent ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Permanently Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete Employee</span>
                  </>
                )}
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
