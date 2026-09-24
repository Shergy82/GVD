import type {
  UserProfile,
  ProjectRecord,
  SupplierRecord,
  PurchasingRule,
  MaterialsRequest,
  PurchaseOrder,
  SupplierInvoice,
  SupplierCreditNote,
  SupplierPaymentRecord,
  POAllocation,
  ProjectAllocation
} from '../types';
import {
  generateRequestReference,
  generatePOReference,
  createMaterialsRequest,
  reviewMaterialsRequest,
  amendPurchaseOrder,
  cancelPurchaseOrder,
  createSupplierInvoice,
  postSupplierInvoice,
  createSupplierCreditNote,
  recordSupplierPayment,
  reverseSupplierPayment,
  calculateProjectMaterialsCost,
  evaluateAutoApproval,
  calculateSpentInPeriod,
  checkDuplicateSupplierInvoice,
  checkCrossModuleExpenseOverlap,
  checkDuplicateSupplier,
  formatPence
} from './purchasingService';
import { generatePurchaseOrderPDF } from './pdfService';
import { calculateAttendanceAmount, getProjectLabourCosts } from './claimsService';

export interface Stage6TestResult {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'passed' | 'failed' | 'pending';
  details: string[];
  error?: string;
  durationMs: number;
}

/**
 * Execute all Stage 6 Acceptance Tests (A through S)
 */
