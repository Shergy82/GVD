import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, ChevronLeft, ChevronRight, Plus, Send, Save, AlertTriangle,
  CheckCircle, XCircle, FileText, Receipt, Car, Trash2, Upload, Eye,
  ChevronDown, ChevronUp, MessageSquare, Download, HelpCircle, Loader2,
  MapPin, Fuel, Info, X, Camera, Image as ImageIcon
} from 'lucide-react';
import type {
  UserProfile, WeeklyClaim, AttendanceLine, ExpenseLine, TravelLine,
  TravelProjectAllocation, BookingRecord, ContractorRateVersion,
  ClaimLineStatus, AttendanceType, PaymentBasis, ProjectRecord
} from '../types';
import {
  getBookingsForWeek, getExistingClaim, getContractorRates, getRateForDate,
  calculateAttendanceAmount, calculateActualHours, validateClaimForSubmission,
  saveDraftClaim, submitClaim, generateClaimReference, withdrawClaim,
  getContractorClaims, respondToQuery, uploadReceiptFiles, getContractorInvoices,
  getContractorPayments, getApprovedUninvoicedLines, issueInvoice,
  getContractorTaxConfig, type ApprovedUninvoicedLine
} from '../services/claimsService';
import { generateClaimPDF, generateInvoicePDF } from '../services/pdfService';
import { formatPenceToGBP, parseGBPToPence } from '../services/projectService';
import {
  formatLocalDate, parseLocalDate, getMondayOfDate, getWeekDays, formatDayHeader
} from '../services/plannerService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

interface ContractorClaimsViewProps {
  currentUser: UserProfile;
}

type ClaimTab = 'new' | 'history' | 'invoices';
type ClaimStep = 'attendance' | 'expenses' | 'travel' | 'review';

const EXPENSE_CATEGORIES = [
  'Materials', 'Tools & Equipment', 'PPE / Safety', 'Parking',
  'Accommodation', 'Subsistence', 'Phone / Data', 'Other'
];

