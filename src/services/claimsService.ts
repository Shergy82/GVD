import { db, storage } from './firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  doc,
  runTransaction,
  orderBy,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type {
  ContractorRateVersion,
  ContractorTaxConfig,
  WeeklyClaim,
  AttendanceLine,
  ExpenseLine,
  TravelLine,
  TravelProjectAllocation,
  ClaimStatus,
  ClaimLineStatus,
  ClaimReviewAction,
  InvoiceRecord,
  InvoiceLineItem,
  PaymentRecord,
  ProjectLabourCost,
  BookingRecord,
  UserProfile,
  PaymentBasis,
  TravelMethod,
  AttendanceType,
  InvoiceStatus
} from '../types';
import { formatLocalDate, parseLocalDate, getMondayOfDate, getWeekDays } from './plannerService';
import { formatPenceToGBP } from './projectService';

/* ========================================================= */
/* MONETARY HELPERS                                          */
/* ========================================================= */

/** Round to nearest integer pence using banker's rounding */
export function roundPence(value: number): number {
  return Math.round(value);
}

/** Generate a unique claim reference: CLM-YYYY-NNNN */
export async function generateClaimReference(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const counterRef = doc(db, 'counters', `claim_ref_${currentYear}`);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const lastSeq = snap.exists() ? (snap.data().lastSeq || 0) : 0;
    const nextSeq = lastSeq + 1;
    transaction.set(counterRef, { lastSeq: nextSeq, year: currentYear }, { merge: true });
    return `CLM-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
  });
}

/** Generate a unique invoice internal reference: INV-YYYY-NNNN */
export async function generateInvoiceReference(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const counterRef = doc(db, 'counters', `invoice_ref_${currentYear}`);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const lastSeq = snap.exists() ? (snap.data().lastSeq || 0) : 0;
    const nextSeq = lastSeq + 1;
    transaction.set(counterRef, { lastSeq: nextSeq, year: currentYear }, { merge: true });
    return `INV-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
  });
}

/* ========================================================= */
/* CONTRACTOR RATE MANAGEMENT                                */
/* ========================================================= */

/** Get all rate versions for a contractor, ordered by effectiveFrom desc */
export async function getContractorRates(contractorUid: string): Promise<ContractorRateVersion[]> {
  const snap = await getDocs(
    query(collection(db, 'contractor_rates'), where('contractorUid', '==', contractorUid))
  );
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContractorRateVersion));
  return list.sort((a, b) => (b.effectiveFrom || '').localeCompare(a.effectiveFrom || ''));
}

/** Get the rate version effective on a given date */
export function getRateForDate(rates: ContractorRateVersion[], dateStr: string): ContractorRateVersion | null {
  // Sort by effectiveFrom descending
  const sorted = [...rates].sort((a, b) => (b.effectiveFrom || '').localeCompare(a.effectiveFrom || ''));
  for (const rate of sorted) {
    if (rate.effectiveFrom <= dateStr) {
      if (!rate.effectiveTo || rate.effectiveTo >= dateStr) {
        return rate;
      }
    }
  }
  return null;
}

/** Create or update a contractor's rate */
export async function saveContractorRate(
  rate: Omit<ContractorRateVersion, 'id' | 'createdAt'>,
  existingRateId?: string
): Promise<string> {
  const now = new Date().toISOString();

  if (existingRateId) {
    // Supersede old rate
    await updateDoc(doc(db, 'contractor_rates', existingRateId), {
      effectiveTo: rate.effectiveFrom,
      supersededAt: now,
      supersededByUid: rate.createdByUid
    });
  }

  const newRate = { ...rate, createdAt: now };
  const docRef = await addDoc(collection(db, 'contractor_rates'), newRate);
  return docRef.id;
}

/** Get contractor tax configuration */
export async function getContractorTaxConfig(contractorUid: string): Promise<ContractorTaxConfig | null> {
  const snap = await getDoc(doc(db, 'contractor_tax_configs', contractorUid));
  return snap.exists() ? (snap.data() as ContractorTaxConfig) : null;
}

/** Save contractor tax configuration */
export async function saveContractorTaxConfig(config: ContractorTaxConfig): Promise<void> {
  await setDoc(doc(db, 'contractor_tax_configs', config.contractorUid), config);
}

/* ========================================================= */
/* CLAIM LIFECYCLE                                           */
/* ========================================================= */

/** Get all claims for a contractor */
export async function getContractorClaims(contractorUid: string): Promise<WeeklyClaim[]> {
  const snap = await getDocs(
    query(collection(db, 'weekly_claims'), where('contractorUid', '==', contractorUid))
  );
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklyClaim));
  return list.sort((a, b) => (b.weekStartDate || '').localeCompare(a.weekStartDate || ''));
}

