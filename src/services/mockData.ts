import type { 
  UserProfile, 
  PersonRecord, 
  CompetencyDocument, 
  RequirementConfig, 
  Project, 
  ProjectDocument, 
  Booking, 
  AttendanceClaim, 
  PurchaseOrder, 
  SupplierInvoice, 
  SubcontractOrder, 
  SubcontractVariation, 
  SubcontractApplication, 
  AIMaterialsList, 
  CustomerAccessToken,
  AuditLog
} from '../types';

export const MOCK_USERS: UserProfile[] = [
  {
    uid: 'user-owner-01',
    email: 'shergy82@gmail.com',
    fullName: 'Phil Shergold',
    phone: '07700 900123',
    accountType: 'Employee',
    role: 'Owner',
    status: 'active',
    trades: ['General Management', 'Quantity Surveying'],
    planningEligible: true,
    assignedProjectIds: ['prj-001', 'prj-002'],
    createdAt: '2026-01-01T09:00:00Z',
    updatedAt: '2026-01-01T09:00:00Z'
  },
  {
    uid: 'user-admin-01',
    email: 'sarah.jenkins@gvdcontracts.co.uk',
    fullName: 'Sarah Jenkins',
    phone: '07700 900456',
    accountType: 'Employee',
    role: 'Admin',
    status: 'active',
    trades: ['Operations Management'],
    planningEligible: false,
    assignedProjectIds: ['prj-001', 'prj-002'],
    createdAt: '2026-01-02T09:00:00Z',
    updatedAt: '2026-01-02T09:00:00Z'
  },
  {
    uid: 'user-pm-01',
    email: 'dave.miller@gvdcontracts.co.uk',
    fullName: 'Dave Miller',
    phone: '07700 900789',
    accountType: 'Employee',
    role: 'ProjectManager',
    status: 'active',
    trades: ['Site Supervision', 'Carpentry'],
    planningEligible: true,
    assignedProjectIds: ['prj-001', 'prj-002'],
    createdAt: '2026-01-03T09:00:00Z',
    updatedAt: '2026-01-03T09:00:00Z'
  },
  {
    uid: 'user-contractor-01',
    email: 'mark.davies@daviescarpentry.co.uk',
    fullName: 'Mark Davies',
    phone: '07700 900111',
    accountType: 'IndividualContractor',
    role: 'IndividualContractor',
    status: 'active',
    companyName: 'Davies Carpentry & Joinery',
    trades: ['Carpentry & Joinery', 'Drylining'],
    planningEligible: true,
    assignedProjectIds: ['prj-001', 'prj-002'],
    createdAt: '2026-01-05T09:00:00Z',
    updatedAt: '2026-01-05T09:00:00Z'
  },
  {
    uid: 'user-company-01',
    email: 'john@apexplumbing.co.uk',
    fullName: 'John Taylor',
    phone: '07700 900222',
    accountType: 'ContractorCompany',
    role: 'ContractorCompany',
    status: 'active',
    companyName: 'Apex Plumbing & Mechanical Ltd',
    companyContactPerson: 'John Taylor',
    trades: ['Plumbing & Heating', 'Mechanical'],
    planningEligible: true,
    assignedProjectIds: ['prj-001'],
    createdAt: '2026-01-06T09:00:00Z',
    updatedAt: '2026-01-06T09:00:00Z'
  },
  {
    uid: 'user-pending-01',
    email: 'tom.bennett@gmail.com',
    fullName: 'Tom Bennett',
    phone: '07700 900333',
    accountType: 'IndividualContractor',
    role: 'IndividualContractor',
    status: 'pending',
    trades: ['Plastering'],
    planningEligible: false,
    assignedProjectIds: [],
    createdAt: '2026-09-22T10:00:00Z',
    updatedAt: '2026-09-22T10:00:00Z'
  }
];

export const MOCK_PEOPLE: PersonRecord[] = [
  ...MOCK_USERS.map(u => ({
    ...u,
    commercials: u.uid === 'user-contractor-01' ? {
      utr: '1234567890',
      vatNumber: 'GB987654321',
      businessAddress: '12 Industrial Estate, Reading, RG1 2AG',
      dayRatePence: 20000, // £200.00 / day
      halfDayRatePence: 11000,
      hourlyRatePence: 3000,
      travelRatePencePerMile: 45, // 45p per mile
      internalNotes: 'Top quality joiner. CSCS Gold Card verified.'
    } : undefined
  }))
];

