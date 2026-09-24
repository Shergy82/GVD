import type { 
  CompetencyDocument, 
  CompetencyStatus, 
  RequirementConfig, 
  UserProfile, 
  PlanningEligibilityResult 
} from '../types';

/**
 * Gets current date string in YYYY-MM-DD format according to Europe/London timezone.
 */
export function getTodayLondonString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(now); // YYYY-MM-DD
}

/**
 * Calculates accurate competency status dynamically based on dates, review state, and reminder thresholds.
 */
export function calculateCompetencyStatus(
  doc?: CompetencyDocument | null,
  reminderWindowDays: number = 60,
  referenceDateStr?: string
): CompetencyStatus {
  if (!doc) return 'Missing';

  // If status is rejected
  if (doc.reviewStatus === 'Rejected') return 'Rejected';

  // If status is still awaiting initial review
  if (doc.reviewStatus === 'Awaiting Review') return 'Awaiting Review';

  const today = referenceDateStr || getTodayLondonString();

  // If document does not expire and is reviewed/approved
  if (doc.doesNotExpire || !doc.expiryDate) {
    if (doc.issueDate && doc.issueDate > today) {
      // Future-dated issue date is not valid yet
      return 'Awaiting Review';
    }
    return 'Valid';
  }

  // Future-dated issue date
  if (doc.issueDate && doc.issueDate > today) {
    return 'Awaiting Review';
  }

  const expiry = doc.expiryDate;

  // Expired: Today is strictly after expiry date (valid through stated date in Europe/London, expired from following day)
  if (today > expiry) {
    return 'Expired';
  }

  // Calculate days remaining until expiry
  const todayDate = new Date(today + 'T00:00:00');
  const expiryDate = new Date(expiry + 'T00:00:00');
  const diffTime = expiryDate.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= reminderWindowDays) {
    return 'Expiring Soon';
  }

  return 'Valid';
}

/**
 * Determines overall status for a requirement type given a list of submitted document versions.
 * Handles current approved version vs replacement awaiting review.
 */
export function getOverallRequirementStatus(
  requirement: RequirementConfig,
  user: UserProfile,
  allDocs: CompetencyDocument[],
  referenceDateStr?: string
): {
  status: CompetencyStatus;
  currentApprovedDoc?: CompetencyDocument;
  pendingReplacementDoc?: CompetencyDocument;
  statusNote?: string;
} {
  const today = referenceDateStr || getTodayLondonString();

  // Filter docs for this requirement and holder
  const reqDocs = allDocs.filter(d => d.requirementId === requirement.id && d.holderId === user.uid);

  if (reqDocs.length === 0) {
    return { status: 'Missing' };
  }

  // Find currently approved document version
  const currentApproved = reqDocs.find(d => d.isCurrentVersion && d.reviewStatus !== 'Awaiting Review' && d.reviewStatus !== 'Rejected');
  
  // Find replacement awaiting review
  const pendingReplacement = reqDocs.find(d => d.reviewStatus === 'Awaiting Review');

  if (!currentApproved) {
    if (pendingReplacement) {
      return {
        status: 'Awaiting Review',
        pendingReplacementDoc: pendingReplacement,
        statusNote: 'Evidence submitted, awaiting GVD review.'
      };
    }

    const latestRejected = reqDocs.find(d => d.reviewStatus === 'Rejected');
    if (latestRejected) {
      return {
        status: 'Rejected',
        statusNote: latestRejected.rejectionReason || 'Submitted evidence was rejected.'
      };
    }

    return { status: 'Missing' };
  }

  // Calculate status of current approved document
  const currentStatus = calculateCompetencyStatus(currentApproved, 60, today);

  if (pendingReplacement) {
    if (currentStatus === 'Valid' || currentStatus === 'Expiring Soon') {
      const expDate = currentApproved.expiryDate ? new Date(currentApproved.expiryDate).toLocaleDateString('en-GB') : 'No Expiry';
      return {
        status: currentStatus,
        currentApprovedDoc: currentApproved,
        pendingReplacementDoc: pendingReplacement,
        statusNote: `Current certificate valid until ${expDate}. Replacement awaiting review.`
      };
    }
    if (currentStatus === 'Expired') {
      return {
        status: 'Expired',
        currentApprovedDoc: currentApproved,
        pendingReplacementDoc: pendingReplacement,
        statusNote: 'Current certificate has expired. Replacement is awaiting review.'
      };
    }
  }

  return {
    status: currentStatus,
    currentApprovedDoc: currentApproved
  };
}

/**
 * Reusable server-side / client planning eligibility check.
 * Assesses a person against configured requirements for a supplied work date or date range.
 */
export function checkPlanningEligibility(
  personId: string,
  startDateStr: string,
  endDateStr: string = startDateStr,
  user: UserProfile,
  allDocs: CompetencyDocument[],
  requirements: RequirementConfig[]
): PlanningEligibilityResult {
  const metRequirements: string[] = [];
  const warnings: string[] = [];
  const mandatoryMissingOrExpired: string[] = [];
  const expiringDuringPeriod: string[] = [];

  // Filter applicable requirements for user's category and trade
  const applicableReqs = requirements.filter(r => {
    if (!r.isActive) return false;
    
    // Check account type applicability
    const categoryMatch = r.applicableAccountTypes.length === 0 || r.applicableAccountTypes.includes(user.applicationCategory);
    if (!categoryMatch) return false;

    // Check trade applicability
    if (r.applicableTrades.length > 0) {
      const userTrade = user.primaryTrade;
      if (!userTrade || !r.applicableTrades.includes(userTrade)) {
        return false;
      }
    }
    return true;
  });

  applicableReqs.forEach(req => {
    const outcome = getOverallRequirementStatus(req, user, allDocs, startDateStr);

    if (outcome.status === 'Valid') {
      metRequirements.push(req.name);

      // Check if document expires during requested date range
      if (outcome.currentApprovedDoc?.expiryDate) {
        const expDate = outcome.currentApprovedDoc.expiryDate;
        if (expDate >= startDateStr && expDate <= endDateStr) {
          expiringDuringPeriod.push(`${req.name} (expires on ${new Date(expDate).toLocaleDateString('en-GB')})`);
        }
      }
    } else if (outcome.status === 'Expiring Soon') {
      metRequirements.push(req.name);
      warnings.push(`${req.name} is expiring soon (status: Expiring Soon)`);

      if (outcome.currentApprovedDoc?.expiryDate) {
        const expDate = outcome.currentApprovedDoc.expiryDate;
        if (expDate >= startDateStr && expDate <= endDateStr) {
          expiringDuringPeriod.push(`${req.name} (expires on ${new Date(expDate).toLocaleDateString('en-GB')})`);
        }
      }
    } else {
      if (req.isMandatory) {
        mandatoryMissingOrExpired.push(`${req.name} [Mandatory] (${outcome.status})`);
      } else {
        warnings.push(`${req.name} [Advisory] (${outcome.status})`);
      }
    }
  });

  const isEligible = mandatoryMissingOrExpired.length === 0;

  return {
    personId,
    personName: user.fullName,
    isEligible,
    metRequirements,
    warnings,
    mandatoryMissingOrExpired,
    expiringDuringPeriod
  };
}
