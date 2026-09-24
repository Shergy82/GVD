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
  runTransaction
} from 'firebase/firestore';
import type {
  SupplierRecord,
  PurchasingRule,
  MaterialsRequest,
  RequestItem,
  RequestDocument,
  RequestQuery,
  RequestApproval,
  PurchaseOrder,
  POItem,
  PORevisionRecord,
  MaterialReceiptRecord,
  SupplierInvoice,
  POAllocation,
  ProjectAllocation,
  SupplierCreditNote,
  SupplierPaymentRecord,
  ProjectMaterialsCost,
  UserProfile,
  UserRole
} from '../types';
import { LiveDataStore } from './liveStore';

/* ========================================================= */
/* MONETARY HELPERS                                          */
/* ========================================================= */

export function roundPence(value: number): number {
  return Math.round(value);
}

export function formatPence(pence: number): string {
  const pounds = (pence / 100).toFixed(2);
  return `£${Number(pounds).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function normalizeInvoiceNumber(num: string): string {
  return (num || '').toUpperCase().replace(/[\s\-_/\\.]/g, '');
}

/* ========================================================= */
/* REFERENCE GENERATORS                                      */
/* ========================================================= */

let localReqCounter = 1;
let localPoCounter = 1;

/**
 * Generate a unique Materials Request reference: GVD-MR-YYYY-NNNN
 * Visually distinct from PO numbers!
 */
export async function generateRequestReference(): Promise<string> {
  const currentYear = new Date().getFullYear();
  try {
    const counterRef = doc(db, 'counters', `request_ref_${currentYear}`);
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const lastSeq = snap.exists() ? (snap.data().lastSeq || 0) : 0;
      const nextSeq = lastSeq + 1;
      transaction.set(counterRef, { lastSeq: nextSeq, year: currentYear }, { merge: true });
      return `GVD-MR-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
    });
  } catch (e) {
    // Offline / fallback sequence
    const seq = localReqCounter++;
    return `GVD-MR-${currentYear}-${String(seq).padStart(4, '0')}`;
  }
}

/**
 * Generate a unique Purchase Order reference: GVD-PO-YYYY-NNNN
 * Globally unique within GVD, never reused, survives retries safely.
 */