export const MOCK_REQUIREMENTS: RequirementConfig[] = [
  {
    id: 'req-cscs',
    name: 'CSCS Card',
    description: 'Construction Skills Certification Scheme card',
    applicableTrades: ['Carpentry & Joinery', 'Drylining', 'Plastering', 'Plumbing & Heating', 'General Management'],
    applicableAccountTypes: ['Employee', 'IndividualContractor'],
    isMandatory: true,
    isOverridable: false,
    doesNotExpire: false
  },
  {
    id: 'req-asbestos',
    name: 'Asbestos Awareness Training',
    description: 'UKATA or IOSH Accredited Asbestos Awareness Certificate',
    applicableTrades: ['Carpentry & Joinery', 'Drylining', 'Plastering', 'Plumbing & Heating'],
    applicableAccountTypes: ['Employee', 'IndividualContractor'],
    isMandatory: true,
    isOverridable: true,
    doesNotExpire: false
  },
  {
    id: 'req-insurance',
    name: 'Public Liability Insurance (£5m)',
    description: 'Current Company Public Liability Policy Schedule',
    applicableTrades: ['Plumbing & Heating', 'Mechanical', 'Electrical'],
    applicableAccountTypes: ['ContractorCompany'],
    isMandatory: true,
    isOverridable: false,
    doesNotExpire: false
  }
];

export const MOCK_COMPETENCIES: CompetencyDocument[] = [
  {
    id: 'comp-001',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    trade: 'Carpentry & Joinery',
    requirementName: 'CSCS Card',
    issuerProvider: 'CITB',
    referenceNumber: 'CSCS-987654',
    issueDate: '2024-03-15',
    expiryDate: '2029-03-15',
    doesNotExpire: false,
    reviewStatus: 'Valid',
    verifiedBy: 'Sarah Jenkins',
    verifiedAt: '2026-01-05',
    updatedAt: '2026-01-05T10:00:00Z'
  },
  {
    id: 'comp-002',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    trade: 'Carpentry & Joinery',
    requirementName: 'Asbestos Awareness Training',
    issuerProvider: 'UKATA',
    referenceNumber: 'UKATA-2025-442',
    issueDate: '2025-10-10',
    expiryDate: '2026-10-10', // Expiring soon in ~17 days!
    doesNotExpire: false,
    reviewStatus: 'Expiring Soon',
    verifiedBy: 'Sarah Jenkins',
    verifiedAt: '2026-01-05',
    updatedAt: '2026-09-01T09:00:00Z'
  },
  {
    id: 'comp-003',
    personId: 'user-pending-01',
    personName: 'Tom Bennett',
    trade: 'Plastering',
    requirementName: 'CSCS Card',
    issuerProvider: 'CITB',
    referenceNumber: 'CSCS-112233',
    issueDate: '2024-01-10',
    expiryDate: '2026-01-10', // EXPIRED!
    doesNotExpire: false,
    reviewStatus: 'Expired',
    updatedAt: '2026-09-22T10:00:00Z'
  }
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'prj-1',
    reference: 'GVD-PRJ-2026-050',
    customerName: 'Gillian (50 Wallis Way)',
    customerPhone: '01782 890123',
    customerEmail: 'gillian@stokecouncil.gov.uk',
    siteAddress: '50 Wallis Way, Stoke-on-Trent',
    postcode: 'ST4 8RR',
    projectType: 'Level Access Shower (LAS) Refurbishment',
    responsibleManagerId: 'user-owner-01',
    responsibleManagerName: 'Phil Shergold',
    startDate: '2026-09-20',
    targetCompletionDate: '2026-10-15',
    status: 'In Progress',
    accessNotes: 'Occupied bungalow. Level access entrance at front door.',
    contractValuePence: 650000, // £6,500.00
    customerVariationsPence: 0,
    assignedUserIds: ['user-owner-01', 'user-admin-01', 'user-pm-01', 'user-contractor-01', 'user-company-01'],
    defectsChecklistComplete: false,
    financialClosureComplete: false,
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-09-23T10:00:00Z'
  },
  {
    id: 'prj-001',
    reference: 'GVD-PRJ-2026-001',
    customerName: 'Grosvenor Estates Ltd',
    customerPhone: '020 7946 0123',
    customerEmail: 'projects@grosvenorestates.co.uk',
    siteAddress: '14 Grosvenor Square, Mayfair, London',
    postcode: 'W1K 6LD',
    projectType: 'High-End Luxury Residential Refurbishment',
    responsibleManagerId: 'user-pm-01',
    responsibleManagerName: 'Dave Miller',
    startDate: '2026-09-01',
    targetCompletionDate: '2026-12-15',
    status: 'In Progress',
    accessNotes: 'Keycode front door: 4892#. Parking permit required on street.',
    contractValuePence: 12500000, // £125,000.00
    customerVariationsPence: 1500000, // £15,000.00
    quoteExtraction: {
      originalFileName: 'Grosvenor_Square_Refurb_Quote_v2.pdf',
      netPence: 12500000,
      vatPence: 2500000,
      grossPence: 15000000,
      exclusions: ['Scaffolding by main contractor', 'Structural engineer signoff fees'],
      provisionalSums: [
        { item: 'Unforeseen timber decay repairs', amountPence: 500000 }
      ],
      sourcePageReferences: ['Page 3', 'Page 7 - Schedule of Works'],
      reviewedBy: 'Phil Shergold',
      reviewedAt: '2026-09-02'
    },
    assignedUserIds: ['user-owner-01', 'user-admin-01', 'user-pm-01', 'user-contractor-01', 'user-company-01'],
    defectsChecklistComplete: false,
    financialClosureComplete: false,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-23T10:00:00Z'
  },
  {
    id: 'prj-002',
    reference: 'GVD-PRJ-2026-002',
    customerName: 'Park Lane Hospitality Group',
    customerPhone: '020 7946 0888',
    customerEmail: 'refurb@parklanehg.co.uk',
    siteAddress: '28 Park Lane, Mayfair, London',
    postcode: 'W1K 1QA',
    projectType: 'Boutique Hotel Ensuite Fitout',
    responsibleManagerId: 'user-pm-01',
    responsibleManagerName: 'Dave Miller',
    startDate: '2026-09-15',
    targetCompletionDate: '2026-11-30',
    status: 'In Progress',
    accessNotes: 'Loading bay entrance off Curzon Street. Deliveries 07:00-11:00.',
    contractValuePence: 8500000, // £85,000.00
    customerVariationsPence: 0,
    assignedUserIds: ['user-owner-01', 'user-admin-01', 'user-pm-01', 'user-contractor-01'],
    createdAt: '2026-09-10T08:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z'
  }
];

