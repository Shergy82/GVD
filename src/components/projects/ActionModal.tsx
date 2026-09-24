import React, { useState } from 'react';
import { X, CheckSquare, MessageSquare, AlertCircle, Calendar } from 'lucide-react';
import type { ProjectDocumentVisibility, ProjectMember, UserProfile } from '../../types';
import { createProjectAction } from '../../services/projectService';

interface ActionModalProps {
  projectId: string;
  projectReference: string;
  responsibleManagerUid: string;
  responsibleManagerName: string;
  projectMembers: ProjectMember[];
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  projectId,
  projectReference,
  responsibleManagerUid,
  responsibleManagerName,
  projectMembers,
  currentUser,
  onClose,
  onSuccess
}) => {
  const isContractor = currentUser.applicationCategory !== 'GVD Employee';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedUserUid, setAssignedUserUid] = useState(
    isContractor ? responsibleManagerUid : (projectMembers[0]?.uid || '')
  );
  const [dueDate, setDueDate] = useState('');
  const [visibility, setVisibility] = useState<ProjectDocumentVisibility>(
    isContractor ? 'Selected Project People' : 'All Authorised Project Participants'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for the action or query.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const assignedMember = projectMembers.find(m => m.uid === assignedUserUid);
      const assignedName = assignedMember ? assignedMember.fullName : (isContractor ? responsibleManagerName : 'Unassigned');

      await createProjectAction(
        projectId,
        projectReference,
        {
          title: title.trim(),
          description: description.trim(),
          assignedUserUid,
          assignedUserName: assignedName,
          dueDate,
          visibility
        },
        currentUser
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create action or query.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              {isContractor ? <MessageSquare className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base">
                {isContractor ? 'Raise Site Query / Question' : 'Create Project Action'}
              </h3>
              <p className="text-xs text-slate-300">{projectReference}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isContractor ? 'Query Title / Question' : 'Action Title'} <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isContractor ? 'e.g. Clarification on consumer unit height' : 'e.g. Verify main gas bonding before plastering'}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assign To</label>
            <select
              value={assignedUserUid}
              onChange={(e) => setAssignedUserUid(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
            >
              {isContractor ? (
                <option value={responsibleManagerUid}>Responsible GVD Manager ({responsibleManagerName})</option>
              ) : (
                projectMembers.map(m => (
                  <option key={m.uid} value={m.uid}>
                    {m.fullName} — {m.companyName || m.trade || m.role}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Due Date</label>
            <input 
              type="date" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Details & Context</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide clear context or instructions..."
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {!isContractor && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Audience & Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ProjectDocumentVisibility)}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="All Authorised Project Participants">All Authorised Project Participants</option>
                <option value="GVD Project Team Only">GVD Project Team Only</option>
                <option value="Selected Project People">Selected Participants</option>
              </select>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow disabled:opacity-50"
            >
              {saving ? 'Submitting...' : (isContractor ? 'Submit Query' : 'Create Action')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