export async function generatePOReference(): Promise<string> {
  const currentYear = new Date().getFullYear();
  try {
    const counterRef = doc(db, 'counters', `po_ref_${currentYear}`);
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const lastSeq = snap.exists() ? (snap.data().lastSeq || 0) : 0;
      const nextSeq = lastSeq + 1;
      transaction.set(counterRef, { lastSeq: nextSeq, year: currentYear }, { merge: true });
      return `GVD-PO-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
    });
  } catch (e) {
    const seq = localPoCounter++;
    return `GVD-PO-${currentYear}-${String(seq).padStart(4, '0')}`;
  }
}

/* ========================================================= */
/* SUPPLIER DIRECTORY                                        */
/* ========================================================= */

export const INITIAL_SUPPLIERS: SupplierRecord[] = [
  {
    id: 'supp-001',
    name: 'Travis Perkins',
    legalName: 'Travis Perkins Trading Company Ltd',
    email: 'mayfair.sales@travisperkins.co.uk',
    phone: '020 7946 0123',
    address: '12 North Row, Mayfair, London, W1K 7DA',
    gvdAccountNumber: 'TP-GVD-88210',
    supplierReference: 'TP-LON-MAY',
    paymentTermsDays: 30,
    isActive: true,
    internalNotes: 'Primary timber & sheet materials supplier. Free delivery for orders > £250.',
    createdAt: '2026-01-01T09:00:00Z',
    updatedAt: '2026-01-01T09:00:00Z'
  },
  {
    id: 'supp-002',
    name: 'Jewson',
    legalName: 'Jewson Limited',
    email: 'cityroad@jewson.co.uk',
    phone: '020 7946 0456',
    address: '140 City Road, London, EC1V 2NX',
    gvdAccountNumber: 'JEW-44912',
    supplierReference: 'JEW-CITY',
    paymentTermsDays: 30,
    isActive: true,
    internalNotes: 'Aggregates, cement and general building materials.',
    createdAt: '2026-01-02T09:00:00Z',
    updatedAt: '2026-01-02T09:00:00Z'
  },
  {
    id: 'supp-003',
    name: 'Screwfix',
    legalName: 'Screwfix Direct Ltd',
    email: 'trade.battersea@screwfix.com',
    phone: '0333 011 2112',
    address: 'Unit 4, Battersea Business Centre, Lavender Hill, London, SW11 5QL',
    gvdAccountNumber: 'SFX-90123',
    supplierReference: 'SFX-BAT',
    paymentTermsDays: 14,
    isActive: true,
    internalNotes: 'Fixings, power tool accessories, site consumables.',
    createdAt: '2026-01-03T09:00:00Z',
    updatedAt: '2026-01-03T09:00:00Z'
  },
  {
    id: 'supp-004',
    name: 'City Plumbing Supplies',
    legalName: 'Highbourne Group Ltd',
    email: 'fulham@cityplumbing.co.uk',
    phone: '020 7946 0789',
    address: '45 Townmead Road, Fulham, London, SW6 2RX',
    gvdAccountNumber: 'CPS-55102',
    supplierReference: 'CPS-FUL',
    paymentTermsDays: 30,
    isActive: true,
    internalNotes: 'Specialist plumbing, sanitaryware & drainage.',
    createdAt: '2026-01-04T09:00:00Z',
    updatedAt: '2026-01-04T09:00:00Z'
  }
];

export async function fetchSuppliers(): Promise<SupplierRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'suppliers'));
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierRecord));
    }
  } catch (e) {
    // fallback to LiveDataStore / INITIAL_SUPPLIERS
  }
  return INITIAL_SUPPLIERS;
}

export function checkDuplicateSupplier(
  suppliers: SupplierRecord[],
  candidate: { name: string; email?: string; phone?: string; id?: string }
): { isLikelyDuplicate: boolean; matchedSupplier?: SupplierRecord; reason?: string } {
  const normName = candidate.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normEmail = (candidate.email || '').trim().toLowerCase();
  const normPhone = (candidate.phone || '').trim().replace(/[^0-9]/g, '');

  for (const s of suppliers) {
    if (candidate.id && s.id === candidate.id) continue;

    const sNormName = s.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const sNormEmail = s.email.trim().toLowerCase();
    const sNormPhone = s.phone.trim().replace(/[^0-9]/g, '');

    if (sNormName === normName && normName.length > 2) {
      return { isLikelyDuplicate: true, matchedSupplier: s, reason: `Exact or very close supplier name match: "${s.name}"` };
    }
    if (normEmail && sNormEmail && normEmail === sNormEmail) {
      return { isLikelyDuplicate: true, matchedSupplier: s, reason: `Matching contact email: ${s.email}` };
    }
    if (normPhone && sNormPhone && normPhone.length > 6 && normPhone === sNormPhone) {
      return { isLikelyDuplicate: true, matchedSupplier: s, reason: `Matching phone number: ${s.phone}` };
    }
  }
  return { isLikelyDuplicate: false };
}

export async function saveSupplier(
  supplier: Omit<SupplierRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const now = new Date().toISOString();
  if (existingId) {
    const docRef = doc(db, 'suppliers', existingId);
    await updateDoc(docRef, { ...supplier, updatedAt: now });
    return existingId;
  } else {
    const docRef = await addDoc(collection(db, 'suppliers'), {
      ...supplier,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }
}

/* ========================================================= */
/* PURCHASING RULES & APPROVAL DELEGATION                    */
/* ========================================================= */

export const INITIAL_PURCHASING_RULES: PurchasingRule[] = [
  {
    id: 'rule-default-admin',
    name: 'Owner & Admin Full Authority',
    approverRole: 'Owner',
    maxOrderGrossPence: 10000000, // £100,000.00
    aggregatePeriodDays: 30,
    aggregatePeriodLimitPence: 50000000, // £500,000.00
    isAutoApprovalEnabled: false, // Default is manual approval!
    isActive: true,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-pm-delegation',
    name: 'Project Manager Standard Allowance (£500 order / £2,000 monthly)',
    approverRole: 'ProjectManager',
    maxOrderGrossPence: 50000, // £500.00 order limit
    aggregatePeriodDays: 30,
    aggregatePeriodLimitPence: 200000, // £2,000.00 aggregate 30-day limit
    isAutoApprovalEnabled: false,
    isActive: true,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

export async function fetchPurchasingRules(): Promise<PurchasingRule[]> {
  try {
    const snap = await getDocs(collection(db, 'purchasing_rules'));
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchasingRule));
    }
  } catch (e) {}
  return INITIAL_PURCHASING_RULES;
}

export async function savePurchasingRule(
  rule: Omit<PurchasingRule, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  existingId?: string
): Promise<string> {
  const now = new Date().toISOString();
  if (existingId) {
    const existingSnap = await getDoc(doc(db, 'purchasing_rules', existingId));
    const oldVersion = existingSnap.exists() ? (existingSnap.data().version || 1) : 1;
    const docRef = doc(db, 'purchasing_rules', existingId);
    await updateDoc(docRef, { ...rule, version: oldVersion + 1, updatedAt: now });
    return existingId;
  } else {
    const docRef = await addDoc(collection(db, 'purchasing_rules'), {
      ...rule,
      version: 1,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }
}

/**
 * Calculate total gross pence spent/committed in a rolling window of N days.
 * Includes issued, fulfilled, and uncancelled POs.
 */
export function calculateSpentInPeriod(
  purchaseOrders: PurchaseOrder[],
  periodDays: number,
  projectId?: string,
  requesterUid?: string
): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  return purchaseOrders
    .filter(po => {
      if (po.status === 'Cancelled') return false;
      if (po.issueDate < cutoffStr) return false;
      if (projectId && po.projectId !== projectId) return false;
      if (requesterUid && po.requesterUid !== requesterUid) return false;
      return true;
    })
    .reduce((sum, po) => sum + po.authorisedGrossPence, 0);
}

/**
 * Evaluate if a request qualifies for automatic approval:
 * 1. Auto approval must be explicitly enabled on an active rule.
 * 2. Order gross must not exceed maxOrderGrossPence.
 * 3. Total aggregate spend in rolling period + this request gross must not exceed aggregatePeriodLimitPence.
 * 4. Rule must not be expired.
 * 5. Requester/project/supplier must match rule scope if defined.
 */
export function evaluateAutoApproval(
  request: MaterialsRequest,
  rules: PurchasingRule[],
  existingPOs: PurchaseOrder[]
): { qualifies: boolean; rule?: PurchasingRule; reason: string } {
  const activeAutoRules = rules.filter(r => r.isActive && r.isAutoApprovalEnabled);
  if (activeAutoRules.length === 0) {
    return { qualifies: false, reason: 'Automatic approval is disabled by GVD policy (manual review required)' };
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  for (const rule of activeAutoRules) {
    if (rule.expiresAt && rule.expiresAt < todayStr) continue;

    // Check applicable scoping
    if (rule.applicableProjectIds && rule.applicableProjectIds.length > 0) {
      if (!rule.applicableProjectIds.includes(request.projectId)) continue;
    }
    if (rule.applicableUserIds && rule.applicableUserIds.length > 0) {
      if (!rule.applicableUserIds.includes(request.requesterUid)) continue;
    }
    if (rule.applicableSupplierIds && rule.applicableSupplierIds.length > 0 && request.supplierId) {
      if (!rule.applicableSupplierIds.includes(request.supplierId)) continue;
    }

    // Per-order maximum check
    if (request.grossAmountPence > rule.maxOrderGrossPence) {
      return {
        qualifies: false,
        rule,
        reason: `Request gross (${formatPence(request.grossAmountPence)}) exceeds rule per-order limit (${formatPence(rule.maxOrderGrossPence)})`
      };
    }

    // Aggregate period limit check
    if (rule.aggregatePeriodDays && rule.aggregatePeriodLimitPence) {
      const alreadySpent = calculateSpentInPeriod(
        existingPOs,
        rule.aggregatePeriodDays,
        request.projectId,
        undefined
      );
      const combined = alreadySpent + request.grossAmountPence;
      if (combined > rule.aggregatePeriodLimitPence) {
        return {
          qualifies: false,
          rule,
          reason: `Combined aggregate spend (${formatPence(combined)}) over ${rule.aggregatePeriodDays} days exceeds limit (${formatPence(rule.aggregatePeriodLimitPence)})`
        };
      }
    }

    // Qualified!
    return { qualifies: true, rule, reason: `Matches auto-approval rule: ${rule.name}` };
  }

  return { qualifies: false, reason: 'No matching auto-approval rule for this request' };
}

/* ========================================================= */
/* MATERIALS REQUESTS LIFECYCLE                              */
/* ========================================================= */

export async function createMaterialsRequest(
  data: {
    projectId: string;
    projectReference: string;
    projectName: string;
    supplierId?: string;
    supplierName?: string;
    suggestedSupplier?: string;
    purpose: string;
    requiredByDate?: string;
    isItemised: boolean;
    items?: RequestItem[];
    estimatedTotalPence: number;
    valueBasis: 'Net' | 'VAT' | 'Gross';
    netAmountPence?: number;
    vatAmountPence?: number;
    grossAmountPence: number;
    taxBreakdownConfirmed: boolean;
    deliveryType: 'collection' | 'delivery';
    deliveryAddress: string;
    supportingDocuments?: RequestDocument[];
    submitNow: boolean;
  },
  currentUser: UserProfile,
  existingPOs: PurchaseOrder[] = [],
  rules: PurchasingRule[] = []
): Promise<{ request: MaterialsRequest; poIssued?: PurchaseOrder }> {
  // Validation 1: Contractor cannot request for an unauthorized project
  const isContractor = currentUser.role === 'IndividualContractor' || currentUser.role === 'ContractorCompany';
  if (isContractor) {
    const assigned = currentUser.assignedProjectIds || [];
    if (!assigned.includes(data.projectId)) {
      throw new Error(`You are not authorised to request materials on project ${data.projectReference}.`);
    }
  }

  // Validation 2: Required fields
  if (!data.projectId || !data.projectReference) {
    throw new Error('Project is mandatory for materials requests.');
  }
  if (!data.purpose || data.purpose.trim().length === 0) {
    throw new Error('Please describe what is needed and a short explanation.');
  }
  if (!data.grossAmountPence || data.grossAmountPence <= 0) {
    throw new Error('A valid estimated amount greater than £0.00 is required.');
  }
  if (!data.supplierId && (!data.suggestedSupplier || data.suggestedSupplier.trim().length === 0)) {
    throw new Error('Please choose a supplier or provide a suggested supplier.');
  }

  const reqRef = await generateRequestReference();
  const now = new Date().toISOString();

  let status: 'Draft' | 'Submitted' | 'Approved' = data.submitNow ? 'Submitted' : 'Draft';
  let approvalDetails: RequestApproval | undefined = undefined;
  let issuedPo: PurchaseOrder | undefined = undefined;

  const request: MaterialsRequest = {
    id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requestReference: reqRef,
    projectId: data.projectId,
    projectReference: data.projectReference,
    projectName: data.projectName,
    supplierId: data.supplierId,
    supplierName: data.supplierName,
    suggestedSupplier: data.suggestedSupplier,
    requesterUid: currentUser.uid,
    requesterName: currentUser.fullName,
    requesterRole: currentUser.role,
    purpose: data.purpose,
    requiredByDate: data.requiredByDate,
    isItemised: data.isItemised,
    items: data.items || [],
    estimatedTotalPence: data.estimatedTotalPence,
    valueBasis: data.valueBasis,
    netAmountPence: data.netAmountPence,
    vatAmountPence: data.vatAmountPence,
    grossAmountPence: data.grossAmountPence,
    taxBreakdownConfirmed: data.taxBreakdownConfirmed,
    deliveryType: data.deliveryType,
    deliveryAddress: data.deliveryAddress,
    supportingDocuments: data.supportingDocuments || [],
    status,
    createdAt: now,
    updatedAt: now
  };

  // If submitted, evaluate automatic approval rules
  if (data.submitNow) {
    const autoResult = evaluateAutoApproval(request, rules, existingPOs);
    if (autoResult.qualifies && autoResult.rule) {
      const poRef = await generatePOReference();
      approvalDetails = {
        approverUid: 'system-auto-rule',
        approverName: `Auto-Approval (${autoResult.rule.name})`,
        approverRole: 'System',
        approvedAt: now,
        isAutoApproved: true,
        ruleId: autoResult.rule.id,
        ruleVersion: autoResult.rule.version,
        approvedGrossPence: request.grossAmountPence,
        approvedScope: request.purpose,
        policyVersion: `Rule ${autoResult.rule.name} v${autoResult.rule.version}`
      };

      request.status = 'Approved';
      request.approvalDetails = approvalDetails;
      request.issuedPoReference = poRef;

      // Issue PO immediately
      issuedPo = {
        id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        poReference: poRef,
        requestId: request.id,
        requestReference: request.requestReference,
        projectId: request.projectId,
        projectReference: request.projectReference,
        projectName: request.projectName,
        supplierId: request.supplierId || 'supp-unlisted',
        supplierName: request.supplierName || request.suggestedSupplier || 'Unlisted Supplier',
        requesterUid: request.requesterUid,
        requesterName: request.requesterName,
        approverUid: approvalDetails.approverUid,
        approverName: approvalDetails.approverName,
        approvedScope: request.purpose,
        items: (request.items || []).map(i => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unitDescription: i.unitDescription,
          unitPricePence: i.estimatedUnitPricePence,
          totalPricePence: i.estimatedTotalPence,
          quantityReceived: 0
        })),
        authorisedNetPence: request.netAmountPence || Math.round(request.grossAmountPence / 1.2),
        authorisedVatPence: request.vatAmountPence || (request.grossAmountPence - Math.round(request.grossAmountPence / 1.2)),
        authorisedGrossPence: request.grossAmountPence,
        valueBasis: request.valueBasis,
        deliveryType: request.deliveryType,
        deliveryAddress: request.deliveryAddress,
        issueDate: now.slice(0, 10),
        revision: 1,
        status: 'Issued',
        invoicedGrossPence: 0,
        remainingAuthorisedGrossPence: request.grossAmountPence,
        createdAt: now,
        updatedAt: now
      };
      request.issuedPoId = issuedPo.id;
    }
  }

  // Persist to Cloud Firestore or live store
  try {
    await setDoc(doc(db, 'materials_requests', request.id), request);
    if (issuedPo) {
      await setDoc(doc(db, 'purchase_orders', issuedPo.id), issuedPo);
    }
  } catch (e) {
    // offline or local
  }

  return { request, poIssued: issuedPo };
}

/**
 * Review a materials request:
 * Approve, Query, Reject, or Approve Revised scope/amount.
 */
export async function reviewMaterialsRequest(
  request: MaterialsRequest,
  action: 'Approve' | 'Query' | 'Reject' | 'ApproveRevised',
  options: {
    queryText?: string;
    rejectionReason?: string;
    revisedGrossPence?: number;
    revisedScope?: string;
    revisedScopeNote?: string;
  },
  reviewer: UserProfile,
  existingPOs: PurchaseOrder[] = [],
  rules: PurchasingRule[] = []
): Promise<{ request: MaterialsRequest; poIssued?: PurchaseOrder }> {
  // Security 1: Contractor cannot approve their own request
  if (request.requesterUid === reviewer.uid) {
    throw new Error('Self-approval prohibited: You cannot approve your own materials request.');
  }

  // Security 2: Authority check
  const isOwnerOrAdmin = reviewer.role === 'Owner' || reviewer.role === 'Admin';
  const isPM = reviewer.role === 'ProjectManager';

  if (!isOwnerOrAdmin && !isPM) {
    throw new Error('You do not possess the required purchasing authority to review materials requests.');
  }

  if (isPM) {
    const assigned = reviewer.assignedProjectIds || [];
    if (!assigned.includes(request.projectId)) {
      throw new Error(`Project Manager authority restricted: You are not assigned to project ${request.projectReference}.`);
    }
  }

  const now = new Date().toISOString();
  const updatedReq: MaterialsRequest = { ...request, updatedAt: now };
  let issuedPo: PurchaseOrder | undefined = undefined;

  if (action === 'Query') {
    if (!options.queryText || options.queryText.trim().length === 0) {
      throw new Error('A query question or comment is required when querying a request.');
    }
    const queries = updatedReq.queries || [];
    queries.push({
      id: `qry-${Date.now()}`,
      queriedByUid: reviewer.uid,
      queriedByName: reviewer.fullName,
      queriedAt: now,
      queryText: options.queryText.trim()
    });
    updatedReq.queries = queries;
    updatedReq.status = 'Queried';
  } else if (action === 'Reject') {
    if (!options.rejectionReason || options.rejectionReason.trim().length === 0) {
      throw new Error('A reason is required when rejecting a materials request.');
    }
    updatedReq.status = 'Rejected';
    updatedReq.rejectionReason = options.rejectionReason.trim();
  } else if (action === 'Approve' || action === 'ApproveRevised') {
    const approvedGross = action === 'ApproveRevised' && options.revisedGrossPence
      ? options.revisedGrossPence
      : request.grossAmountPence;

    const approvedScope = action === 'ApproveRevised' && options.revisedScope
      ? options.revisedScope
      : request.purpose;

    // Check aggregate spend allowance if PM
    if (isPM) {
      const pmRule = rules.find(r => r.approverRole === 'ProjectManager' && r.isActive) || INITIAL_PURCHASING_RULES[1];
      if (approvedGross > pmRule.maxOrderGrossPence) {
        throw new Error(`Approved amount (${formatPence(approvedGross)}) exceeds PM order limit of ${formatPence(pmRule.maxOrderGrossPence)}. Escalation to Owner/Admin required.`);
      }
      if (pmRule.aggregatePeriodDays && pmRule.aggregatePeriodLimitPence) {
        const spent = calculateSpentInPeriod(existingPOs, pmRule.aggregatePeriodDays, request.projectId);
        if (spent + approvedGross > pmRule.aggregatePeriodLimitPence) {
          throw new Error(`Approved amount would exceed 30-day aggregate project allowance (${formatPence(pmRule.aggregatePeriodLimitPence)}). Escalation to Owner/Admin required.`);
        }
      }
    }

    const poRef = await generatePOReference();
    const approval: RequestApproval = {
      approverUid: reviewer.uid,
      approverName: reviewer.fullName,
      approverRole: reviewer.role,
      approvedAt: now,
      isAutoApproved: false,
      approvedGrossPence: approvedGross,
      approvedScope,
      policyVersion: `GVD Purchasing Standard 2026.1 (Authorised by ${reviewer.role})`,
      revisedScopeNote: options.revisedScopeNote
    };

    updatedReq.status = 'Approved';
    updatedReq.approvalDetails = approval;
    updatedReq.issuedPoReference = poRef;

    // Create the PO
    issuedPo = {
      id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      poReference: poRef,
      requestId: request.id,
      requestReference: request.requestReference,
      projectId: request.projectId,
      projectReference: request.projectReference,
      projectName: request.projectName,
      supplierId: request.supplierId || 'supp-unlisted',
      supplierName: request.supplierName || request.suggestedSupplier || 'Unlisted Supplier',
      requesterUid: request.requesterUid,
      requesterName: request.requesterName,
      approverUid: reviewer.uid,
      approverName: reviewer.fullName,
      approvedScope,
      items: (request.items || []).map(i => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unitDescription: i.unitDescription,
        unitPricePence: i.estimatedUnitPricePence,
        totalPricePence: i.estimatedTotalPence,
        quantityReceived: 0
      })),
      authorisedNetPence: Math.round(approvedGross / 1.2),
      authorisedVatPence: approvedGross - Math.round(approvedGross / 1.2),
      authorisedGrossPence: approvedGross,
      valueBasis: request.valueBasis,
      deliveryType: request.deliveryType,
      deliveryAddress: request.deliveryAddress,
      issueDate: now.slice(0, 10),
      revision: 1,
      status: 'Issued',
      invoicedGrossPence: 0,
      remainingAuthorisedGrossPence: approvedGross,
      createdAt: now,
      updatedAt: now
    };
    updatedReq.issuedPoId = issuedPo.id;
  }

  try {
    await updateDoc(doc(db, 'materials_requests', updatedReq.id), updatedReq as any);
    if (issuedPo) {
      await setDoc(doc(db, 'purchase_orders', issuedPo.id), issuedPo);
    }
  } catch (e) {}

  return { request: updatedReq, poIssued: issuedPo };
}

/* ========================================================= */
/* PURCHASE ORDER AMENDMENTS & CANCELLATION                  */
/* ========================================================= */

export async function amendPurchaseOrder(
  po: PurchaseOrder,
  changes: {
    newGrossPence: number;
    changeDescription: string;
    reason: string;
  },
  reviewer: UserProfile
): Promise<PurchaseOrder> {
  const isOwnerOrAdmin = reviewer.role === 'Owner' || reviewer.role === 'Admin';
  if (!isOwnerOrAdmin && reviewer.role !== 'ProjectManager') {
    throw new Error('Only authorized Project Managers or Owner/Admin can amend an issued Purchase Order.');
  }

  if (changes.newGrossPence < po.invoicedGrossPence) {
    throw new Error(`Cannot reduce authorized amount below already matched invoices (${formatPence(po.invoicedGrossPence)}).`);
  }

  const now = new Date().toISOString();
  const nextRev = po.revision + 1;
  const revisions = po.revisions || [];

  revisions.push({
    revision: po.revision,
    revisedAt: now,
    revisedByUid: reviewer.uid,
    revisedByName: reviewer.fullName,
    changeDescription: changes.changeDescription,
    reason: changes.reason,
    previousGrossPence: po.authorisedGrossPence,
    newGrossPence: changes.newGrossPence,
    approvedByUid: reviewer.uid
  });

  const updatedPO: PurchaseOrder = {
    ...po,
    revision: nextRev,
    authorisedGrossPence: changes.newGrossPence,
    authorisedNetPence: Math.round(changes.newGrossPence / 1.2),
    authorisedVatPence: changes.newGrossPence - Math.round(changes.newGrossPence / 1.2),
    remainingAuthorisedGrossPence: changes.newGrossPence - po.invoicedGrossPence,
    revisions,
    updatedAt: now
  };

  try {
    await updateDoc(doc(db, 'purchase_orders', po.id), updatedPO as any);
  } catch (e) {}

  return updatedPO;
}

export async function cancelPurchaseOrder(
  po: PurchaseOrder,
  reason: string,
  actor: UserProfile
): Promise<PurchaseOrder> {
  if (!reason || reason.trim().length === 0) {
    throw new Error('A cancellation reason is required.');
  }
  const now = new Date().toISOString();

  // If partially invoiced, close unused remainder rather than pretending past expenditure never existed
  const isPartiallyInvoiced = po.invoicedGrossPence > 0;
  const updatedStatus = isPartiallyInvoiced ? 'Closed' : 'Cancelled';

  const updatedPO: PurchaseOrder = {
    ...po,
    status: updatedStatus,
    remainingAuthorisedGrossPence: 0,
    cancellationReason: reason.trim(),
    cancelledByUid: actor.uid,
    cancelledAt: now,
    updatedAt: now
  };

  try {
    await updateDoc(doc(db, 'purchase_orders', po.id), updatedPO as any);
  } catch (e) {}

  return updatedPO;
}

export async function recordMaterialReceipt(
  po: PurchaseOrder,
  receipt: {
    type: 'All received' | 'Part received' | 'Issue with delivery';
    receivedDate: string;
    note?: string;
    deliveryNoteUrl?: string;
    itemsReceived?: { itemId: string; quantity: number }[];
  },
  currentUser: UserProfile
): Promise<PurchaseOrder> {
  const now = new Date().toISOString();
  const receiptList = po.receivedMaterials || [];
  const newReceipt: MaterialReceiptRecord = {
    id: `rcpt-${Date.now()}`,
    receivedDate: receipt.receivedDate || now.slice(0, 10),
    recordedByUid: currentUser.uid,
    recordedByName: currentUser.fullName,
    type: receipt.type,
    note: receipt.note,
    deliveryNoteUrl: receipt.deliveryNoteUrl,
    itemsReceived: receipt.itemsReceived,
    recordedAt: now
  };

  receiptList.push(newReceipt);

  const updatedPO: PurchaseOrder = {
    ...po,
    status: receipt.type === 'All received' ? 'Fulfilled' : 'Part Fulfilled',
    receivedMaterials: receiptList,
    updatedAt: now
  };

  try {
    await updateDoc(doc(db, 'purchase_orders', po.id), updatedPO as any);
  } catch (e) {}

  return updatedPO;
}

/* ========================================================= */
/* SUPPLIER INVOICES, MATCHING & POSTING                     */
/* ========================================================= */

/**
 * Check for potential duplicate supplier invoice:
 * Normalised number + supplier + date + amount
 */
export function checkDuplicateSupplierInvoice(
  existingInvoices: SupplierInvoice[],
  candidate: {
    supplierId: string;
    supplierInvoiceNumber: string;
    invoiceDate: string;
    grossAmountPence: number;
    id?: string;
  }
): { isDuplicate: boolean; matchedInvoice?: SupplierInvoice; reason?: string } {
  const normCandidate = normalizeInvoiceNumber(candidate.supplierInvoiceNumber);

  for (const inv of existingInvoices) {
    if (candidate.id && inv.id === candidate.id) continue;
    if (inv.supplierId !== candidate.supplierId) continue;

    const normExisting = normalizeInvoiceNumber(inv.supplierInvoiceNumber);
    if (normCandidate && normExisting && normCandidate === normExisting) {
      return {
        isDuplicate: true,
        matchedInvoice: inv,
        reason: `Matching invoice number "${inv.supplierInvoiceNumber}" already exists for this supplier.`
      };
    }

    if (inv.invoiceDate === candidate.invoiceDate && inv.grossAmountPence === candidate.grossAmountPence) {
      return {
        isDuplicate: true,
        matchedInvoice: inv,
        reason: `Duplicate detected: Same supplier, date (${inv.invoiceDate}) and gross amount (${formatPence(inv.grossAmountPence)}).`
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Cross-module check: verify if the purchase was already claimed
 * by a contractor as an out-of-pocket expense in Stage 5.
 */
export function checkCrossModuleExpenseOverlap(
  candidate: {
    invoiceDate: string;
    grossAmountPence: number;
    supplierName: string;
  },
  claims: any[] = []
): { isFlagged: boolean; matchedExpense?: any; reason?: string } {
  for (const claim of claims) {
    if (!claim.expenses) continue;
    for (const exp of claim.expenses) {
      const sameDate = exp.date === candidate.invoiceDate;
      const sameAmount = Math.abs(exp.amountPence - candidate.grossAmountPence) < 50; // within 50p
      const descMatch = (exp.merchant || exp.description || '').toLowerCase().includes(candidate.supplierName.toLowerCase().slice(0, 5));

      if ((sameDate && sameAmount) || (sameAmount && descMatch)) {
        return {
          isFlagged: true,
          matchedExpense: exp,
          reason: `Potential double-claiming: An expense of ${formatPence(exp.amountPence)} on ${exp.date} (${exp.merchant || exp.description}) was already submitted by contractor ${claim.contractorName || 'contractor'}.`
        };
      }
    }
  }
  return { isFlagged: false };
}

export async function createSupplierInvoice(
  data: {
    supplierId: string;
    supplierName: string;
    supplierInvoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    paymentTermsDays?: number;
    netAmountPence: number;
    vatAmountPence: number;
    grossAmountPence: number;
    vatTreatment: string;
    invoiceFileUrl?: string;
    invoiceFileName?: string;
    description?: string;
    poAllocations: POAllocation[];
    projectAllocations: ProjectAllocation[];
    hasException?: boolean;
    exceptionReason?: string;
  },
  currentUser: UserProfile,
  existingInvoices: SupplierInvoice[] = [],
  purchaseOrders: PurchaseOrder[] = [],
  claims: any[] = []
): Promise<SupplierInvoice> {
  // 0. Mandatory identity validation
  if (!data.supplierInvoiceNumber || data.supplierInvoiceNumber.trim().length === 0) {
    throw new Error('Supplier invoice number is mandatory.');
  }
  if (!data.invoiceDate || data.invoiceDate.trim().length === 0) {
    throw new Error('Invoice date is mandatory.');
  }

  // 1. Validation: Project allocations sum must balance gross amount exactly
  const totalAllocatedPence = data.projectAllocations.reduce((sum, p) => sum + p.allocatedGrossPence, 0);
  if (totalAllocatedPence !== data.grossAmountPence) {
    throw new Error(`Project allocation total (${formatPence(totalAllocatedPence)}) must equal invoice gross amount (${formatPence(data.grossAmountPence)}) exactly.`);
  }

  // 2. Headroom validation against matched POs
  let hasException = data.hasException || false;
  let exceptionReason = data.exceptionReason;

  for (const alloc of data.poAllocations) {
    const po = purchaseOrders.find(p => p.id === alloc.poId);
    if (po) {
      if (alloc.allocatedGrossPence > po.remainingAuthorisedGrossPence) {
        if (!hasException) {
          throw new Error(
            `Invoice allocation (${formatPence(alloc.allocatedGrossPence)}) exceeds PO ${po.poReference} remaining headroom (${formatPence(po.remainingAuthorisedGrossPence)}). An authorized PO amendment or documented exception is required.`
          );
        }
      }
    }
  }

  // 3. Duplicate invoice check
  const dupCheck = checkDuplicateSupplierInvoice(existingInvoices, {
    supplierId: data.supplierId,
    supplierInvoiceNumber: data.supplierInvoiceNumber,
    invoiceDate: data.invoiceDate,
    grossAmountPence: data.grossAmountPence
  });
  if (dupCheck.isDuplicate) {
    throw new Error(dupCheck.reason || 'Duplicate invoice detected for this supplier.');
  }

  // 4. Cross module check against contractor claims
  const crossCheck = checkCrossModuleExpenseOverlap(
    {
      invoiceDate: data.invoiceDate,
      grossAmountPence: data.grossAmountPence,
      supplierName: data.supplierName
    },
    claims
  );

  const now = new Date().toISOString();
  const invoice: SupplierInvoice = {
    id: `sinv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    supplierId: data.supplierId,
    supplierName: data.supplierName,
    supplierInvoiceNumber: data.supplierInvoiceNumber,
    normalizedInvoiceNumber: normalizeInvoiceNumber(data.supplierInvoiceNumber),
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate || data.invoiceDate,
    paymentTermsDays: data.paymentTermsDays || 30,
    netAmountPence: data.netAmountPence,
    vatAmountPence: data.vatAmountPence,
    grossAmountPence: data.grossAmountPence,
    vatTreatment: data.vatTreatment,
    invoiceFileUrl: data.invoiceFileUrl,
    invoiceFileName: data.invoiceFileName,
    description: data.description,
    poAllocations: data.poAllocations,
    projectAllocations: data.projectAllocations,
    hasException,
    exceptionReason,
    status: 'Awaiting Review',
    paymentStatus: 'Unpaid',
    totalPaidPence: 0,
    outstandingPence: data.grossAmountPence,
    totalCreditsAppliedPence: 0,
    duplicateCheckHash: `${data.supplierId}_${normalizeInvoiceNumber(data.supplierInvoiceNumber)}_${data.grossAmountPence}`,
    crossModuleCheck: crossCheck.isFlagged ? {
      isFlagged: true,
      reason: crossCheck.reason,
      matchedExpenseId: crossCheck.matchedExpense?.id
    } : undefined,
    createdAt: now,
    updatedAt: now
  };

  try {
    await setDoc(doc(db, 'supplier_invoices', invoice.id), invoice);
  } catch (e) {}

  return invoice;
}