export const MOCK_DOCUMENTS: ProjectDocument[] = [
  {
    id: 'doc-001',
    projectId: 'prj-001',
    title: 'Approved Architectural Layout Drawing A3',
    fileName: 'Grosvenor_Arch_Plan_A3_RevC.pdf',
    fileUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    fileType: 'pdf',
    category: 'Drawing',
    visibility: 'Assigned Team',
    allowedUserIds: ['user-owner-01', 'user-admin-01', 'user-pm-01', 'user-contractor-01', 'user-company-01'],
    uploaderId: 'user-pm-01',
    uploaderName: 'Dave Miller',
    uploadedAt: '2026-09-02T10:00:00Z'
  },
  {
    id: 'doc-002',
    projectId: 'prj-001',
    title: 'Bathroom Strip-out & Structural Condition',
    fileName: 'site_photo_before_stripout.jpg',
    fileUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
    fileType: 'image',
    category: 'Photo',
    photoCategory: 'Before',
    visibility: 'Assigned Team',
    uploaderId: 'user-pm-01',
    uploaderName: 'Dave Miller',
    caption: 'Existing wetroom before wall removal',
    uploadedAt: '2026-09-12T14:30:00Z'
  }
];

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'bk-001',
    projectId: 'prj-001',
    projectReference: 'GVD-PRJ-2026-001',
    projectAddress: '14 Grosvenor Square, London',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    trade: 'Carpentry & Joinery',
    date: '2026-09-21', // Mon
    slot: 'Full Day',
    status: 'Accepted',
    plannerId: 'user-pm-01',
    plannerName: 'Dave Miller',
    createdAt: '2026-09-18T09:00:00Z',
    acknowledgedAt: '2026-09-18T10:15:00Z'
  },
  {
    id: 'bk-002',
    projectId: 'prj-001',
    projectReference: 'GVD-PRJ-2026-001',
    projectAddress: '14 Grosvenor Square, London',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    trade: 'Carpentry & Joinery',
    date: '2026-09-22', // Tue
    slot: 'Full Day',
    status: 'Accepted',
    plannerId: 'user-pm-01',
    plannerName: 'Dave Miller',
    createdAt: '2026-09-18T09:00:00Z',
    acknowledgedAt: '2026-09-18T10:15:00Z'
  },
  {
    id: 'bk-003',
    projectId: 'prj-001',
    projectReference: 'GVD-PRJ-2026-001',
    projectAddress: '14 Grosvenor Square, London',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    trade: 'Carpentry & Joinery',
    date: '2026-09-23', // Wed
    slot: 'Full Day',
    status: 'Accepted',
    plannerId: 'user-pm-01',
    plannerName: 'Dave Miller',
    createdAt: '2026-09-18T09:00:00Z',
    acknowledgedAt: '2026-09-18T10:15:00Z'
  },
  {
    id: 'bk-004',
    projectId: 'prj-002',
    projectReference: 'GVD-PRJ-2026-002',
    projectAddress: '28 Park Lane, London',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    trade: 'Carpentry & Joinery',
    date: '2026-09-24', // Thu
    slot: 'Full Day',
    status: 'Accepted',
    plannerId: 'user-pm-01',
    plannerName: 'Dave Miller',
    createdAt: '2026-09-18T09:00:00Z',
    acknowledgedAt: '2026-09-18T10:15:00Z'
  },
  {
    id: 'bk-005',
    projectId: 'prj-002',
    projectReference: 'GVD-PRJ-2026-002',
    projectAddress: '28 Park Lane, London',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    trade: 'Carpentry & Joinery',
    date: '2026-09-25', // Fri
    slot: 'Full Day',
    status: 'Accepted',
    plannerId: 'user-pm-01',
    plannerName: 'Dave Miller',
    createdAt: '2026-09-18T09:00:00Z',
    acknowledgedAt: '2026-09-18T10:15:00Z'
  }
];