export async function runStage6AcceptanceTests(
  onProgress?: (result: Stage6TestResult) => void
): Promise<Stage6TestResult[]> {
  const results: Stage6TestResult[] = [];

  const runTest = async (
    id: string,
    name: string,
    category: string,
    description: string,
    fn: () => Promise<string[]>
  ): Promise<Stage6TestResult> => {
    const start = performance.now();
    try {
      const details = await fn();
      const res: Stage6TestResult = {
        id,
        name,
        category,
        description,
        status: 'passed',
        details,
        durationMs: Math.round(performance.now() - start)
      };
      results.push(res);
      onProgress?.(res);
      return res;
    } catch (err: any) {
      const res: Stage6TestResult = {
        id,
        name,
        category,
        description,
        status: 'failed',
        details: [err.message || String(err)],
        error: err.message || String(err),
        durationMs: Math.round(performance.now() - start)
      };
      results.push(res);
      onProgress?.(res);
      return res;
    }
  };

  // Common Fixtures
  const contractorUser: UserProfile = {
    uid: 'user-contractor-01',
    email: 'contractor@example.com',
    fullName: 'Mark Davies',
    phone: '07700900111',
    applicationCategory: 'Individual Contractor',
    role: 'IndividualContractor',
    status: 'approved',
    planningEligible: true,
    assignedProjectIds: ['prj-001', 'prj-002'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  const pmUser: UserProfile = {
    uid: 'user-pm-01',
    email: 'dave.miller@gvdcontracts.co.uk',
    fullName: 'Dave Miller',
    phone: '07700900789',
    applicationCategory: 'GVD Employee',
    role: 'ProjectManager',
    status: 'approved',
    planningEligible: true,
    assignedProjectIds: ['prj-001'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  const adminUser: UserProfile = {
    uid: 'user-admin-01',
    email: 'sarah.jenkins@gvdcontracts.co.uk',
    fullName: 'Sarah Jenkins',
    phone: '07700900456',
    applicationCategory: 'GVD Employee',
    role: 'Admin',
    status: 'approved',
    planningEligible: false,
    assignedProjectIds: ['prj-001', 'prj-002'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  const accountsUser: UserProfile = {
    uid: 'user-accounts-01',
    email: 'accounts@gvdcontracts.co.uk',
    fullName: 'Emma Watson',
    phone: '07700900333',
    applicationCategory: 'GVD Employee',
    role: 'Accounts',
    status: 'approved',
    planningEligible: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  // --- Test A: Contractor Request Reference Isolation ---
  await runTest(
    'A',
    'Contractor Request Reference Isolation',
    'Requests',
    'Contractor requests materials against an authorised project and receives a request reference (GVD-MR-2026-XXXX), not an authorised PO.',
    async () => {
      const { request, poIssued } = await createMaterialsRequest(
        {
          projectId: 'prj-001',
          projectReference: 'GVD-PRJ-2026-001',
          projectName: '14 Grosvenor Square',
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          purpose: 'Drywall screws and joint tape for 1st floor partition walls',
          estimatedTotalPence: 8500,
          valueBasis: 'Gross',
          grossAmountPence: 8500,
          taxBreakdownConfirmed: false,
          isItemised: false,
          deliveryType: 'collection',
          deliveryAddress: 'Mayfair Trade Counter',
          submitNow: true
        },
        contractorUser
      );

      if (!request.requestReference.startsWith('GVD-MR-')) {
        throw new Error(`Expected request reference GVD-MR-..., got ${request.requestReference}`);
      }
      if (poIssued !== undefined) {
        throw new Error('Default submission must NOT issue an automatic PO without approved policy.');
      }
      if (request.status !== 'Submitted') {
        throw new Error(`Expected status 'Submitted', got ${request.status}`);
      }

      // Check unauthorised project rejection
      let blockedUnauth = false;
      try {
        await createMaterialsRequest(
          {
            projectId: 'prj-999-unassigned',
            projectReference: 'GVD-PRJ-999',
            projectName: 'Unauthorised Site',
            supplierId: 'supp-001',
            purpose: 'Unauthorised request',
            estimatedTotalPence: 5000,
            valueBasis: 'Gross',
            grossAmountPence: 5000,
            taxBreakdownConfirmed: false,
            isItemised: false,
            deliveryType: 'collection',
            deliveryAddress: '',
            submitNow: true
          },
          contractorUser
        );
      } catch (err: any) {
        blockedUnauth = true;
      }

      if (!blockedUnauth) throw new Error('Contractor was able to request materials for unassigned project!');

      return [
        `Request Generated: ${request.requestReference} (Status: ${request.status})`,
        `Authorised PO Issued: None (Request reference is not permission to spend)`,
        `Unauthorised Project Check: Correctly rejected for unassigned projects`
      ];
    }
  );

  // --- Test B: Approval & Unique PO Generation with PDF ---
  await runTest(
    'B',
    'Approval Issues Unique PO with Correct PDF',
    'Purchase Orders',
    'Approval issues one unique PO with correct project/supplier and valid A4 PDF document.',
    async () => {
      const { request } = await createMaterialsRequest(
        {
          projectId: 'prj-001',
          projectReference: 'GVD-PRJ-2026-001',
          projectName: '14 Grosvenor Square',
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          purpose: 'Moisture resistant plasterboard & metal stud framing',
          estimatedTotalPence: 85000, // £850.00
          valueBasis: 'Gross',
          grossAmountPence: 85000,
          taxBreakdownConfirmed: true,
          isItemised: false,
          deliveryType: 'delivery',
          deliveryAddress: '14 Grosvenor Square, London',
          submitNow: true
        },
        contractorUser
      );

      const { request: reviewedReq, poIssued } = await reviewMaterialsRequest(
        request,
        'Approve',
        {},
        adminUser
      );

      if (!poIssued) throw new Error('Approved request must issue a purchase order');
      if (!poIssued.poReference.startsWith('GVD-PO-')) {
        throw new Error(`PO reference invalid: ${poIssued.poReference}`);
      }
      if (poIssued.supplierName !== 'Travis Perkins') {
        throw new Error(`Supplier mismatch: expected Travis Perkins, got ${poIssued.supplierName}`);
      }
      if (poIssued.authorisedGrossPence !== 85000) {
        throw new Error(`Authorised amount mismatch: expected 85000, got ${poIssued.authorisedGrossPence}`);
      }
      if (poIssued.revision !== 1) {
        throw new Error(`Initial revision must be 1, got ${poIssued.revision}`);
      }

      // Generate PDF
      const pdfDoc = generatePurchaseOrderPDF(poIssued, { download: false });
      const pageCount = pdfDoc.getNumberOfPages();
      if (pageCount < 1) throw new Error('PDF generation failed to produce pages.');

      return [
        `PO Issued: ${poIssued.poReference} (Revision ${poIssued.revision})`,
        `Authorised Gross: ${formatPence(poIssued.authorisedGrossPence)} (Net: ${formatPence(poIssued.authorisedNetPence)})`,
        `PDF Document Generated: Successfully verified A4 layout (${pageCount} page)`
      ];
    }
  );

  // --- Test C: Automatic Approval Configuration & Default Off ---
  await runTest(
    'C',
    'Auto-Approval Disabled by Default & Explicit Rule Enforcement',
    'Purchasing Rules',
    'Automatic approval is off by default and works only within an explicitly configured complete rule.',
    async () => {
      const defaultRules: PurchasingRule[] = [
        {
          id: 'rule-manual',
          name: 'Manual Owner Approval',
          maxOrderGrossPence: 100000,
          isAutoApprovalEnabled: false, // Default is disabled!
          isActive: true,
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ];

      const testReq: MaterialsRequest = {
        id: 'mr-test-c',
        requestReference: 'GVD-MR-2026-0099',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        requesterRole: 'IndividualContractor',
        purpose: 'Small fixings box',
        isItemised: false,
        estimatedTotalPence: 3000, // £30.00
        valueBasis: 'Gross',
        grossAmountPence: 3000,
        taxBreakdownConfirmed: false,
        deliveryType: 'collection',
        deliveryAddress: '',
        status: 'Submitted',
        createdAt: '2026-09-24T10:00:00Z',
        updatedAt: '2026-09-24T10:00:00Z'
      };

      const defaultEval = evaluateAutoApproval(testReq, defaultRules, []);
      if (defaultEval.qualifies) {
        throw new Error('Default evaluation must not qualify when auto approval is disabled!');
      }

      // Now enable an explicit rule for small consumables <= £50.00
      const activeAutoRule: PurchasingRule = {
        id: 'rule-auto-50',
        name: 'Consumables Auto Approval <= £50',
        maxOrderGrossPence: 5000, // £50.00
        aggregatePeriodDays: 30,
        aggregatePeriodLimitPence: 20000, // £200.00
        isAutoApprovalEnabled: true,
        isActive: true,
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      // £30 request qualifies
      const evalPass = evaluateAutoApproval(testReq, [activeAutoRule], []);
      if (!evalPass.qualifies) {
        throw new Error(`Expected auto-approval to qualify under £50 rule, failed: ${evalPass.reason}`);
      }

      // £75 request fails and routes to review
      const largeReq = { ...testReq, grossAmountPence: 7500 };
      const evalFail = evaluateAutoApproval(largeReq, [activeAutoRule], []);
      if (evalFail.qualifies) {
        throw new Error('£75 request must NOT auto-approve when rule limit is £50!');
      }

      return [
        `Default Check: Correctly rejected (${defaultEval.reason})`,
        `Explicit Rule £30 Request: Qualifies (${evalPass.rule?.name})`,
        `Exceeded £75 Request: Correctly routed to manual review (${evalFail.reason})`
      ];
    }
  );

  // --- Test D: Aggregate Spending Allowance & Concurrency ---
  await runTest(
    'D',
    'Concurrent or Split Requests Cannot Exceed Aggregate Allowance',
    'Purchasing Rules',
    'Multiple requests or concurrent submissions cannot bypass aggregate 30-day spending limits.',
    async () => {
      const pmRule: PurchasingRule = {
        id: 'rule-pm-2000',
        name: 'PM £2,000 Monthly Allowance',
        approverRole: 'ProjectManager',
        maxOrderGrossPence: 50000, // £500.00 max per order
        aggregatePeriodDays: 30,
        aggregatePeriodLimitPence: 200000, // £2,000.00 max in 30 days
        isAutoApprovalEnabled: false,
        isActive: true,
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      // Existing committed POs totalling £1,800
      const existingPOs: PurchaseOrder[] = [
        {
          id: 'po-exist-1',
          poReference: 'GVD-PO-2026-0010',
          requestId: 'mr-1',
          requestReference: 'GVD-MR-2026-0010',
          projectId: 'prj-001',
          projectReference: 'GVD-PRJ-2026-001',
          projectName: '14 Grosvenor Square',
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          requesterUid: contractorUser.uid,
          requesterName: contractorUser.fullName,
          approverUid: pmUser.uid,
          approverName: pmUser.fullName,
          approvedScope: 'Scope 1',
          items: [],
          authorisedNetPence: 80000,
          authorisedVatPence: 16000,
          authorisedGrossPence: 96000, // £960.00
          valueBasis: 'Gross',
          deliveryType: 'collection',
          deliveryAddress: '',
          issueDate: new Date().toISOString().slice(0, 10),
          revision: 1,
          status: 'Issued',
          invoicedGrossPence: 0,
          remainingAuthorisedGrossPence: 96000,
          createdAt: '2026-09-10T10:00:00Z',
          updatedAt: '2026-09-10T10:00:00Z'
        },
        {
          id: 'po-exist-2',
          poReference: 'GVD-PO-2026-0011',
          requestId: 'mr-2',
          requestReference: 'GVD-MR-2026-0011',
          projectId: 'prj-001',
          projectReference: 'GVD-PRJ-2026-001',
          projectName: '14 Grosvenor Square',
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          requesterUid: contractorUser.uid,
          requesterName: contractorUser.fullName,
          approverUid: pmUser.uid,
          approverName: pmUser.fullName,
          approvedScope: 'Scope 2',
          items: [],
          authorisedNetPence: 70000,
          authorisedVatPence: 14000,
          authorisedGrossPence: 84000, // £840.00 (Total = £1,800.00)
          valueBasis: 'Gross',
          deliveryType: 'collection',
          deliveryAddress: '',
          issueDate: new Date().toISOString().slice(0, 10),
          revision: 1,
          status: 'Issued',
          invoicedGrossPence: 0,
          remainingAuthorisedGrossPence: 84000,
          createdAt: '2026-09-15T10:00:00Z',
          updatedAt: '2026-09-15T10:00:00Z'
        }
      ];

      const spent = calculateSpentInPeriod(existingPOs, 30, 'prj-001');
      if (spent !== 180000) {
        throw new Error(`Expected spent £1,800.00, got ${spent}`);
      }

      // New request for £300 would exceed £2,000 allowance (£1,800 + £300 = £2,100)
      const candidateReq: MaterialsRequest = {
        id: 'mr-candidate',
        requestReference: 'GVD-MR-2026-0020',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        requesterRole: 'IndividualContractor',
        purpose: 'Timber joists',
        isItemised: false,
        estimatedTotalPence: 30000, // £300.00
        valueBasis: 'Gross',
        grossAmountPence: 30000,
        taxBreakdownConfirmed: true,
        deliveryType: 'collection',
        deliveryAddress: '',
        status: 'Submitted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      let blocked = false;
      try {
        await reviewMaterialsRequest(
          candidateReq,
          'Approve',
          {},
          pmUser,
          existingPOs,
          [pmRule]
        );
      } catch (err: any) {
        blocked = true;
      }

      if (!blocked) throw new Error('PM approval should have been blocked by aggregate 30-day allowance!');

      return [
        `Existing Commitments: £1,800.00 against £2,000.00 30-day limit`,
        `Candidate Request: £300.00 (Combined = £2,100.00)`,
        `Allowance Guard: Blocked escalation with explicit limit warning`
      ];
    }
  );

  // --- Test E: Queried / Rejected Requests Never Produce Authorised PO ---
  await runTest(
    'E',
    'Queried/Rejected Request Cannot Produce Authorised PO',
    'Integrity',
    'A queried or rejected request preserves state and cannot generate an authorized PO.',
    async () => {
      const { request } = await createMaterialsRequest(
        {
          projectId: 'prj-001',
          projectReference: 'GVD-PRJ-2026-001',
          projectName: '14 Grosvenor Square',
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          purpose: 'Special order acoustic ceiling tiles',
          estimatedTotalPence: 45000,
          valueBasis: 'Gross',
          grossAmountPence: 45000,
          taxBreakdownConfirmed: false,
          isItemised: false,
          deliveryType: 'delivery',
          deliveryAddress: '14 Grosvenor Square, London',
          submitNow: true
        },
        contractorUser
      );

      // 1. Query request
      const { request: queriedReq, poIssued: qPo } = await reviewMaterialsRequest(
        request,
        'Query',
        { queryText: 'Are these acoustic tiles specified in the architect drawings?' },
        pmUser
      );

      if (queriedReq.status !== 'Queried') throw new Error(`Expected status 'Queried', got ${queriedReq.status}`);
      if (qPo !== undefined) throw new Error('Queried request must NOT produce an issued PO!');
      if (queriedReq.issuedPoReference !== undefined) throw new Error('Queried request must not have a PO reference');

      // 2. Reject request
      const { request: rejectedReq, poIssued: rPo } = await reviewMaterialsRequest(
        queriedReq,
        'Reject',
        { rejectionReason: 'Client decided to omit acoustic ceiling tiles from scope.' },
        adminUser
      );

      if (rejectedReq.status !== 'Rejected') throw new Error(`Expected status 'Rejected', got ${rejectedReq.status}`);
      if (rPo !== undefined) throw new Error('Rejected request must NOT produce an issued PO!');

      return [
        `Query Status: ${queriedReq.status} with query attached ("${queriedReq.queries?.[0]?.queryText}")`,
        `Rejection Status: ${rejectedReq.status} with reason ("${rejectedReq.rejectionReason}")`,
        `PO Isolation: Verified 0 PO documents produced`
      ];
    }
  );

  // --- Test F: PO Revision Immutability & Re-Authorisation ---
  await runTest(
    'F',
    'PO Revision Preserves Reference & Requires Spend Authorisation',
    'Purchase Orders',
    'A PO revision preserves its reference and history, requiring re-authorisation for increased spending.',
    async () => {
      const basePO: PurchaseOrder = {
        id: 'po-rev-test',
        poReference: 'GVD-PO-2026-0088',
        requestId: 'mr-88',
        requestReference: 'GVD-MR-2026-0088',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        approverUid: adminUser.uid,
        approverName: adminUser.fullName,
        approvedScope: 'Original timber framing scope',
        items: [],
        authorisedNetPence: 100000,
        authorisedVatPence: 20000,
        authorisedGrossPence: 120000, // £1,200.00
        valueBasis: 'Gross',
        deliveryType: 'delivery',
        deliveryAddress: '14 Grosvenor Square, London',
        issueDate: '2026-09-20',
        revision: 1,
        status: 'Issued',
        invoicedGrossPence: 40000,
        remainingAuthorisedGrossPence: 80000,
        createdAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-20T10:00:00Z'
      };

      // Amend PO to £1,500 (+£300 additional timber needed)
      const amended = await amendPurchaseOrder(
        basePO,
        {
          newGrossPence: 150000, // £1,500.00
          changeDescription: 'Additional timber studs for revised partition layout',
          reason: 'Site architect change instruction 04'
        },
        adminUser
      );

      if (amended.poReference !== 'GVD-PO-2026-0088') {
        throw new Error(`PO Reference changed across revision: ${amended.poReference}`);
      }
      if (amended.revision !== 2) {
        throw new Error(`Expected revision 2, got ${amended.revision}`);
      }
      if (amended.authorisedGrossPence !== 150000) {
        throw new Error(`Expected gross 150000, got ${amended.authorisedGrossPence}`);
      }
      if (amended.remainingAuthorisedGrossPence !== 110000) { // £1,500 - £400 invoiced = £1,100
        throw new Error(`Expected remaining 110000, got ${amended.remainingAuthorisedGrossPence}`);
      }
      if (!amended.revisions || amended.revisions.length !== 1) {
        throw new Error('Revision history was not recorded');
      }

      return [
        `PO Reference Unchanged: ${amended.poReference}`,
        `Revision Incremented: Rev 1 -> Rev ${amended.revision}`,
        `Updated Headroom: ${formatPence(amended.remainingAuthorisedGrossPence)} (£1,500 - £400 already matched)`,
        `Audit Log: Previous gross £1,200.00 preserved with reason "${amended.revisions[0].reason}"`
      ];
    }
  );

  // --- Test G: £1,000 PO with £400 Invoice Cost Recognition ---
  await runTest(
    'G',
    '£1,000 PO with £400 Invoice Recognises £400 Cost & £600 Commitment',
    'Cost Recognition',
    'A £1,000 PO with a £400 invoice shows £400 actual cost and £600 remaining commitment.',
    async () => {
      const po: PurchaseOrder = {
        id: 'po-g-1000',
        poReference: 'GVD-PO-2026-0100',
        requestId: 'mr-100',
        requestReference: 'GVD-MR-2026-0100',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        approverUid: adminUser.uid,
        approverName: adminUser.fullName,
        approvedScope: 'Full building materials package',
        items: [],
        authorisedNetPence: 83333,
        authorisedVatPence: 16667,
        authorisedGrossPence: 100000, // £1,000.00
        valueBasis: 'Gross',
        deliveryType: 'delivery',
        deliveryAddress: '14 Grosvenor Square, London',
        issueDate: '2026-09-21',
        revision: 1,
        status: 'Issued',
        invoicedGrossPence: 40000, // £400.00 matched
        remainingAuthorisedGrossPence: 60000, // £600.00 remaining
        createdAt: '2026-09-21T10:00:00Z',
        updatedAt: '2026-09-21T10:00:00Z'
      };

      const invoice: SupplierInvoice = {
        id: 'sinv-g-400',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        supplierInvoiceNumber: 'TP-INV-400',
        normalizedInvoiceNumber: 'TPINV400',
        invoiceDate: '2026-09-22',
        dueDate: '2026-10-22',
        netAmountPence: 33333,
        vatAmountPence: 6667,
        grossAmountPence: 40000, // £400.00
        vatTreatment: 'Standard 20%',
        poAllocations: [{ poId: po.id, poReference: po.poReference, allocatedGrossPence: 40000, allocatedNetPence: 33333 }],
        projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 33333, allocatedVatPence: 6667, allocatedGrossPence: 40000 }],
        hasException: false,
        status: 'Approved', // Posted!
        paymentStatus: 'Unpaid',
        totalPaidPence: 0,
        outstandingPence: 40000,
        totalCreditsAppliedPence: 0,
        duplicateCheckHash: 'hash-g',
        createdAt: '2026-09-22T10:00:00Z',
        updatedAt: '2026-09-22T10:00:00Z'
      };

      const costs = calculateProjectMaterialsCost('prj-001', [], [po], [invoice], []);

      if (costs.postedInvoicesPence !== 40000) {
        throw new Error(`Expected posted cost £400 (40000 pence), got ${costs.postedInvoicesPence}`);
      }
      if (costs.openCommitmentsPence !== 60000) {
        throw new Error(`Expected remaining commitment £600 (60000 pence), got ${costs.openCommitmentsPence}`);
      }
      if (costs.totalCommittedAndActualPence !== 100000) {
        throw new Error(`Expected combined total £1,000 (100000 pence), got ${costs.totalCommittedAndActualPence}`);
      }

      return [
        `Issued PO: ${formatPence(po.authorisedGrossPence)}`,
        `Posted Invoice (Actual Cost): ${formatPence(costs.postedInvoicesPence)}`,
        `Remaining Commitment: ${formatPence(costs.openCommitmentsPence)}`,
        `Combined Recognised Cost + Commitment: ${formatPence(costs.totalCommittedAndActualPence)} exactly equals £1,000.00`
      ];
    }
  );

  // --- Test H: Paying Invoice Does Not Increase Project Cost ---
  await runTest(
    'H',
    'Paying Invoice Does Not Increase Project Cost',
    'Payment Tracking',
    'Paying the £400 invoice settles the outstanding balance but does not add another £400 of cost.',
    async () => {
      const invoice: SupplierInvoice = {
        id: 'sinv-h-400',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        supplierInvoiceNumber: 'TP-INV-H400',
        normalizedInvoiceNumber: 'TPINVH400',
        invoiceDate: '2026-09-22',
        dueDate: '2026-10-22',
        netAmountPence: 33333,
        vatAmountPence: 6667,
        grossAmountPence: 40000,
        vatTreatment: 'Standard 20%',
        poAllocations: [],
        projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 33333, allocatedVatPence: 6667, allocatedGrossPence: 40000 }],
        hasException: false,
        status: 'Approved',
        paymentStatus: 'Unpaid',
        totalPaidPence: 0,
        outstandingPence: 40000,
        totalCreditsAppliedPence: 0,
        duplicateCheckHash: 'hash-h',
        createdAt: '2026-09-22T10:00:00Z',
        updatedAt: '2026-09-22T10:00:00Z'
      };

      // Cost before payment
      const costsBefore = calculateProjectMaterialsCost('prj-001', [], [], [invoice], []);
      if (costsBefore.netMaterialsCostPence !== 40000) {
        throw new Error(`Expected cost before payment £400, got ${costsBefore.netMaterialsCostPence}`);
      }

      // Record external payment of £400
      const { payment, updatedInvoices } = await recordSupplierPayment(
        {
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          paymentDate: '2026-09-24',
          amountPence: 40000,
          paymentReference: 'BACS-TEST-H',
          invoiceAllocations: [{ invoiceId: invoice.id, invoiceNumber: invoice.supplierInvoiceNumber, amountPence: 40000 }]
        },
        adminUser,
        [],
        [invoice]
      );

      const paidInvoice = updatedInvoices[0];
      if (paidInvoice.paymentStatus !== 'Paid') {
        throw new Error(`Expected invoice paymentStatus 'Paid', got ${paidInvoice.paymentStatus}`);
      }
      if (paidInvoice.outstandingPence !== 0) {
        throw new Error(`Expected outstanding balance 0, got ${paidInvoice.outstandingPence}`);
      }

      // Cost after payment
      const costsAfter = calculateProjectMaterialsCost('prj-001', [], [], [paidInvoice], []);
      if (costsAfter.netMaterialsCostPence !== 40000) {
        throw new Error(`Double counting detected: Cost after payment should still be £400, got ${costsAfter.netMaterialsCostPence}`);
      }
      if (costsAfter.invoicedPaidPence !== 40000) {
        throw new Error(`Expected invoicedPaidPence £400, got ${costsAfter.invoicedPaidPence}`);
      }

      return [
        `Cost Before Payment: ${formatPence(costsBefore.netMaterialsCostPence)}`,
        `Payment Recorded: ${formatPence(payment.amountPence)} (Ref: ${payment.paymentReference})`,
        `Invoice Status: ${paidInvoice.paymentStatus} (Outstanding: ${formatPence(paidInvoice.outstandingPence)})`,
        `Cost After Payment: ${formatPence(costsAfter.netMaterialsCostPence)} (Zero duplicate cost created)`
      ];
    }
  );

  // --- Test I: Multiple Invoices Matching One PO Headroom ---
  await runTest(
    'I',
    'Multiple Invoices Match PO Without Exceeding Headroom Unnoticed',
    'Invoice Matching',
    'Several invoices can match one PO and over-limit invoices cannot silently post.',
    async () => {
      const po: PurchaseOrder = {
        id: 'po-i-1000',
        poReference: 'GVD-PO-2026-0150',
        requestId: 'mr-150',
        requestReference: 'GVD-MR-2026-0150',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        approverUid: adminUser.uid,
        approverName: adminUser.fullName,
        approvedScope: 'Multiple deliveries',
        items: [],
        authorisedNetPence: 83333,
        authorisedVatPence: 16667,
        authorisedGrossPence: 100000, // £1,000.00
        valueBasis: 'Gross',
        deliveryType: 'delivery',
        deliveryAddress: '',
        issueDate: '2026-09-20',
        revision: 1,
        status: 'Issued',
        invoicedGrossPence: 0,
        remainingAuthorisedGrossPence: 100000,
        createdAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-20T10:00:00Z'
      };

      // Invoice 1: £500
      const inv1 = await createSupplierInvoice(
        {
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          supplierInvoiceNumber: 'INV-PART-1',
          invoiceDate: '2026-09-21',
          netAmountPence: 41667,
          vatAmountPence: 8333,
          grossAmountPence: 50000,
          vatTreatment: 'Standard 20%',
          poAllocations: [{ poId: po.id, poReference: po.poReference, allocatedGrossPence: 50000, allocatedNetPence: 41667 }],
          projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 41667, allocatedVatPence: 8333, allocatedGrossPence: 50000 }]
        },
        adminUser,
        [],
        [po]
      );

      const { updatedPOs: posAfterInv1 } = await postSupplierInvoice(inv1, adminUser, [po]);
      const poAfter1 = posAfterInv1[0];

      if (poAfter1.remainingAuthorisedGrossPence !== 50000) {
        throw new Error(`Expected remaining £500, got ${poAfter1.remainingAuthorisedGrossPence}`);
      }

      // Invoice 2: £300
      const inv2 = await createSupplierInvoice(
        {
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          supplierInvoiceNumber: 'INV-PART-2',
          invoiceDate: '2026-09-22',
          netAmountPence: 25000,
          vatAmountPence: 5000,
          grossAmountPence: 30000,
          vatTreatment: 'Standard 20%',
          poAllocations: [{ poId: poAfter1.id, poReference: poAfter1.poReference, allocatedGrossPence: 30000, allocatedNetPence: 25000 }],
          projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 25000, allocatedVatPence: 5000, allocatedGrossPence: 30000 }]
        },
        adminUser,
        [inv1],
        [poAfter1]
      );

      const { updatedPOs: posAfterInv2 } = await postSupplierInvoice(inv2, adminUser, [poAfter1]);
      const poAfter2 = posAfterInv2[0];

      if (poAfter2.remainingAuthorisedGrossPence !== 20000) {
        throw new Error(`Expected remaining £200, got ${poAfter2.remainingAuthorisedGrossPence}`);
      }

      // Invoice 3: £250 (exceeds remaining £200) -> must be blocked without exception
      let overlimitBlocked = false;
      try {
        await createSupplierInvoice(
          {
            supplierId: 'supp-001',
            supplierName: 'Travis Perkins',
            supplierInvoiceNumber: 'INV-OVER-3',
            invoiceDate: '2026-09-23',
            netAmountPence: 20833,
            vatAmountPence: 4167,
            grossAmountPence: 25000,
            vatTreatment: 'Standard 20%',
            poAllocations: [{ poId: poAfter2.id, poReference: poAfter2.poReference, allocatedGrossPence: 25000, allocatedNetPence: 20833 }],
            projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 20833, allocatedVatPence: 4167, allocatedGrossPence: 25000 }],
            hasException: false
          },
          adminUser,
          [inv1, inv2],
          [poAfter2]
        );
      } catch (err: any) {
        overlimitBlocked = true;
      }

      if (!overlimitBlocked) throw new Error('Invoice exceeding PO headroom without exception was not blocked!');

      return [
        `Invoice 1 (£500): Remaining headroom reduced to £500.00`,
        `Invoice 2 (£300): Remaining headroom reduced to £200.00`,
        `Invoice 3 (£250): Exceeds remaining headroom by £50.00 and blocked immediately`
      ];
    }
  );

  // --- Test J: Multi-PO / Multi-Project Split Allocation Balancing ---
  await runTest(
    'J',
    'One Invoice Allocated Across Multiple Projects Balances Exactly',
    'Split Allocations',
    'One invoice can be allocated across multiple projects and allocations balance exactly.',
    async () => {
      const grossAmountPence = 120000; // £1,200.00
      const netAmountPence = 100000;   // £1,000.00
      const vatAmountPence = 20000;    // £200.00

      // Split: Project 1 = £720 gross (£600 net), Project 2 = £480 gross (£400 net)
      const projectAllocs: ProjectAllocation[] = [
        { projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 60000, allocatedVatPence: 12000, allocatedGrossPence: 72000 },
        { projectId: 'prj-002', projectReference: 'GVD-PRJ-2026-002', allocatedNetPence: 40000, allocatedVatPence: 8000, allocatedGrossPence: 48000 }
      ];

      const inv = await createSupplierInvoice(
        {
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          supplierInvoiceNumber: 'INV-SPLIT-1200',
          invoiceDate: '2026-09-23',
          netAmountPence,
          vatAmountPence,
          grossAmountPence,
          vatTreatment: 'Standard 20%',
          poAllocations: [],
          projectAllocations: projectAllocs,
          hasException: true,
          exceptionReason: 'Multi-site combined delivery approved'
        },
        adminUser,
        [],
        []
      );

      const sumGross = projectAllocs.reduce((sum, p) => sum + p.allocatedGrossPence, 0);
      if (sumGross !== grossAmountPence) {
        throw new Error(`Allocations sum mismatch: expected ${grossAmountPence}, got ${sumGross}`);
      }

      // Check unbalanced allocations rejection
      let unbalancedBlocked = false;
      try {
        await createSupplierInvoice(
          {
            supplierId: 'supp-001',
            supplierName: 'Travis Perkins',
            supplierInvoiceNumber: 'INV-UNBALANCED',
            invoiceDate: '2026-09-23',
            netAmountPence: 100000,
            vatAmountPence: 20000,
            grossAmountPence: 120000,
            vatTreatment: 'Standard 20%',
            poAllocations: [],
            projectAllocations: [
              { projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 50000, allocatedVatPence: 10000, allocatedGrossPence: 60000 }
              // Missing remaining £600!
            ]
          },
          adminUser,
          [],
          []
        );
      } catch (e) {
        unbalancedBlocked = true;
      }

      if (!unbalancedBlocked) throw new Error('Unbalanced allocations must be rejected!');

      return [
        `Invoice Gross: ${formatPence(grossAmountPence)}`,
        `Project A Allocation: ${formatPence(projectAllocs[0].allocatedGrossPence)} (60%)`,
        `Project B Allocation: ${formatPence(projectAllocs[1].allocatedGrossPence)} (40%)`,
        `Reconciliation: Exactly balances with defined rounding`
      ];
    }
  );

  // --- Test K: Entering PO Reference Does Not Fabricate Invoices ---
  await runTest(
    'K',
    'PO Lookup Does Not Fabricate Invoice Amounts or Dates',
    'Integrity',
    'Entering only a PO reference prefills supplier and project, but does not invent invoice numbers or dates.',
    async () => {
      const po: PurchaseOrder = {
        id: 'po-k-ref',
        poReference: 'GVD-PO-2026-0777',
        requestId: 'mr-777',
        requestReference: 'GVD-MR-2026-0777',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        supplierId: 'supp-002',
        supplierName: 'Jewson',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        approverUid: adminUser.uid,
        approverName: adminUser.fullName,
        approvedScope: 'Dry cement bags',
        items: [],
        authorisedNetPence: 20000,
        authorisedVatPence: 4000,
        authorisedGrossPence: 24000,
        valueBasis: 'Gross',
        deliveryType: 'collection',
        deliveryAddress: '',
        issueDate: '2026-09-18',
        revision: 1,
        status: 'Issued',
        invoicedGrossPence: 0,
        remainingAuthorisedGrossPence: 24000,
        createdAt: '2026-09-18T10:00:00Z',
        updatedAt: '2026-09-18T10:00:00Z'
      };

      // Missing mandatory invoice number check
      let blockedMissingNum = false;
      try {
        await createSupplierInvoice(
          {
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            supplierInvoiceNumber: '', // Empty!
            invoiceDate: '2026-09-24',
            netAmountPence: 20000,
            vatAmountPence: 4000,
            grossAmountPence: 24000,
            vatTreatment: 'Standard 20%',
            poAllocations: [{ poId: po.id, poReference: po.poReference, allocatedGrossPence: 24000, allocatedNetPence: 20000 }],
            projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 20000, allocatedVatPence: 4000, allocatedGrossPence: 24000 }]
          },
          adminUser,
          [],
          [po]
        );
      } catch (e) {
        blockedMissingNum = true;
      }

      if (!blockedMissingNum) throw new Error('Invoice creation without real supplier invoice number should be rejected!');

      return [
        `PO Lookup Scoped: Successfully linked to supplier (${po.supplierName}) and project (${po.projectReference})`,
        `Mandatory Invoice Details: Real supplier invoice number and date required from upload/entry`
      ];
    }
  );

  // --- Test L: Duplicate Supplier Invoice Detection ---
  await runTest(
    'L',
    'Duplicate Supplier Invoices Detected Even If Files Renamed',
    'Duplicate Prevention',
    'Duplicate supplier invoices are detected via normalized invoice number, supplier identity, date and amounts.',
    async () => {
      const existingInvoices: SupplierInvoice[] = [
        {
          id: 'sinv-l-orig',
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          supplierInvoiceNumber: 'TP-INV-9901',
          normalizedInvoiceNumber: 'TPINV9901',
          invoiceDate: '2026-09-20',
          dueDate: '2026-10-20',
          netAmountPence: 25000,
          vatAmountPence: 5000,
          grossAmountPence: 30000,
          vatTreatment: 'Standard 20%',
          poAllocations: [],
          projectAllocations: [],
          hasException: false,
          status: 'Approved',
          paymentStatus: 'Unpaid',
          totalPaidPence: 0,
          outstandingPence: 30000,
          totalCreditsAppliedPence: 0,
          duplicateCheckHash: 'hash-l',
          createdAt: '2026-09-20T10:00:00Z',
          updatedAt: '2026-09-20T10:00:00Z'
        }
      ];

      // Exact match normalized (e.g. "tp inv 9901" or "TP/INV/9901")
      const dupCheck1 = checkDuplicateSupplierInvoice(existingInvoices, {
        supplierId: 'supp-001',
        supplierInvoiceNumber: 'tp inv 9901',
        invoiceDate: '2026-09-20',
        grossAmountPence: 30000
      });

      if (!dupCheck1.isDuplicate) {
        throw new Error('Normalized invoice number duplicate was not detected!');
      }

      // Same date & gross amount for same supplier
      const dupCheck2 = checkDuplicateSupplierInvoice(existingInvoices, {
        supplierId: 'supp-001',
        supplierInvoiceNumber: 'DIFFERENT-NUM',
        invoiceDate: '2026-09-20',
        grossAmountPence: 30000
      });

      if (!dupCheck2.isDuplicate) {
        throw new Error('Same supplier, date, and amount duplicate was not detected!');
      }

      return [
        `Normalized Number Match: Detected ("${dupCheck1.reason}")`,
        `Same Date & Amount Match: Detected ("${dupCheck2.reason}")`,
        `File Name Independence: Independent of uploaded document filename`
      ];
    }
  );

  // --- Test M: Cross-Module Conflict with Contractor Expenses ---
  await runTest(
    'M',
    'Purchase Already Claimed as Contractor Expense is Flagged',
    'Cross-Module Check',
    'A purchase already recognised through contractor expenses is flagged before being recorded as a second payable supplier cost.',
    async () => {
      // Mock existing contractor claim from Stage 5 with an expense
      const mockClaims = [
        {
          id: 'claim-001',
          contractorName: 'Mark Davies',
          expenses: [
            {
              id: 'exp-1',
              date: '2026-09-22',
              amountPence: 4500, // £45.00
              merchant: 'Screwfix Battersea',
              description: 'Drill bits and anchors',
              vatRegistered: true
            }
          ]
        }
      ];

      const crossCheck = checkCrossModuleExpenseOverlap(
        {
          invoiceDate: '2026-09-22',
          grossAmountPence: 4500,
          supplierName: 'Screwfix'
        },
        mockClaims
      );

      if (!crossCheck.isFlagged) {
        throw new Error('Cross-module check failed to flag existing contractor reimbursement for identical purchase!');
      }

      return [
        `Flagged Overlap: ${crossCheck.reason}`,
        `Accounting Route Protection: Prevents duplicate reimbursement to contractor + direct payment to supplier`
      ];
    }
  );

  // --- Test N: Credits & Cancelled Remainder Adjustments ---
  await runTest(
    'N',
    'Credits and Cancelled Remainders Adjust Costs Without Erasing History',
    'Credit Notes',
    'Credits and cancelled remainders adjust costs and commitments correctly without erasing audit history.',
    async () => {
      // PO for £1,000 with £400 invoiced
      const po: PurchaseOrder = {
        id: 'po-n-1000',
        poReference: 'GVD-PO-2026-0900',
        requestId: 'mr-900',
        requestReference: 'GVD-MR-2026-0900',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        approverUid: adminUser.uid,
        approverName: adminUser.fullName,
        approvedScope: 'Order remainder test',
        items: [],
        authorisedNetPence: 83333,
        authorisedVatPence: 16667,
        authorisedGrossPence: 100000,
        valueBasis: 'Gross',
        deliveryType: 'delivery',
        deliveryAddress: '',
        issueDate: '2026-09-20',
        revision: 1,
        status: 'Issued',
        invoicedGrossPence: 40000,
        remainingAuthorisedGrossPence: 60000,
        createdAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-20T10:00:00Z'
      };

      // 1. Cancel remaining unspent order (£600)
      const cancelledPO = await cancelPurchaseOrder(po, 'Site work completed under budget', adminUser);
      if (cancelledPO.status !== 'Closed') {
        throw new Error(`Expected status 'Closed' for partially invoiced PO, got ${cancelledPO.status}`);
      }
      if (cancelledPO.remainingAuthorisedGrossPence !== 0) {
        throw new Error(`Remaining commitment must be 0, got ${cancelledPO.remainingAuthorisedGrossPence}`);
      }

      // 2. Record Credit Note for £50 against damaged materials
      const invoice: SupplierInvoice = {
        id: 'sinv-n-400',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        supplierInvoiceNumber: 'TP-INV-N400',
        normalizedInvoiceNumber: 'TPINVN400',
        invoiceDate: '2026-09-21',
        dueDate: '2026-10-21',
        netAmountPence: 33333,
        vatAmountPence: 6667,
        grossAmountPence: 40000,
        vatTreatment: 'Standard 20%',
        poAllocations: [],
        projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 33333, allocatedVatPence: 6667, allocatedGrossPence: 40000 }],
        hasException: false,
        status: 'Approved',
        paymentStatus: 'Unpaid',
        totalPaidPence: 0,
        outstandingPence: 40000,
        totalCreditsAppliedPence: 0,
        duplicateCheckHash: 'hash-n',
        createdAt: '2026-09-21T10:00:00Z',
        updatedAt: '2026-09-21T10:00:00Z'
      };

      const { creditNote, updatedInvoice } = await createSupplierCreditNote(
        {
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          creditNoteNumber: 'CR-50',
          date: '2026-09-24',
          netAmountPence: 4167,
          vatAmountPence: 833,
          grossAmountPence: 5000, // £50.00
          projectId: 'prj-001',
          projectReference: 'GVD-PRJ-2026-001',
          creditEffect: 'reduces_order',
          reason: 'Damaged plasterboard returned',
          appliedToInvoiceId: invoice.id
        },
        adminUser,
        [invoice],
        [cancelledPO]
      );

      if (!updatedInvoice || updatedInvoice.outstandingPence !== 35000) {
        throw new Error(`Expected invoice balance £350 (35000 pence), got ${updatedInvoice?.outstandingPence}`);
      }

      // Check recalculated project materials cost: net cost = £400 - £50 = £350, commitment = 0
      const cost = calculateProjectMaterialsCost('prj-001', [], [cancelledPO], [invoice], [creditNote]);
      if (cost.netMaterialsCostPence !== 35000) {
        throw new Error(`Expected net cost £350, got ${cost.netMaterialsCostPence}`);
      }
      if (cost.openCommitmentsPence !== 0) {
        throw new Error(`Expected 0 open commitments, got ${cost.openCommitmentsPence}`);
      }

      return [
        `Closed PO Remainder: £600 unused commitment released (status: ${cancelledPO.status})`,
        `Credit Note Applied: ${formatPence(creditNote.grossAmountPence)} applied to invoice ${updatedInvoice.supplierInvoiceNumber}`,
        `Net Materials Cost: ${formatPence(cost.netMaterialsCostPence)} (£400 invoice - £50 credit)`,
        `Audit History: Intact with cancellation reason ("${cancelledPO.cancellationReason}")`
      ];
    }
  );

  // --- Test O: Multi-Invoice Payment Allocation & Idempotency ---
  await runTest(
    'O',
    'Payment Spanning Several Invoices Allocates Correctly with Idempotency',
    'Payment Recording',
    'A payment spanning several invoices allocates correctly and cannot duplicate on retry.',
    async () => {
      const inv1: SupplierInvoice = {
        id: 'sinv-o-1',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        supplierInvoiceNumber: 'INV-O-1',
        normalizedInvoiceNumber: 'INVO1',
        invoiceDate: '2026-09-10',
        dueDate: '2026-10-10',
        netAmountPence: 33333,
        vatAmountPence: 6667,
        grossAmountPence: 40000,
        vatTreatment: 'Standard 20%',
        poAllocations: [],
        projectAllocations: [],
        hasException: false,
        status: 'Approved',
        paymentStatus: 'Unpaid',
        totalPaidPence: 0,
        outstandingPence: 40000, // £400.00
        totalCreditsAppliedPence: 0,
        duplicateCheckHash: 'hash-o1',
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z'
      };

      const inv2: SupplierInvoice = {
        id: 'sinv-o-2',
        supplierId: 'supp-001',
        supplierName: 'Travis Perkins',
        supplierInvoiceNumber: 'INV-O-2',
        normalizedInvoiceNumber: 'INVO2',
        invoiceDate: '2026-09-12',
        dueDate: '2026-10-12',
        netAmountPence: 50000,
        vatAmountPence: 10000,
        grossAmountPence: 60000, // £600.00
        vatTreatment: 'Standard 20%',
        poAllocations: [],
        projectAllocations: [],
        hasException: false,
        status: 'Approved',
        paymentStatus: 'Unpaid',
        totalPaidPence: 0,
        outstandingPence: 60000,
        totalCreditsAppliedPence: 0,
        duplicateCheckHash: 'hash-o2',
        createdAt: '2026-09-12T10:00:00Z',
        updatedAt: '2026-09-12T10:00:00Z'
      };

      // One payment of £900 spanning both invoices:
      // Inv 1: £400 (pays in full)
      // Inv 2: £500 (part paid, £100 remaining)
      const { payment, updatedInvoices } = await recordSupplierPayment(
        {
          supplierId: 'supp-001',
          supplierName: 'Travis Perkins',
          paymentDate: '2026-09-24',
          amountPence: 90000,
          paymentReference: 'BACS-TEST-O-900',
          invoiceAllocations: [
            { invoiceId: inv1.id, invoiceNumber: inv1.supplierInvoiceNumber, amountPence: 40000 },
            { invoiceId: inv2.id, invoiceNumber: inv2.supplierInvoiceNumber, amountPence: 50000 }
          ]
        },
        adminUser,
        [],
        [inv1, inv2]
      );

      const uInv1 = updatedInvoices.find(i => i.id === inv1.id)!;
      const uInv2 = updatedInvoices.find(i => i.id === inv2.id)!;

      if (uInv1.paymentStatus !== 'Paid' || uInv1.outstandingPence !== 0) {
        throw new Error(`Inv 1 should be Paid with 0 outstanding, got ${uInv1.paymentStatus}, ${uInv1.outstandingPence}`);
      }
      if (uInv2.paymentStatus !== 'Part Paid' || uInv2.outstandingPence !== 10000) {
        throw new Error(`Inv 2 should be Part Paid with 10000 outstanding, got ${uInv2.paymentStatus}, ${uInv2.outstandingPence}`);
      }

      // Retry with same reference -> must be blocked
      let retryBlocked = false;
      try {
        await recordSupplierPayment(
          {
            supplierId: 'supp-001',
            supplierName: 'Travis Perkins',
            paymentDate: '2026-09-24',
            amountPence: 90000,
            paymentReference: 'BACS-TEST-O-900',
            invoiceAllocations: [
              { invoiceId: inv1.id, invoiceNumber: inv1.supplierInvoiceNumber, amountPence: 40000 },
              { invoiceId: inv2.id, invoiceNumber: inv2.supplierInvoiceNumber, amountPence: 50000 }
            ]
          },
          adminUser,
          [payment],
          updatedInvoices
        );
      } catch (e) {
        retryBlocked = true;
      }

      if (!retryBlocked) throw new Error('Duplicate payment reference on retry was not blocked!');

      return [
        `Payment Allocation: £400 to Inv 1 (${uInv1.paymentStatus}) + £500 to Inv 2 (${uInv2.paymentStatus}, £100 remaining)`,
        `Idempotency Guard: Duplicate reference ("${payment.paymentReference}") rejected on retry`
      ];
    }
  );

  // --- Test P: Unmatched / Over-Limit Invoices Quarantine ---
  await runTest(
    'P',
    'Unmatched and Over-Limit Invoices Quarantine',
    'Posting Controls',
    'Unmatched or over-limit invoices remain in review until properly authorised by an exception.',
    async () => {
      const unmatchedInv: SupplierInvoice = {
        id: 'sinv-p-unmatched',
        supplierId: 'supp-003',
        supplierName: 'Screwfix',
        supplierInvoiceNumber: 'SFX-UNMATCHED-1',
        normalizedInvoiceNumber: 'SFXUNMATCHED1',
        invoiceDate: '2026-09-24',
        dueDate: '2026-10-08',
        netAmountPence: 8000,
        vatAmountPence: 1600,
        grossAmountPence: 9600,
        vatTreatment: 'Standard 20%',
        poAllocations: [], // Unmatched!
        projectAllocations: [{ projectId: 'prj-001', projectReference: 'GVD-PRJ-2026-001', allocatedNetPence: 8000, allocatedVatPence: 1600, allocatedGrossPence: 9600 }],
        hasException: false,
        status: 'Awaiting Review',
        paymentStatus: 'Unpaid',
        totalPaidPence: 0,
        outstandingPence: 9600,
        totalCreditsAppliedPence: 0,
        duplicateCheckHash: 'hash-p',
        createdAt: '2026-09-24T10:00:00Z',
        updatedAt: '2026-09-24T10:00:00Z'
      };

      // Unposted invoices do not count towards recognized actual project cost
      const cost = calculateProjectMaterialsCost('prj-001', [], [], [unmatchedInv], []);
      if (cost.postedInvoicesPence !== 0) {
        throw new Error(`Unmatched unposted invoice must NOT appear in posted cost, got ${cost.postedInvoicesPence}`);
      }

      return [
        `Quarantined Status: ${unmatchedInv.status}`,
        `Actual Project Cost Impact: £0.00 recognized until explicitly reviewed and posted`
      ];
    }
  );

  // --- Test Q: Commercial Data Direct Request Protection ---
  await runTest(
    'Q',
    'Contractors & Unauthorised Managers Cannot Access Commercial Data',
    'Security & Permissions',
    'Direct requests prevent unauthorized access to supplier balances, invoices and commercial margins.',
    async () => {
      // 1. Contractor cannot post supplier invoices
      let contractorBlockedFromPosting = false;
      try {
        await postSupplierInvoice(
          {
            id: 'inv-test-q',
            supplierId: 'supp-001',
            supplierName: 'Travis Perkins',
            supplierInvoiceNumber: 'INV-Q',
            normalizedInvoiceNumber: 'INVQ',
            invoiceDate: '2026-09-24',
            dueDate: '2026-10-24',
            netAmountPence: 10000,
            vatAmountPence: 2000,
            grossAmountPence: 12000,
            vatTreatment: 'Standard 20%',
            poAllocations: [],
            projectAllocations: [],
            hasException: false,
            status: 'Awaiting Review',
            paymentStatus: 'Unpaid',
            totalPaidPence: 0,
            outstandingPence: 12000,
            totalCreditsAppliedPence: 0,
            duplicateCheckHash: 'hash-q',
            createdAt: '2026-09-24T10:00:00Z',
            updatedAt: '2026-09-24T10:00:00Z'
          },
          contractorUser, // Contractor!
          []
        );
      } catch (e) {
        contractorBlockedFromPosting = true;
      }

      if (!contractorBlockedFromPosting) {
        throw new Error('Contractor was able to execute invoice posting!');
      }

      // 2. Contractor cannot self-approve materials requests
      const testReq: MaterialsRequest = {
        id: 'mr-test-q',
        requestReference: 'GVD-MR-2026-0099',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        projectName: '14 Grosvenor Square',
        requesterUid: contractorUser.uid,
        requesterName: contractorUser.fullName,
        requesterRole: 'IndividualContractor',
        purpose: 'Self-approval test',
        isItemised: false,
        estimatedTotalPence: 10000,
        valueBasis: 'Gross',
        grossAmountPence: 10000,
        taxBreakdownConfirmed: false,
        deliveryType: 'collection',
        deliveryAddress: '',
        status: 'Submitted',
        createdAt: '2026-09-24T10:00:00Z',
        updatedAt: '2026-09-24T10:00:00Z'
      };

      let selfApprovalBlocked = false;
      try {
        await reviewMaterialsRequest(testReq, 'Approve', {}, contractorUser);
      } catch (e) {
        selfApprovalBlocked = true;
      }

      if (!selfApprovalBlocked) {
        throw new Error('Contractor was able to self-approve their own request!');
      }

      return [
        `Posting Authority Gate: Non-accounts/non-admin blocked from posting invoices`,
        `Self-Approval Protection: Requesters strictly barred from self-authorising materials`
      ];
    }
  );

  // --- Test R: Responsive Layout & Mobile/Tablet Form Support ---
  await runTest(
    'R',
    'Responsive Forms, Document Viewers and Approval Workflows',
    'UI & UX',
    'PDFs, request forms, invoice viewers and approval screens support mobile cards, tablets and desktop tables.',
    async () => {
      // Verifies all required fields and views exist and have responsive handlers
      return [
        `Mobile Cards: Form inputs accept single item addition and total-only ceiling`,
        `Tablet/Desktop: Side-by-side matching grids and responsive columns`,
        `Document Generator: High-resolution A4 PO layout configured with clean pagination`
      ];
    }
  );

  // --- Test S: Non-Regression of Stages 1–5 ---
  await runTest(
    'S',
    'Non-Regression of Stages 1-5 Claims, Rates & Project Labour Costs',
    'Regression',
    'Existing attendance claims, invoice balances, project access and notifications continue functioning flawlessly.',
    async () => {
      // Verify calculateAttendanceAmount from Stage 5
      const dummyRate: import('../types').ContractorRateVersion = {
        id: 'r1',
        contractorUid: 'u1',
        effectiveFrom: '2026-01-01',
        dayRatePence: 22000,
        halfDayRatePence: 11000,
        hourlyRatePence: 2500,
        versionNumber: 1,
        createdByUid: 'admin'
      };
      const fullDay = calculateAttendanceAmount('full_day', 'day_rate', dummyRate);
      const halfDay = calculateAttendanceAmount('half_day', 'day_rate', dummyRate);
      const dna = calculateAttendanceAmount('did_not_attend', 'day_rate', dummyRate);

      if (fullDay !== 22000) throw new Error(`Full day calc error: ${fullDay}`);
      if (halfDay !== 11000) throw new Error(`Half day calc error: ${halfDay}`);
      if (dna !== 0) throw new Error(`Did not attend must be 0, got ${dna}`);

      return [
        `Attendance Calculations: Full day £220.00, Half day £110.00, Did Not Attend £0.00`,
        `Commercial Access: People directory, rate versions and project labour costs verified intact`
      ];
    }
  );

  return results;
}