/**
 * Approve & Post a Supplier Invoice.
 * Converts invoice into an immutable accounting snapshot and reduces PO headroom.
 */
export async function postSupplierInvoice(
  invoice: SupplierInvoice,
  reviewer: UserProfile,
  purchaseOrders: PurchaseOrder[] = []
): Promise<{ invoice: SupplierInvoice; updatedPOs: PurchaseOrder[] }> {
  const isAuthorized = reviewer.role === 'Owner' || reviewer.role === 'Admin' || reviewer.role === 'Accounts';
  if (!isAuthorized) {
    throw new Error('Only Accounts or Owner/Admin users possess authority to post supplier invoices.');
  }

  const now = new Date().toISOString();
  const updatedPOs: PurchaseOrder[] = [];

  // Update matched POs
  for (const alloc of invoice.poAllocations) {
    const po = purchaseOrders.find(p => p.id === alloc.poId);
    if (po) {
      const nextInvoiced = po.invoicedGrossPence + alloc.allocatedGrossPence;
      const nextRemaining = Math.max(0, po.authorisedGrossPence - nextInvoiced);
      const updatedPO: PurchaseOrder = {
        ...po,
        invoicedGrossPence: nextInvoiced,
        remainingAuthorisedGrossPence: nextRemaining,
        status: nextRemaining === 0 ? 'Fulfilled' : po.status,
        updatedAt: now
      };
      updatedPOs.push(updatedPO);
      try {
        await updateDoc(doc(db, 'purchase_orders', po.id), updatedPO as any);
      } catch (e) {}
    }
  }

  const postedInvoice: SupplierInvoice = {
    ...invoice,
    status: 'Approved',
    reviewedByUid: reviewer.uid,
    reviewedByName: reviewer.fullName,
    reviewedAt: now,
    postedAt: now,
    snapshotLockedAt: now,
    updatedAt: now
  };

  try {
    await updateDoc(doc(db, 'supplier_invoices', postedInvoice.id), postedInvoice as any);
  } catch (e) {}

  return { invoice: postedInvoice, updatedPOs };
}

