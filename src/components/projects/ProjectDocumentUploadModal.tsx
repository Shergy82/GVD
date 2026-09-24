import React, { useState } from 'react';
import { X, Upload, FileText, Lock, Users, AlertCircle, RefreshCw } from 'lucide-react';
import type { ProjectDocumentCategory, ProjectDocumentVisibility, UserProfile, ProjectMember } from '../../types';
import { uploadProjectDocument } from '../../services/projectService';

interface ProjectDocumentUploadModalProps {
  projectId: string;
  projectMembers: ProjectMember[];
  currentUser: UserProfile;
  replacingDocId?: string;
  replacingDocTitle?: string;
  replacingDocVersion?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProjectDocumentUploadModal: React.FC<ProjectDocumentUploadModalProps> = ({
  projectId,
  projectMembers,
  currentUser,
  replacingDocId,
  replacingDocTitle,
  replacingDocVersion,
  onClose,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState(replacingDocTitle || '');
  const [category, setCategory] = useState<ProjectDocumentCategory>('Drawings');
  const [visibility, setVisibility] = useState<ProjectDocumentVisibility>(
    currentUser.applicationCategory === 'GVD Employee' ? 'All Authorised Project Participants' : 'GVD Project Team Only'
  );
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title && !replacingDocTitle) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a document file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a display title for the document.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await uploadProjectDocument(
        projectId,
        selectedFile,
        {
          title: title.trim(),
          category,
          visibility,
          description: description.trim(),
          allowedUserIds: selectedUserIds,
          replacingDocId
        },
        currentUser
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-slate-800 rounded-lg text-indigo-400">
              {replacingDocId ? <RefreshCw className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base">
                {replacingDocId ? `Publish Revision (v${(replacingDocVersion || 1) + 1})` : 'Upload Project Document'}
              </h3>
              <p className="text-xs text-slate-300">Official site plans, drawings & safety files</p>
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

          {replacingDocId && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Revision Note:</strong> Uploading this new file will publish <strong>v{(replacingDocVersion || 1) + 1}</strong>. The earlier version (v{replacingDocVersion || 1}) will be preserved in document history with warning tags for users viewing superseded files.
            </div>
          )}

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document File (PDF, DWG, DOCX, XLSX, images) <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex justify-center px-4 py-4 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-400 transition bg-slate-50">
              <div className="space-y-1 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-400" />
                <div className="flex text-xs text-slate-600">
                  <label htmlFor="doc-file-input" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 px-2 py-0.5 border border-indigo-200">
                    <span>Choose File</span>
                    <input id="doc-file-input" type="file" onChange={handleFileSelect} className="sr-only" />
                  </label>
                  <p className="pl-1 pt-0.5">or drag and drop</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  {selectedFile ? selectedFile.name : 'PDF up to 50MB. A3 drawings will preserve full orientation & quality.'}
                </p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Display Title <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ground Floor Electrical Layout Rev C"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProjectDocumentCategory)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="Drawings">Drawings</option>
              <option value="Scope & Specifications">Scope & Specifications</option>
              <option value="Site/Safety Information">Site/Safety Information</option>
              <option value="General Documents">General Documents</option>
            </select>
          </div>

          {/* Visibility Audience */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Intended Audience & Access Setting</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ProjectDocumentVisibility)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
            >
              <option value="All Authorised Project Participants">All Authorised Project Participants (GVD + Contractors)</option>
              <option value="GVD Project Team Only">GVD Project Team Only (Internal Staff)</option>
              <option value="Selected Project People">Selected Project People Only</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>GVD-only choice restricts access to assigned GVD staff & Admin.</span>
            </p>
          </div>

          {/* Selected People checklist if Selected Project People */}
          {visibility === 'Selected Project People' && (
            <div className="p-3 bg-slate-50 border rounded-lg max-h-36 overflow-y-auto space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Permitted Members:</label>
              {projectMembers.map(m => (
                <label key={m.uid} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedUserIds.includes(m.uid)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUserIds([...selectedUserIds, m.uid]);
                      else setSelectedUserIds(selectedUserIds.filter(id => id !== m.uid));
                    }}
                    className="rounded text-indigo-600"
                  />
                  <span>{m.fullName} ({m.companyName || m.trade || m.role})</span>
                </label>
              ))}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Short Description</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Updated with client changes regarding consumer unit position"
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

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
              disabled={uploading}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow disabled:opacity-50"
            >
              {uploading ? 'Uploading File...' : (replacingDocId ? 'Publish Revision' : 'Upload Document')}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