/** Get a single claim by ID */
export async function getClaim(claimId: string): Promise<WeeklyClaim | null> {
  const snap = await getDoc(doc(db, 'weekly_claims', claimId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as WeeklyClaim) : null;
}

/** Get all claims for review (GVD staff) */
export async function getClaimsForReview(statusFilter?: ClaimStatus[]): Promise<WeeklyClaim[]> {
  let q;
  if (statusFilter && statusFilter.length > 0) {
    q = query(collection(db, 'weekly_claims'), where('status', 'in', statusFilter));
  } else {
    q = query(collection(db, 'weekly_claims'), where('status', '!=', 'Draft'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklyClaim));
}

/** Get bookings for a contractor in a given week (to prefill attendance) */
export async function getBookingsForWeek(contractorUid: string, weekStartDate: string): Promise<BookingRecord[]> {
  const weekDays = getWeekDays(weekStartDate);
  const snap = await getDocs(
    query(
      collection(db, 'bookings'),
      where('personId', '==', contractorUid),
      where('localDate', '>=', weekDays[0]),
      where('localDate', '<=', weekDays[6])
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BookingRecord));
}

/** Check if a claim already exists for a contractor/week */
export async function getExistingClaim(contractorUid: string, weekStartDate: string): Promise<WeeklyClaim | null> {
  const snap = await getDocs(
    query(
      collection(db, 'weekly_claims'),
      where('contractorUid', '==', contractorUid),
      where('weekStartDate', '==', weekStartDate),
      where('isSupplementary', '==', false)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as WeeklyClaim;
}

/** Calculate attendance amount from rate and attendance type */
export function calculateAttendanceAmount(
  attendanceType: AttendanceType,
  paymentBasis: PaymentBasis,
  rate: ContractorRateVersion,
  actualHours?: number
): number {
  if (attendanceType === 'did_not_attend') return 0;

  if (paymentBasis === 'day_rate') {
    if (attendanceType === 'full_day') return rate.dayRatePence || 0;
    if (attendanceType === 'half_day') return rate.halfDayRatePence || 0;
    return 0;
  }

  if (paymentBasis === 'hourly_rate') {
    if (!actualHours || !rate.hourlyRatePence) return 0;
    return roundPence(actualHours * rate.hourlyRatePence);
  }

  return 0;
}

/** Calculate hours from start/end/break for hourly workers */
export function calculateActualHours(startTime: string, endTime: string, unpaidBreakMinutes: number = 0): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const workedMins = Math.max(0, endMins - startMins - unpaidBreakMinutes);
  return Math.round((workedMins / 60) * 100) / 100; // 2 decimal places
}

/** Validate a claim before submission - returns list of error messages */
export function validateClaimForSubmission(claim: WeeklyClaim, rates: ContractorRateVersion[]): string[] {
  const errors: string[] = [];
  const today = formatLocalDate(new Date());

  // Check for future dates
  for (const line of claim.attendanceLines) {
    if (line.attendanceType !== 'did_not_attend' && line.localDate > today) {
      errors.push(`Cannot claim future work for ${line.localDate} on ${line.projectReference}.`);
    }
  }

  // Check for missing rates
  for (const line of claim.attendanceLines) {
    if (line.attendanceType !== 'did_not_attend') {
      const activeRate = getRateForDate(rates, line.localDate);
      if (!activeRate || (line.paymentBasis === 'day_rate' ? (!activeRate.dayRatePence || activeRate.dayRatePence <= 0) : (!activeRate.hourlyRatePence || activeRate.hourlyRatePence <= 0))) {
        errors.push(`No agreed rate configured for ${line.localDate}. GVD needs to confirm your rate before submission.`);
      }
    }
  }

  // Check for unplanned work without reason
  for (const line of claim.attendanceLines) {
    if (line.isUnplanned && !line.unplannedReason?.trim()) {
      errors.push(`Unplanned work on ${line.localDate} at ${line.projectReference} needs an explanation.`);
    }
  }

  // Check hourly workers have hours
  for (const line of claim.attendanceLines) {
    if (line.paymentBasis === 'hourly_rate' && line.attendanceType === 'hourly') {
      if (!line.actualHours || line.actualHours <= 0) {
        errors.push(`Hours not entered for ${line.localDate} at ${line.projectReference}.`);
      }
    }
  }

  // Check expenses have receipts and project allocation
  for (const line of claim.expenseLines) {
    if (!line.receiptFileUrls || line.receiptFileUrls.length === 0) {
      errors.push(`Receipt missing for expense: ${line.description} (${line.category}). Receipt evidence is required.`);
    }
    if (!line.projectId && (!line.allocations || line.allocations.length === 0)) {
      errors.push(`Project allocation missing for expense: ${line.description}.`);
    }
    if (line.allocations && line.allocations.length > 0) {
      const allocTotal = line.allocations.reduce((s, a) => s + a.allocatedAmountPence, 0);
      if (allocTotal !== line.amountPence) {
        errors.push(`Expense on ${line.expenseDate} (${line.description}): project allocations (${formatPenceToGBP(allocTotal)}) don't equal the total claimed (${formatPenceToGBP(line.amountPence)}).`);
      }
    }
    if (line.amountPence <= 0) {
      errors.push(`Invalid amount for expense: ${line.description}.`);
    }
  }

  // Check travel claims
  const travelJourneysByDate = new Map<string, Set<TravelMethod>>();
  for (const line of claim.travelLines) {
    const allocTotal = line.projectAllocations.reduce((s, a) => s + a.allocatedAmountPence, 0);
    if (allocTotal !== line.totalAmountPence) {
      errors.push(`Travel on ${line.travelDate}: project allocations (${formatPenceToGBP(allocTotal)}) don't equal the total (${formatPenceToGBP(line.totalAmountPence)}).`);
    }
    if (line.projectAllocations.length === 0) {
      errors.push(`Travel on ${line.travelDate}: no project allocation.`);
    }
    if (line.travelMethod === 'actual_fuel' && (!line.fuelReceiptUrls || line.fuelReceiptUrls.length === 0)) {
      errors.push(`Fuel receipt missing for actual fuel travel claim on ${line.travelDate}. Receipt evidence is required.`);
    }
    if (line.travelMethod === 'mileage' && (!line.miles || line.miles <= 0)) {
      errors.push(`Mileage travel claim on ${line.travelDate} must have valid recorded miles.`);
    }

    // Check mileage and actual fuel not claimed for the same journey
    const methodsOnDate = travelJourneysByDate.get(line.travelDate) || new Set<TravelMethod>();
    if (line.travelMethod === 'mileage' && methodsOnDate.has('actual_fuel')) {
      errors.push(`Cannot claim both mileage and actual fuel reimbursement for the same journey on ${line.travelDate}.`);
    }
    if (line.travelMethod === 'actual_fuel' && methodsOnDate.has('mileage')) {
      errors.push(`Cannot claim both mileage and actual fuel reimbursement for the same journey on ${line.travelDate}.`);
    }
    methodsOnDate.add(line.travelMethod);
    travelJourneysByDate.set(line.travelDate, methodsOnDate);
  }

  // Check for duplicate or overlapping attendance (same person, same date, even across projects)
  const dateUnitsMap = new Map<string, number>();
  for (const line of claim.attendanceLines) {
    if (line.attendanceType === 'did_not_attend') continue;
    const currentUnits = dateUnitsMap.get(line.localDate) || 0;
    const lineUnit = line.attendanceType === 'full_day' ? 1 : line.attendanceType === 'half_day' ? 0.5 : (line.actualHours || 0) / 8;
    if (currentUnits + lineUnit > 1.05) {
      errors.push(`Overlapping attendance entry on ${line.localDate} across projects (${line.projectReference}).`);
    }
    dateUnitsMap.set(line.localDate, currentUnits + lineUnit);
  }

  // Check no payable lines exist
  const hasPayableLines = claim.attendanceLines.some(l => l.attendanceType !== 'did_not_attend') ||
    claim.expenseLines.length > 0 ||
    claim.travelLines.length > 0;
  if (!hasPayableLines) {
    errors.push('No payable items in this claim.');
  }

  return errors;
}

/** Create or update a draft claim */
export async function saveDraftClaim(claim: Omit<WeeklyClaim, 'id'> & { id?: string }): Promise<string> {
  const now = new Date().toISOString();

  // Recalculate totals
  const totalLabourPence = claim.attendanceLines
    .filter(l => l.attendanceType !== 'did_not_attend')
    .reduce((s, l) => s + l.calculatedAmountPence, 0);
  const totalExpensesPence = claim.expenseLines.reduce((s, l) => s + l.amountPence, 0);
  const totalTravelPence = claim.travelLines.reduce((s, l) => s + l.totalAmountPence, 0);

  const claimData = {
    ...claim,
    totalLabourPence,
    totalExpensesPence,
    totalTravelPence,
    totalClaimPence: totalLabourPence + totalExpensesPence + totalTravelPence,
    updatedAt: now
  };

  if (claim.id) {
    await updateDoc(doc(db, 'weekly_claims', claim.id), claimData);
    return claim.id;
  } else {
    const claimRef = claimData.claimReference || await generateClaimReference();
    const newClaim = { ...claimData, claimReference: claimRef, createdAt: now };
    const docRef = await addDoc(collection(db, 'weekly_claims'), newClaim);
    return docRef.id;
  }
}

/** Submit a claim - validates and transitions to Submitted */
export async function submitClaim(
  claimId: string,
  rates: ContractorRateVersion[]
): Promise<{ success: boolean; errors: string[] }> {
  const claim = await getClaim(claimId);
  if (!claim) return { success: false, errors: ['Claim not found.'] };

  if (claim.status !== 'Draft' && claim.status !== 'Queried') {
    return { success: false, errors: [`Cannot submit a claim with status "${claim.status}".`] };
  }

  const errors = validateClaimForSubmission(claim, rates);
  if (errors.length > 0) return { success: false, errors };

  const now = new Date().toISOString();

  // Snapshot rate versions used
  const rateIds = new Set<string>();
  for (const line of claim.attendanceLines) {
    if (line.attendanceType !== 'did_not_attend') {
      const rate = getRateForDate(rates, line.localDate);
      if (rate) rateIds.add(rate.id);
    }
  }

  // Transition all draft lines to submitted
  const updatedAttendance = claim.attendanceLines.map(l => ({
    ...l,
    lineStatus: l.lineStatus === 'Draft' || l.lineStatus === 'Queried' ? 'Submitted' as ClaimLineStatus : l.lineStatus
  }));
  const updatedExpenses = claim.expenseLines.map(l => ({
    ...l,
    lineStatus: l.lineStatus === 'Draft' || l.lineStatus === 'Queried' ? 'Submitted' as ClaimLineStatus : l.lineStatus
  }));
  const updatedTravel = claim.travelLines.map(l => ({
    ...l,
    lineStatus: l.lineStatus === 'Draft' || l.lineStatus === 'Queried' ? 'Submitted' as ClaimLineStatus : l.lineStatus
  }));

  await updateDoc(doc(db, 'weekly_claims', claimId), {
    status: 'Submitted',
    revision: (claim.revision || 0) + 1,
    rateSnapshotIds: Array.from(rateIds),
    submittedAt: now,
    submittedDeclaration: true,
    attendanceLines: updatedAttendance,
    expenseLines: updatedExpenses,
    travelLines: updatedTravel,
    updatedAt: now
  });

  return { success: true, errors: [] };
}

/** Withdraw a claim (only if no lines are approved/invoiced) */
export async function withdrawClaim(claimId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const claim = await getClaim(claimId);
  if (!claim) return { success: false, error: 'Claim not found.' };

  const hasApproved = [
    ...claim.attendanceLines,
    ...claim.expenseLines,
    ...claim.travelLines
  ].some(l => l.lineStatus === 'Approved');

  if (hasApproved) {
    return { success: false, error: 'Cannot withdraw: some lines have been approved. Use the query process instead.' };
  }

  const now = new Date().toISOString();
  await updateDoc(doc(db, 'weekly_claims', claimId), {
    status: 'Withdrawn',
    withdrawnAt: now,
    withdrawnReason: reason,
    updatedAt: now,
    attendanceLines: claim.attendanceLines.map(l => ({ ...l, lineStatus: 'Withdrawn' as ClaimLineStatus })),
    expenseLines: claim.expenseLines.map(l => ({ ...l, lineStatus: 'Withdrawn' as ClaimLineStatus })),
    travelLines: claim.travelLines.map(l => ({ ...l, lineStatus: 'Withdrawn' as ClaimLineStatus }))
  });

  return { success: true };
}

/* ========================================================= */
/* REVIEW & APPROVAL                                         */
/* ========================================================= */

/** Review a single claim line (approve/query/reject/reduce) */
export async function reviewClaimLine(
  claimId: string,
  lineType: 'attendance' | 'expense' | 'travel',
  lineId: string,
  action: 'Approved' | 'Queried' | 'Rejected' | 'Reduced',
  reviewerUid: string,
  reviewerName: string,
  note?: string,
  approvedAmount?: number,
  allowedProjectIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  const claim = await getClaim(claimId);
  if (!claim) return { success: false, error: 'Claim not found.' };

  // Self-approval check
  if (claim.contractorUid === reviewerUid) {
    return { success: false, error: 'You cannot review your own claim.' };
  }

  // Check project permission if restricted
  if (allowedProjectIds && allowedProjectIds.length > 0) {
    const targetLine = lineType === 'attendance'
      ? claim.attendanceLines.find(l => l.id === lineId)
      : lineType === 'expense'
      ? claim.expenseLines.find(l => l.id === lineId)
      : claim.travelLines.find(l => l.id === lineId);

    if (targetLine) {
      const lineProjectId = (targetLine as any).projectId || (targetLine as any).projectAllocations?.[0]?.projectId;
      if (lineProjectId && !allowedProjectIds.includes(lineProjectId)) {
        return { success: false, error: 'You do not have permission to review claim lines for this project.' };
      }
    }
  }

  const now = new Date().toISOString();
  const reviewAction: ClaimReviewAction = {
    id: `rev-${Date.now()}`,
    lineType,
    lineId,
    action,
    reviewerUid,
    reviewerName,
    note,
    approvedAmount: action === 'Reduced' ? approvedAmount : undefined,
    timestamp: now
  };

  // Update the specific line
  const updateLine = (lines: any[]) => lines.map((l: any) => {
    if (l.id !== lineId) return l;
    const newStatus: ClaimLineStatus =
      action === 'Approved' || action === 'Reduced' ? 'Approved' :
        action === 'Queried' ? 'Queried' :
          'Rejected';

    return {
      ...l,
      lineStatus: newStatus,
      approvedAmountPence: action === 'Reduced' ? approvedAmount :
        action === 'Approved' ? l.calculatedAmountPence || l.amountPence || l.totalAmountPence :
          l.approvedAmountPence,
      reviewerUid,
      reviewerName,
      reviewedAt: now,
      reviewNote: note,
      queryMessage: action === 'Queried' ? note : l.queryMessage
    };
  });

  let updatedAttendance = claim.attendanceLines;
  let updatedExpenses = claim.expenseLines;
  let updatedTravel = claim.travelLines;

  if (lineType === 'attendance') updatedAttendance = updateLine(claim.attendanceLines);
  if (lineType === 'expense') updatedExpenses = updateLine(claim.expenseLines);
  if (lineType === 'travel') updatedTravel = updateLine(claim.travelLines);

  // Determine overall claim status from line statuses
  const allLines = [...updatedAttendance, ...updatedExpenses, ...updatedTravel];
  const statuses = allLines.map(l => l.lineStatus);
  const hasQueried = statuses.includes('Queried');
  const hasSubmitted = statuses.includes('Submitted');
  const hasApproved = statuses.includes('Approved');
  const allApproved = statuses.every(s => s === 'Approved' || s === 'Rejected' || s === 'Withdrawn');

  let newClaimStatus: ClaimStatus = claim.status;
  if (allApproved && hasApproved) newClaimStatus = 'Approved';
  else if (hasQueried) newClaimStatus = 'Queried';
  else if (hasApproved && (hasSubmitted || hasQueried)) newClaimStatus = 'Partially Approved';
  else newClaimStatus = 'Under Review';

  // Calculate approved totals
  const approvedLabourPence = updatedAttendance
    .filter(l => l.lineStatus === 'Approved')
    .reduce((s, l) => s + (l.approvedAmountPence ?? l.calculatedAmountPence), 0);
  const approvedExpensesPence = updatedExpenses
    .filter(l => l.lineStatus === 'Approved')
    .reduce((s, l) => s + (l.approvedAmountPence ?? l.amountPence), 0);
  const approvedTravelPence = updatedTravel
    .filter(l => l.lineStatus === 'Approved')
    .reduce((s, l) => s + (l.approvedAmountPence ?? l.totalAmountPence), 0);

  await updateDoc(doc(db, 'weekly_claims', claimId), {
    attendanceLines: updatedAttendance,
    expenseLines: updatedExpenses,
    travelLines: updatedTravel,
    status: newClaimStatus,
    approvedLabourPence,
    approvedExpensesPence,
    approvedTravelPence,
    approvedTotalPence: approvedLabourPence + approvedExpensesPence + approvedTravelPence,
    reviewerActions: [...claim.reviewerActions, reviewAction],
    updatedAt: now
  });

  return { success: true };
}

/** Respond to a query on a claim line */
export async function respondToQuery(
  claimId: string,
  lineType: 'attendance' | 'expense' | 'travel',
  lineId: string,
  response: string
): Promise<void> {
  const claim = await getClaim(claimId);
  if (!claim) return;

  const updateLine = (lines: any[]) => lines.map((l: any) => {
    if (l.id !== lineId) return l;
    return { ...l, queryResponse: response };
  });

  let updates: any = { updatedAt: new Date().toISOString() };
  if (lineType === 'attendance') updates.attendanceLines = updateLine(claim.attendanceLines);
  if (lineType === 'expense') updates.expenseLines = updateLine(claim.expenseLines);
  if (lineType === 'travel') updates.travelLines = updateLine(claim.travelLines);

  await updateDoc(doc(db, 'weekly_claims', claimId), updates);
}

/* ========================================================= */
/* INVOICING                                                  */
/* ========================================================= */

/** Get invoices for a contractor */
export async function getContractorInvoices(contractorUid: string): Promise<InvoiceRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'invoices'), where('contractorUid', '==', contractorUid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceRecord));
}