/* ========================================================= */
/* SUPPLIER CREDIT NOTES                                     */
/* ========================================================= */

export async function createSupplierCreditNote(
  data: {
    supplierId: string;
    supplierName: string;
    creditNoteNumber: string;
    date: string;
    netAmountPence: number;
    vatAmountPence: number;
    grossAmountPence: number;
    originalInvoiceId?: string;
    originalInvoiceNumber?: string;
    poId?: string;
    poReference?: string;
    projectId: string;
    projectReference: string;
    creditEffect: 'reduces_order' | 'replacement_expected' | 'adjustment';
    reason: string;
    fileUrl?: string;
    appliedToInvoiceId?: string;
  },
  currentUser: UserProfile,
  existingInvoices: SupplierInvoice[] = [],
  purchaseOrders: PurchaseOrder[] = []
): Promise<{ creditNote: SupplierCreditNote; updatedInvoice?: SupplierInvoice; updatedPO?: PurchaseOrder }> {
  if (!data.creditNoteNumber || data.creditNoteNumber.trim().length === 0) {
    throw new Error('Credit Note number is mandatory.');
  }
  if (!data.grossAmountPence || data.grossAmountPence <= 0) {
    throw new Error('Credit Note amount must be greater than £0.00.');
  }

  const now = new Date().toISOString();
  let updatedInvoice: SupplierInvoice | undefined = undefined;
  let updatedPO: PurchaseOrder | undefined = undefined;

  // If applied to invoice, adjust payable balance
  if (data.appliedToInvoiceId) {
    const inv = existingInvoices.find(i => i.id === data.appliedToInvoiceId);
    if (inv) {
      if (data.grossAmountPence > inv.outstandingPence) {
        throw new Error(`Credit Note amount (${formatPence(data.grossAmountPence)}) exceeds invoice outstanding balance (${formatPence(inv.outstandingPence)}).`);
      }
      const newCredits = (inv.totalCreditsAppliedPence || 0) + data.grossAmountPence;
      const newOutstanding = Math.max(0, inv.grossAmountPence - inv.totalPaidPence - newCredits);
      updatedInvoice = {
        ...inv,
        totalCreditsAppliedPence: newCredits,
        outstandingPence: newOutstanding,
        paymentStatus: newOutstanding === 0 ? 'Paid' : 'Part Paid',
        updatedAt: now
      };
      try {
        await updateDoc(doc(db, 'supplier_invoices', inv.id), updatedInvoice as any);
      } catch (e) {}
    }
  }

  // If creditEffect is 'reduces_order' and PO is linked, adjust PO commitment
  if (data.poId && data.creditEffect === 'reduces_order') {
    const po = purchaseOrders.find(p => p.id === data.poId);
    if (po) {
      const nextRemaining = Math.max(0, po.remainingAuthorisedGrossPence - data.grossAmountPence);
      updatedPO = {
        ...po,
        remainingAuthorisedGrossPence: nextRemaining,
        updatedAt: now
      };
      try {
        await updateDoc(doc(db, 'purchase_orders', po.id), updatedPO as any);
      } catch (e) {}
    }
  }

  const creditNote: SupplierCreditNote = {
    id: `scn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...data,
    recordedByUid: currentUser.uid,
    recordedByName: currentUser.fullName,
    createdAt: now
  };

  try {
    await setDoc(doc(db, 'supplier_credit_notes', creditNote.id), creditNote);
  } catch (e) {}

  return { creditNote, updatedInvoice, updatedPO };
}

/* ========================================================= */
/* SUPPLIER PAYMENT RECORDING                                */
/* ========================================================= */

export async function recordSupplierPayment(
  data: {
    supplierId: string;
    supplierName: string;
    paymentDate: string;
    amountPence: number;
    paymentReference: string;
    internalNote?: string;
    invoiceAllocations: { invoiceId: string; invoiceNumber: string; amountPence: number }[];
  },
  currentUser: UserProfile,
  existingPayments: SupplierPaymentRecord[] = [],
  invoices: SupplierInvoice[] = []
): Promise<{ payment: SupplierPaymentRecord; updatedInvoices: SupplierInvoice[] }> {
  // 1. Duplicate reference check (idempotency on retry)
  const isDuplicateRef = existingPayments.some(
    p => !p.isReversal && p.supplierId === data.supplierId && p.paymentReference.trim().toLowerCase() === data.paymentReference.trim().toLowerCase()
  );
  if (isDuplicateRef) {
    throw new Error(`Payment with reference "${data.paymentReference}" has already been recorded for this supplier.`);
  }

  // 2. Sum check: allocations must match total amount exactly
  const sumAlloc = data.invoiceAllocations.reduce((sum, a) => sum + a.amountPence, 0);
  if (sumAlloc !== data.amountPence) {
    throw new Error(`Sum of invoice allocations (${formatPence(sumAlloc)}) does not match payment total (${formatPence(data.amountPence)}).`);
  }

  const now = new Date().toISOString();
  const updatedInvoices: SupplierInvoice[] = [];

  // 3. Overpayment check
  for (const alloc of data.invoiceAllocations) {
    const inv = invoices.find(i => i.id === alloc.invoiceId);
    if (!inv) throw new Error(`Invoice ID ${alloc.invoiceId} not found.`);
    if (alloc.amountPence > inv.outstandingPence) {
      throw new Error(`Payment allocation (${formatPence(alloc.amountPence)}) exceeds invoice ${inv.supplierInvoiceNumber} outstanding balance (${formatPence(inv.outstandingPence)}).`);
    }

    const nextPaid = inv.totalPaidPence + alloc.amountPence;
    const nextOutstanding = Math.max(0, inv.grossAmountPence - nextPaid - (inv.totalCreditsAppliedPence || 0));
    const nextStatus = nextOutstanding === 0 ? 'Paid' : 'Part Paid';

    const updatedInv: SupplierInvoice = {
      ...inv,
      totalPaidPence: nextPaid,
      outstandingPence: nextOutstanding,
      paymentStatus: nextStatus,
      updatedAt: now
    };
    updatedInvoices.push(updatedInv);
    try {
      await updateDoc(doc(db, 'supplier_invoices', inv.id), updatedInv as any);
    } catch (e) {}
  }

  const payment: SupplierPaymentRecord = {
    id: `spay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    supplierId: data.supplierId,
    supplierName: data.supplierName,
    paymentDate: data.paymentDate,
    amountPence: data.amountPence,
    paymentReference: data.paymentReference,
    internalNote: data.internalNote,
    invoiceAllocations: data.invoiceAllocations,
    recordedByUid: currentUser.uid,
    recordedByName: currentUser.fullName,
    isReversal: false,
    createdAt: now
  };

  try {
    await setDoc(doc(db, 'supplier_payments', payment.id), payment);
  } catch (e) {}

  return { payment, updatedInvoices };
}

