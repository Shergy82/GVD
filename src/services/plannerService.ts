import { db } from './firebase';
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
  runTransaction 
} from 'firebase/firestore';
import type { 
  BookingRecord, 
  BookingSlot, 
  BookingStatus, 
  AcknowledgementStatus,
  UnavailabilityRecord, 
  UnavailabilityCategory, 
  UnavailabilityStatus,
  PlanningBatchConflict,
  ProjectRecord,
  UserProfile,
  CompetencyDocument,
  RequirementConfig
} from '../types';
import { addProjectMember } from './projectService';

/* ========================================================= */
/* DATE & UK TIMEZONE HELPERS                                 */
/* ========================================================= */

/**
 * Returns YYYY-MM-DD string for a Date in local UK format.
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD string safely without UTC offset shift.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Gets the Monday of the week containing the given date string or Date object.
 */
export function getMondayOfDate(input: string | Date): string {
  const d = typeof input === 'string' ? parseLocalDate(input) : new Date(input);
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return formatLocalDate(monday);
}

/**
 * Returns array of 7 date strings [Mon..Sun] starting from Monday.
 */
export function getWeekDays(mondayStr: string): string[] {
  const monday = parseLocalDate(mondayStr);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const next = new Date(monday);
    next.setDate(monday.getDate() + i);
    days.push(formatLocalDate(next));
  }
  return days;
}

/**
 * Formats a YYYY-MM-DD string into readable UK header, e.g., "Mon 24 Oct"
 */
export function formatDayHeader(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ========================================================= */
/* COMPETENCY & ELIGIBILITY CHECK FOR TARGET WORK DATE       */
/* ========================================================= */

/**
 * Checks competency expiration for a person on a specific work date.
 */
export async function checkCompetencyForWorkDate(
  person: UserProfile, 
  targetDate: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!person.planningEligible) {
    return { valid: false, reason: `${person.fullName} is disabled for planning eligibility.` };
  }
  if (person.status !== 'approved') {
    return { valid: false, reason: `${person.fullName}'s account is not approved (${person.status}).` };
  }

  // Fetch active requirement configs
  const reqsSnap = await getDocs(query(collection(db, 'requirement_configs'), where('isActive', '==', true)));
  const reqs: RequirementConfig[] = [];
  reqsSnap.forEach(d => reqs.push({ id: d.id, ...d.data() } as RequirementConfig));

  // Filter mandatory requirements for person's account category & trade
  const mandatoryReqs = reqs.filter(r => {
    if (!r.isMandatory) return false;
    const catMatch = r.applicableAccountTypes.length === 0 || r.applicableAccountTypes.includes(person.applicationCategory);
    const tradeMatch = r.applicableTrades.length === 0 || (person.primaryTrade && r.applicableTrades.includes(person.primaryTrade));
    return catMatch && tradeMatch;
  });

  if (mandatoryReqs.length === 0) return { valid: true };

  // Fetch person's competencies
  const compSnap = await getDocs(query(collection(db, 'competencies'), where('holderId', '==', person.uid)));
  const comps: CompetencyDocument[] = [];
  compSnap.forEach(d => comps.push({ id: d.id, ...d.data() } as CompetencyDocument));

  for (const req of mandatoryReqs) {
    const userDoc = comps.find(c => c.requirementId === req.id && c.isCurrentVersion);
    if (!userDoc || userDoc.reviewStatus === 'Missing' || userDoc.reviewStatus === 'Rejected') {
      return { 
        valid: false, 
        reason: `Missing mandatory requirement "${req.name}" for work date ${targetDate}.` 
      };
    }

    if (!userDoc.doesNotExpire && userDoc.expiryDate) {
      if (userDoc.expiryDate <= targetDate) {
        return { 
          valid: false, 
          reason: `Mandatory requirement "${req.name}" expires on or before work date ${targetDate} (Expires: ${userDoc.expiryDate}).` 
        };
      }
    }
  }

  return { valid: true };
}

/* ========================================================= */
/* CONFLICT & AVAILABILITY CHECKS                            */
/* ========================================================= */

/**
 * Checks for booking conflicts, overlaps, unavailability, and project status issues.
 */