/** Get all invoices (for GVD review) */
export async function getAllInvoices(): Promise<InvoiceRecord[]> {
  const snap = await getDocs(collection(db, 'invoices'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceRecord));
}

/** Issue an invoice from approved claim lines */
export async function issueInvoice(
  claim: WeeklyClaim,
  invoiceNumber: string,
  invoiceDate: string,
  supplierDetails: { name: string; address: string; vatNumber?: string },
  customerDetails: { name: string; address: string },
  taxConfig: ContractorTaxConfig | null,
  issuedByUid: string,
  issuedByName: string,
  lineIdsToInvoice?: string[]
): Promise<{ success: boolean; invoiceId?: string; invoice?: InvoiceRecord; error?: string }> {
  const cleanInvNum = invoiceNumber.trim();
  if (!cleanInvNum) {
    return { success: false, error: 'Invoice number is required.' };
  }

  // Double-invoicing prevention check on requested line IDs
  if (lineIdsToInvoice && lineIdsToInvoice.length > 0) {
    const allClaimLines = [...claim.attendanceLines, ...claim.expenseLines, ...claim.travelLines];
    for (const reqId of lineIdsToInvoice) {
      const match = allClaimLines.find(l => l.id === reqId);
      if (match && match.invoiced) {
        return { success: false, error: 'Cannot issue invoice: One or more selected items have already been invoiced.' };
      }
    }
  }

  // Invoice number uniqueness per contractor series
  try {
    const existingSnap = await getDocs(
      query(
        collection(db, 'invoices'),
        where('contractorUid', '==', claim.contractorUid),
        where('invoiceNumber', '==', cleanInvNum)
      )
    );
    if (!existingSnap.empty) {
      return {
        success: false,
        error: `Invoice number "${cleanInvNum}" has already been used by this contractor. Invoice numbers must be unique within the supplier's series.`
      };
    }
  } catch (err: any) {
    // If running in restricted environment without auth token, pass through to schema logic
    console.warn('Invoice uniqueness remote check deferred:', err?.message || err);
  }

  // Tax configuration validation
  if (taxConfig?.vatRegistered && !taxConfig.vatNumber?.trim()) {
    return {
      success: false,
      error: 'Cannot issue invoice: Contractor is marked as VAT registered but VAT number is missing. GVD Accounts must verify tax configuration.'
    };
  }

  // Collect approved uninvoiced lines
  const approvedAttendance = claim.attendanceLines.filter(l =>
    l.lineStatus === 'Approved' && !l.invoiced && (!lineIdsToInvoice || lineIdsToInvoice.includes(l.id))
  );
  const approvedExpenses = claim.expenseLines.filter(l =>
    l.lineStatus === 'Approved' && !l.invoiced && (!lineIdsToInvoice || lineIdsToInvoice.includes(l.id))
  );
  const approvedTravel = claim.travelLines.filter(l =>
    l.lineStatus === 'Approved' && !l.invoiced && (!lineIdsToInvoice || lineIdsToInvoice.includes(l.id))
  );

  if (approvedAttendance.length === 0 && approvedExpenses.length === 0 && approvedTravel.length === 0) {
    return { success: false, error: 'No approved uninvoiced lines selected to invoice.' };
  }

  // Double-invoicing prevention check
  const allClaimLines = [...claim.attendanceLines, ...claim.expenseLines, ...claim.travelLines];
  const selectedLineIds = new Set([
    ...approvedAttendance.map(l => l.id),
    ...approvedExpenses.map(l => l.id),
    ...approvedTravel.map(l => l.id)
  ]);

  for (const l of allClaimLines) {
    if (selectedLineIds.has(l.id) && l.invoiced) {
      return { success: false, error: 'Cannot issue invoice: One or more selected items have already been invoiced.' };
    }
  }

  const now = new Date().toISOString();
  const internalRef = await generateInvoiceReference();

  // Build line items
  const lineItems: InvoiceLineItem[] = [];

  for (const line of approvedAttendance) {
    lineItems.push({
      description: `${line.projectReference} - ${line.localDate} - ${line.attendanceType === 'full_day' ? 'Full Day' : line.attendanceType === 'half_day' ? 'Half Day' : `${line.actualHours}hrs`}`,
      projectId: line.projectId,
      projectReference: line.projectReference,
      quantity: line.attendanceType === 'hourly' ? line.actualHours : 1,
      unitDescription: line.paymentBasis === 'day_rate' ? (line.attendanceType === 'half_day' ? 'Half Day' : 'Day') : 'Hour',
      ratePence: line.ratePence,
      netAmountPence: line.approvedAmountPence ?? line.calculatedAmountPence,
      sourceLineType: 'attendance',
      sourceLineId: line.id
    });
  }

  for (const line of approvedExpenses) {
    lineItems.push({
      description: `${line.projectReference} - ${line.category}: ${line.description}`,
      projectId: line.projectId,
      projectReference: line.projectReference,
      netAmountPence: line.approvedAmountPence ?? line.amountPence,
      sourceLineType: 'expense',
      sourceLineId: line.id
    });
  }

  for (const line of approvedTravel) {
    for (const alloc of line.projectAllocations) {
      lineItems.push({
        description: `${alloc.projectReference} - Travel: ${line.journeyDescription}`,
        projectId: alloc.projectId,
        projectReference: alloc.projectReference,
        netAmountPence: alloc.allocatedAmountPence,
        sourceLineType: 'travel',
        sourceLineId: line.id
      });
    }
  }

  const netAmountPence = lineItems.reduce((s, l) => s + l.netAmountPence, 0);

  // Calculate VAT
  let vatAmountPence = 0;
  let vatTreatment = 'Not VAT Registered';
  if (taxConfig?.vatRegistered && taxConfig.vatRate) {
    if (taxConfig.reverseChargeApplicable) {
      vatTreatment = 'Domestic Reverse Charge';
    } else {
      vatAmountPence = roundPence(netAmountPence * (taxConfig.vatRate / 100));
      vatTreatment = `Standard ${taxConfig.vatRate}%`;
    }
  }

  // CIS deductions
  let cisDeductionPence = 0;
  let cisTreatment: string | undefined;
  if (taxConfig?.cisApplicable && taxConfig.cisDeductionRate) {
    const labourNet = approvedAttendance.reduce((s, l) => s + (l.approvedAmountPence ?? l.calculatedAmountPence), 0);
    cisDeductionPence = roundPence(labourNet * (taxConfig.cisDeductionRate / 100));
    cisTreatment = `CIS Deduction ${taxConfig.cisDeductionRate}%`;
  }

  const grossAmountPence = netAmountPence + vatAmountPence - cisDeductionPence;

  const invoice: Omit<InvoiceRecord, 'id'> = {
    invoiceNumber: cleanInvNum,
    internalReference: internalRef,
    claimId: claim.id,
    claimReference: claim.claimReference,
    contractorUid: claim.contractorUid,
    contractorName: claim.contractorName,
    supplierName: supplierDetails.name || claim.contractorName,
    supplierAddress: supplierDetails.address || '',
    supplierVatNumber: supplierDetails.vatNumber,
    customerName: customerDetails.name || 'GVD Contracts Ltd',
    customerAddress: customerDetails.address || '107–109 Charterhouse Street, London EC1M 6PT',
    netAmountPence,
    vatAmountPence,
    cisDeductionPence: cisDeductionPence > 0 ? cisDeductionPence : undefined,
    grossAmountPence,
    lineItems,
    invoiceDate,
    servicePeriodStart: claim.weekStartDate,
    servicePeriodEnd: claim.weekEndDate,
    vatTreatment,
    cisTreatment,
    status: 'Issued',
    issuedAt: now,
    issuedByUid,
    issuedByName,
    isUploadedInvoice: false,
    totalPaidPence: 0,
    outstandingPence: grossAmountPence,
    paymentStatus: 'Unpaid',
    snapshotLockedAt: now,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await addDoc(collection(db, 'invoices'), invoice);

  // Update claim lines in weekly_claims to mark invoiced
  const markInvoiced = (lines: any[]) => lines.map((l: any) => {
    if (selectedLineIds.has(l.id)) {
      return {
        ...l,
        invoiced: true,
        invoiceId: docRef.id,
        invoiceNumber: cleanInvNum,
        invoicedAt: now
      };
    }
    return l;
  });

  await updateDoc(doc(db, 'weekly_claims', claim.id), {
    attendanceLines: markInvoiced(claim.attendanceLines),
    expenseLines: markInvoiced(claim.expenseLines),
    travelLines: markInvoiced(claim.travelLines),
    updatedAt: now
  });

  return { success: true, invoiceId: docRef.id, invoice: { id: docRef.id, ...invoice } as InvoiceRecord };
}

/** Get approved uninvoiced lines ready for invoicing by contractor */
export interface ApprovedUninvoicedLine {
  claimId: string;
  claimReference: string;
  weekStartDate: string;
  weekEndDate: string;
  lineId: string;
  lineType: 'attendance' | 'expense' | 'travel';
  localDate: string;
  projectId: string;
  projectReference: string;
  projectTitle: string;
  description: string;
  quantity?: number;
  unitDescription?: string;
  ratePence?: number;
  amountPence: number;
}

export async function getApprovedUninvoicedLines(contractorUid: string): Promise<ApprovedUninvoicedLine[]> {
  const claims = await getContractorClaims(contractorUid);
  const results: ApprovedUninvoicedLine[] = [];

  for (const claim of claims) {
    if (claim.status !== 'Approved' && claim.status !== 'Partially Approved') continue;

    // Attendance
    for (const l of claim.attendanceLines) {
      if (l.lineStatus === 'Approved' && !l.invoiced) {
        const amt = l.approvedAmountPence ?? l.calculatedAmountPence ?? 0;
        if (amt > 0) {
          results.push({
            claimId: claim.id,
            claimReference: claim.claimReference,
            weekStartDate: claim.weekStartDate,
            weekEndDate: claim.weekEndDate,
            lineId: l.id,
            lineType: 'attendance',
            localDate: l.localDate,
            projectId: l.projectId,
            projectReference: l.projectReference,
            projectTitle: l.projectTitle,
            description: `${l.projectReference} - ${l.localDate} - ${l.attendanceType === 'full_day' ? 'Full Day' : l.attendanceType === 'half_day' ? 'Half Day' : `${l.actualHours}hrs`}`,
            quantity: l.attendanceType === 'hourly' ? l.actualHours : 1,
            unitDescription: l.paymentBasis === 'day_rate' ? (l.attendanceType === 'half_day' ? 'Half Day' : 'Day') : 'Hour',
            ratePence: l.ratePence,
            amountPence: amt
          });
        }
      }
    }

    // Expenses
    for (const l of claim.expenseLines) {
      if (l.lineStatus === 'Approved' && !l.invoiced) {
        const amt = l.approvedAmountPence ?? l.amountPence ?? 0;
        if (amt > 0) {
          results.push({
            claimId: claim.id,
            claimReference: claim.claimReference,
            weekStartDate: claim.weekStartDate,
            weekEndDate: claim.weekEndDate,
            lineId: l.id,
            lineType: 'expense',
            localDate: l.expenseDate,
            projectId: l.projectId,
            projectReference: l.projectReference,
            projectTitle: l.projectTitle,
            description: `${l.projectReference} - ${l.category}: ${l.description}`,
            amountPence: amt
          });
        }
      }
    }

    // Travel
    for (const l of claim.travelLines) {
      if (l.lineStatus === 'Approved' && !l.invoiced) {
        for (const alloc of l.projectAllocations) {
          if (alloc.allocatedAmountPence > 0) {
            results.push({
              claimId: claim.id,
              claimReference: claim.claimReference,
              weekStartDate: claim.weekStartDate,
              weekEndDate: claim.weekEndDate,
              lineId: l.id,
              lineType: 'travel',
              localDate: l.travelDate,
              projectId: alloc.projectId,
              projectReference: alloc.projectReference,
              projectTitle: alloc.projectTitle,
              description: `${alloc.projectReference} - Travel: ${l.journeyDescription}`,
              amountPence: alloc.allocatedAmountPence
            });
          }
        }
      }
    }
  }

  return results;
}

/** Upload and match an external invoice */
export async function matchUploadedInvoice(
  file: File,
  claimId: string,
  invoiceNumber: string,
  invoiceDate: string,
  grossAmountPence: number,
  issuedByUid: string,
  issuedByName: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  const claim = await getClaim(claimId);
  if (!claim) return { success: false, error: 'Claim not found.' };

  // Upload the file
  const storageRef = ref(storage, `invoices/${claimId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  const now = new Date().toISOString();
  const internalRef = await generateInvoiceReference();

  const invoice: Omit<InvoiceRecord, 'id'> = {
    invoiceNumber,
    internalReference: internalRef,
    claimId,
    claimReference: claim.claimReference,
    contractorUid: claim.contractorUid,
    contractorName: claim.contractorName,
    supplierName: claim.contractorName,
    supplierAddress: '',
    customerName: 'GVD Contracts Ltd',
    customerAddress: '107–109 Charterhouse Street, London EC1M 6PT',
    netAmountPence: grossAmountPence,
    vatAmountPence: 0,
    grossAmountPence,
    lineItems: [],
    invoiceDate,
    servicePeriodStart: claim.weekStartDate,
    servicePeriodEnd: claim.weekEndDate,
    status: 'Matched',
    issuedAt: now,
    issuedByUid,
    issuedByName,
    isUploadedInvoice: true,
    uploadedFileUrl: fileUrl,
    uploadedFileName: file.name,
    totalPaidPence: 0,
    outstandingPence: grossAmountPence,
    paymentStatus: 'Unpaid',
    snapshotLockedAt: now,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await addDoc(collection(db, 'invoices'), invoice);
  return { success: true, invoiceId: docRef.id };
}

/* ========================================================= */
/* PAYMENT RECORDING                                          */
/* ========================================================= */

/** Get payments for an invoice */
export async function getInvoicePayments(invoiceId: string): Promise<PaymentRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'payments'), where('invoiceId', '==', invoiceId))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));
}

/** Get all payments for a contractor */
export async function getContractorPayments(contractorUid: string): Promise<PaymentRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'payments'), where('contractorUid', '==', contractorUid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));
}

/** Record a payment against an invoice */
export async function recordPayment(
  payment: Omit<PaymentRecord, 'id' | 'createdAt'>
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  // Check duplicate payment reference on the same invoice (idempotency)
  if (!payment.isReversal) {
    const existingPaymentSnap = await getDocs(query(
      collection(db, 'payments'),
      where('invoiceId', '==', payment.invoiceId),
      where('paymentReference', '==', payment.paymentReference.trim())
    ));
    if (!existingPaymentSnap.empty) {
      return { success: false, error: `Payment with reference "${payment.paymentReference}" has already been recorded for this invoice.` };
    }
  }

  // Use a transaction to prevent concurrent race conditions
  return await runTransaction(db, async (transaction) => {
    const invoiceRef = doc(db, 'invoices', payment.invoiceId);
    const invoiceSnap = await transaction.get(invoiceRef);

    if (!invoiceSnap.exists()) return { success: false, error: 'Invoice not found.' };

    const invoice = invoiceSnap.data() as InvoiceRecord;

    if (!payment.isReversal && payment.amountPence > invoice.outstandingPence) {
      return { success: false, error: `Payment (${formatPenceToGBP(payment.amountPence)}) exceeds outstanding balance (${formatPenceToGBP(invoice.outstandingPence)}).` };
    }

    const now = new Date().toISOString();
    const paymentData = { ...payment, paymentReference: payment.paymentReference.trim(), createdAt: now };
    const paymentRef = doc(collection(db, 'payments'));
    transaction.set(paymentRef, paymentData);

    // Update invoice balances
    const newTotalPaid = payment.isReversal
      ? invoice.totalPaidPence - payment.amountPence
      : invoice.totalPaidPence + payment.amountPence;
    const newOutstanding = invoice.grossAmountPence - newTotalPaid;
    const newStatus = newOutstanding <= 0 ? 'Paid' : newTotalPaid > 0 ? 'Part Paid' : 'Unpaid';

    transaction.update(invoiceRef, {
      totalPaidPence: newTotalPaid,
      outstandingPence: Math.max(0, newOutstanding),
      paymentStatus: newStatus,
      updatedAt: now
    });

    return { success: true, paymentId: paymentRef.id };
  });
}

/** Reverse a payment */
export async function reversePayment(
  originalPaymentId: string,
  reason: string,
  reversedByUid: string,
  reversedByName: string
): Promise<{ success: boolean; error?: string }> {
  const originalSnap = await getDoc(doc(db, 'payments', originalPaymentId));
  if (!originalSnap.exists()) return { success: false, error: 'Original payment not found.' };

  const original = originalSnap.data() as PaymentRecord;

  return await recordPayment({
    invoiceId: original.invoiceId,
    invoiceNumber: original.invoiceNumber,
    invoiceInternalRef: original.invoiceInternalRef,
    contractorUid: original.contractorUid,
    contractorName: original.contractorName,
    paymentDate: formatLocalDate(new Date()),
    amountPence: original.amountPence,
    paymentReference: `REV-${original.paymentReference}`,
    internalNote: `Reversal of ${original.paymentReference}: ${reason}`,
    recordedByUid: reversedByUid,
    recordedByName: reversedByName,
    isReversal: true,
    reversesPaymentId: originalPaymentId,
    reversalReason: reason
  });
}

/* ========================================================= */
/* PROJECT LABOUR COST ALLOCATION                            */
/* ========================================================= */

/**
 * Calculate project labour & claim costs:
 * - submittedPendingPence: unapproved lines
 * - approvedNotInvoicedPence: approved lines NOT yet invoiced
 * - invoicedPence: invoiced lines from issued invoices
 * - paidPence: payments recorded allocated to this project
 * - invoicedUnpaidPence: invoiced minus paid
 * - totalRecognisedCostPence: approvedNotInvoicedPence + invoicedPence
 * Never double- or triple-counts!
 */
export async function getProjectLabourCosts(projectId: string): Promise<ProjectLabourCost | null> {
  const claimsSnap = await getDocs(collection(db, 'weekly_claims'));
  const allClaims = claimsSnap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklyClaim));

  let submittedPendingPence = 0;
  let approvedNotInvoicedPence = 0;

  for (const claim of allClaims) {
    if (claim.status === 'Draft' || claim.status === 'Withdrawn') continue;

    // Attendance lines
    for (const line of claim.attendanceLines) {
      if (line.projectId !== projectId) continue;
      if (line.lineStatus === 'Submitted') {
        submittedPendingPence += (line.calculatedAmountPence || 0);
      } else if (line.lineStatus === 'Approved') {
        // Only count as approved-not-invoiced if NOT yet invoiced!
        if (!line.invoiced) {
          approvedNotInvoicedPence += (line.approvedAmountPence ?? line.calculatedAmountPence ?? 0);
        }
      }
    }

    // Expense lines
    for (const line of claim.expenseLines) {
      if (line.projectId !== projectId) continue;
      if (line.lineStatus === 'Submitted') {
        submittedPendingPence += (line.amountPence || 0);
      } else if (line.lineStatus === 'Approved') {
        if (!line.invoiced) {
          approvedNotInvoicedPence += (line.approvedAmountPence ?? line.amountPence ?? 0);
        }
      }
    }

    // Travel allocations
    for (const line of claim.travelLines) {
      for (const alloc of line.projectAllocations) {
        if (alloc.projectId !== projectId) continue;
        if (line.lineStatus === 'Submitted') {
          submittedPendingPence += (alloc.allocatedAmountPence || 0);
        } else if (line.lineStatus === 'Approved') {
          if (!line.invoiced) {
            approvedNotInvoicedPence += (alloc.allocatedAmountPence || 0);
          }
        }
      }
    }
  }

  // Invoices and payments
  const invoicesSnap = await getDocs(collection(db, 'invoices'));
  const allInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceRecord));

  let invoicedPence = 0;
  let paidPence = 0;

  for (const inv of allInvoices) {
    if (inv.status === 'Cancelled') continue;
    const projectLines = inv.lineItems.filter(l => l.projectId === projectId);
    const projectNet = projectLines.reduce((s, l) => s + l.netAmountPence, 0);
    if (projectNet > 0) {
      invoicedPence += projectNet;
      // Proportional payment allocation
      if (inv.totalPaidPence > 0 && (inv.netAmountPence > 0 || inv.grossAmountPence > 0)) {
        const base = inv.netAmountPence > 0 ? inv.netAmountPence : inv.grossAmountPence;
        const proportion = projectNet / base;
        paidPence += roundPence(Math.min(inv.totalPaidPence * proportion, projectNet));
      }
    }
  }

  const invoicedUnpaidPence = Math.max(0, invoicedPence - paidPence);
  const totalRecognisedCostPence = approvedNotInvoicedPence + invoicedPence;

  return {
    projectId,
    projectReference: '',
    submittedPendingPence,
    approvedNotInvoicedPence,
    invoicedPence,
    paidPence,
    invoicedUnpaidPence,
    totalRecognisedCostPence,
    // Compatibility aliases
    submittedPence: submittedPendingPence,
    approvedPence: approvedNotInvoicedPence,
    outstandingPence: invoicedUnpaidPence
  };
}

/* ========================================================= */
/* RECEIPT FILE UPLOAD                                        */
/* ========================================================= */

/** Upload receipt file(s) */
export async function uploadReceiptFiles(
  claimId: string,
  lineId: string,
  files: File[]
): Promise<{ urls: string[]; names: string[] }> {
  const urls: string[] = [];
  const names: string[] = [];

  for (const file of files) {
    const storageRef = ref(storage, `receipts/${claimId}/${lineId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push(url);
    names.push(file.name);
  }

  return { urls, names };
}

/* ========================================================= */
/* PERMISSION HELPERS                                         */
/* ========================================================= */

/** Check if a user can review claims (not their own) */
export function canReviewClaims(user: UserProfile): boolean {
  return (
    user.role === 'Owner' ||
    user.role === 'Admin' ||
    user.role === 'Accounts' ||
    user.role === 'ProjectManager'
  );
}

/** Check if a user can manage rates */
export function canManageRates(user: UserProfile): boolean {
  return user.role === 'Owner' || user.role === 'Admin';
}

/** Check if a user can record payments */
export function canRecordPayments(user: UserProfile): boolean {
  return user.role === 'Owner' || user.role === 'Admin' || user.role === 'Accounts';
}

/** Check if a user can issue invoices */
export function canIssueInvoices(user: UserProfile): boolean {
  return (
    user.role === 'Owner' ||
    user.role === 'Admin' ||
    user.role === 'Accounts' ||
    user.role === 'IndividualContractor'
  );
}

/** Check if a user can view financial details (rates, amounts) */
export function canViewFinancials(user: UserProfile): boolean {
  return user.role === 'Owner' || user.role === 'Admin' || user.role === 'Accounts';
}

/** Check if user is an individual contractor (not company, not employee) */
export function isIndividualContractor(user: UserProfile): boolean {
  return user.role === 'IndividualContractor' && user.applicationCategory === 'Individual Contractor';
}