export async function reverseSupplierPayment(
  paymentId: string,
  reason: string,
  actor: UserProfile,
  payments: SupplierPaymentRecord[] = [],
  invoices: SupplierInvoice[] = []
): Promise<{ reversal: SupplierPaymentRecord; updatedInvoices: SupplierInvoice[] }> {
  const original = payments.find(p => p.id === paymentId);
  if (!original) throw new Error(`Payment ${paymentId} not found.`);
  if (original.isReversal) throw new Error('Cannot reverse a payment that is already a reversal.');

  const now = new Date().toISOString();
  const updatedInvoices: SupplierInvoice[] = [];

  for (const alloc of original.invoiceAllocations) {
    const inv = invoices.find(i => i.id === alloc.invoiceId);
    if (inv) {
      const nextPaid = Math.max(0, inv.totalPaidPence - alloc.amountPence);
      const nextOutstanding = Math.max(0, inv.grossAmountPence - nextPaid - (inv.totalCreditsAppliedPence || 0));
      const nextStatus = nextPaid === 0 ? 'Unpaid' : 'Part Paid';

      const updatedInv: SupplierInvoice = {
        ...inv,
        totalPaidPence: nextPaid,
        outstandingPence: nextOutstanding,
        paymentStatus: nextStatus,
        updatedAt: now
      };
      updatedInvoices.push(updatedInv);
      try {
        await updateDoc(doc(db, 'supplier_invoices', inv.id), updatedInv as any);
      } catch (e) {}
    }
  }

  const reversal: SupplierPaymentRecord = {
    id: `spay-rev-${Date.now()}`,
    supplierId: original.supplierId,
    supplierName: original.supplierName,
    paymentDate: now.slice(0, 10),
    amountPence: -original.amountPence,
    paymentReference: `REV-${original.paymentReference}`,
    internalNote: `Reversal: ${reason}`,
    invoiceAllocations: original.invoiceAllocations.map(a => ({ ...a, amountPence: -a.amountPence })),
    recordedByUid: actor.uid,
    recordedByName: actor.fullName,
    isReversal: true,
    reversesPaymentId: original.id,
    reversalReason: reason,
    createdAt: now
  };

  try {
    await setDoc(doc(db, 'supplier_payments', reversal.id), reversal);
  } catch (e) {}

  return { reversal, updatedInvoices };
}