export const ContractorClaimsView: React.FC<ContractorClaimsViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<ClaimTab>('new');
  const [currentStep, setCurrentStep] = useState<ClaimStep>('attendance');
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [claim, setClaim] = useState<WeeklyClaim | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [rates, setRates] = useState<ContractorRateVersion[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [historyClaims, setHistoryClaims] = useState<WeeklyClaim[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; errors: string[] } | null>(null);

  // UI state
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddTravel, setShowAddTravel] = useState(false);
  const [showAddUnplanned, setShowAddUnplanned] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // Computed dates
  const today = formatLocalDate(new Date());
  const currentMonday = getMondayOfDate(today);

  const getTargetMonday = useCallback(() => {
    const base = parseLocalDate(currentMonday);
    base.setDate(base.getDate() + weekOffset * 7);
    return formatLocalDate(base);
  }, [currentMonday, weekOffset]);

  const targetMonday = getTargetMonday();
  const weekDays = getWeekDays(targetMonday);
  const targetSunday = weekDays[6];

  // Format week range for display
  const formatWeekRange = (mon: string, sun: string) => {
    const m = parseLocalDate(mon);
    const s = parseLocalDate(sun);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${m.getDate()} ${months[m.getMonth()]} – ${s.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  };

  // Load data for the selected week
  const loadWeekData = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    setSubmitResult(null);
    try {
      const [bookingData, rateData, existingClaim] = await Promise.all([
        getBookingsForWeek(currentUser.uid, targetMonday),
        getContractorRates(currentUser.uid),
        getExistingClaim(currentUser.uid, targetMonday)
      ]);

      // Load contractor's accessible projects
      const projSnap = await getDocs(
        query(collection(db, 'projects'), where('assignedUserIds', 'array-contains', currentUser.uid))
      );
      const projData = projSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectRecord));

      setBookings(bookingData);
      setRates(rateData);
      setProjects(projData);

      if (existingClaim) {
        setClaim(existingClaim);
      } else {
        // Build fresh draft from bookings
        const attendanceLines: AttendanceLine[] = [];
        const publishedBookings = bookingData.filter(b =>
          b.status === 'Published' && b.acknowledgement !== 'Declined'
        );

        for (const booking of publishedBookings) {
          // Don't prefill cancelled bookings
          if (booking.status === 'Cancelled') continue;

          const rate = getRateForDate(rateData, booking.localDate);
          const paymentBasis: PaymentBasis = rate?.paymentBasis || 'day_rate';
          const defaultType: AttendanceType = paymentBasis === 'hourly_rate' ? 'hourly' : 'full_day';

          attendanceLines.push({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            bookingId: booking.id,
            bookingRevision: booking.revision,
            projectId: booking.projectId,
            projectReference: booking.projectReference,
            projectTitle: booking.projectTitle,
            localDate: booking.localDate,
            attendanceType: defaultType,
            plannedSlot: booking.slot,
            isUnplanned: false,
            ratePence: rate ? (paymentBasis === 'day_rate' ? (rate.dayRatePence || 0) : (rate.hourlyRatePence || 0)) : 0,
            paymentBasis,
            calculatedAmountPence: 0, // Will be calculated when confirmed
            lineStatus: 'Draft'
          });
        }

        // Sort by date
        attendanceLines.sort((a, b) => a.localDate.localeCompare(b.localDate));

        const newClaim: Omit<WeeklyClaim, 'id'> & { id?: string } = {
          claimReference: '',
          contractorUid: currentUser.uid,
          contractorName: currentUser.fullName,
          weekStartDate: targetMonday,
          weekEndDate: targetSunday,
          attendanceLines,
          expenseLines: [],
          travelLines: [],
          totalLabourPence: 0,
          totalExpensesPence: 0,
          totalTravelPence: 0,
          totalClaimPence: 0,
          status: 'Draft',
          revision: 0,
          rateSnapshotIds: [],
          reviewerActions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isSupplementary: false
        };

        setClaim(newClaim as WeeklyClaim);
      }
    } catch (err) {
      console.error('Failed to load week data:', err);
      setErrors(['Failed to load data. Please try again.']);
    }
    setLoading(false);
  }, [currentUser.uid, targetMonday, targetSunday]);

  useEffect(() => { loadWeekData(); }, [loadWeekData]);

  // Load history
  useEffect(() => {
    if (activeTab === 'history') {
      getContractorClaims(currentUser.uid).then(setHistoryClaims);
    }
  }, [activeTab, currentUser.uid]);

  // Auto-save draft
  const autoSave = useCallback(async () => {
    if (!claim || claim.status !== 'Draft') return;
    setSaveStatus('saving');
    try {
      const claimRef = claim.claimReference || await generateClaimReference();
      const savedId = await saveDraftClaim({ ...claim, claimReference: claimRef });
      setClaim(prev => prev ? { ...prev, id: savedId, claimReference: claimRef } : prev);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
    }
  }, [claim]);

  // Update attendance line
  const updateAttendanceLine = (lineId: string, updates: Partial<AttendanceLine>) => {
    if (!claim) return;
    const newLines = claim.attendanceLines.map(line => {
      if (line.id !== lineId) return line;
      const updated = { ...line, ...updates };

      // Recalculate amount
      if (updated.attendanceType === 'did_not_attend') {
        updated.calculatedAmountPence = 0;
      } else if (updated.paymentBasis === 'hourly_rate' && updated.actualStartTime && updated.actualEndTime) {
        updated.actualHours = calculateActualHours(updated.actualStartTime, updated.actualEndTime, updated.unpaidBreakMinutes || 0);
        const rate = getRateForDate(rates, updated.localDate);
        if (rate) {
          updated.calculatedAmountPence = calculateAttendanceAmount(updated.attendanceType, updated.paymentBasis, rate, updated.actualHours);
        }
      } else if (updated.paymentBasis === 'day_rate') {
        const rate = getRateForDate(rates, updated.localDate);
        if (rate) {
          updated.calculatedAmountPence = calculateAttendanceAmount(updated.attendanceType, updated.paymentBasis, rate);
        }
      }

      return updated;
    });

    const totalLabourPence = newLines
      .filter(l => l.attendanceType !== 'did_not_attend')
      .reduce((s, l) => s + l.calculatedAmountPence, 0);

    setClaim(prev => prev ? {
      ...prev,
      attendanceLines: newLines,
      totalLabourPence,
      totalClaimPence: totalLabourPence + prev.totalExpensesPence + prev.totalTravelPence
    } : prev);
  };

  // Add unplanned work
  const addUnplannedWork = (projectId: string, date: string) => {
    if (!claim) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const rate = getRateForDate(rates, date);
    const paymentBasis: PaymentBasis = rate?.paymentBasis || 'day_rate';

    const newLine: AttendanceLine = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      projectReference: project.reference,
      projectTitle: project.title,
      localDate: date,
      attendanceType: paymentBasis === 'hourly_rate' ? 'hourly' : 'full_day',
      isUnplanned: true,
      ratePence: rate ? (paymentBasis === 'day_rate' ? (rate.dayRatePence || 0) : (rate.hourlyRatePence || 0)) : 0,
      paymentBasis,
      calculatedAmountPence: 0,
      lineStatus: 'Draft'
    };

    setClaim(prev => prev ? {
      ...prev,
      attendanceLines: [...prev.attendanceLines, newLine].sort((a, b) => a.localDate.localeCompare(b.localDate))
    } : prev);
    setShowAddUnplanned(false);
  };

  // Remove attendance line
  const removeAttendanceLine = (lineId: string) => {
    if (!claim) return;
    const newLines = claim.attendanceLines.filter(l => l.id !== lineId);
    const totalLabourPence = newLines
      .filter(l => l.attendanceType !== 'did_not_attend')
      .reduce((s, l) => s + l.calculatedAmountPence, 0);
    setClaim(prev => prev ? {
      ...prev,
      attendanceLines: newLines,
      totalLabourPence,
      totalClaimPence: totalLabourPence + prev.totalExpensesPence + prev.totalTravelPence
    } : prev);
  };

  // Add expense
  const addExpense = (expense: Omit<ExpenseLine, 'id' | 'lineStatus'>) => {
    if (!claim) return;
    const newLine: ExpenseLine = {
      ...expense,
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineStatus: 'Draft'
    };
    const newExpenses = [...claim.expenseLines, newLine];
    const totalExpensesPence = newExpenses.reduce((s, l) => s + l.amountPence, 0);
    setClaim(prev => prev ? {
      ...prev,
      expenseLines: newExpenses,
      totalExpensesPence,
      totalClaimPence: prev.totalLabourPence + totalExpensesPence + prev.totalTravelPence
    } : prev);
    setShowAddExpense(false);
  };

  // Remove expense
  const removeExpense = (lineId: string) => {
    if (!claim) return;
    const newExpenses = claim.expenseLines.filter(l => l.id !== lineId);
    const totalExpensesPence = newExpenses.reduce((s, l) => s + l.amountPence, 0);
    setClaim(prev => prev ? {
      ...prev,
      expenseLines: newExpenses,
      totalExpensesPence,
      totalClaimPence: prev.totalLabourPence + totalExpensesPence + prev.totalTravelPence
    } : prev);
  };

  // Add travel
  const addTravel = (travel: Omit<TravelLine, 'id' | 'lineStatus'>) => {
    if (!claim) return;
    const newLine: TravelLine = {
      ...travel,
      id: `trv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineStatus: 'Draft'
    };
    const newTravel = [...claim.travelLines, newLine];
    const totalTravelPence = newTravel.reduce((s, l) => s + l.totalAmountPence, 0);
    setClaim(prev => prev ? {
      ...prev,
      travelLines: newTravel,
      totalTravelPence,
      totalClaimPence: prev.totalLabourPence + prev.totalExpensesPence + totalTravelPence
    } : prev);
    setShowAddTravel(false);
  };

  // Remove travel
  const removeTravel = (lineId: string) => {
    if (!claim) return;
    const newTravel = claim.travelLines.filter(l => l.id !== lineId);
    const totalTravelPence = newTravel.reduce((s, l) => s + l.totalAmountPence, 0);
    setClaim(prev => prev ? {
      ...prev,
      travelLines: newTravel,
      totalTravelPence,
      totalClaimPence: prev.totalLabourPence + prev.totalExpensesPence + totalTravelPence
    } : prev);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!claim) return;
    setSubmitting(true);
    setSubmitResult(null);

    // First save the draft
    const claimRef = claim.claimReference || await generateClaimReference();
    const savedId = await saveDraftClaim({ ...claim, claimReference: claimRef });
    const updatedClaim = { ...claim, id: savedId, claimReference: claimRef };
    setClaim(updatedClaim as WeeklyClaim);

    const result = await submitClaim(savedId, rates);
    setSubmitResult(result);

    if (result.success) {
      await loadWeekData();
    }
    setSubmitting(false);
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!claim?.id) return;
    const reason = prompt('Why are you withdrawing this claim?');
    if (!reason) return;
    const result = await withdrawClaim(claim.id, reason);
    if (result.success) {
      await loadWeekData();
    } else {
      setErrors([result.error || 'Failed to withdraw claim.']);
    }
  };

  // Check if the week is in the future
  const isWeekFuture = targetMonday > today;

  // Render
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '12px' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--brand-gold)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Loading your claim...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '120px' }}>
      {/* Header tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
        {[
          { id: 'new' as ClaimTab, label: 'New Claim' },
          { id: 'history' as ClaimTab, label: 'My Claims' },
          { id: 'invoices' as ClaimTab, label: 'Invoices & Payments' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.85rem',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'new' && claim && (
        <NewClaimFlow
          claim={claim}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          weekDays={weekDays}
          targetMonday={targetMonday}
          targetSunday={targetSunday}
          formatWeekRange={formatWeekRange}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          today={today}
          rates={rates}
          projects={projects}
          bookings={bookings}
          errors={errors}
          submitResult={submitResult}
          saveStatus={saveStatus}
          saving={saving}
          submitting={submitting}
          isWeekFuture={isWeekFuture}
          updateAttendanceLine={updateAttendanceLine}
          addUnplannedWork={addUnplannedWork}
          removeAttendanceLine={removeAttendanceLine}
          addExpense={addExpense}
          removeExpense={removeExpense}
          addTravel={addTravel}
          removeTravel={removeTravel}
          autoSave={autoSave}
          handleSubmit={handleSubmit}
          handleWithdraw={handleWithdraw}
          showAddExpense={showAddExpense}
          setShowAddExpense={setShowAddExpense}
          showAddTravel={showAddTravel}
          setShowAddTravel={setShowAddTravel}
          showAddUnplanned={showAddUnplanned}
          setShowAddUnplanned={setShowAddUnplanned}
          currentUser={currentUser}
          setClaim={setClaim}
        />
      )}

      {activeTab === 'history' && (
        <ClaimHistoryView claims={historyClaims} />
      )}

      {activeTab === 'invoices' && (
        <InvoicesPaymentsView currentUser={currentUser} />
      )}
    </div>
  );
};

/* ========================================================= */
/* NEW CLAIM FLOW (Steps: Attendance → Expenses → Travel → Review) */
/* ========================================================= */

interface NewClaimFlowProps {
  claim: WeeklyClaim;
  currentStep: ClaimStep;
  setCurrentStep: (s: ClaimStep) => void;
  weekDays: string[];
  targetMonday: string;
  targetSunday: string;
  formatWeekRange: (m: string, s: string) => string;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
  today: string;
  rates: ContractorRateVersion[];
  projects: ProjectRecord[];
  bookings: BookingRecord[];
  errors: string[];
  submitResult: { success: boolean; errors: string[] } | null;
  saveStatus: string;
  saving: boolean;
  submitting: boolean;
  isWeekFuture: boolean;
  updateAttendanceLine: (id: string, updates: Partial<AttendanceLine>) => void;
  addUnplannedWork: (projectId: string, date: string) => void;
  removeAttendanceLine: (id: string) => void;
  addExpense: (e: Omit<ExpenseLine, 'id' | 'lineStatus'>) => void;
  removeExpense: (id: string) => void;
  addTravel: (t: Omit<TravelLine, 'id' | 'lineStatus'>) => void;
  removeTravel: (id: string) => void;
  autoSave: () => void;
  handleSubmit: () => void;
  handleWithdraw: () => void;
  showAddExpense: boolean;
  setShowAddExpense: (v: boolean) => void;
  showAddTravel: boolean;
  setShowAddTravel: (v: boolean) => void;
  showAddUnplanned: boolean;
  setShowAddUnplanned: (v: boolean) => void;
  currentUser: UserProfile;
  setClaim: React.Dispatch<React.SetStateAction<WeeklyClaim | null>>;
}

const NewClaimFlow: React.FC<NewClaimFlowProps> = (props) => {
  const {
    claim, currentStep, setCurrentStep, weekDays, targetMonday, targetSunday,
    formatWeekRange, weekOffset, setWeekOffset, today, rates, projects,
    errors, submitResult, saveStatus, submitting, isWeekFuture,
    updateAttendanceLine, addUnplannedWork, removeAttendanceLine,
    addExpense, removeExpense, addTravel, removeTravel,
    autoSave, handleSubmit, handleWithdraw, showAddExpense, setShowAddExpense,
    showAddTravel, setShowAddTravel, showAddUnplanned, setShowAddUnplanned,
    currentUser, setClaim
  } = props;

  const steps: { id: ClaimStep; label: string; icon: React.ReactNode }[] = [
    { id: 'attendance', label: 'Attendance', icon: <Calendar size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'travel', label: 'Travel', icon: <Car size={16} /> },
    { id: 'review', label: 'Review', icon: <Send size={16} /> },
  ];

  const isReadOnly = claim.status !== 'Draft' && claim.status !== 'Queried';
  const canNavigateWeeks = claim.status === 'Draft' && !claim.id;

  return (
    <>
      {/* Week Navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)', marginBottom: '12px'
      }}>
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          disabled={!canNavigateWeeks}
          style={{
            padding: '8px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: canNavigateWeeks ? 'var(--bg-subtle)' : 'transparent',
            cursor: canNavigateWeeks ? 'pointer' : 'default', opacity: canNavigateWeeks ? 1 : 0.3
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
            {formatWeekRange(targetMonday, targetSunday)}
          </div>
          {claim.claimReference && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ref: {claim.claimReference}
            </div>
          )}
          <div style={{
            display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
            padding: '2px 8px', borderRadius: 'var(--radius-full)', marginTop: '4px',
            background: claim.status === 'Draft' ? 'var(--bg-subtle)' :
              claim.status === 'Submitted' ? 'var(--status-info-bg)' :
                claim.status === 'Approved' ? 'var(--status-success-bg)' :
                  claim.status === 'Queried' ? 'var(--status-warning-bg)' :
                    'var(--bg-subtle)',
            color: claim.status === 'Draft' ? 'var(--text-secondary)' :
              claim.status === 'Submitted' ? 'var(--status-info-text)' :
                claim.status === 'Approved' ? 'var(--status-success-text)' :
                  claim.status === 'Queried' ? 'var(--status-warning-text)' :
                    'var(--text-secondary)'
          }}>
            {claim.status}
          </div>
        </div>

        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          disabled={!canNavigateWeeks || isWeekFuture}
          style={{
            padding: '8px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: canNavigateWeeks && !isWeekFuture ? 'var(--bg-subtle)' : 'transparent',
            cursor: canNavigateWeeks && !isWeekFuture ? 'pointer' : 'default',
            opacity: canNavigateWeeks && !isWeekFuture ? 1 : 0.3
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Missing rate warning */}
      {rates.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px',
          background: 'var(--status-warning-bg)', borderRadius: 'var(--radius-md)',
          border: '1px solid #FDE68A', marginBottom: '12px'
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--status-warning-text)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--status-warning-text)' }}>
              No Rate Configured
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--status-warning-text)', marginTop: '2px' }}>
              GVD needs to set your agreed rate before you can submit claims for payment. You can still record your attendance.
            </div>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div style={{
        display: 'flex', gap: '2px', marginBottom: '16px', background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--border-color)'
      }}>
        {steps.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            style={{
              flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              background: currentStep === step.id ? 'var(--brand-navy)' : 'transparent',
              color: currentStep === step.id ? '#FFF' : 'var(--text-secondary)',
              fontWeight: currentStep === step.id ? 700 : 500,
              fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            {step.icon}
            <span className="desktop-only" style={{ whiteSpace: 'nowrap' }}>{step.label}</span>
          </button>
        ))}
      </div>

      {/* Running total bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', background: 'var(--brand-navy)', color: '#FFF',
        borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span>Labour: <strong>{formatPenceToGBP(claim.totalLabourPence)}</strong></span>
          <span>Expenses: <strong>{formatPenceToGBP(claim.totalExpensesPence)}</strong></span>
          <span>Travel: <strong>{formatPenceToGBP(claim.totalTravelPence)}</strong></span>
        </div>
        <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>
          {formatPenceToGBP(claim.totalClaimPence)}
        </div>
      </div>

      {/* Save status */}
      {saveStatus !== 'idle' && (
        <div style={{
          textAlign: 'center', fontSize: '0.75rem', padding: '4px',
          color: saveStatus === 'saved' ? 'var(--status-success-text)' :
            saveStatus === 'error' ? 'var(--status-danger-text)' : 'var(--text-muted)'
        }}>
          {saveStatus === 'saving' && '💾 Saving draft...'}
          {saveStatus === 'saved' && '✓ Draft saved'}
          {saveStatus === 'error' && '⚠ Failed to save'}
        </div>
      )}

      {/* Step content */}
      {currentStep === 'attendance' && (
        <AttendanceStep
          claim={claim}
          weekDays={weekDays}
          today={today}
          rates={rates}
          projects={projects}
          isReadOnly={isReadOnly}
          updateAttendanceLine={updateAttendanceLine}
          addUnplannedWork={addUnplannedWork}
          removeAttendanceLine={removeAttendanceLine}
          showAddUnplanned={showAddUnplanned}
          setShowAddUnplanned={setShowAddUnplanned}
          onNext={() => { autoSave(); setCurrentStep('expenses'); }}
        />
      )}

      {currentStep === 'expenses' && (
        <ExpensesStep
          claim={claim}
          projects={projects}
          rates={rates}
          isReadOnly={isReadOnly}
          addExpense={addExpense}
          removeExpense={removeExpense}
          showAddExpense={showAddExpense}
          setShowAddExpense={setShowAddExpense}
          currentUser={currentUser}
          setClaim={setClaim}
          onBack={() => setCurrentStep('attendance')}
          onNext={() => { autoSave(); setCurrentStep('travel'); }}
        />
      )}

      {currentStep === 'travel' && (
        <TravelStep
          claim={claim}
          projects={projects}
          rates={rates}
          weekDays={weekDays}
          isReadOnly={isReadOnly}
          addTravel={addTravel}
          removeTravel={removeTravel}
          showAddTravel={showAddTravel}
          setShowAddTravel={setShowAddTravel}
          onBack={() => setCurrentStep('expenses')}
          onNext={() => { autoSave(); setCurrentStep('review'); }}
        />
      )}

      {currentStep === 'review' && (
        <ReviewStep
          claim={claim}
          rates={rates}
          errors={errors}
          submitResult={submitResult}
          submitting={submitting}
          isReadOnly={isReadOnly}
          handleSubmit={handleSubmit}
          handleWithdraw={handleWithdraw}
          onBack={() => setCurrentStep('travel')}
        />
      )}
    </>
  );
};

/* ========================================================= */
/* ATTENDANCE STEP                                            */
/* ========================================================= */

interface AttendanceStepProps {
  claim: WeeklyClaim;
  weekDays: string[];
  today: string;
  rates: ContractorRateVersion[];
  projects: ProjectRecord[];
  isReadOnly: boolean;
  updateAttendanceLine: (id: string, updates: Partial<AttendanceLine>) => void;
  addUnplannedWork: (projectId: string, date: string) => void;
  removeAttendanceLine: (id: string) => void;
  showAddUnplanned: boolean;
  setShowAddUnplanned: (v: boolean) => void;
  onNext: () => void;
}

const AttendanceStep: React.FC<AttendanceStepProps> = ({
  claim, weekDays, today, rates, projects, isReadOnly,
  updateAttendanceLine, addUnplannedWork, removeAttendanceLine,
  showAddUnplanned, setShowAddUnplanned, onNext
}) => {
  const [unplannedProject, setUnplannedProject] = useState('');
  const [unplannedDate, setUnplannedDate] = useState('');

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
          Check Your Week
        </h3>
        {!isReadOnly && (
          <button
            onClick={() => setShowAddUnplanned(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: 'var(--radius-sm)', border: '1px dashed var(--brand-gold)',
              background: 'var(--brand-gold-light)', color: 'var(--brand-gold-hover)',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            <Plus size={14} /> Add Unplanned Work
          </button>
        )}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Confirm each day's attendance. Only confirmed work will be included in your claim.
      </p>

      {/* Day cards */}
      {weekDays.map((day, idx) => {
        const dayLines = claim.attendanceLines.filter(l => l.localDate === day);
        const d = parseLocalDate(day);
        const isFuture = day > today;
        const isToday = day === today;

        return (
          <div key={day} style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${isToday ? 'var(--brand-gold)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: '8px',
            overflow: 'hidden'
          }}>
            {/* Day header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              background: isToday ? 'var(--brand-gold-light)' : isFuture ? '#F1F5F9' : 'transparent',
              borderBottom: dayLines.length > 0 ? '1px solid var(--border-color)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                  background: isToday ? 'var(--brand-gold)' : 'var(--bg-subtle)',
                  color: isToday ? '#FFF' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.9rem', fontFamily: 'var(--font-heading)'
                }}>
                  {d.getDate()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {dayNames[idx]} {d.getDate()} {months[d.getMonth()]}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isFuture ? 'Future – cannot claim' :
                      dayLines.length === 0 ? 'No work planned' :
                        `${dayLines.length} booking${dayLines.length !== 1 ? 's' : ''}`}
                  </div>
                </div>
              </div>

              {dayLines.length > 0 && (
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--brand-gold-hover)' }}>
                  {formatPenceToGBP(dayLines.reduce((s, l) => s + l.calculatedAmountPence, 0))}
                </div>
              )}
            </div>

            {/* Day attendance lines */}
            {dayLines.map(line => (
              <AttendanceLineCard
                key={line.id}
                line={line}
                isFuture={isFuture}
                isReadOnly={isReadOnly}
                onUpdate={(updates) => updateAttendanceLine(line.id, updates)}
                onRemove={() => removeAttendanceLine(line.id)}
              />
            ))}
          </div>
        );
      })}

      {/* Add unplanned work modal */}
      {showAddUnplanned && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '100%', maxWidth: '460px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
              Add Unplanned Work
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              For work that wasn't booked in advance. This will be reviewed by GVD.
            </p>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Date</label>
            <select
              value={unplannedDate}
              onChange={e => setUnplannedDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', marginBottom: '12px', fontSize: '0.85rem'
              }}
            >
              <option value="">Select a day</option>
              {weekDays.filter(d => d <= today).map(d => (
                <option key={d} value={d}>{formatDayHeader(d)}</option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Project</label>
            <select
              value={unplannedProject}
              onChange={e => setUnplannedProject(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', marginBottom: '16px', fontSize: '0.85rem'
              }}
            >
              <option value="">Select a project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.reference} – {p.title}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowAddUnplanned(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (unplannedProject && unplannedDate) {
                    addUnplannedWork(unplannedProject, unplannedDate);
                    setUnplannedProject('');
                    setUnplannedDate('');
                  }
                }}
                disabled={!unplannedProject || !unplannedDate}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--brand-gold)',
                  color: '#FFF', fontWeight: 700, cursor: 'pointer',
                  opacity: !unplannedProject || !unplannedDate ? 0.5 : 1
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Next button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '8px' }}>
        {!isReadOnly && (
          <button
            onClick={() => {}}
            style={{
              padding: '12px 20px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
            onClick2={undefined}
          >
            <Save size={16} /> Save Draft
          </button>
        )}
        <button
          onClick={onNext}
          style={{
            padding: '12px 24px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--brand-navy)',
            color: '#FFF', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          Next: Expenses <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

/* ========================================================= */
/* ATTENDANCE LINE CARD                                       */
/* ========================================================= */

interface AttendanceLineCardProps {
  line: AttendanceLine;
  isFuture: boolean;
  isReadOnly: boolean;
  onUpdate: (updates: Partial<AttendanceLine>) => void;
  onRemove: () => void;
}

const AttendanceLineCard: React.FC<AttendanceLineCardProps> = ({ line, isFuture, isReadOnly, onUpdate, onRemove }) => {
  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid var(--border-color)',
      background: line.attendanceType === 'did_not_attend' ? '#FEF2F2' :
        line.isUnplanned ? '#FFF7ED' : 'transparent'
    }}>
      {/* Project info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-gold-hover)',
            background: 'var(--brand-gold-light)', padding: '2px 8px',
            borderRadius: 'var(--radius-full)', marginRight: '8px'
          }}>
            {line.projectReference}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {line.projectTitle}
          </span>
        </div>
        {line.isUnplanned && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: '#EA580C',
            background: '#FFF7ED', padding: '2px 6px', borderRadius: 'var(--radius-full)',
            border: '1px solid #FDBA74'
          }}>
            Unplanned
          </span>
        )}
      </div>

      {/* Planned info */}
      {line.plannedSlot && !line.isUnplanned && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Planned: {line.plannedSlot}
        </div>
      )}

      {/* Attendance type selector */}
      {!isReadOnly && !isFuture && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {line.paymentBasis === 'day_rate' ? (
            <>
              {(['full_day', 'half_day', 'did_not_attend'] as AttendanceType[]).map(type => (
                <button
                  key={type}
                  onClick={() => onUpdate({ attendanceType: type })}
                  style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-full)',
                    border: `1px solid ${line.attendanceType === type ? 'var(--brand-navy)' : 'var(--border-color)'}`,
                    background: line.attendanceType === type ? 'var(--brand-navy)' : 'var(--bg-surface)',
                    color: line.attendanceType === type ? '#FFF' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {type === 'full_day' ? '✓ Full Day' : type === 'half_day' ? '½ Half Day' : '✕ Did Not Attend'}
                </button>
              ))}
            </>
          ) : (
            <>
              {(['hourly', 'did_not_attend'] as AttendanceType[]).map(type => (
                <button
                  key={type}
                  onClick={() => onUpdate({ attendanceType: type })}
                  style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-full)',
                    border: `1px solid ${line.attendanceType === type ? 'var(--brand-navy)' : 'var(--border-color)'}`,
                    background: line.attendanceType === type ? 'var(--brand-navy)' : 'var(--bg-surface)',
                    color: line.attendanceType === type ? '#FFF' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer'
                  }}
                >
                  {type === 'hourly' ? '⏱ Worked Hours' : '✕ Did Not Attend'}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Hourly time entry */}
      {line.paymentBasis === 'hourly_rate' && line.attendanceType === 'hourly' && !isReadOnly && !isFuture && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Start</label>
            <input
              type="time"
              value={line.actualStartTime || ''}
              onChange={e => onUpdate({ actualStartTime: e.target.value })}
              style={{
                display: 'block', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', fontSize: '0.85rem', width: '100px'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Finish</label>
            <input
              type="time"
              value={line.actualEndTime || ''}
              onChange={e => onUpdate({ actualEndTime: e.target.value })}
              style={{
                display: 'block', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', fontSize: '0.85rem', width: '100px'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Unpaid Break</label>
            <input
              type="number"
              value={line.unpaidBreakMinutes || 0}
              onChange={e => onUpdate({ unpaidBreakMinutes: parseInt(e.target.value) || 0 })}
              min="0"
              step="15"
              style={{
                display: 'block', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', fontSize: '0.85rem', width: '80px'
              }}
              placeholder="mins"
            />
          </div>
          {line.actualHours != null && (
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', marginTop: '16px' }}>
              {line.actualHours}hrs
            </div>
          )}
        </div>
      )}

      {/* Explanation for differences or unplanned */}
      {(line.isUnplanned || (line.attendanceType !== 'full_day' && line.attendanceType !== 'did_not_attend' && line.plannedSlot === 'Full Day')) && !isReadOnly && (
        <div style={{ marginBottom: '8px' }}>
          <input
            type="text"
            value={line.isUnplanned ? (line.unplannedReason || '') : (line.explanation || '')}
            onChange={e => onUpdate(line.isUnplanned ? { unplannedReason: e.target.value } : { explanation: e.target.value })}
            placeholder={line.isUnplanned ? 'Why was this work not booked?' : 'Explain the difference from plan'}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)', fontSize: '0.8rem'
            }}
          />
        </div>
      )}

      {/* Query display */}
      {line.lineStatus === 'Queried' && line.queryMessage && (
        <div style={{
          padding: '8px 12px', background: 'var(--status-warning-bg)',
          borderRadius: 'var(--radius-sm)', marginBottom: '8px'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-warning-text)' }}>
            Query from reviewer:
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--status-warning-text)' }}>
            {line.queryMessage}
          </div>
        </div>
      )}

      {/* Bottom row: amount + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {line.attendanceType === 'did_not_attend' ? (
            <span style={{ color: 'var(--status-danger-text)' }}>Not attending – no charge</span>
          ) : line.ratePence === 0 ? (
            <span style={{ color: 'var(--status-warning-text)' }}>
              <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Rate not set
            </span>
          ) : (
            <span>
              {line.paymentBasis === 'day_rate'
                ? `${line.attendanceType === 'half_day' ? 'Half Day' : 'Full Day'} @ ${formatPenceToGBP(line.ratePence)}`
                : `${line.actualHours || 0}hrs @ ${formatPenceToGBP(line.ratePence)}/hr`}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-navy)' }}>
            {line.attendanceType !== 'did_not_attend' ? formatPenceToGBP(line.calculatedAmountPence) : '–'}
          </span>
          {line.isUnplanned && !isReadOnly && (
            <button
              onClick={onRemove}
              style={{
                padding: '4px', borderRadius: '4px', border: 'none',
                background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)'
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ========================================================= */
/* EXPENSES STEP                                              */
/* ========================================================= */

interface ExpensesStepProps {
  claim: WeeklyClaim;
  projects: ProjectRecord[];
  rates: ContractorRateVersion[];
  isReadOnly: boolean;
  addExpense: (e: Omit<ExpenseLine, 'id' | 'lineStatus'>) => void;
  removeExpense: (id: string) => void;
  showAddExpense: boolean;
  setShowAddExpense: (v: boolean) => void;
  currentUser: UserProfile;
  setClaim: React.Dispatch<React.SetStateAction<WeeklyClaim | null>>;
  onBack: () => void;
  onNext: () => void;
}

const ExpensesStep: React.FC<ExpensesStepProps> = ({
  claim, projects, isReadOnly, addExpense, removeExpense,
  showAddExpense, setShowAddExpense, currentUser, setClaim, onBack, onNext
}) => {
  const [expCategory, setExpCategory] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expProject, setExpProject] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expFiles, setExpFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleAddExpense = async () => {
    const project = projects.find(p => p.id === expProject);
    if (!project || !expCategory || !expDate || !expDescription || !expAmount) return;

    const amountPence = parseGBPToPence(expAmount);
    if (amountPence <= 0) return;

    let receiptUrls: string[] = [];
    let receiptNames: string[] = [];

    if (expFiles.length > 0 && claim.id) {
      setUploading(true);
      const lineId = `exp-${Date.now()}`;
      const result = await uploadReceiptFiles(claim.id, lineId, expFiles);
      receiptUrls = result.urls;
      receiptNames = result.names;
      setUploading(false);
    }

    addExpense({
      projectId: project.id,
      projectReference: project.reference,
      projectTitle: project.title,
      expenseDate: expDate,
      category: expCategory,
      description: expDescription,
      amountPence,
      receiptFileUrls: receiptUrls,
      receiptFileNames: receiptNames,
    });

    setExpCategory('');
    setExpDate('');
    setExpProject('');
    setExpDescription('');
    setExpAmount('');
    setExpFiles([]);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
          Expenses
        </h3>
        {!isReadOnly && (
          <button
            onClick={() => setShowAddExpense(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: 'var(--radius-sm)', border: '1px dashed var(--brand-gold)',
              background: 'var(--brand-gold-light)', color: 'var(--brand-gold-hover)',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            <Plus size={14} /> Add Expense
          </button>
        )}
      </div>

      {claim.expenseLines.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
          marginBottom: '16px'
        }}>
          <Receipt size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            No expenses this week
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Add any reimbursable expenses with receipts
          </div>
        </div>
      )}

      {/* Expense cards */}
      {claim.expenseLines.map(line => (
        <div key={line.id} style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)', padding: '14px 16px',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                  borderRadius: 'var(--radius-full)', background: 'var(--status-info-bg)',
                  color: 'var(--status-info-text)'
                }}>
                  {line.category}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatDayHeader(line.expenseDate)}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{line.description}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {line.projectReference} – {line.projectTitle}
              </div>
              {line.receiptFileNames.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--status-success-text)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={12} /> {line.receiptFileNames.length} receipt{line.receiptFileNames.length !== 1 ? 's' : ''} attached
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {formatPenceToGBP(line.amountPence)}
              </span>
              {!isReadOnly && (
                <button onClick={() => removeExpense(line.id)} style={{
                  padding: '4px', border: 'none', background: 'transparent',
                  cursor: 'pointer', color: 'var(--text-muted)'
                }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Add expense form */}
      {showAddExpense && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '100%', maxWidth: '500px',
            maxHeight: '85vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Add Expense
              </h3>
              <button onClick={() => setShowAddExpense(false)} style={{
                padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer'
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Project *</label>
                <select value={expProject} onChange={e => setExpProject(e.target.value)} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }}>
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.reference} – {p.title}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Category *</label>
                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }}>
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Date *</label>
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Description *</label>
                <input type="text" value={expDescription} onChange={e => setExpDescription(e.target.value)}
                  placeholder="What was purchased?" style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Amount (£) *</label>
                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)}
                  placeholder="0.00" step="0.01" min="0.01" style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Receipt *
                </label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)', border: '2px dashed var(--border-color)',
                  background: 'var(--bg-subtle)', cursor: 'pointer', justifyContent: 'center'
                }}>
                  <Camera size={20} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {expFiles.length > 0 ? `${expFiles.length} file${expFiles.length !== 1 ? 's' : ''} selected` : 'Take photo or choose file'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={e => setExpFiles(Array.from(e.target.files || []))}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <button
                onClick={handleAddExpense}
                disabled={!expProject || !expCategory || !expDate || !expDescription || !expAmount || uploading}
                style={{
                  width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                  fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  opacity: !expProject || !expCategory || !expDate || !expDescription || !expAmount ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                {uploading ? <><Loader2 size={16} className="spin" /> Uploading...</> : <><Plus size={16} /> Add Expense</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button onClick={onBack} style={{
          padding: '12px 20px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
          fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <ChevronLeft size={16} /> Attendance
        </button>
        <button onClick={onNext} style={{
          padding: '12px 24px', borderRadius: 'var(--radius-sm)',
          border: 'none', background: 'var(--brand-navy)', color: '#FFF',
          fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          Next: Travel <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

/* ========================================================= */
/* TRAVEL STEP                                                */
/* ========================================================= */

interface TravelStepProps {
  claim: WeeklyClaim;
  projects: ProjectRecord[];
  rates: ContractorRateVersion[];
  weekDays: string[];
  isReadOnly: boolean;
  addTravel: (t: Omit<TravelLine, 'id' | 'lineStatus'>) => void;
  removeTravel: (id: string) => void;
  showAddTravel: boolean;
  setShowAddTravel: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

const TravelStep: React.FC<TravelStepProps> = ({
  claim, projects, rates, weekDays, isReadOnly,
  addTravel, removeTravel, showAddTravel, setShowAddTravel, onBack, onNext
}) => {
  const [trvDate, setTrvDate] = useState('');
  const [trvDescription, setTrvDescription] = useState('');
  const [trvMiles, setTrvMiles] = useState('');
  const [trvFixedAmount, setTrvFixedAmount] = useState('');
  const [trvAllocations, setTrvAllocations] = useState<TravelProjectAllocation[]>([]);

  // Determine travel method from rate
  const currentRate = rates.length > 0 ? rates[0] : null;
  const travelMethod = currentRate?.travelMethod || 'mileage';

  const handleAddTravel = () => {
    if (!trvDate || !trvDescription) return;

    let totalAmountPence = 0;
    const mileageRatePence = currentRate?.mileageRatePence || 0;

    if (travelMethod === 'mileage') {
      const miles = parseFloat(trvMiles);
      if (!miles || miles <= 0) return;
      totalAmountPence = Math.round(miles * mileageRatePence);
    } else if (travelMethod === 'fixed_amount') {
      totalAmountPence = currentRate?.fixedTravelAmountPence || 0;
    }

    // Check allocations sum
    const allocTotal = trvAllocations.reduce((s, a) => s + a.allocatedAmountPence, 0);
    if (trvAllocations.length > 0 && allocTotal !== totalAmountPence) {
      alert(`Project allocations (${formatPenceToGBP(allocTotal)}) must equal the total (${formatPenceToGBP(totalAmountPence)}).`);
      return;
    }

    // Default allocation to first project if not specified
    const finalAllocations = trvAllocations.length > 0 ? trvAllocations :
      claim.attendanceLines
        .filter(l => l.localDate === trvDate && l.attendanceType !== 'did_not_attend')
        .map((l, _, arr) => ({
          projectId: l.projectId,
          projectReference: l.projectReference,
          projectTitle: l.projectTitle,
          allocatedAmountPence: Math.round(totalAmountPence / arr.length)
        }));

    if (finalAllocations.length === 0) {
      alert('Add at least one project allocation for the travel claim.');
      return;
    }

    // Fix rounding
    const allocSum = finalAllocations.reduce((s, a) => s + a.allocatedAmountPence, 0);
    if (allocSum !== totalAmountPence && finalAllocations.length > 0) {
      finalAllocations[0].allocatedAmountPence += (totalAmountPence - allocSum);
    }

    addTravel({
      travelDate: trvDate,
      travelMethod,
      journeyDescription: trvDescription,
      miles: travelMethod === 'mileage' ? parseFloat(trvMiles) : undefined,
      mileageRatePence: travelMethod === 'mileage' ? mileageRatePence : undefined,
      fixedAmountPence: travelMethod === 'fixed_amount' ? currentRate?.fixedTravelAmountPence : undefined,
      totalAmountPence,
      projectAllocations: finalAllocations
    });

    setTrvDate('');
    setTrvDescription('');
    setTrvMiles('');
    setTrvFixedAmount('');
    setTrvAllocations([]);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
          Travel
        </h3>
        {!isReadOnly && travelMethod !== 'none' && (
          <button
            onClick={() => setShowAddTravel(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: 'var(--radius-sm)', border: '1px dashed var(--brand-gold)',
              background: 'var(--brand-gold-light)', color: 'var(--brand-gold-hover)',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            <Plus size={14} /> Add Travel
          </button>
        )}
      </div>

      {travelMethod === 'none' && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px'
        }}>
          <Car size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            No travel method approved
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Contact GVD if you need to claim travel expenses
          </div>
        </div>
      )}

      {claim.travelLines.length === 0 && travelMethod !== 'none' && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px'
        }}>
          <Car size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            No travel claimed this week
          </div>
        </div>
      )}

      {/* Travel cards */}
      {claim.travelLines.map(line => (
        <div key={line.id} style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)', padding: '14px 16px', marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {formatDayHeader(line.travelDate)} • {line.travelMethod === 'mileage' ? `${line.miles} miles` : 'Fixed amount'}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{line.journeyDescription}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {line.projectAllocations.map(a => `${a.projectReference}: ${formatPenceToGBP(a.allocatedAmountPence)}`).join(' • ')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {formatPenceToGBP(line.totalAmountPence)}
              </span>
              {!isReadOnly && (
                <button onClick={() => removeTravel(line.id)} style={{
                  padding: '4px', border: 'none', background: 'transparent',
                  cursor: 'pointer', color: 'var(--text-muted)'
                }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Add travel modal */}
      {showAddTravel && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '100%', maxWidth: '500px',
            maxHeight: '85vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Add Travel
              </h3>
              <button onClick={() => setShowAddTravel(false)} style={{
                padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer'
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Date</label>
                <select value={trvDate} onChange={e => setTrvDate(e.target.value)} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }}>
                  <option value="">Select a day</option>
                  {weekDays.map(d => <option key={d} value={d}>{formatDayHeader(d)}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Journey Description</label>
                <input type="text" value={trvDescription} onChange={e => setTrvDescription(e.target.value)}
                  placeholder="e.g. Home to site and return" style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>

              {travelMethod === 'mileage' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Miles (@ {formatPenceToGBP(currentRate?.mileageRatePence || 0)}/mile)
                  </label>
                  <input type="number" value={trvMiles} onChange={e => setTrvMiles(e.target.value)}
                    placeholder="0" min="1" style={{
                      width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)', fontSize: '0.85rem'
                    }} />
                  {trvMiles && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', marginTop: '4px' }}>
                      = {formatPenceToGBP(Math.round(parseFloat(trvMiles) * (currentRate?.mileageRatePence || 0)))}
                    </div>
                  )}
                </div>
              )}

              {travelMethod === 'fixed_amount' && (
                <div style={{
                  padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Fixed travel amount: {formatPenceToGBP(currentRate?.fixedTravelAmountPence || 0)}
                  </div>
                </div>
              )}

              {/* Simple project allocation */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Split between projects
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Leave blank to split evenly across the day's projects
                </div>
                {projects.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px'
                  }}>
                    <span style={{ fontSize: '0.8rem', flex: 1 }}>{p.reference}</span>
                    <input
                      type="number"
                      placeholder="£0.00"
                      step="0.01"
                      min="0"
                      style={{
                        width: '100px', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)', fontSize: '0.8rem'
                      }}
                      onChange={e => {
                        const val = parseGBPToPence(e.target.value);
                        setTrvAllocations(prev => {
                          const filtered = prev.filter(a => a.projectId !== p.id);
                          if (val > 0) {
                            filtered.push({
                              projectId: p.id,
                              projectReference: p.reference,
                              projectTitle: p.title,
                              allocatedAmountPence: val
                            });
                          }
                          return filtered;
                        });
                      }}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddTravel}
                disabled={!trvDate || !trvDescription}
                style={{
                  width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                  fontWeight: 700, cursor: 'pointer',
                  opacity: !trvDate || !trvDescription ? 0.5 : 1
                }}
              >
                Add Travel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button onClick={onBack} style={{
          padding: '12px 20px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
          fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <ChevronLeft size={16} /> Expenses
        </button>
        <button onClick={onNext} style={{
          padding: '12px 24px', borderRadius: 'var(--radius-sm)',
          border: 'none', background: 'var(--brand-navy)', color: '#FFF',
          fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          Review & Submit <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

/* ========================================================= */
/* REVIEW & SUBMIT STEP                                       */
/* ========================================================= */

interface ReviewStepProps {
  claim: WeeklyClaim;
  rates: ContractorRateVersion[];
  errors: string[];
  submitResult: { success: boolean; errors: string[] } | null;
  submitting: boolean;
  isReadOnly: boolean;
  handleSubmit: () => void;
  handleWithdraw: () => void;
  onBack: () => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  claim, rates, errors, submitResult, submitting, isReadOnly,
  handleSubmit, handleWithdraw, onBack
}) => {
  const [declaration, setDeclaration] = useState(false);

  // Pre-validate
  const validationErrors = claim.status === 'Draft' || claim.status === 'Queried'
    ? validateClaimForSubmission(claim, rates) : [];

  // Group attendance by project
  const attendanceByProject = new Map<string, AttendanceLine[]>();
  claim.attendanceLines
    .filter(l => l.attendanceType !== 'did_not_attend')
    .forEach(l => {
      const existing = attendanceByProject.get(l.projectId) || [];
      existing.push(l);
      attendanceByProject.set(l.projectId, existing);
    });

  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
        Review Your Claim
      </h3>

      {/* Attendance summary by project */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)', marginBottom: '12px', overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Labour</span>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-navy)' }}>
            {formatPenceToGBP(claim.totalLabourPence)}
          </span>
        </div>
        {Array.from(attendanceByProject.entries()).map(([projectId, lines]) => (
          <div key={projectId} style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {lines[0].projectReference} – {lines[0].projectTitle}
              </span>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {lines.length} day{lines.length !== 1 ? 's' : ''}
              </div>
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {formatPenceToGBP(lines.reduce((s, l) => s + l.calculatedAmountPence, 0))}
            </span>
          </div>
        ))}
        {attendanceByProject.size === 0 && (
          <div style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No payable attendance
          </div>
        )}
      </div>

      {/* Expenses summary */}
      {claim.expenseLines.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)', marginBottom: '12px', overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Expenses</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-navy)' }}>
              {formatPenceToGBP(claim.totalExpensesPence)}
            </span>
          </div>
          {claim.expenseLines.map(l => (
            <div key={l.id} style={{
              padding: '8px 16px', borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem'
            }}>
              <span>{l.category}: {l.description}</span>
              <span style={{ fontWeight: 600 }}>{formatPenceToGBP(l.amountPence)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Travel summary */}
      {claim.travelLines.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)', marginBottom: '12px', overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Travel</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-navy)' }}>
              {formatPenceToGBP(claim.totalTravelPence)}
            </span>
          </div>
          {claim.travelLines.map(l => (
            <div key={l.id} style={{
              padding: '8px 16px', borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem'
            }}>
              <span>{l.journeyDescription}</span>
              <span style={{ fontWeight: 600 }}>{formatPenceToGBP(l.totalAmountPence)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grand total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', background: 'var(--brand-navy)', color: '#FFF',
        borderRadius: 'var(--radius-md)', marginBottom: '16px'
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
          Total Claim
        </span>
        <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
          {formatPenceToGBP(claim.totalClaimPence)}
        </span>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div style={{
          padding: '14px 16px', background: 'var(--status-danger-bg)',
          borderRadius: 'var(--radius-md)', marginBottom: '16px'
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--status-danger-text)', marginBottom: '8px' }}>
            Please fix before submitting:
          </div>
          {validationErrors.map((err, i) => (
            <div key={i} style={{
              fontSize: '0.8rem', color: 'var(--status-danger-text)',
              padding: '4px 0', display: 'flex', alignItems: 'flex-start', gap: '6px'
            }}>
              <XCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              {err}
            </div>
          ))}
        </div>
      )}

      {/* Submit result */}
      {submitResult && (
        <div style={{
          padding: '14px 16px',
          background: submitResult.success ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
          borderRadius: 'var(--radius-md)', marginBottom: '16px'
        }}>
          {submitResult.success ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} style={{ color: 'var(--status-success-text)' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--status-success-text)' }}>Claim Submitted</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--status-success-text)' }}>
                  Your claim has been submitted for review. Ref: {claim.claimReference}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, color: 'var(--status-danger-text)', marginBottom: '4px' }}>
                Submission Failed
              </div>
              {submitResult.errors.map((e, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--status-danger-text)' }}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Declaration & submit */}
      {!isReadOnly && validationErrors.length === 0 && !submitResult?.success && (
        <>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px',
            background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '16px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={declaration}
              onChange={e => setDeclaration(e.target.checked)}
              style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--brand-gold)' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              I confirm that the work, expenses and travel listed are accurate to the best of my knowledge.
            </span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={!declaration || submitting}
            style={{
              width: '100%', padding: '16px', borderRadius: 'var(--radius-md)',
              border: 'none', background: declaration ? 'var(--brand-gold)' : 'var(--bg-subtle)',
              color: declaration ? '#FFF' : 'var(--text-muted)',
              fontWeight: 800, fontSize: '1rem', cursor: declaration ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontFamily: 'var(--font-heading)'
            }}
          >
            {submitting ? (
              <><Loader2 size={18} className="spin" /> Submitting...</>
            ) : (
              <><Send size={18} /> Submit Claim – {formatPenceToGBP(claim.totalClaimPence)}</>
            )}
          </button>
        </>
      )}

      {/* Withdraw option */}
      {claim.status === 'Submitted' && (
        <button
          onClick={handleWithdraw}
          style={{
            width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--status-danger-text)', background: 'transparent',
            color: 'var(--status-danger-text)', fontWeight: 600, fontSize: '0.85rem',
            cursor: 'pointer', marginTop: '12px'
          }}
        >
          Withdraw Claim
        </button>
      )}

      {/* Download PDF button */}
      <button
        onClick={() => generateClaimPDF(claim, claim.status === 'Draft' ? 'Draft Claim' : 'Submitted Claim')}
        style={{
          width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
          color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem',
          cursor: 'pointer', marginTop: '12px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '8px'
        }}
      >
        <Download size={16} /> Download {claim.status === 'Draft' ? 'Draft' : 'Submitted'} Claim PDF
      </button>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '16px' }}>
        <button onClick={onBack} style={{
          padding: '12px 20px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
          fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <ChevronLeft size={16} /> Travel
        </button>
      </div>
    </div>
  );
};

/* ========================================================= */
/* CLAIM HISTORY VIEW                                         */
/* ========================================================= */

const ClaimHistoryView: React.FC<{ claims: WeeklyClaim[] }> = ({ claims }) => {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'Draft': { bg: 'var(--bg-subtle)', text: 'var(--text-secondary)' },
    'Submitted': { bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
    'Under Review': { bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
    'Partially Approved': { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
    'Approved': { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
    'Queried': { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
    'Withdrawn': { bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
  };

  if (claims.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 24px', background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
      }}>
        <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>No Claims Yet</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Your submitted claims will appear here
        </div>
      </div>
    );
  }

  return (
    <div>
      {claims.map(c => {
        const colors = statusColors[c.status] || statusColors['Draft'];
        return (
          <div key={c.id} style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)', padding: '14px 16px',
            marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>
                  {c.claimReference}
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Week: {formatDayHeader(c.weekStartDate)} – {formatDayHeader(c.weekEndDate)}
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: 'var(--radius-full)', background: colors.bg, color: colors.text
              }}>
                {c.status}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              <span>Labour: <strong>{formatPenceToGBP(c.totalLabourPence)}</strong></span>
              {c.totalExpensesPence > 0 && <span>Expenses: <strong>{formatPenceToGBP(c.totalExpensesPence)}</strong></span>}
              {c.totalTravelPence > 0 && <span>Travel: <strong>{formatPenceToGBP(c.totalTravelPence)}</strong></span>}
              <span style={{ fontWeight: 700 }}>Total: {formatPenceToGBP(c.totalClaimPence)}</span>
            </div>

            {c.approvedTotalPence != null && c.approvedTotalPence > 0 && (
              <div style={{
                fontSize: '0.75rem', marginTop: '6px', padding: '4px 8px',
                background: 'var(--status-success-bg)', borderRadius: 'var(--radius-sm)',
                color: 'var(--status-success-text)', fontWeight: 600
              }}>
                Approved: {formatPenceToGBP(c.approvedTotalPence)}
              </div>
            )}

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => generateClaimPDF(c, c.status === 'Approved' || c.status === 'Partially Approved' ? 'Approved Claim Summary' : 'Submitted Claim')}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Download size={13} /> Download PDF
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ========================================================= */
/* INVOICES & PAYMENTS VIEW (Contractor)                      */
/* ========================================================= */

const InvoicesPaymentsView: React.FC<{ currentUser: UserProfile }> = ({ currentUser }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [uninvoicedLines, setUninvoicedLines] = useState<ApprovedUninvoicedLine[]>([]);
  const [taxConfig, setTaxConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Invoice creation modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(formatLocalDate(new Date()));
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [lastIssuedInvoice, setLastIssuedInvoice] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, pay, lines, tax] = await Promise.all([
        getContractorInvoices(currentUser.uid),
        getContractorPayments(currentUser.uid),
        getApprovedUninvoicedLines(currentUser.uid),
        getContractorTaxConfig(currentUser.uid)
      ]);
      setInvoices(inv);
      setPayments(pay);
      setUninvoicedLines(lines);
      setTaxConfig(tax);
    } catch (err) {
      console.error('Failed to load contractor finance data:', err);
    }
    setLoading(false);
  }, [currentUser.uid]);

  useEffect(() => { loadData(); }, [loadData]);

  // Selected lines computation
  const selectedLines = uninvoicedLines.filter(l => selectedLineIds.has(l.lineId));
  const selectedNetPence = selectedLines.reduce((s, l) => s + l.amountPence, 0);

  // VAT estimation
  let estimatedVatPence = 0;
  let vatLabel = 'Not VAT Registered';
  if (taxConfig?.vatRegistered && taxConfig.vatRate) {
    if (taxConfig.reverseChargeApplicable) {
      vatLabel = 'Domestic Reverse Charge (Customer accounts for VAT)';
    } else {
      estimatedVatPence = Math.round(selectedNetPence * (taxConfig.vatRate / 100));
      vatLabel = `Standard VAT (${taxConfig.vatRate}%)`;
    }
  }

  // CIS estimation
  let estimatedCisPence = 0;
  if (taxConfig?.cisApplicable && taxConfig.cisDeductionRate) {
    const labourNet = selectedLines
      .filter(l => l.lineType === 'attendance')
      .reduce((s, l) => s + l.amountPence, 0);
    estimatedCisPence = Math.round(labourNet * (taxConfig.cisDeductionRate / 100));
  }

  const estimatedGrossPence = selectedNetPence + estimatedVatPence - estimatedCisPence;

  // Toggle selection
  const toggleSelectLine = (id: string) => {
    setSelectedLineIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedLineIds.size === uninvoicedLines.length) {
      setSelectedLineIds(new Set());
    } else {
      setSelectedLineIds(new Set(uninvoicedLines.map(l => l.lineId)));
    }
  };

  const handleIssueInvoice = async () => {
    if (!invoiceNumber.trim() || !invoiceDate) {
      setIssueError('Please enter an invoice number and date.');
      return;
    }
    if (selectedLines.length === 0) {
      setIssueError('Please select at least one approved line.');
      return;
    }

    setIssuing(true);
    setIssueError(null);

    // Group selected lines by claim
    const firstLine = selectedLines[0];
    const claimDocSnap = await getExistingClaim(currentUser.uid, firstLine.weekStartDate);
    if (!claimDocSnap) {
      setIssueError('Could not locate originating claim for selected lines.');
      setIssuing(false);
      return;
    }

    const res = await issueInvoice(
      claimDocSnap,
      invoiceNumber.trim(),
      invoiceDate,
      {
        name: currentUser.fullName,
        address: taxConfig?.supplierBusinessAddress || '',
        vatNumber: taxConfig?.vatNumber
      },
      {
        name: 'GVD Contracts Ltd',
        address: '107–109 Charterhouse Street, London EC1M 6PT'
      },
      taxConfig,
      currentUser.uid,
      currentUser.fullName,
      Array.from(selectedLineIds)
    );

    if (res.success && res.invoice) {
      setLastIssuedInvoice(res.invoice);
      setShowIssueModal(false);
      setSelectedLineIds(new Set());
      setInvoiceNumber('');
      await loadData();
    } else {
      setIssueError(res.error || 'Failed to issue invoice.');
    }
    setIssuing(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '8px' }}>
        <Loader2 size={20} className="spin" /> Loading...
      </div>
    );
  }

  return (
    <div>
      {/* Success banner if invoice was just issued */}
      {lastIssuedInvoice && (
        <div style={{
          padding: '16px', background: 'var(--status-success-bg)',
          borderRadius: 'var(--radius-md)', marginBottom: '20px',
          border: '1px solid var(--status-success-text)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--status-success-text)', fontSize: '0.9rem' }}>
                ✓ Invoice {lastIssuedInvoice.invoiceNumber} Issued Successfully
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--status-success-text)', marginTop: '2px' }}>
                Ref: {lastIssuedInvoice.internalReference} • Total: {formatPenceToGBP(lastIssuedInvoice.grossAmountPence)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => generateInvoicePDF(lastIssuedInvoice)}
                style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--status-success-text)', color: '#FFF',
                  fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Download size={14} /> Download Invoice PDF
              </button>
              <button
                onClick={() => setLastIssuedInvoice(null)}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVED LINES READY TO INVOICE */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Approved Lines Ready to Invoice
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Select your approved items and issue your tax invoice to GVD
            </div>
          </div>
          {uninvoicedLines.length > 0 && (
            <button
              onClick={selectAll}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              {selectedLineIds.size === uninvoicedLines.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {uninvoicedLines.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '36px 20px', background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
          }}>
            <CheckCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              No uninvoiced approved lines
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              When GVD approves your weekly claims, your approved attendance and expenses will appear here ready to invoice.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {uninvoicedLines.map(line => {
                const isSelected = selectedLineIds.has(line.lineId);
                return (
                  <div
                    key={line.lineId}
                    onClick={() => toggleSelectLine(line.lineId)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: isSelected ? 'var(--brand-gold-light)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)', border: `1px solid ${isSelected ? 'var(--brand-gold)' : 'var(--border-color)'}`,
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Controlled via parent div onClick
                        style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {line.description}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Claim: {line.claimReference} • {line.projectReference} • {line.localDate}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-navy)' }}>
                      {formatPenceToGBP(line.amountPence)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Invoicing summary bar */}
            {selectedLineIds.size > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'var(--brand-navy)', color: '#FFF',
                borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '10px'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {selectedLineIds.size} line{selectedLineIds.size !== 1 ? 's' : ''} selected
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                    Net: {formatPenceToGBP(selectedNetPence)} • Gross Due: {formatPenceToGBP(estimatedGrossPence)}
                  </div>
                </div>
                <button
                  onClick={() => { setShowIssueModal(true); setIssueError(null); }}
                  style={{
                    padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                    border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <FileText size={16} /> Issue My Invoice
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MY ISSUED INVOICES */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>
        My Issued Invoices
      </h3>
      {invoices.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '36px 20px', background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
          marginBottom: '24px'
        }}>
          <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No issued invoices yet</div>
        </div>
      ) : (
        invoices.map(inv => (
          <div key={inv.id} style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)', padding: '14px 16px',
            marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {inv.invoiceNumber}
              </span>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: inv.paymentStatus === 'Paid' ? 'var(--status-success-bg)' :
                  inv.paymentStatus === 'Part Paid' ? 'var(--status-warning-bg)' : 'var(--status-info-bg)',
                color: inv.paymentStatus === 'Paid' ? 'var(--status-success-text)' :
                  inv.paymentStatus === 'Part Paid' ? 'var(--status-warning-text)' : 'var(--status-info-text)'
              }}>
                {inv.paymentStatus}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {inv.invoiceDate} • Internal Ref: {inv.internalReference} • Claim: {inv.claimReference}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
              <span>Gross: <strong>{formatPenceToGBP(inv.grossAmountPence)}</strong></span>
              <span>Paid: <strong>{formatPenceToGBP(inv.totalPaidPence)}</strong></span>
              <span>Outstanding: <strong>{formatPenceToGBP(inv.outstandingPence)}</strong></span>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => generateInvoicePDF(inv)}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Download size={13} /> Download Invoice PDF
              </button>
            </div>
          </div>
        ))
      )}

      {/* PAYMENT HISTORY */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '12px', marginTop: '24px' }}>
        Payment History
      </h3>
      {payments.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '36px 20px', background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No payments recorded</div>
        </div>
      ) : (
        payments.filter(p => !p.isReversal).map(p => (
          <div key={p.id} style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)', padding: '12px 16px',
            marginBottom: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {formatPenceToGBP(p.amountPence)}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {p.paymentDate}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ref: {p.paymentReference} • Invoice: {p.invoiceNumber}
            </div>
          </div>
        ))
      )}

      {/* ISSUE INVOICE MODAL */}
      {showIssueModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '100%', maxWidth: '520px',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Issue Contractor Invoice
              </h3>
              <button
                onClick={() => setShowIssueModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {issueError && (
              <div style={{
                padding: '10px 14px', background: 'var(--status-danger-bg)',
                borderRadius: 'var(--radius-sm)', marginBottom: '14px',
                fontSize: '0.8rem', color: 'var(--status-danger-text)'
              }}>
                {issueError}
              </div>
            )}

            {/* Parties */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
              padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)',
              marginBottom: '14px', fontSize: '0.75rem'
            }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>FROM (Supplier):</span>
                <div style={{ fontWeight: 600 }}>{currentUser.fullName}</div>
                {taxConfig?.supplierBusinessAddress && <div>{taxConfig.supplierBusinessAddress}</div>}
                {taxConfig?.vatNumber && <div>VAT: {taxConfig.vatNumber}</div>}
              </div>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>TO (Customer):</span>
                <div style={{ fontWeight: 600 }}>GVD Contracts Ltd</div>
                <div>107–109 Charterhouse Street</div>
                <div>London EC1M 6PT</div>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Your Invoice Number * (Must be unique in your series)
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-001"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Invoice Date *
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Selected lines list */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                Invoiced Items ({selectedLines.length})
              </label>
              <div style={{
                maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.75rem'
              }}>
                {selectedLines.map(l => (
                  <div key={l.lineId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>{l.description}</span>
                    <span style={{ fontWeight: 600 }}>{formatPenceToGBP(l.amountPence)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial calculation breakdown */}
            <div style={{
              padding: '12px 14px', background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.8rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Net Labour & Costs:</span>
                <span style={{ fontWeight: 600 }}>{formatPenceToGBP(selectedNetPence)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>VAT ({vatLabel}):</span>
                <span style={{ fontWeight: 600 }}>{formatPenceToGBP(estimatedVatPence)}</span>
              </div>
              {estimatedCisPence > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#B91C1C' }}>
                  <span>CIS Deduction ({taxConfig?.cisDeductionRate}%):</span>
                  <span style={{ fontWeight: 600 }}>-{formatPenceToGBP(estimatedCisPence)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', paddingTop: '6px',
                borderTop: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.95rem'
              }}>
                <span>Gross Payable:</span>
                <span style={{ color: 'var(--brand-navy)' }}>{formatPenceToGBP(estimatedGrossPence)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowIssueModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleIssueInvoice}
                disabled={issuing || !invoiceNumber.trim()}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                  fontWeight: 700, cursor: 'pointer', opacity: issuing || !invoiceNumber.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {issuing ? <><Loader2 size={16} className="spin" /> Issuing...</> : 'Confirm & Issue Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
