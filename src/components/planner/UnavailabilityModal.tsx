import React, { useState } from 'react';
import { X, CalendarX, AlertCircle, CheckCircle } from 'lucide-react';
import type { UnavailabilityCategory, BookingSlot, UserProfile } from '../../types';
import { requestUnavailability, formatLocalDate } from '../../services/plannerService';

interface UnavailabilityModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const UnavailabilityModal: React.FC<UnavailabilityModalProps> = ({
  currentUser,
  onClose,
  onSuccess
}) => {
  const isGvd = currentUser.applicationCategory === 'GVD Employee';

  const [startDate, setStartDate] = useState(formatLocalDate(new Date()));
  const [endDate, setEndDate] = useState(formatLocalDate(new Date()));
  const [slot, setSlot] = useState<BookingSlot>('Full Day');
  const [category, setCategory] = useState<UnavailabilityCategory>('Holiday');
  const [reason, setReason] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await requestUnavailability(
        {
          startDate,
          endDate,
          slot,
          category,
          reason: reason.trim()
        },
        currentUser
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit unavailability request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <CalendarX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {isGvd ? 'Record Absence / Unavailability' : 'Submit Unavailability Request'}
              </h3>
              <p className="text-xs text-slate-300">Holiday, sickness, or training notice</p>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as UnavailabilityCategory)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium"
            >
              <option value="Holiday">Holiday / Annual Leave</option>
              <option value="Sickness">Sickness / Medical</option>
              <option value="Training">Training / Course</option>
              <option value="Other">Other Personal Commitment</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">End Date</label>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Time Slot</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as BookingSlot)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
            >
              <option value="Full Day">Full Day</option>
              <option value="Morning">Morning Only</option>
              <option value="Afternoon">Afternoon Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Notes / Reason Details</label>
            <input 
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Private notes (Restricted to GVD Planners)"
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              General planners and project views display only "Unavailable" without revealing private reasons.
            </p>
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
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : (isGvd ? 'Record Absence' : 'Submit Unavailability')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