export const MOCK_CLAIMS: AttendanceClaim[] = [
  {
    id: 'claim-001',
    personId: 'user-contractor-01',
    personName: 'Mark Davies',
    weekStartDate: '2026-09-21',
    daysWorked: [
      {
        date: '2026-09-21',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        slot: 'Full Day',
        dayRatePence: 20000,
        calculatedCostPence: 20000 // £200
      },
      {
        date: '2026-09-22',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        slot: 'Full Day',
        dayRatePence: 20000,
        calculatedCostPence: 20000 // £200
      },
      {
        date: '2026-09-23',
        projectId: 'prj-001',
        projectReference: 'GVD-PRJ-2026-001',
        slot: 'Full Day',
        dayRatePence: 20000,
        calculatedCostPence: 20000 // £200 (Total Prj A = £600)
      },
      {
        date: '2026-09-24',
        projectId: 'prj-002',
        projectReference: 'GVD-PRJ-2026-002',
        slot: 'Full Day',
        dayRatePence: 20000,
        calculatedCostPence: 20000 // £200
      },
      {
        date: '2026-09-25',
        projectId: 'prj-002',
        projectReference: 'GVD-PRJ-2026-002',
        slot: 'Full Day',
        dayRatePence: 20000,
        calculatedCostPence: 20000 // £200 (Total Prj B = £400)
      }
    ],
    expenses: [],
    travelMiles: 0,
    travelRatePencePerMile: 45,
    travelTotalPence: 10000, // £100 travel allowance split £60 / £40
    travelProjectAllocations: [
      { projectId: 'prj-001', amountPence: 6000 }, // £60.00 -> Project A total = £660.00
      { projectId: 'prj-002', amountPence: 4000 }  // £40.00 -> Project B total = £440.00
    ],
    totalClaimPence: 110000, // Exact £1,100.00 example from Brief!
    status: 'Approved',
    approvedBy: 'Sarah Jenkins',
    approvedAt: '2026-09-23T11:00:00Z',
    approvedAmountPence: 110000,
    invoiceNumber: 'INV-MD-2026-09',
    createdAt: '2026-09-23T09:00:00Z',
    updatedAt: '2026-09-23T11:00:00Z'
  }
];