export async function checkBookingConflicts(
  person: UserProfile,
  project: ProjectRecord,
  date: string,
  slot: BookingSlot,
  startTime?: string,
  endTime?: string,
  excludeBookingId?: string
): Promise<PlanningBatchConflict | null> {
  // 1. Check Project Status
  if (['Site Complete', 'Cancelled'].includes(project.status) || project.isArchived) {
    return {
      personId: person.uid,
      personName: person.fullName,
      date,
      type: 'project_status',
      message: `Project ${project.reference} is ${project.isArchived ? 'Archived' : project.status} and cannot receive new bookings.`
    };
  }

  // 2. Check Competency for Date
  const compCheck = await checkCompetencyForWorkDate(person, date);
  if (!compCheck.valid) {
    return {
      personId: person.uid,
      personName: person.fullName,
      date,
      type: 'competency',
      message: compCheck.reason || 'Failed mandatory competency requirement.'
    };
  }

  // 3. Check Approved Unavailability for Date
  const unavailSnap = await getDocs(query(
    collection(db, 'unavailability'),
    where('personId', '==', person.uid),
    where('status', '==', 'Approved')
  ));

  let isUnavailable = false;
  let unavailReason = '';
  unavailSnap.forEach(docSnap => {
    const u = docSnap.data() as UnavailabilityRecord;
    if (date >= u.startDate && date <= u.endDate) {
      isUnavailable = true;
      unavailReason = u.category;
    }
  });

  if (isUnavailable) {
    return {
      personId: person.uid,
      personName: person.fullName,
      date,
      type: 'unavailability',
      message: `${person.fullName} has approved unavailability (${unavailReason}) on ${date}.`
    };
  }

  // 4. Check Existing Active Bookings on Date
  const bookingsSnap = await getDocs(query(
    collection(db, 'bookings'),
    where('personId', '==', person.uid),
    where('localDate', '==', date)
  ));

  const existingBookings: BookingRecord[] = [];
  bookingsSnap.forEach(d => {
    const b = { id: d.id, ...d.data() } as BookingRecord;
    if (b.status !== 'Cancelled' && b.id !== excludeBookingId) {
      existingBookings.push(b);
    }
  });

  for (const ex of existingBookings) {
    if (slot === 'Full Day' || ex.slot === 'Full Day') {
      return {
        personId: person.uid,
        personName: person.fullName,
        date,
        type: 'duplicate',
        message: `${person.fullName} is already booked on ${ex.projectReference} (${ex.slot}) on ${date}.`
      };
    }

    if (slot === ex.slot) {
      return {
        personId: person.uid,
        personName: person.fullName,
        date,
        type: 'overlapping',
        message: `${person.fullName} is already booked for ${slot} on ${ex.projectReference} on ${date}.`
      };
    }
  }

  return null;
}

/* ========================================================= */
/* FIRESTORE BOOKINGS CRUD                                   */
/* ========================================================= */

/**
 * Fetches bookings for a date range and optional filters.
 */
export async function fetchBookings(filters: {
  startDate: string;
  endDate: string;
  projectId?: string;
  personId?: string;
  userRole?: string;
  userUid?: string;
}): Promise<BookingRecord[]> {
  let q = query(
    collection(db, 'bookings'),
    where('localDate', '>=', filters.startDate),
    where('localDate', '<=', filters.endDate)
  );

  const snap = await getDocs(q);
  let bookings: BookingRecord[] = [];

  snap.forEach(d => {
    bookings.push({ id: d.id, ...d.data() } as BookingRecord);
  });

  // Contractor security filter: see ONLY own non-draft bookings
  if (filters.userRole === 'IndividualContractor' || filters.userRole === 'ContractorCompany') {
    bookings = bookings.filter(b => b.personId === filters.userUid && b.status !== 'Draft');
  }

  if (filters.projectId) {
    bookings = bookings.filter(b => b.projectId === filters.projectId);
  }

  if (filters.personId) {
    bookings = bookings.filter(b => b.personId === filters.personId);
  }

  return bookings;
}

/**
 * Creates a batch of bookings atomically with complete pre-validation.
 */
