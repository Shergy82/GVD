import React, { useState } from 'react';
import { X, Copy, Calendar, AlertCircle } from 'lucide-react';
import type { UserProfile } from '../../types';
import { copyWeekForward, getWeekDays, formatDayHeader } from '../../services/plannerService';

interface CopyWeekModalProps {
  sourceMonday: string;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const CopyWeekModal: React.FC<CopyWeekModalProps> = ({
  sourceMonday,
  currentUser,
  onClose,
  onSuccess
}) => {
  const sourceDays = getWeekDays(sourceMonday);

  // Compute next week Monday default
  const sourceMonDate = new Date(sourceMonday);
  const targetMonDate = new Date(sourceMonDate);
  targetMonDate.setDate(targetMonDate.getDate() + 7);
  
  const [targetMonday, setTargetMonday] = useState(
    targetMonDate.toISOString().split('T')[0]
  );

  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCopying(true);
    setError(null);

    try {
      const res = await copyWeekForward({
        sourceMonday,
        targetMonday,
        actor: currentUser
      });
      onSuccess(res.createdCount);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to copy week forward.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Copy Week Forward</h3>
              <p className="text-xs text-slate-300">Duplicate active schedule into new drafts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCopy} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <span className="text-slate-500 block">Source Schedule Week:</span>
            <strong className="text-slate-900 block font-bold">
              {formatDayHeader(sourceDays[0])} — {formatDayHeader(sourceDays[6])}
            </strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Destination Week Monday <span className="text-red-500">*</span>
            </label>
            <input 
              type="date"
              value={targetMonday}
              onChange={(e) => setTargetMonday(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <strong className="block font-semibold">Copy Rules:</strong>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-800">
              <li>Copied bookings default to <strong>Draft</strong> status.</li>
              <li>Acceptance history is <strong>not</strong> carried forward.</li>
              <li>Cancelled bookings are automatically excluded.</li>
              <li>Rechecks eligibility and destination conflicts.</li>
            </ul>
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
              disabled={copying}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Copy className="w-4 h-4" />
              <span>{copying ? 'Copying Schedule...' : 'Copy Week Forward'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
