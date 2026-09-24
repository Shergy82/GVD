import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, MessageSquare, ChevronDown,
  ChevronUp, FileText, Eye, Download, Loader2, Clock, Filter,
  Receipt, Car, Calendar, DollarSign, CreditCard, Upload, X,
  Search, User, Building, Send, Banknote
} from 'lucide-react';
import type {
  UserProfile, WeeklyClaim, AttendanceLine, ExpenseLine, TravelLine,
  ClaimStatus, ClaimLineStatus, InvoiceRecord, PaymentRecord,
  ContractorRateVersion, ContractorTaxConfig
} from '../types';
import {
  getClaimsForReview, reviewClaimLine, getClaim,
  getContractorRates, getContractorTaxConfig,
  issueInvoice, matchUploadedInvoice,
  getAllInvoices, getInvoicePayments, recordPayment, reversePayment,
  canReviewClaims, canRecordPayments, canIssueInvoices, canViewFinancials,
  getContractorInvoices, saveContractorRate, saveContractorTaxConfig,
  canManageRates, generateClaimReference
} from '../services/claimsService';
import { formatPenceToGBP, parseGBPToPence } from '../services/projectService';
import { formatDayHeader, formatLocalDate } from '../services/plannerService';
import { generateClaimPDF, generateInvoicePDF } from '../services/pdfService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

interface ClaimsReviewViewProps {
  currentUser: UserProfile;
}

type ReviewFilter = 'Submitted' | 'Queried' | 'Approved' | 'All';