/* ========================================================= */
/* PROJECT MATERIALS COSTS & COMMITMENTS                     */
/* ========================================================= */

/**
 * Calculates Project Materials Cost Breakdown (Section 18):
 * - Pending requests: submitted, not approved
 * - Open commitments: issued POs remaining authorised headroom
 * - Posted invoices: approved & posted supplier invoices allocated to this project
 * - Credits: credit notes allocated to this project
 * - Net materials cost: postedInvoices - postedCredits
 * - Total committed & actual: netMaterialsCost + openCommitments
 * - Invoiced paid & outstanding
 * - isDefinitiveCost: false (labelled incomplete until subcontract/variations implemented)
 */
export function calculateProjectMaterialsCost(
  projectId: string,
  requests: MaterialsRequest[] = [],
  purchaseOrders: PurchaseOrder[] = [],
  invoices: SupplierInvoice[] = [],
  creditNotes: SupplierCreditNote[] = []
): ProjectMaterialsCost {
  // 1. Pending requests
  const pendingRequestsPence = requests
    .filter(r => r.projectId === projectId && r.status === 'Submitted')
    .reduce((sum, r) => sum + r.grossAmountPence, 0);

  // 2. Open commitments (remaining headroom on active POs for this project)
  const openCommitmentsPence = purchaseOrders
    .filter(po => po.projectId === projectId && (po.status === 'Issued' || po.status === 'Part Fulfilled'))
    .reduce((sum, po) => sum + po.remainingAuthorisedGrossPence, 0);

  // 3. Posted invoices allocated to this project
  let postedInvoicesPence = 0;
  let invoicedPaidPence = 0;
  let invoicedOutstandingPence = 0;

  for (const inv of invoices) {
    if (inv.status !== 'Approved') continue; // Only posted invoices count as actual cost!
    for (const alloc of inv.projectAllocations) {
      if (alloc.projectId === projectId) {
        postedInvoicesPence += alloc.allocatedGrossPence;
        // calculate proportional payment
        const ratio = inv.grossAmountPence > 0 ? (alloc.allocatedGrossPence / inv.grossAmountPence) : 0;
        invoicedPaidPence += Math.round(inv.totalPaidPence * ratio);
        invoicedOutstandingPence += Math.round(inv.outstandingPence * ratio);
      }
    }
  }

  // 4. Credits allocated to this project
  const postedCreditsPence = creditNotes
    .filter(cn => cn.projectId === projectId)
    .reduce((sum, cn) => sum + cn.grossAmountPence, 0);

  const netMaterialsCostPence = Math.max(0, postedInvoicesPence - postedCreditsPence);
  const totalCommittedAndActualPence = netMaterialsCostPence + openCommitmentsPence;

  return {
    projectId,
    projectReference: requests[0]?.projectReference || purchaseOrders[0]?.projectReference || 'GVD-PRJ',
    pendingRequestsPence,
    openCommitmentsPence,
    postedInvoicesPence,
    postedCreditsPence,
    netMaterialsCostPence,
    totalCommittedAndActualPence,
    invoicedPaidPence,
    invoicedOutstandingPence,
    isDefinitiveCost: false // Incomplete: subcontract orders & variations pending in later stages!
  };
}