export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-001',
    reference: 'GVD-PO-2026-001',
    projectId: 'prj-001',
    projectReference: 'GVD-PRJ-2026-001',
    supplierName: 'Travis Perkins Mayfair',
    purposeItems: 'Moisture resistant plasterboard & metal stud framing',
    requestedBy: 'user-pm-01',
    requestedByName: 'Dave Miller',
    approvedBy: 'user-owner-01',
    approvedByName: 'Phil Shergold',
    approvedValuePence: 85000, // £850.00
    status: 'Approved',
    createdAt: '2026-09-05T10:00:00Z',
    updatedAt: '2026-09-05T10:30:00Z'
  }
];

export const MOCK_SUPPLIER_INVOICES: SupplierInvoice[] = [
  {
    id: 'sinv-001',
    purchaseOrderId: 'po-001',
    poReference: 'GVD-PO-2026-001',
    supplierName: 'Travis Perkins Mayfair',
    invoiceNumber: 'TP-INV-99481',
    invoiceDate: '2026-09-10',
    netPence: 85000,
    vatPence: 17000,
    grossPence: 102000,
    projectAllocations: [
      { projectId: 'prj-001', amountPence: 85000 }
    ],
    matchedStatus: 'Matched',
    matchedBy: 'Emma Watson',
    matchedAt: '2026-09-12T11:00:00Z',
    createdAt: '2026-09-12T10:00:00Z'
  }
];

export const MOCK_SUBCONTRACT_ORDERS: SubcontractOrder[] = [
  {
    id: 'sco-001',
    reference: 'GVD-SCO-2026-001',
    projectId: 'prj-001',
    projectReference: 'GVD-PRJ-2026-001',
    companyUserId: 'user-company-01',
    companyName: 'Apex Plumbing & Mechanical Ltd',
    trade: 'Plumbing & Heating',
    scopeDescription: 'Complete 1st & 2nd fix wetroom plumbing, sanitaryware installation and testing',
    originalValuePence: 1000000, // £10,000.00 (Example from Brief section 15 Scenario I)
    approvedVariationsPence: 100000, // £1,000.00 approved variation
    currentAuthorizedValuePence: 1100000, // £11,000.00 total authorized
    submittedApplicationsPence: 400000,
    certifiedAmountPence: 400000, // £4,000.00 certified (Remaining entitlement = £7,000.00)
    paidAmountPence: 400000,
    remainingEntitlementPence: 700000, // £7,000.00 exactly!
    status: 'Active',
    createdAt: '2026-09-02T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z'
  }
];

export const MOCK_SUBCONTRACT_VARIATIONS: SubcontractVariation[] = [
  {
    id: 'var-001',
    subcontractOrderId: 'sco-001',
    scoReference: 'GVD-SCO-2026-001',
    variationReference: 'VAR-01',
    description: 'Additional concealed valve installation & secondary pipework rerouting',
    netValuePence: 100000, // £1,000.00
    status: 'Approved',
    submittedBy: 'John Taylor',
    approvedBy: 'Phil Shergold',
    approvedAt: '2026-09-15T14:00:00Z',
    createdAt: '2026-09-14T09:00:00Z'
  }
];

export const MOCK_SUBCONTRACT_APPLICATIONS: SubcontractApplication[] = [
  {
    id: 'app-001',
    subcontractOrderId: 'sco-001',
    scoReference: 'GVD-SCO-2026-001',
    applicationNumber: 1,
    cumulativeWorkClaimedPence: 400000, // £4,000.00
    previousCertifiedPence: 0,
    thisApplicationClaimedPence: 400000,
    certifiedAmountPence: 400000,
    status: 'Paid',
    certifiedBy: 'Phil Shergold',
    certifiedAt: '2026-09-18T10:00:00Z',
    createdAt: '2026-09-16T09:00:00Z'
  }
];

