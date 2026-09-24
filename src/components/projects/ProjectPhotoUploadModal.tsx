import React, { useState } from 'react';
import { X, Camera, Image as ImageIcon, Upload, AlertCircle } from 'lucide-react';
import type { ProjectPhotoCategory, ProjectDocumentVisibility, UserProfile } from '../../types';
import { uploadProjectPhoto } from '../../services/projectService';

interface ProjectPhotoUploadModalProps {
  projectId: string;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProjectPhotoUploadModal: React.FC<ProjectPhotoUploadModalProps> = ({
  projectId,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<ProjectPhotoCategory>('Progress');
  const [caption, setCaption] = useState('');
  const [capturedAt, setCapturedAt] = useState(new Date().toISOString().split('T')[0]);
  const [visibility, setVisibility] = useState<ProjectDocumentVisibility>('All Authorised Project Participants');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      if (file.lastModified) {
        const fileDate = new Date(file.lastModified).toISOString().split('T')[0];
        setCapturedAt(fileDate);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select or capture a site photo.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await uploadProjectPhoto(
        projectId,
        selectedFile,
        {
          category,
          caption: caption.trim(),
          capturedAt,
          visibility
        },
        currentUser
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload site photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Upload Site Photo</h3>
              <p className="text-xs text-slate-300">Progress, evidence & site condition photos</p>
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

          {/* Camera / Image Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Photo File <span className="text-red-500">*</span>
            </label>
            
            {previewUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video bg-black flex items-center justify-center">
                <img src={previewUrl} alt="Upload Preview" className="max-h-full max-w-full object-contain" />
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-full hover:bg-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition text-center">
                  <Camera className="w-7 h-7 text-emerald-600 mb-1" />
                  <span className="text-xs font-semibold text-slate-700">Take Photo</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="sr-only" />
                </label>

                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer transition text-center">
                  <ImageIcon className="w-7 h-7 text-indigo-600 mb-1" />
                  <span className="text-xs font-semibold text-slate-700">Photo Library</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
                </label>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Photo Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProjectPhotoCategory)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
            >
              <option value="Before">Before (Initial Site State)</option>
              <option value="Progress">Progress (Ongoing Work)</option>
              <option value="Completion">Completion (Finished Stage)</option>
              <option value="Other">Other / Miscellaneous</option>
            </select>
          </div>

          {/* Photo Capture Date vs Upload Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Photo Taken Date</label>
              <input 
                type="date" 
                value={capturedAt}
                onChange={(e) => setCapturedAt(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Server Upload Time</label>
              <input 
                type="text" 
                disabled 
                value="Auto (Server Timestamp)" 
                className="w-full px-3 py-1.5 border rounded-lg text-xs bg-slate-100 text-slate-500"
              />
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Caption / Notes</label>
            <input 
              type="text" 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Consumer unit wall chased out ready for cabling"
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Visibility */}
          {currentUser.applicationCategory === 'GVD Employee' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Visibility Audience</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ProjectDocumentVisibility)}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="All Authorised Project Participants">All Authorised Project Participants</option>
                <option value="GVD Project Team Only">GVD Project Team Only (Restricted)</option>
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
              disabled={uploading}
              className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow disabled:opacity-50"
            >
              {uploading ? 'Uploading Photo...' : 'Upload Site Photo'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
