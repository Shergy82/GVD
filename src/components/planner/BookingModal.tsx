import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Building, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import type { 
  ProjectRecord, 
  UserProfile, 
  BookingSlot, 
  BookingStatus, 
  PlanningBatchConflict 
} from '../../types';
import { 
  createBookingBatch, 
  formatLocalDate, 
  getWeekDays, 
  getMondayOfDate 
} from '../../services/plannerService';
import { fetchProjects } from '../../services/projectService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface BookingModalProps {
  initialProjectId?: string;
  initialPersonId?: string;
  initialDate?: string;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  initialProjectId,
  initialPersonId,
  initialDate = formatLocalDate(new Date()),
  currentUser,
  onClose,
  onSuccess
}) => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>(initialPersonId ? [initialPersonId] : []);
  
  // Date Selection
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState<string>(initialDate);
  const [rangeStart, setRangeStart] = useState<string>(initialDate);
  const [rangeEnd, setRangeEnd] = useState<string>(initialDate);
  const [includeWeekends, setIncludeWeekends] = useState(false);

  // Slot & Instructions
  const [slot, setSlot] = useState<BookingSlot>('Full Day');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:30');
  const [instructions, setInstructions] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<PlanningBatchConflict[]>([]);

  useEffect(() => {
    async function loadFormOptions() {
      try {
        setLoadingData(true);
        // Load active projects
        const projs = await fetchProjects(currentUser, { isArchived: false });
        // Filter projects that can receive bookings
        const bookableProjs = projs.filter(p => ['Draft', 'Planned', 'In Progress'].includes(p.status));
        setProjects(bookableProjs);

        if (!selectedProjectId && bookableProjs.length > 0) {
          setSelectedProjectId(bookableProjs[0].id);
        }

        // Load approved, planningEligible individuals
        const usersSnap = await getDocs(query(
          collection(db, 'users'),
          where('status', '==', 'approved'),
          where('planningEligible', '==', true)
        ));

        const loadedPeople: UserProfile[] = [];
        usersSnap.forEach(d => loadedPeople.push({ uid: d.id, ...d.data() } as UserProfile));
        setPeople(loadedPeople);
      } catch (err) {
        console.error("Error loading booking form options:", err);
      } finally {
        setLoadingData(false);
      }
    }
    loadFormOptions();
  }, []);

  // Compute selected dates list
  const getSelectedDatesList = (): string[] => {
    if (dateMode === 'single') return [singleDate];

    const dates: string[] = [];
    let curr = new Date(rangeStart);
    const end = new Date(rangeEnd);

    while (curr <= end) {
      const dayOfWeek = curr.getDay(); // 0 is Sun, 6 is Sat
      if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        dates.push(formatLocalDate(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select a project for the booking.');
      return;
    }
    if (selectedPersonIds.length === 0) {
      setError('Please select at least one operative person.');
      return;
    }

    const selectedDates = getSelectedDatesList();
    if (selectedDates.length === 0) {
      setError('No valid dates selected. If using a weekend date range, check "Include Weekends".');
      return;
    }

    const targetProject = projects.find(p => p.id === selectedProjectId);
    const targetPersons = people.filter(p => selectedPersonIds.includes(p.uid));

    if (!targetProject || targetPersons.length === 0) return;

    setSaving(true);
    setError(null);
    setConflicts([]);

    try {
      const result = await createBookingBatch({
        project: targetProject,
        persons: targetPersons,
        dates: selectedDates,
        slot,
        startTime: slot === 'Custom' ? startTime : undefined,
        endTime: slot === 'Custom' ? endTime : undefined,
        instructions: instructions.trim(),
        status: publishImmediately ? 'Published' : 'Draft',
        actor: currentUser
      });

      if (!result.success) {
        setConflicts(result.conflicts);
        setError('Booking conflicts detected. Please review the highlighted issues below before submitting.');
      } else {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create booking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Create Work Booking</h3>
              <p className="text-xs text-slate-300">Schedule operatives onto project site</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs space-y-1">
              <div className="flex items-center space-x-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs space-y-2">
              <strong className="block font-bold">Conflict Summary ({conflicts.length}):</strong>
              <ul className="space-y-1 text-[11px] list-disc list-inside">
                {conflicts.map((c, idx) => (
                  <li key={idx}>
                    <strong>{c.personName}</strong> on {c.date}: {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loadingData ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading projects and operatives...</div>
          ) : (
            <>
              {/* Select Project */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.reference} — {p.title} ({p.siteAddress}) [{p.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Operatives */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Operative(s) <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-slate-50 border rounded-lg max-h-40 overflow-y-auto space-y-1.5">
                  {people.map(p => (
                    <label key={p.uid} className="flex items-center space-x-2.5 text-xs text-slate-800 cursor-pointer bg-white p-2 rounded border border-slate-200 hover:border-indigo-300">
                      <input 
                        type="checkbox"
                        checked={selectedPersonIds.includes(p.uid)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPersonIds([...selectedPersonIds, p.uid]);
                          else setSelectedPersonIds(selectedPersonIds.filter(id => id !== p.uid));
                        }}
                        className="rounded text-indigo-600"
                      />
                      <div className="flex-1">
                        <span className="font-bold">{p.fullName}</span>
                        <span className="text-slate-500 text-[11px] block">
                          {p.primaryTrade || p.role} {p.companyName ? `• ${p.companyName}` : ''}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Mode */}
              <div className="space-y-2">
                <div className="flex items-center space-x-4 text-xs font-semibold text-slate-700">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="dateMode"
                      checked={dateMode === 'single'}
                      onChange={() => setDateMode('single')}
                      className="text-indigo-600"
                    />
                    <span>Single Day</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="dateMode"
                      checked={dateMode === 'range'}
                      onChange={() => setDateMode('range')}
                      className="text-indigo-600"
                    />
                    <span>Date Range</span>
                  </label>
                </div>

                {dateMode === 'single' ? (
                  <div>
                    <input 
                      type="date"
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Start Date</label>
                      <input 
                        type="date"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">End Date</label>
                      <input 
                        type="date"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {dateMode === 'range' && (
                  <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer pt-1">
                    <input 
                      type="checkbox"
                      checked={includeWeekends}
                      onChange={(e) => setIncludeWeekends(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Include Weekends (Default: Weekdays only)</span>
                  </label>
                )}
              </div>

              {/* Work Slot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
                {(['Full Day', 'Morning', 'Afternoon', 'Custom'] as BookingSlot[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`py-2 px-2 rounded-lg border text-center transition ${
                      slot === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {slot === 'Custom' && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Start Time</label>
                    <input 
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">End Time</label>
                    <input 
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Description / Instructions</label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. First fix electrical installation, consumer unit positioning..."
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Publish Toggle */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between text-xs text-indigo-900">
                <div className="space-y-0.5">
                  <span className="font-bold block">Publish Immediately</span>
                  <span className="text-[11px] text-slate-600">Draft bookings reserve capacity but are hidden from contractors until published.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
              </div>
            </>
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
              disabled={saving || loadingData}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow disabled:opacity-50"
            >
              {saving ? 'Creating Booking...' : (publishImmediately ? 'Confirm & Publish Work' : 'Save as Draft')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
