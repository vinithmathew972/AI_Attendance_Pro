import React, { useState, useEffect } from 'react';
import { Building2, X, Plus, Edit2, Check, AlertCircle, Trash2, Users } from 'lucide-react';
import { getDepartmentsApi, createDepartmentApi, updateDepartmentApi, deleteDepartmentApi } from '../services/api';

export const DepartmentModal = ({ isOpen, onClose, onDepartmentsChanged }) => {
  const [departments, setDepartments] = useState([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getDepartmentsApi();
      setDepartments(data || []);
      if (onDepartmentsChanged) onDepartmentsChanged(data || []);
    } catch (err) {
      setError('Failed to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDepartments();
      setNewDeptName('');
      setEditingId(null);
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    try {
      setLoading(true);
      setError('');
      await createDepartmentApi({ name: newDeptName.trim() });
      setSuccess(`Department "${newDeptName.trim()}" created successfully!`);
      setNewDeptName('');
      setTimeout(() => setSuccess(''), 3000);
      await loadDepartments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create department.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (dept) => {
    setEditingId(dept.id);
    setEditingName(dept.name);
    setError('');
  };

  const handleSaveEdit = async (id) => {
    if (!editingName.trim()) return;

    try {
      setLoading(true);
      setError('');
      await updateDepartmentApi(id, { name: editingName.trim() });
      setSuccess('Department updated successfully.');
      setEditingId(null);
      setTimeout(() => setSuccess(''), 3000);
      await loadDepartments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update department.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 shadow-2xl space-y-5 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Dynamic Department Management</h3>
              <p className="text-[11px] text-slate-500">Add, rename, and manage company departments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start space-x-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Add New Department Input */}
        <form onSubmit={handleCreate} className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Create New Department
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              required
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="e.g. Research & Development"
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !newDeptName.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Existing Departments List */}
        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Departments ({departments.length})
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all"
              >
                {editingId === dept.id ? (
                  <div className="flex items-center space-x-2 flex-1 mr-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-500 text-xs text-slate-900 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(dept.id)}
                      className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:text-slate-900"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-semibold text-slate-800">{dept.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 font-mono flex items-center space-x-1 border border-slate-200">
                      <Users className="w-2.5 h-2.5" />
                      <span>{dept.employee_count || 0}</span>
                    </span>
                  </div>
                )}

                {editingId !== dept.id && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleStartEdit(dept)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                      title="Rename Department"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