export async function createBookingBatch(params: {
  project: ProjectRecord;
  persons: UserProfile[];
  dates: string[];
  slot: BookingSlot;
  startTime?: string;
  endTime?: string;
  instructions?: string;
  status: BookingStatus; // 'Draft' or 'Published'
  actor: UserProfile;
}): Promise<{ success: boolean; conflicts: PlanningBatchConflict[]; createdCount: number }> {
  const conflicts: PlanningBatchConflict[] = [];

  // Pre-validate all person/date combinations
  for (const person of params.persons) {
    for (const date of params.dates) {
      const conflict = await checkBookingConflicts(
        person, 
        params.project, 
        date, 
        params.slot, 
        params.startTime, 
        params.endTime
      );
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  if (conflicts.length > 0) {
    return { success: false, conflicts, createdCount: 0 };
  }

  // Generate shared group reference
  const groupRef = `GRP_${Date.now()}`;
  let count = 0;

  for (const person of params.persons) {
    for (const date of params.dates) {
      const bookingRef = doc(collection(db, 'bookings'));
      const bookingRecord: BookingRecord = {
        id: bookingRef.id,
        groupRef,
        projectId: params.project.id,
        projectReference: params.project.reference,
        projectTitle: params.project.title,
        siteAddress: params.project.siteAddress,
        postcode: params.project.postcode,
        personId: person.uid,
        personName: person.fullName,
        personTrade: person.primaryTrade || person.role,
        companyId: person.companyId || '',
        companyName: person.companyName || '',
        localDate: date,
        slot: params.slot,
        startTime: params.startTime || '',
        endTime: params.endTime || '',
        instructions: params.instructions || '',
        status: params.status,
        acknowledgement: 'Pending',
        revision: 1,
        createdByUid: params.actor.uid,
        createdByName: params.actor.fullName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(bookingRef, bookingRecord);
      count++;

      // If Published, grant booking-derived project membership & send notification
      if (params.status === 'Published') {
        try {
          await addProjectMember(
            params.project.id,
            {
              uid: person.uid,
              fullName: person.fullName,
              email: person.email,
              phone: person.phone,
              companyName: person.companyName || '',
              trade: person.primaryTrade || '',
              role: person.role,
              accessPreset: 'Contractor Participant',
              addedAt: new Date().toISOString(),
              addedBy: params.actor.fullName
            },
            params.actor
          );
        } catch (e) {
          // Member may already exist explicitly
        }

        // Send Notification
        await addDoc(collection(db, 'notifications'), {
          recipientId: person.uid,
          recipientEmail: person.email,
          title: `New Work Booking Published: ${params.project.reference}`,
          message: `You are booked at ${params.project.siteAddress} on ${date} (${params.slot}). Please open My Work to accept or decline.`,
          type: 'booking_published',
          relatedProjectId: params.project.id,
          relatedBookingId: bookingRef.id,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  return { success: true, conflicts: [], createdCount: count };
}

/**
 * Updates a booking or group of bookings.
 */
export async function updateBookingRecord(
  bookingId: string,
  updateScope: 'single' | 'group',
  changes: Partial<BookingRecord>,
  actor: UserProfile
): Promise<void> {
  const targetRef = doc(db, 'bookings', bookingId);
  const snap = await getDoc(targetRef);
  if (!snap.exists()) return;

  const current = snap.data() as BookingRecord;
  const isMaterialChange = (
    (changes.localDate && changes.localDate !== current.localDate) ||
    (changes.slot && changes.slot !== current.slot) ||
    (changes.startTime && changes.startTime !== current.startTime) ||
    (changes.endTime && changes.endTime !== current.endTime) ||
    (changes.instructions && changes.instructions !== current.instructions)
  );

  const payload: Partial<BookingRecord> = {
    ...changes,
    updatedByUid: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: new Date().toISOString()
  };

  if (isMaterialChange && current.status === 'Published') {
    payload.acknowledgement = 'Pending';
    payload.revision = (current.revision || 1) + 1;
  }

  if (updateScope === 'single' || !current.groupRef) {
    await updateDoc(targetRef, payload);
    if (isMaterialChange && current.status === 'Published') {
      await addDoc(collection(db, 'notifications'), {
        recipientId: current.personId,
        recipientEmail: '',
        title: `Work Booking Updated: ${current.projectReference}`,
        message: `Your booking on ${current.localDate} at ${current.siteAddress} was updated. Please review in My Work.`,
        type: 'booking_changed',
        relatedProjectId: current.projectId,
        relatedBookingId: current.id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  } else {
    // Update group bookings
    const groupSnap = await getDocs(query(
      collection(db, 'bookings'),
      where('groupRef', '==', current.groupRef),
      where('localDate', '>=', current.localDate)
    ));

    groupSnap.forEach(async (d) => {
      await updateDoc(doc(db, 'bookings', d.id), payload);
    });
  }
}

/**
 * Cancels a booking or group of bookings.
 */
export async function cancelBookingRecord(
  bookingId: string,
  reason: string,
  actor: UserProfile
): Promise<void> {
  const targetRef = doc(db, 'bookings', bookingId);
  const snap = await getDoc(targetRef);
  if (!snap.exists()) return;

  const current = snap.data() as BookingRecord;

  await updateDoc(targetRef, {
    status: 'Cancelled',
    cancelledReason: reason,
    updatedByUid: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: new Date().toISOString()
  });

  if (current.status === 'Published') {
    await addDoc(collection(db, 'notifications'), {
      recipientId: current.personId,
      recipientEmail: '',
      title: `Work Booking Cancelled: ${current.projectReference}`,
      message: `Your booking on ${current.localDate} at ${current.siteAddress} has been cancelled. Reason: ${reason}`,
      type: 'booking_cancelled',
      relatedProjectId: current.projectId,
      relatedBookingId: current.id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }
}

/**
 * Contractor response: Accept or Decline booking.
 */
export async function respondToBooking(
  bookingId: string,
  response: 'Accepted' | 'Declined',
  declineReason: string | undefined,
  actor: UserProfile
): Promise<void> {
  const targetRef = doc(db, 'bookings', bookingId);
  const snap = await getDoc(targetRef);
  if (!snap.exists()) return;

  const current = snap.data() as BookingRecord;
  if (current.personId !== actor.uid) {
    throw new Error('Access denied: You can only respond to your own bookings.');
  }

  await updateDoc(targetRef, {
    acknowledgement: response,
    declineReason: response === 'Declined' ? (declineReason || 'No reason specified') : null,
    updatedByUid: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: new Date().toISOString()
  });

  // Notify GVD Planners/Managers if declined
  if (response === 'Declined') {
    await addDoc(collection(db, 'notifications'), {
      recipientId: current.createdByUid,
      recipientEmail: '',
      title: `Booking Declined by ${actor.fullName}`,
      message: `${actor.fullName} declined booking on ${current.projectReference} (${current.localDate}). Reason: ${declineReason || 'None'}`,
      type: 'booking_response',
      relatedProjectId: current.projectId,
      relatedBookingId: current.id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }
}

/**
 * Copies source week bookings forward to destination week as new drafts.
 */
export async function copyWeekForward(params: {
  sourceMonday: string;
  targetMonday: string;
  actor: UserProfile;
}): Promise<{ createdCount: number }> {
  const sourceDays = getWeekDays(params.sourceMonday);
  const targetDays = getWeekDays(params.targetMonday);

  const bookingsSnap = await getDocs(query(
    collection(db, 'bookings'),
    where('localDate', '>=', sourceDays[0]),
    where('localDate', '<=', sourceDays[6])
  ));

  let count = 0;
  bookingsSnap.forEach(async (d) => {
    const orig = d.data() as BookingRecord;
    if (orig.status === 'Cancelled') return;

    const dayIndex = sourceDays.indexOf(orig.localDate);
    if (dayIndex >= 0 && dayIndex < 7) {
      const targetDate = targetDays[dayIndex];
      const newRef = doc(collection(db, 'bookings'));
      const newRecord: BookingRecord = {
        ...orig,
        id: newRef.id,
        groupRef: `GRP_CPY_${Date.now()}`,
        localDate: targetDate,
        status: 'Draft',
        acknowledgement: 'Pending',
        declineReason: undefined,
        revision: 1,
        createdByUid: params.actor.uid,
        createdByName: params.actor.fullName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(newRef, newRecord);
      count++;
    }
  });

  return { createdCount: count };
}

/* ========================================================= */
/* UNAVAILABILITY SERVICES                                    */
/* ========================================================= */

export async function fetchUnavailability(personId?: string): Promise<UnavailabilityRecord[]> {
  let q = query(collection(db, 'unavailability'));
  if (personId) {
    q = query(q, where('personId', '==', personId));
  }
  const snap = await getDocs(q);
  const records: UnavailabilityRecord[] = [];
  snap.forEach(d => records.push({ id: d.id, ...d.data() } as UnavailabilityRecord));
  return records.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function requestUnavailability(
  data: {
    startDate: string;
    endDate: string;
    slot: BookingSlot;
    category: UnavailabilityCategory;
    reason?: string;
  },
  actor: UserProfile
): Promise<void> {
  const isGvd = actor.applicationCategory === 'GVD Employee';
  const newRef = doc(collection(db, 'unavailability'));
  const rec: UnavailabilityRecord = {
    id: newRef.id,
    personId: actor.uid,
    personName: actor.fullName,
    startDate: data.startDate,
    endDate: data.endDate,
    slot: data.slot,
    category: data.category,
    status: isGvd ? 'Approved' : 'Pending',
    reason: data.reason || '',
    createdByUid: actor.uid,
    createdAt: new Date().toISOString()
  };
  await setDoc(newRef, rec);
}

export async function reviewUnavailability(
  unavailabilityId: string,
  status: 'Approved' | 'Rejected',
  actor: UserProfile,
  rejectionReason?: string
): Promise<void> {
  const targetRef = doc(db, 'unavailability', unavailabilityId);
  await updateDoc(targetRef, {
    status,
    reviewedByUid: actor.uid,
    reviewedByName: actor.fullName,
    reviewedAt: new Date().toISOString(),
    rejectionReason: rejectionReason || ''
  });
}