export const ClaimsReviewView: React.FC<ClaimsReviewViewProps> = ({ currentUser }) => {
  const [activeSection, setActiveSection] = useState<'claims' | 'invoices' | 'payments' | 'rates'>('claims');
  const [claims, setClaims] = useState<WeeklyClaim[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>('Submitted');
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);
  const [reviewingLine, setReviewingLine] = useState<{ claimId: string; lineType: string; lineId: string } | null>(null);
  const [reviewAction, setReviewAction] = useState<'Approved' | 'Queried' | 'Rejected' | 'Reduced'>('Approved');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAmount, setReviewAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);

  // Invoice modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceClaim, setInvoiceClaim] = useState<WeeklyClaim | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(formatLocalDate(new Date()));

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(formatLocalDate(new Date()));
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (currentUser.role === 'ProjectManager') {
        const projSnap = await getDocs(
          query(collection(db, 'projects'), where('assignedUserIds', 'array-contains', currentUser.uid))
        );
        setAssignedProjectIds(projSnap.docs.map(d => d.id));
      }

      const statusMap: Record<ReviewFilter, ClaimStatus[] | undefined> = {
        'Submitted': ['Submitted', 'Under Review'],
        'Queried': ['Queried'],
        'Approved': ['Approved', 'Partially Approved'],
        'All': undefined
      };
      const [claimData, invoiceData] = await Promise.all([
        getClaimsForReview(statusMap[filter]),
        getAllInvoices()
      ]);
      setClaims(claimData);
      setInvoices(invoiceData);
    } catch (err) {
      console.error('Failed to load review data:', err);
    }
    setLoading(false);
  }, [filter, currentUser.role, currentUser.uid]);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle review action
  const handleReviewLine = async () => {
    if (!reviewingLine) return;
    setSaving(true);
    const result = await reviewClaimLine(
      reviewingLine.claimId,
      reviewingLine.lineType as any,
      reviewingLine.lineId,
      reviewAction,
      currentUser.uid,
      currentUser.fullName,
      reviewNote,
      reviewAction === 'Reduced' ? parseGBPToPence(reviewAmount) : undefined,
      currentUser.role === 'ProjectManager' ? assignedProjectIds : undefined
    );
    if (!result.success) {
      alert(result.error || 'Failed to review line.');
    }
    setReviewingLine(null);
    setReviewNote('');
    setReviewAmount('');
    await loadData();
    setSaving(false);
  };

  // Approve all submitted lines in a claim at once
  const handleApproveAll = async (claimId: string) => {
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;
    if (claim.contractorUid === currentUser.uid) {
      alert('You cannot approve your own claim.');
      return;
    }
    setSaving(true);
    const isPM = currentUser.role === 'ProjectManager';
    const allLines = [
      ...claim.attendanceLines
        .filter(l => l.lineStatus === 'Submitted')
        .filter(l => !isPM || assignedProjectIds.includes(l.projectId))
        .map(l => ({ type: 'attendance', id: l.id })),
      ...claim.expenseLines
        .filter(l => l.lineStatus === 'Submitted')
        .filter(l => !isPM || assignedProjectIds.includes(l.projectId))
        .map(l => ({ type: 'expense', id: l.id })),
      ...claim.travelLines
        .filter(l => l.lineStatus === 'Submitted')
        .filter(l => !isPM || l.projectAllocations.some(a => assignedProjectIds.includes(a.projectId)))
        .map(l => ({ type: 'travel', id: l.id })),
    ];
    for (const line of allLines) {
      await reviewClaimLine(
        claimId, line.type as any, line.id, 'Approved', currentUser.uid, currentUser.fullName,
        undefined, undefined, isPM ? assignedProjectIds : undefined
      );
    }
    await loadData();
    setSaving(false);
  };

  // Handle invoice issuance
  const handleIssueInvoice = async () => {
    if (!invoiceClaim || !invoiceNumber || !invoiceDate) return;
    setSaving(true);

    const taxConfig = await getContractorTaxConfig(invoiceClaim.contractorUid);

    const result = await issueInvoice(
      invoiceClaim,
      invoiceNumber,
      invoiceDate,
      {
        name: invoiceClaim.contractorName,
        address: taxConfig?.supplierBusinessAddress || '',
        vatNumber: taxConfig?.vatNumber
      },
      { name: 'GVD Contracts Ltd', address: '' },
      taxConfig,
      currentUser.uid,
      currentUser.fullName
    );

    if (result.success) {
      setShowInvoiceModal(false);
      setInvoiceClaim(null);
      await loadData();
    } else {
      alert(result.error || 'Failed to issue invoice.');
    }
    setSaving(false);
  };

  // Handle payment recording
  const handleRecordPayment = async () => {
    if (!paymentInvoice || !paymentAmount || !paymentDate || !paymentRef) return;
    setSaving(true);

    const result = await recordPayment({
      invoiceId: paymentInvoice.id,
      invoiceNumber: paymentInvoice.invoiceNumber,
      invoiceInternalRef: paymentInvoice.internalReference,
      contractorUid: paymentInvoice.contractorUid,
      contractorName: paymentInvoice.contractorName,
      paymentDate,
      amountPence: parseGBPToPence(paymentAmount),
      paymentReference: paymentRef,
      internalNote: paymentNote,
      recordedByUid: currentUser.uid,
      recordedByName: currentUser.fullName,
      isReversal: false
    });

    if (result.success) {
      setShowPaymentModal(false);
      setPaymentInvoice(null);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNote('');
      await loadData();
    } else {
      alert(result.error || 'Failed to record payment.');
    }
    setSaving(false);
  };

  // Generate PDF
  const handleDownloadClaimPDF = (claim: WeeklyClaim, type: 'claim' | 'approved' | 'invoice') => {
    generateClaimPDF(claim, type === 'approved' ? 'Approved Claim Summary' : claim.status === 'Draft' ? 'Draft Claim' : 'Submitted Claim');
  };

  const lineStatusBadge = (status: ClaimLineStatus) => {
    const colors: Record<string, { bg: string; text: string }> = {
      'Draft': { bg: '#F1F5F9', text: '#475569' },
      'Submitted': { bg: '#E0F2FE', text: '#075985' },
      'Approved': { bg: '#D1FAE5', text: '#065F46' },
      'Queried': { bg: '#FEF3C7', text: '#92400E' },
      'Rejected': { bg: '#FEE2E2', text: '#991B1B' },
      'Withdrawn': { bg: '#F1F5F9', text: '#94A3B8' },
    };
    const c = colors[status] || colors['Draft'];
    return (
      <span style={{
        fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px',
        borderRadius: 'var(--radius-full)', background: c.bg, color: c.text
      }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '8px' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--brand-gold)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Loading claims...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Section tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-md)', padding: '4px', overflowX: 'auto'
      }}>
        {[
          { id: 'claims' as const, label: 'Review Claims', icon: <FileText size={15} /> },
          ...(canViewFinancials(currentUser) ? [
            { id: 'invoices' as const, label: 'Invoices', icon: <Receipt size={15} /> },
            { id: 'payments' as const, label: 'Payments', icon: <CreditCard size={15} /> },
          ] : []),
          ...(canManageRates(currentUser) ? [{ id: 'rates' as const, label: 'Rates', icon: <DollarSign size={15} /> }] : [])
        ].map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: activeSection === sec.id ? 'var(--bg-surface)' : 'transparent',
              fontWeight: activeSection === sec.id ? 700 : 500, fontSize: '0.8rem',
              color: activeSection === sec.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
              boxShadow: activeSection === sec.id ? 'var(--shadow-sm)' : 'none', whiteSpace: 'nowrap'
            }}
          >
            {sec.icon} {sec.label}
          </button>
        ))}
      </div>

      {/* CLAIMS REVIEW */}
      {activeSection === 'claims' && (
        <>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['Submitted', 'Queried', 'Approved', 'All'] as ReviewFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-full)',
                  border: `1px solid ${filter === f ? 'var(--brand-navy)' : 'var(--border-color)'}`,
                  background: filter === f ? 'var(--brand-navy)' : 'var(--bg-surface)',
                  color: filter === f ? '#FFF' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                {f === 'Submitted' ? '📥 Awaiting Review' : f === 'Queried' ? '❓ Queried' : f === 'Approved' ? '✅ Approved' : '📋 All'}
                {f !== 'All' && (
                  <span style={{ marginLeft: '6px', opacity: 0.7 }}>
                    ({claims.length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {claims.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 24px', background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
            }}>
              <CheckCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>No claims in this view</div>
            </div>
          )}

          {/* Claim cards */}
          {claims
            .filter(claim => {
              if (currentUser.role !== 'ProjectManager') return true;
              const hasAtt = claim.attendanceLines.some(l => assignedProjectIds.includes(l.projectId));
              const hasExp = claim.expenseLines.some(l => assignedProjectIds.includes(l.projectId));
              const hasTrv = claim.travelLines.some(l => l.projectAllocations.some(a => assignedProjectIds.includes(a.projectId)));
              return hasAtt || hasExp || hasTrv;
            })
            .map(claim => {
            const isPM = currentUser.role === 'ProjectManager';
            const isExpanded = expandedClaimId === claim.id;
            const isSelfClaim = claim.contractorUid === currentUser.uid;
            const relevantAttendance = claim.attendanceLines
              .filter(l => l.attendanceType !== 'did_not_attend')
              .filter(l => !isPM || assignedProjectIds.includes(l.projectId));
            const relevantExpenses = claim.expenseLines
              .filter(l => !isPM || assignedProjectIds.includes(l.projectId));
            const relevantTravel = claim.travelLines
              .filter(l => !isPM || l.projectAllocations.some(a => assignedProjectIds.includes(a.projectId)));
            const submittedLines = [
              ...relevantAttendance.filter(l => l.lineStatus === 'Submitted'),
              ...relevantExpenses.filter(l => l.lineStatus === 'Submitted'),
              ...relevantTravel.filter(l => l.lineStatus === 'Submitted'),
            ];

            return (
              <div key={claim.id} style={{
                background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)', marginBottom: '10px', overflow: 'hidden'
              }}>
                {/* Claim header */}
                <div
                  onClick={() => setExpandedClaimId(isExpanded ? null : claim.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', cursor: 'pointer',
                    borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'var(--brand-gold-light)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                      fontSize: '0.8rem', color: 'var(--brand-gold-hover)'
                    }}>
                      {claim.contractorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {claim.contractorName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {claim.claimReference} • {formatDayHeader(claim.weekStartDate)} – {formatDayHeader(claim.weekEndDate)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {canViewFinancials(currentUser) ? (
                      <span style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>
                        {formatPenceToGBP(claim.totalClaimPence)}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {relevantAttendance.length} attendance line{relevantAttendance.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: '16px' }}>
                    {isSelfClaim && (
                      <div style={{
                        padding: '10px 14px', background: 'var(--status-warning-bg)',
                        borderRadius: 'var(--radius-sm)', marginBottom: '12px',
                        fontSize: '0.8rem', fontWeight: 600, color: 'var(--status-warning-text)'
                      }}>
                        ⚠ This is your own claim – you cannot approve it.
                      </div>
                    )}

                    {/* Quick actions */}
                    {!isSelfClaim && submittedLines.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleApproveAll(claim.id)}
                          disabled={saving}
                          style={{
                            padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                            border: 'none', background: 'var(--status-success-text)',
                            color: '#FFF', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <CheckCircle size={16} /> Approve All ({submittedLines.length} lines)
                        </button>
                        {canViewFinancials(currentUser) && (
                          <button
                            onClick={() => handleDownloadClaimPDF(claim, 'claim')}
                            style={{
                              padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <Download size={14} /> PDF
                          </button>
                        )}
                      </div>
                    )}

                    {/* Attendance lines */}
                    {relevantAttendance.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={15} /> Labour
                        </div>
                        {relevantAttendance.map(line => (
                          <div key={line.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: 'var(--bg-subtle)',
                            borderRadius: 'var(--radius-sm)', marginBottom: '4px',
                            flexWrap: 'wrap', gap: '8px'
                          }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                {formatDayHeader(line.localDate)} – {line.projectReference}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                {line.attendanceType === 'full_day' ? 'Full Day' : line.attendanceType === 'half_day' ? 'Half Day' : `${line.actualHours}hrs`}
                                {line.isUnplanned && ' (Unplanned)'}
                              </span>
                              {line.unplannedReason && (
                                <div style={{ fontSize: '0.7rem', color: '#EA580C' }}>Reason: {line.unplannedReason}</div>
                              )}
                              {line.explanation && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Note: {line.explanation}</div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {canViewFinancials(currentUser) && (
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                  {formatPenceToGBP(line.calculatedAmountPence)}
                                </span>
                              )}
                              {lineStatusBadge(line.lineStatus)}
                              {!isSelfClaim && line.lineStatus === 'Submitted' && (
                                <button
                                  onClick={() => setReviewingLine({ claimId: claim.id, lineType: 'attendance', lineId: line.id })}
                                  style={{
                                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                                    fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  Review
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expense lines */}
                    {relevantExpenses.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Receipt size={15} /> Expenses
                        </div>
                        {relevantExpenses.map(line => (
                          <div key={line.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: 'var(--bg-subtle)',
                            borderRadius: 'var(--radius-sm)', marginBottom: '4px',
                            flexWrap: 'wrap', gap: '8px'
                          }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                {line.category}: {line.description}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                {line.projectReference} • {formatDayHeader(line.expenseDate)}
                              </span>
                              {line.receiptFileUrls.length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--status-success-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle size={10} /> {line.receiptFileUrls.length} receipt(s)
                                  {line.receiptFileUrls.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      style={{ marginLeft: '4px', color: 'var(--status-info-text)' }}>
                                      <Eye size={12} />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {canViewFinancials(currentUser) && (
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                  {formatPenceToGBP(line.amountPence)}
                                </span>
                              )}
                              {lineStatusBadge(line.lineStatus)}
                              {!isSelfClaim && line.lineStatus === 'Submitted' && (
                                <button
                                  onClick={() => setReviewingLine({ claimId: claim.id, lineType: 'expense', lineId: line.id })}
                                  style={{
                                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                                    fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  Review
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Travel lines */}
                    {relevantTravel.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Car size={15} /> Travel
                        </div>
                        {relevantTravel.map(line => (
                          <div key={line.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: 'var(--bg-subtle)',
                            borderRadius: 'var(--radius-sm)', marginBottom: '4px',
                            flexWrap: 'wrap', gap: '8px'
                          }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                {line.journeyDescription}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                {formatDayHeader(line.travelDate)} • {line.miles ? `${line.miles} miles` : 'Fixed'}
                              </span>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Split: {line.projectAllocations
                                  .filter(a => !isPM || assignedProjectIds.includes(a.projectId))
                                  .map(a => `${a.projectReference}${canViewFinancials(currentUser) ? `: ${formatPenceToGBP(a.allocatedAmountPence)}` : ''}`)
                                  .join(', ')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {canViewFinancials(currentUser) && (
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                  {formatPenceToGBP(line.totalAmountPence)}
                                </span>
                              )}
                              {lineStatusBadge(line.lineStatus)}
                              {!isSelfClaim && line.lineStatus === 'Submitted' && (
                                <button
                                  onClick={() => setReviewingLine({ claimId: claim.id, lineType: 'travel', lineId: line.id })}
                                  style={{
                                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                                    fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  Review
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Totals */}
                    {canViewFinancials(currentUser) && (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
                        background: 'var(--brand-navy)', color: '#FFF', borderRadius: 'var(--radius-sm)',
                        marginBottom: '12px'
                      }}>
                        <span style={{ fontWeight: 700 }}>
                          Submitted: {formatPenceToGBP(claim.totalClaimPence)}
                        </span>
                        {claim.approvedTotalPence != null && (
                          <span style={{ fontWeight: 700 }}>
                            Approved: {formatPenceToGBP(claim.approvedTotalPence)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Invoice action */}
                    {(claim.status === 'Approved' || claim.status === 'Partially Approved') &&
                      canIssueInvoices(currentUser) && (
                        <button
                          onClick={() => { setInvoiceClaim(claim); setShowInvoiceModal(true); }}
                          style={{
                            padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                            border: 'none', background: 'var(--brand-gold)',
                            color: '#FFF', fontWeight: 700, fontSize: '0.85rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <FileText size={16} /> Issue Invoice
                        </button>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* INVOICES */}
      {activeSection === 'invoices' && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>
            Invoices
          </h3>
          {invoices.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px', background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
            }}>
              <Receipt size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>No invoices yet</div>
            </div>
          ) : (
            invoices.map(inv => (
              <div key={inv.id} style={{
                background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)', padding: '14px 16px', marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {inv.invoiceNumber}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '8px' }}>
                        ({inv.internalReference})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {inv.contractorName} • {inv.invoiceDate} • Claim: {inv.claimReference}
                    </div>
                  </div>
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
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  <span>Net: <strong>{formatPenceToGBP(inv.netAmountPence)}</strong></span>
                  {inv.vatAmountPence > 0 && <span>VAT: <strong>{formatPenceToGBP(inv.vatAmountPence)}</strong></span>}
                  {inv.cisDeductionPence && inv.cisDeductionPence > 0 && <span>CIS: <strong>-{formatPenceToGBP(inv.cisDeductionPence)}</strong></span>}
                  <span>Gross: <strong>{formatPenceToGBP(inv.grossAmountPence)}</strong></span>
                  <span>Paid: <strong>{formatPenceToGBP(inv.totalPaidPence)}</strong></span>
                  <span>Outstanding: <strong>{formatPenceToGBP(inv.outstandingPence)}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => generateInvoicePDF(inv)}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                      fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Download size={14} /> Download PDF
                  </button>
                  {inv.paymentStatus !== 'Paid' && canRecordPayments(currentUser) && (
                    <button
                      onClick={() => { setPaymentInvoice(inv); setShowPaymentModal(true); setPaymentAmount((inv.outstandingPence / 100).toFixed(2)); }}
                      style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                        border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                        fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Banknote size={14} /> Record Payment
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PAYMENTS */}
      {activeSection === 'payments' && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>
            Payment Records
          </h3>
          <div style={{
            textAlign: 'center', padding: '40px 24px', background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
          }}>
            <CreditCard size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Use the Invoices tab to record payments against specific invoices.
            </div>
          </div>
        </div>
      )}

      {/* RATES MANAGEMENT */}
      {activeSection === 'rates' && canManageRates(currentUser) && (
        <RatesManagement currentUser={currentUser} />
      )}

      {/* Review line modal */}
      {reviewingLine && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '100%', maxWidth: '460px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
              Review Line
            </h3>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {((currentUser.role === 'ProjectManager'
                ? ['Approved', 'Queried', 'Rejected'] as const
                : ['Approved', 'Queried', 'Rejected', 'Reduced'] as const)
              ).map(a => (
                <button key={a} onClick={() => setReviewAction(a)} style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-full)',
                  border: `1px solid ${reviewAction === a ? 'var(--brand-navy)' : 'var(--border-color)'}`,
                  background: reviewAction === a ? 'var(--brand-navy)' : 'var(--bg-surface)',
                  color: reviewAction === a ? '#FFF' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                {a === 'Approved' ? '✓ Approve' : a === 'Queried' ? '? Query' : a === 'Rejected' ? '✕ Reject' : '↓ Reduce'}
              </button>
            ))}
          </div>

            {reviewAction === 'Reduced' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Approved Amount (£) *
                </label>
                <input type="number" value={reviewAmount} onChange={e => setReviewAmount(e.target.value)}
                  step="0.01" min="0" style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                {reviewAction === 'Queried' ? 'Question for contractor *' :
                  reviewAction === 'Rejected' || reviewAction === 'Reduced' ? 'Reason *' : 'Note (optional)'}
              </label>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                rows={3} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem', resize: 'vertical'
                }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setReviewingLine(null); setReviewNote(''); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontWeight: 600, cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button onClick={handleReviewLine} disabled={saving ||
                ((reviewAction === 'Queried' || reviewAction === 'Rejected' || reviewAction === 'Reduced') && !reviewNote) ||
                (reviewAction === 'Reduced' && !reviewAmount)
              }
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                  fontWeight: 700, cursor: 'pointer',
                  opacity: saving ? 0.5 : 1
                }}>
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice modal */}
      {showInvoiceModal && invoiceClaim && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '100%', maxWidth: '500px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
              Issue Invoice
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Claim: {invoiceClaim.claimReference} • {invoiceClaim.contractorName}
              <br />Approved: {formatPenceToGBP(invoiceClaim.approvedTotalPence || 0)}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Invoice Number *</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-001" style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Invoice Date *</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowInvoiceModal(false); setInvoiceClaim(null); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontWeight: 600, cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button onClick={handleIssueInvoice} disabled={saving || !invoiceNumber || !invoiceDate}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                  fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1
                }}>
                {saving ? 'Issuing...' : 'Issue Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPaymentModal && paymentInvoice && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '100%', maxWidth: '500px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
              Record Payment
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Invoice: {paymentInvoice.invoiceNumber} • {paymentInvoice.contractorName}
              <br />Outstanding: {formatPenceToGBP(paymentInvoice.outstandingPence)}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Payment Amount (£) *</label>
              <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                step="0.01" min="0.01" style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Payment Date *</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Payment Reference *</label>
              <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                placeholder="e.g. BACS Ref, Cheque No." style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Internal Note</label>
              <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                placeholder="Optional" style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowPaymentModal(false); setPaymentInvoice(null); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                  fontWeight: 600, cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button onClick={handleRecordPayment}
                disabled={saving || !paymentAmount || !paymentDate || !paymentRef}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--brand-gold)', color: '#FFF',
                  fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1
                }}>
                {saving ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================================================= */
/* RATES MANAGEMENT (Owner/Admin only)                        */
/* ========================================================= */

const RatesManagement: React.FC<{ currentUser: UserProfile }> = ({ currentUser }) => {
  const [contractors, setContractors] = useState<UserProfile[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [rates, setRates] = useState<ContractorRateVersion[]>([]);
  const [taxConfig, setTaxConfig] = useState<ContractorTaxConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New rate form
  const [paymentBasis, setPaymentBasis] = useState<'day_rate' | 'hourly_rate'>('day_rate');
  const [dayRate, setDayRate] = useState('');
  const [halfDayRate, setHalfDayRate] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(formatLocalDate(new Date()));
  const [travelMethod, setTravelMethod] = useState<'mileage' | 'fixed_amount' | 'none'>('mileage');
  const [mileageRate, setMileageRate] = useState('0.45');
  const [fixedTravel, setFixedTravel] = useState('');

  // Tax config form
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [cisApplicable, setCisApplicable] = useState(false);
  const [cisRate, setCisRate] = useState('20');

  useEffect(() => {
    // Load individual contractors
    import('firebase/firestore').then(({ getDocs, query, where, collection }) => {
      import('../services/firebase').then(({ db }) => {
        getDocs(query(collection(db, 'users'), where('role', '==', 'IndividualContractor'), where('status', '==', 'approved')))
          .then(snap => {
            setContractors(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
          });
      });
    });
  }, []);

  const loadContractorData = async (uid: string) => {
    setSelectedUid(uid);
    setLoading(true);
    const [rateData, tax] = await Promise.all([
      getContractorRates(uid),
      getContractorTaxConfig(uid)
    ]);
    setRates(rateData);
    setTaxConfig(tax);
    if (tax) {
      setVatRegistered(tax.vatRegistered || false);
      setVatNumber(tax.vatNumber || '');
      setCisApplicable(tax.cisApplicable || false);
      setCisRate(String(tax.cisDeductionRate || 20));
    }
    setLoading(false);
  };

  const handleSaveRate = async () => {
    if (!selectedUid) return;
    setSaving(true);

    const currentRate = rates.length > 0 ? rates[0] : undefined;

    await saveContractorRate({
      contractorUid: selectedUid,
      paymentBasis,
      dayRatePence: paymentBasis === 'day_rate' ? parseGBPToPence(dayRate) : undefined,
      halfDayRatePence: paymentBasis === 'day_rate' && halfDayRate ? parseGBPToPence(halfDayRate) : undefined,
      hourlyRatePence: paymentBasis === 'hourly_rate' ? parseGBPToPence(hourlyRate) : undefined,
      effectiveFrom,
      travelMethod: travelMethod as any,
      mileageRatePence: travelMethod === 'mileage' ? parseGBPToPence(mileageRate) : undefined,
      fixedTravelAmountPence: travelMethod === 'fixed_amount' ? parseGBPToPence(fixedTravel) : undefined,
      claimableExpenseCategories: ['Materials', 'PPE / Safety', 'Parking'],
      createdByUid: currentUser.uid,
      createdByName: currentUser.fullName
    }, currentRate?.id);

    await loadContractorData(selectedUid);
    setSaving(false);
  };

  const handleSaveTaxConfig = async () => {
    if (!selectedUid) return;
    setSaving(true);
    await saveContractorTaxConfig({
      contractorUid: selectedUid,
      vatRegistered,
      vatNumber: vatRegistered ? vatNumber : undefined,
      vatRate: vatRegistered ? 20 : undefined,
      cisApplicable,
      cisDeductionRate: cisApplicable ? parseInt(cisRate) : undefined,
      configuredByUid: currentUser.uid,
      configuredByName: currentUser.fullName,
      configuredAt: new Date().toISOString()
    });
    await loadContractorData(selectedUid);
    setSaving(false);
  };

  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>
        Contractor Rates & Tax
      </h3>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Select Contractor</label>
        <select
          value={selectedUid}
          onChange={e => loadContractorData(e.target.value)}
          style={{
            width: '100%', maxWidth: '400px', padding: '10px 12px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem'
          }}
        >
          <option value="">Choose a contractor...</option>
          {contractors.map(c => (
            <option key={c.uid} value={c.uid}>{c.fullName} ({c.email})</option>
          ))}
        </select>
      </div>

      {loading && <div style={{ padding: '20px', textAlign: 'center' }}><Loader2 size={20} className="spin" /></div>}

      {selectedUid && !loading && (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* Rate form */}
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)', padding: '20px'
          }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', fontFamily: 'var(--font-heading)' }}>
              Payment Rate
            </h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Payment Basis</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['day_rate', 'hourly_rate'] as const).map(b => (
                  <button key={b} onClick={() => setPaymentBasis(b)} style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-full)',
                    border: `1px solid ${paymentBasis === b ? 'var(--brand-navy)' : 'var(--border-color)'}`,
                    background: paymentBasis === b ? 'var(--brand-navy)' : 'var(--bg-surface)',
                    color: paymentBasis === b ? '#FFF' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
                  }}>
                    {b === 'day_rate' ? 'Day Rate' : 'Hourly Rate'}
                  </button>
                ))}
              </div>
            </div>

            {paymentBasis === 'day_rate' && (
              <>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Day Rate (£)</label>
                  <input type="number" value={dayRate} onChange={e => setDayRate(e.target.value)}
                    step="0.01" min="0" style={{
                      width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)', fontSize: '0.85rem'
                    }} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Half Day Rate (£) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                      Suggested: {dayRate ? formatPenceToGBP(Math.round(parseGBPToPence(dayRate) / 2)) : '–'}
                    </span>
                  </label>
                  <input type="number" value={halfDayRate} onChange={e => setHalfDayRate(e.target.value)}
                    step="0.01" min="0" style={{
                      width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)', fontSize: '0.85rem'
                    }} />
                </div>
              </>
            )}

            {paymentBasis === 'hourly_rate' && (
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Hourly Rate (£)</label>
                <input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)}
                  step="0.01" min="0" style={{
                    width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>
            )}

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Effective From</label>
              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }} />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Travel Method</label>
              <select value={travelMethod} onChange={e => setTravelMethod(e.target.value as any)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }}>
                <option value="mileage">Mileage</option>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="none">None</option>
              </select>
            </div>

            {travelMethod === 'mileage' && (
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Mileage Rate (£/mile)</label>
                <input type="number" value={mileageRate} onChange={e => setMileageRate(e.target.value)}
                  step="0.01" style={{
                    width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>
            )}

            {travelMethod === 'fixed_amount' && (
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Fixed Travel Amount (£)</label>
                <input type="number" value={fixedTravel} onChange={e => setFixedTravel(e.target.value)}
                  step="0.01" style={{
                    width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>
            )}

            <button onClick={handleSaveRate} disabled={saving} style={{
              width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--brand-gold)', color: '#FFF',
              fontWeight: 700, cursor: 'pointer', marginTop: '8px'
            }}>
              {saving ? 'Saving...' : 'Save Rate'}
            </button>

            {/* Existing rates */}
            {rates.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>Rate History</div>
                {rates.map(r => (
                  <div key={r.id} style={{
                    padding: '8px 12px', background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)', marginBottom: '4px', fontSize: '0.75rem'
                  }}>
                    <strong>{r.paymentBasis === 'day_rate' ? `Day: ${formatPenceToGBP(r.dayRatePence)}` : `Hourly: ${formatPenceToGBP(r.hourlyRatePence)}`}</strong>
                    {' • '}From {r.effectiveFrom}{r.effectiveTo ? ` to ${r.effectiveTo}` : ' (current)'}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax config */}
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)', padding: '20px'
          }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', fontFamily: 'var(--font-heading)' }}>
              Tax Configuration
            </h4>
            <div style={{
              padding: '10px 12px', background: 'var(--status-warning-bg)',
              borderRadius: 'var(--radius-sm)', marginBottom: '12px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-warning-text)' }}>
                ⚠ Tax settings must be verified by qualified accounts. This is not a compliance engine.
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={vatRegistered} onChange={e => setVatRegistered(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-gold)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>VAT Registered</span>
            </label>

            {vatRegistered && (
              <div style={{ marginBottom: '8px', marginLeft: '24px' }}>
                <input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)}
                  placeholder="VAT Number" style={{
                    width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem'
                  }} />
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={cisApplicable} onChange={e => setCisApplicable(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-gold)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>CIS Applicable</span>
            </label>

            {cisApplicable && (
              <div style={{ marginBottom: '8px', marginLeft: '24px' }}>
                <select value={cisRate} onChange={e => setCisRate(e.target.value)} style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', fontSize: '0.85rem'
                }}>
                  <option value="20">20% (Standard)</option>
                  <option value="30">30% (Higher)</option>
                  <option value="0">0% (Gross Payment)</option>
                </select>
              </div>
            )}

            <button onClick={handleSaveTaxConfig} disabled={saving} style={{
              width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--brand-navy)', color: '#FFF',
              fontWeight: 700, cursor: 'pointer', marginTop: '8px'
            }}>
              {saving ? 'Saving...' : 'Save Tax Config'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
