export type UserRole = 
  | 'Owner'
  | 'Admin'
  | 'ProjectManager'
  | 'Planner'
  | 'Accounts'
  | 'IndividualContractor'
  | 'ContractorCompany';

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'inactive';
export type ApplicationCategory = 'GVD Employee' | 'Individual Contractor' | 'Contractor Company';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  applicationCategory: ApplicationCategory;
  role: UserRole;
  status: AccountStatus;
  companyId?: string;
  companyName?: string;
  companyContactPerson?: string;
  primaryTrade?: string;
  trades?: string[];
  planningEligible: boolean;
  assignedProjectIds?: string[];
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  adminNotes?: string;
  emailVerified?: boolean;
  customFields?: Record<string, any>;
}

export interface PrivateBusinessDetails {
  uid: string;
  businessName?: string;
  tradingName?: string;
  businessAddress?: string;
  utr?: string; // Stored as text to preserve leading zeroes
  vatRegistered?: boolean;
  vatNumber?: string;
  companyNumber?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CompanyProfile {
  id: string;
  companyName: string;
  tradingName?: string;
  businessAddress: string;
  mainContactUid: string;
  mainContactName: string;
  businessEmail: string;
  businessPhone: string;
  companyNumber?: string;
  utr?: string; // Stored as text
  vatRegistered?: boolean;
  vatNumber?: string;
  associatedUserIds: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type RequirementCategory = 'competency' | 'insurance' | 'supporting_document';
export type RequirementTarget = 'individual' | 'company';

export interface RequirementConfig {
  id: string;
  name: string;
  description: string;
  category: RequirementCategory;
  target: RequirementTarget;
  applicableAccountTypes: ApplicationCategory[];
  applicableTrades: string[]; // Empty = all trades
  isMandatory: boolean; // Mandatory = required for date eligibility
  evidenceRequired: boolean;
  expiryRequired: boolean;
  allowDoesNotExpire: boolean;
  reminderThresholdsDays: number[]; // e.g. [60, 30, 7, 0]
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CompetencyStatus = 
  | 'Missing'
  | 'Awaiting Review'
  | 'Valid'
  | 'Expiring Soon'
  | 'Expired'
  | 'Rejected'
  | 'Not Required';

export interface CompetencyDocument {
  id: string;
  requirementId: string;
  requirementName: string;
  requirementCategory: RequirementCategory;
  target: RequirementTarget;
  holderId: string; // personId or companyId
  holderName: string;
  holderType: 'individual' | 'company';
  issuerProvider: string;
  referenceNumber: string;
  issueDate?: string; // YYYY-MM-DD
  expiryDate?: string | null; // YYYY-MM-DD or null if does not expire
  doesNotExpire: boolean;
  documentUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  notes?: string; // Public/user note
  reviewStatus: CompetencyStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string; // User-facing rejection reason
  privateInternalNotes?: string; // GVD-only internal notes
  version: number;
  isCurrentVersion: boolean;
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'selection' | 'yes_no';
export type CustomFieldVisibility = 'gvd_staff_only' | 'self_and_gvd';

export interface CustomFieldConfig {
  id: string; // Stable ID
  label: string;
  helpText?: string;
  fieldType: CustomFieldType;
  options?: string[]; // For selection type
  applicableAccountTypes: ApplicationCategory[];
  isRequired: boolean;
  viewPermission: CustomFieldVisibility;
  editPermission: 'admin_only' | 'self_and_admin';
  isActive: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  recipientEmail: string;
  title: string;
  message: string;
  type: 'expiry_warning' | 'document_expired' | 'review_approved' | 'review_rejected' | 'action_assigned' | 'booking_published' | 'booking_changed' | 'booking_cancelled' | 'booking_response' | 'system';
  relatedRequirementId?: string;
  relatedCompetencyId?: string;
  relatedPersonId?: string;
  relatedProjectId?: string;
  relatedActionId?: string;
  relatedBookingId?: string;
  thresholdDays?: number;
  isRead: boolean;
  createdAt: string;
  sentEmail?: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  beforeState?: any;
  afterState?: any;
  timestamp: string;
}

export interface PlanningEligibilityResult {
  personId: string;
  personName: string;
  isEligible: boolean;
  metRequirements: string[];
  warnings: string[];
  mandatoryMissingOrExpired: string[];
  expiringDuringPeriod: string[];
}

/* ========================================================= */
/* STAGE 3: PROJECTS & WORKSPACES DATA TYPES                 */
/* ========================================================= */

export type OperationalProjectStatus = 
  | 'Draft'
  | 'Planned'
  | 'In Progress'
  | 'Site Complete'
  | 'Cancelled';

export type ProjectAccessPreset = 
  | 'GVD Project Team'
  | 'Contractor Participant'
  | 'Company Contact';

export interface ProjectMember {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  companyName?: string;
  trade?: string;
  role: UserRole;
  accessPreset: ProjectAccessPreset;
  addedAt: string;
  addedBy: string;
}

export interface SiteContactInfo {
  clientName: string;
  clientOrg?: string;
  clientEmail?: string;
  clientPhone?: string;
  residentName?: string;
  residentPhone?: string;
  residentEmail?: string;
  residentAccessNotes?: string;
  keySafeCode?: string; // Restricted visibility info
  parkingNotes?: string;
  welfareNotes?: string;
  workingRestrictions?: string;
  otherSiteInstructions?: string;
}

export interface ProjectRecord {
  id: string; // Internal UUID
  reference: string; // Permanent atomic reference e.g. GVD-2026-0001
  title: string;
  siteAddress: string;
  postcode: string;
  projectType: string;
  description?: string;
  responsibleManagerUid: string;
  responsibleManagerName: string;
  targetStartDate?: string; // YYYY-MM-DD (Provisional target)
  targetFinishDate?: string; // YYYY-MM-DD (Provisional target)
  status: OperationalProjectStatus;
  isArchived: boolean;
  archivedAt?: string;
  archivedBy?: string;
  siteInfo: SiteContactInfo;
  assignedUserIds: string[]; // List of user UIDs for security rule evaluation
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

export interface QuoteProvisionalSum {
  item: string;
  amountPence: number;
}

export interface CommercialCorrectionLog {
  timestamp: string;
  actorUid: string;
  actorName: string;
  previousValuePence?: number;
  newValuePence: number;
  reason: string;
}

export interface ProjectCommercial {
  projectId: string; // Matches project.id
  projectReference: string;
  quoteDocumentUrl?: string;
  quoteFileName?: string;
  quoteReference?: string;
  quoteDate?: string;
  confirmedContractValuePence?: number; // Integer minor pence (£1,500.50 -> 150050)
  hasConfirmedValue: boolean;
  netPence?: number;
  vatPence?: number;
  vatTreatment?: string; // e.g. 'Standard 20%', 'Reverse Charge'
  grossPence?: number;
  provisionalSums: QuoteProvisionalSum[];
  exclusions: string[];
  internalNotes?: string;
  extractionStatus?: 'None' | 'Pending' | 'Suggested' | 'Confirmed' | 'Failed';
  extractionSuggestions?: {
    netPence?: number;
    vatPence?: number;
    grossPence?: number;
    quoteReference?: string;
    provisionalSums?: QuoteProvisionalSum[];
    exclusions?: string[];
  };
  correctionsHistory: CommercialCorrectionLog[];
  updatedAt: string;
  updatedBy?: string;
}

export type ProjectDocumentCategory = 
  | 'Drawings'
  | 'Scope & Specifications'
  | 'Site/Safety Information'
  | 'General Documents';

export type ProjectDocumentVisibility = 
  | 'GVD Project Team Only'
  | 'All Authorised Project Participants'
  | 'Selected Project People';

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  category: ProjectDocumentCategory;
  originalFilename: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  uploaderUid: string;
  uploaderName: string;
  uploadTimestamp: string;
  version: number;
  isCurrentVersion: boolean;
  supersededBy?: string;
  visibility: ProjectDocumentVisibility;
  allowedUserIds?: string[]; // Present when visibility is 'Selected Project People'
  description?: string;
}

export type ProjectPhotoCategory = 'Before' | 'Progress' | 'Completion' | 'Other';

export interface ProjectPhoto {
  id: string;
  projectId: string;
  photoUrl: string;
  caption?: string;
  category: ProjectPhotoCategory;
  uploaderUid: string;
  uploaderName: string;
  capturedAt?: string;
  uploadedAt: string;
  visibility: ProjectDocumentVisibility;
}

export type ProjectActionStatus = 'Open' | 'In Progress' | 'Done';

export interface ActionComment {
  id: string;
  authorUid: string;
  authorName: string;
  commentText: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface ProjectAction {
  id: string;
  projectId: string;
  projectReference: string;
  title: string;
  description?: string;
  assignedUserUid: string;
  assignedUserName: string;
  dueDate?: string;
  status: ProjectActionStatus;
  visibility: ProjectDocumentVisibility;
  relatedDocId?: string;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  comments: ActionComment[];
}

/* ========================================================= */
/* STAGE 4: PLANNER, LABOUR SHEET & BOOKINGS DATA TYPES       */
/* ========================================================= */

export type BookingSlot = 'Full Day' | 'Morning' | 'Afternoon' | 'Custom';
export type BookingStatus = 'Draft' | 'Published' | 'Cancelled';
export type AcknowledgementStatus = 'Pending' | 'Accepted' | 'Declined' | 'Change Requested';

export interface BookingRecord {
  id: string;
  groupRef: string; // Links bookings created together in a multi-day or multi-person batch
  projectId: string;
  projectReference: string;
  projectTitle: string;
  siteAddress: string;
  postcode: string;
  personId: string; // User UID
  personName: string;
  personTrade: string;
  companyId?: string;
  companyName?: string;
  localDate: string; // YYYY-MM-DD (Europe/London date)
  slot: BookingSlot;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  instructions?: string;
  status: BookingStatus;
  acknowledgement: AcknowledgementStatus;
  declineReason?: string;
  revision: number;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedAt: string;
  cancelledReason?: string;
  actionRequiredReason?: string;
}

export type UnavailabilityCategory = 'Holiday' | 'Sickness' | 'Training' | 'Other';
export type UnavailabilityStatus = 'Pending' | 'Approved' | 'Rejected';

export interface UnavailabilityRecord {
  id: string;
  personId: string;
  personName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  slot: BookingSlot;
  category: UnavailabilityCategory;
  status: UnavailabilityStatus;
  reason?: string; // Restricted visibility notes
  createdByUid: string;
  createdAt: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface PlanningBatchConflict {
  personId: string;
  personName: string;
  date: string;
  type: 'duplicate' | 'overlapping' | 'unavailability' | 'competency' | 'project_status' | 'account_ineligible';
  message: string;
}

export interface FCMDeviceSubscription {
  token: string;
  userUid: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  updatedAt: string;
}

/* ========================================================= */
/* STAGE 5: ATTENDANCE, CLAIMS, INVOICES & PAYMENTS           */
/* ========================================================= */

export type PaymentBasis = 'day_rate' | 'hourly_rate';
export type TravelMethod = 'mileage' | 'fixed_amount' | 'actual_fuel' | 'none';

export interface ContractorRateVersion {
  id: string;
  contractorUid: string;
  paymentBasis: PaymentBasis;
  dayRatePence?: number;          // Integer pence
  halfDayRatePence?: number;      // Explicit half-day amount (not auto-halved)
  hourlyRatePence?: number;       // Integer pence
  effectiveFrom: string;          // YYYY-MM-DD
  effectiveTo?: string;           // YYYY-MM-DD or undefined if current
  travelMethod: TravelMethod;
  mileageRatePence?: number;      // Pence per mile
  fixedTravelAmountPence?: number;
  claimableExpenseCategories: string[];
  paymentTermsDays?: number;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
  supersededAt?: string;
  supersededByUid?: string;
}

export interface ContractorTaxConfig {
  contractorUid: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  vatRate?: number;             // e.g. 20 for 20%
  cisApplicable?: boolean;
  cisDeductionRate?: number;    // e.g. 20 or 30
  reverseChargeApplicable?: boolean;
  supplierBusinessName?: string;
  supplierBusinessAddress?: string;
  invoiceNumberPrefix?: string;
  lastInvoiceNumber?: number;
  isVerified?: boolean;
  verifiedByUid?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  configuredByUid?: string;
  configuredByName?: string;
  configuredAt?: string;
  notes?: string;
}

export type ClaimStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Partially Approved'
  | 'Approved'
  | 'Queried'
  | 'Withdrawn';

export type ClaimLineStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Queried'
  | 'Rejected'
  | 'Withdrawn';

export type AttendanceType = 'full_day' | 'half_day' | 'hourly' | 'did_not_attend';

export interface AttendanceLine {
  id: string;
  bookingId?: string;            // Link to original booking
  bookingRevision?: number;
  projectId: string;
  projectReference: string;
  projectTitle: string;
  localDate: string;             // YYYY-MM-DD
  attendanceType: AttendanceType;
  plannedSlot?: BookingSlot;     // What was booked
  actualStartTime?: string;      // HH:mm for hourly
  actualEndTime?: string;        // HH:mm for hourly
  unpaidBreakMinutes?: number;
  actualHours?: number;          // Calculated decimal hours
  isUnplanned: boolean;          // Not from a booking
  unplannedReason?: string;
  explanation?: string;          // Why it differs from plan
  ratePence: number;             // Snapshot of applicable rate
  paymentBasis: PaymentBasis;    // Snapshot
  calculatedAmountPence: number; // Calculated payable amount
  lineStatus: ClaimLineStatus;
  approvedAmountPence?: number;  // May differ from calculated
  reviewerUid?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  queryMessage?: string;
  queryResponse?: string;
  invoiced?: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  invoicedAt?: string;
}

export interface ExpenseLine {
  id: string;
  projectId: string;
  projectReference: string;
  projectTitle: string;
  expenseDate: string;           // YYYY-MM-DD
  category: string;
  description: string;
  amountPence: number;           // Amount being claimed
  receiptFileUrls: string[];     // Multiple images
  receiptFileNames: string[];
  receiptHash?: string;          // For duplicate warning
  fullReceiptTotalPence?: number; // Total on receipt
  previouslyClaimedPence?: number; // Already claimed from this receipt
  lineStatus: ClaimLineStatus;
  approvedAmountPence?: number;
  reviewerUid?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  queryMessage?: string;
  queryResponse?: string;
  invoiced?: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  invoicedAt?: string;
}

export interface TravelLine {
  id: string;
  travelDate: string;            // YYYY-MM-DD
  travelMethod: TravelMethod;
  journeyDescription: string;
  miles?: number;
  mileageRatePence?: number;     // Snapshot
  fixedAmountPence?: number;
  actualFuelAmountPence?: number;
  fuelReceiptUrls?: string[];
  fuelReceiptFileNames?: string[];
  totalAmountPence: number;
  // Project allocation for travel
  projectAllocations: TravelProjectAllocation[];
  lineStatus: ClaimLineStatus;
  approvedAmountPence?: number;
  reviewerUid?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  queryMessage?: string;
  queryResponse?: string;
  invoiced?: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  invoicedAt?: string;
}

export interface TravelProjectAllocation {
  projectId: string;
  projectReference: string;
  projectTitle: string;
  allocatedAmountPence: number;
}

export interface WeeklyClaim {
  id: string;
  claimReference: string;        // Unique human-readable ref
  contractorUid: string;
  contractorName: string;
  weekStartDate: string;         // Monday YYYY-MM-DD
  weekEndDate: string;           // Sunday YYYY-MM-DD
  attendanceLines: AttendanceLine[];
  expenseLines: ExpenseLine[];
  travelLines: TravelLine[];
  totalLabourPence: number;
  totalExpensesPence: number;
  totalTravelPence: number;
  totalClaimPence: number;
  approvedLabourPence?: number;
  approvedExpensesPence?: number;
  approvedTravelPence?: number;
  approvedTotalPence?: number;
  status: ClaimStatus;
  revision: number;
  parentClaimId?: string;        // For supplementary claims
  rateSnapshotIds: string[];     // Rate versions used
  submittedAt?: string;
  submittedDeclaration?: boolean;
  reviewerActions: ClaimReviewAction[];
  withdrawnAt?: string;
  withdrawnReason?: string;
  createdAt: string;
  updatedAt: string;
  isSupplementary: boolean;
}

export interface ClaimReviewAction {
  id: string;
  lineType: 'attendance' | 'expense' | 'travel';
  lineId: string;
  action: 'Approved' | 'Queried' | 'Rejected' | 'Reduced';
  previousAmount?: number;
  approvedAmount?: number;
  reviewerUid: string;
  reviewerName: string;
  note?: string;
  timestamp: string;
}

export type InvoiceStatus = 'Draft' | 'Issued' | 'Matched' | 'Cancelled' | 'Credit Note';

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;         // Supplier's invoice number
  internalReference: string;     // App's internal ref
  claimId: string;
  claimReference: string;
  contractorUid: string;
  contractorName: string;
  // Supplier details snapshot
  supplierName: string;
  supplierAddress: string;
  supplierVatNumber?: string;
  // Customer details snapshot
  customerName: string;
  customerAddress: string;
  // Amounts
  netAmountPence: number;
  vatAmountPence: number;
  cisDeductionPence?: number;
  grossAmountPence: number;
  // Line details snapshot
  lineItems: InvoiceLineItem[];
  // Dates
  invoiceDate: string;           // YYYY-MM-DD
  servicePeriodStart: string;    // YYYY-MM-DD
  servicePeriodEnd: string;      // YYYY-MM-DD
  dueDate?: string;              // YYYY-MM-DD
  // Tax treatment
  vatTreatment?: string;         // e.g. 'Standard 20%', 'Reverse Charge', 'Not VAT Registered'
  cisTreatment?: string;
  // Status and metadata
  status: InvoiceStatus;
  issuedAt?: string;
  issuedByUid: string;
  issuedByName: string;
  isUploadedInvoice: boolean;    // External invoice uploaded vs app-generated
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  // Payment tracking
  totalPaidPence: number;
  outstandingPence: number;
  paymentStatus: 'Unpaid' | 'Part Paid' | 'Paid';
  // Immutability
  snapshotLockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  description: string;
  projectId: string;
  projectReference: string;
  quantity?: number;
  unitDescription?: string;
  ratePence?: number;
  netAmountPence: number;
  sourceLineType: 'attendance' | 'expense' | 'travel';
  sourceLineId: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceInternalRef: string;
  contractorUid: string;
  contractorName: string;
  paymentDate: string;           // YYYY-MM-DD
  amountPence: number;
  paymentReference: string;
  internalNote?: string;
  recordedByUid: string;
  recordedByName: string;
  isReversal: boolean;
  reversesPaymentId?: string;
  reversalReason?: string;
  createdAt: string;
}

export interface ProjectLabourCost {
  projectId: string;
  projectReference: string;
  submittedPendingPence: number;        // Unapproved submitted
  approvedNotInvoicedPence: number;     // Approved, not yet invoiced
  invoicedPence: number;                // Invoiced
  paidPence: number;                    // Paid
  invoicedUnpaidPence: number;          // Invoiced minus paid (outstanding)
  totalRecognisedCostPence: number;     // approvedNotInvoicedPence + invoicedPence
  // Compatibility aliases
  submittedPence?: number;
  approvedPence?: number;
  outstandingPence?: number;
}

// Permissions for financial operations
export type FinancialPermission =
  | 'review_attendance'
  | 'approve_claims'
  | 'issue_invoices'
  | 'record_payments'
  | 'maintain_rates'
  | 'create_materials_request'
  | 'approve_materials_request'
  | 'issue_amend_pos'
  | 'enter_supplier_invoices'
  | 'approve_post_supplier_invoices'
  | 'maintain_suppliers'
  | 'change_purchasing_rules';

// ==========================================
// STAGE 6: MATERIALS & PURCHASING TYPES
// ==========================================

export interface SupplierRecord {
  id: string;
  name: string;
  legalName?: string;
  email: string;
  phone: string;
  address: string;
  gvdAccountNumber?: string;
  supplierReference?: string;
  paymentTermsDays: number; // e.g. 30
  isActive: boolean;
  internalNotes?: string;
  linkedContractorCompanyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchasingRule {
  id: string;
  name: string;
  approverRole?: UserRole;
  approverUid?: string;
  maxOrderGrossPence: number; // Max order allowance (e.g. 50000 = £500)
  aggregatePeriodDays?: number; // e.g. 30 days
  aggregatePeriodLimitPence?: number; // Aggregate limit over period (e.g. 200000 = £2,000)
  isAutoApprovalEnabled: boolean; // Must be explicitly enabled
  applicableProjectIds?: string[]; // Empty = all
  applicableUserIds?: string[]; // Empty = all
  applicableSupplierIds?: string[]; // Empty = all
  expiresAt?: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItem {
  id: string;
  description: string;
  quantity: number;
  unitDescription?: string; // e.g. "bags", "lengths", "m2", "boxes"
  estimatedUnitPricePence: number;
  estimatedTotalPence: number;
}

export interface RequestDocument {
  id: string;
  name: string;
  url: string;
  fileType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface RequestQuery {
  id: string;
  queriedByUid: string;
  queriedByName: string;
  queriedAt: string;
  queryText: string;
  responseByUid?: string;
  responseByName?: string;
  responseAt?: string;
  responseText?: string;
}

export interface RequestApproval {
  approverUid: string;
  approverName: string;
  approverRole: string;
  approvedAt: string;
  isAutoApproved: boolean;
  ruleId?: string;
  ruleVersion?: number;
  approvedGrossPence: number;
  approvedScope: string;
  policyVersion: string;
  revisedScopeNote?: string;
}

export interface MaterialsRequest {
  id: string;
  requestReference: string; // e.g. "GVD-MR-2026-0001"
  projectId: string;
  projectReference: string;
  projectName: string;
  supplierId?: string;
  supplierName?: string;
  suggestedSupplier?: string; // if unlisted
  requesterUid: string;
  requesterName: string;
  requesterRole: UserRole;
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
  status: 'Draft' | 'Submitted' | 'Queried' | 'Approved' | 'Rejected' | 'Cancelled';
  queries?: RequestQuery[];
  approvalDetails?: RequestApproval;
  rejectionReason?: string;
  issuedPoId?: string;
  issuedPoReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitDescription?: string;
  unitPricePence: number;
  totalPricePence: number;
  quantityReceived: number;
}

export interface PORevisionRecord {
  revision: number;
  revisedAt: string;
  revisedByUid: string;
  revisedByName: string;
  changeDescription: string;
  reason: string;
  previousGrossPence: number;
  newGrossPence: number;
  approvedByUid: string;
}

export interface MaterialReceiptRecord {
  id: string;
  receivedDate: string;
  recordedByUid: string;
  recordedByName: string;
  type: 'All received' | 'Part received' | 'Issue with delivery';
  note?: string;
  deliveryNoteUrl?: string;
  itemsReceived?: { itemId: string; quantity: number }[];
  recordedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poReference: string; // e.g. "GVD-PO-2026-0001"
  requestId: string;
  requestReference: string;
  projectId: string;
  projectReference: string;
  projectName: string;
  supplierId: string;
  supplierName: string;
  supplierAddress?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  requesterUid: string;
  requesterName: string;
  approverUid: string;
  approverName: string;
  approvedScope: string;
  items: POItem[];
  authorisedNetPence: number;
  authorisedVatPence: number;
  authorisedGrossPence: number;
  valueBasis: 'Net' | 'VAT' | 'Gross';
  deliveryType: 'collection' | 'delivery';
  deliveryAddress: string;
  specialInstructions?: string;
  issueDate: string; // YYYY-MM-DD
  revision: number;
  status: 'Issued' | 'Part Fulfilled' | 'Fulfilled' | 'Closed' | 'Cancelled';
  revisions?: PORevisionRecord[];
  cancellationReason?: string;
  cancelledByUid?: string;
  cancelledAt?: string;
  receivedMaterials?: MaterialReceiptRecord[];
  invoicedGrossPence: number;
  remainingAuthorisedGrossPence: number;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface POAllocation {
  poId: string;
  poReference: string;
  allocatedGrossPence: number;
  allocatedNetPence: number;
}

export interface ProjectAllocation {
  projectId: string;
  projectReference: string;
  allocatedNetPence: number;
  allocatedVatPence: number;
  allocatedGrossPence: number;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  normalizedInvoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;
  paymentTermsDays?: number;
  netAmountPence: number;
  vatAmountPence: number;
  grossAmountPence: number;
  vatTreatment: string; // e.g. "Standard 20%", "Zero Rated", "Reverse Charge"
  invoiceFileUrl?: string;
  invoiceFileName?: string;
  description?: string;
  poAllocations: POAllocation[];
  projectAllocations: ProjectAllocation[];
  hasException: boolean;
  exceptionReason?: string;
  exceptionApprovedByUid?: string;
  status: 'Draft' | 'Awaiting Review' | 'Queried' | 'Approved' | 'Rejected';
  paymentStatus: 'Unpaid' | 'Part Paid' | 'Paid' | 'Credit Balance';
  totalPaidPence: number;
  outstandingPence: number;
  totalCreditsAppliedPence: number;
  duplicateCheckHash: string;
  crossModuleCheck?: {
    isFlagged: boolean;
    reason?: string;
    matchedExpenseId?: string;
    resolvedByUid?: string;
  };
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  postedAt?: string;
  snapshotLockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierCreditNote {
  id: string;
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
  recordedByUid: string;
  recordedByName: string;
  appliedToInvoiceId?: string;
  createdAt: string;
}

export interface SupplierPaymentRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  paymentDate: string;
  amountPence: number;
  paymentReference: string;
  internalNote?: string;
  invoiceAllocations: { invoiceId: string; invoiceNumber: string; amountPence: number }[];
  recordedByUid: string;
  recordedByName: string;
  isReversal: boolean;
  reversesPaymentId?: string;
  reversalReason?: string;
  createdAt: string;
}

export interface ProjectMaterialsCost {
  projectId: string;
  projectReference: string;
  pendingRequestsPence: number; // submitted, not yet approved
  openCommitmentsPence: number; // issued POs remaining authorised headroom
  postedInvoicesPence: number; // approved & posted supplier invoices
  postedCreditsPence: number; // credit notes
  netMaterialsCostPence: number; // postedInvoicesPence - postedCreditsPence
  totalCommittedAndActualPence: number; // netMaterialsCostPence + openCommitmentsPence
  invoicedPaidPence: number; // payments made
  invoicedOutstandingPence: number; // unpaid invoices
  isDefinitiveCost: boolean; // false! (labelled incomplete until subcontracts/variations implemented)
}