export const MOCK_AI_MATERIALS: AIMaterialsList[] = [
  {
    id: 'mat-001',
    reference: 'GVD-MAT-2026-001',
    projectId: 'prj-001',
    projectReference: 'GVD-PRJ-2026-001',
    version: 1,
    tradesSelected: ['Plastering', 'Tiling', 'Plumbing & Heating'],
    confirmedInputs: {
      drawingScale: '1:50 @ A3',
      ceilingHeightMeters: 2.7,
      wallConstruction: '100mm Metal Stud with Insulation',
      substrateType: '12.5mm Moisture Resistant Plasterboard',
      legendNotes: 'Green dashed line denotes tanking membrane zone'
    },
    materials: [
      {
        id: 'm-1',
        trade: 'Plastering',
        itemDescription: 'Knauf 12.5mm Moisture Resistant Board 2400x1200mm',
        quantity: 34,
        unit: 'Sheets',
        coverageDetail: '78.5 m2 wetroom walls after deducting 3.2 m2 door/window openings',
        packRoundingApplied: true,
        estimatedNetUnitPence: 1450,
        estimatedTotalPence: 49300,
        sourceDrawingPage: 'Page 2 - Layout A3',
        confidence: 'High',
        siteCheckRequired: false
      },
      {
        id: 'm-2',
        trade: 'Tiling',
        itemDescription: 'BAL Tanking Kit Waterproofing System',
        quantity: 2,
        unit: 'Kits',
        coverageDetail: 'Ensuite shower zone wall & floor perimeter',
        packRoundingApplied: false,
        estimatedNetUnitPence: 8500,
        estimatedTotalPence: 17000,
        sourceDrawingPage: 'Page 2',
        confidence: 'High',
        siteCheckRequired: true
      }
    ],
    sequenceOfWorks: [
      {
        id: 'seq-1',
        stepNumber: 1,
        phase: 'Preparation',
        description: 'Verify drawing scale (1:50) on site and locate water isolation valve.',
        trade: 'Plumbing & Heating',
        specialistRequired: true
      },
      {
        id: 'seq-2',
        stepNumber: 2,
        phase: 'Strip-out',
        description: 'Carefully strip out existing sanitaryware and timber framing.',
        trade: 'Carpentry & Joinery',
        specialistRequired: false
      },
      {
        id: 'seq-3',
        stepNumber: 3,
        phase: 'First Fix',
        description: 'Install 100mm metal stud partitions and 1st fix pipework.',
        trade: 'Plumbing & Heating',
        specialistRequired: true
      },
      {
        id: 'seq-4',
        stepNumber: 4,
        phase: 'Substrate Prep',
        description: 'Fix 12.5mm moisture resistant board and apply tanking kit.',
        trade: 'Plastering',
        specialistRequired: false
      },
      {
        id: 'seq-5',
        stepNumber: 5,
        phase: 'Finishes',
        description: 'Tile shower area and plaster non-tiled ceiling/walls.',
        trade: 'Tiling',
        specialistRequired: false
      },
      {
        id: 'seq-6',
        stepNumber: 6,
        phase: 'Second Fix',
        description: 'Fit sanitaryware, thermostatic valves, and test pressure.',
        trade: 'Plumbing & Heating',
        specialistRequired: true
      }
    ],
    totalEstimatedNetPence: 66300,
    status: 'Approved',
    createdBy: 'user-pm-01',
    approvedBy: 'Phil Shergold',
    approvedAt: '2026-09-10T11:00:00Z',
    createdAt: '2026-09-10T10:00:00Z'
  }
];

export const MOCK_CUSTOMER_TOKEN: CustomerAccessToken = {
  id: 'tok-001',
  projectId: 'prj-001',
  projectReference: 'GVD-PRJ-2026-001',
  customerName: 'Grosvenor Estates Ltd',
  tokenHash: 'gvd-token-998877665544332211',
  rawToken: 'gvd-token-998877665544332211',
  pinRequired: false,
  isRevoked: false,
  createdAt: '2026-09-02T10:00:00Z'
};

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    actorId: 'user-owner-01',
    actorName: 'Phil Shergold',
    actorRole: 'Owner',
    action: 'APPROVE_CLAIM',
    entityType: 'AttendanceClaim',
    entityId: 'claim-001',
    details: 'Approved weekly claim for Mark Davies (£1,100.00 total)',
    timestamp: '2026-09-23T11:00:00Z'
  }
];
