import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import type { CompetencyDocument, RequirementConfig, UserProfile, AppNotification } from '../types';
import { getTodayLondonString, calculateCompetencyStatus } from './competencyLogic';

/**
 * Runs daily competency expiry monitoring scan.
 * Creates deduplicated in-app notifications for holders and reviewers.
 */
export async function runDailyExpiryCheck(): Promise<{ scannedCount: number; notificationsCreated: number }> {
  const today = getTodayLondonString();
  const todayDate = new Date(today + 'T00:00:00');

  // Fetch active user profiles
  const usersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'approved')));
  const usersMap = new Map<string, UserProfile>();
  usersSnap.forEach(docSnap => {
    usersMap.set(docSnap.id, { uid: docSnap.id, ...docSnap.data() } as UserProfile);
  });

  // Fetch requirement configs
  const reqSnap = await getDocs(query(collection(db, 'requirement_configs'), where('isActive', '==', true)));
  const reqMap = new Map<string, RequirementConfig>();
  reqSnap.forEach(docSnap => {
    reqMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as RequirementConfig);
  });

  // Fetch competencies
  const compSnap = await getDocs(collection(db, 'competencies'));
  const docsList: CompetencyDocument[] = [];
  compSnap.forEach(docSnap => {
    docsList.push({ id: docSnap.id, ...docSnap.data() } as CompetencyDocument);
  });

  // Fetch existing notifications to prevent duplicates
  const notifSnap = await getDocs(collection(db, 'notifications'));
  const existingNotifs = new Set<string>();
  notifSnap.forEach(docSnap => {
    const data = docSnap.data() as AppNotification;
    if (data.relatedCompetencyId && data.thresholdDays !== undefined) {
      existingNotifs.add(`${data.relatedCompetencyId}_${data.thresholdDays}`);
    }
  });

  let notificationsCreated = 0;

  for (const docItem of docsList) {
    // Skip if not current version or if status is rejected
    if (!docItem.isCurrentVersion || docItem.reviewStatus === 'Rejected') continue;

    // Check if holder is an active approved user
    const holder = usersMap.get(docItem.holderId);
    if (!holder) continue; // Skip inactive or unapproved users

    if (docItem.doesNotExpire || !docItem.expiryDate) continue;

    const expiryDate = new Date(docItem.expiryDate + 'T00:00:00');
    const diffTime = expiryDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const thresholds = [60, 30, 7, 0];

    for (const threshold of thresholds) {
      const isDue = (threshold === 0 && diffDays <= 0) || (threshold > 0 && diffDays <= threshold && diffDays > threshold - 7);

      if (isDue) {
        const notifKey = `${docItem.id}_${threshold}`;
        if (existingNotifs.has(notifKey)) continue; // Already notified for this threshold

        const isExpired = diffDays <= 0;
        const title = isExpired 
          ? `Document Expired: ${docItem.requirementName}` 
          : `Document Expiring Soon (${diffDays} days): ${docItem.requirementName}`;
        
        const message = isExpired
          ? `Your ${docItem.requirementName} certificate expired on ${new Date(docItem.expiryDate).toLocaleDateString('en-GB')}. Please upload a replacement.`
          : `Your ${docItem.requirementName} certificate expires on ${new Date(docItem.expiryDate).toLocaleDateString('en-GB')} (${diffDays} days remaining).`;

        const newNotif: Partial<AppNotification> = {
          recipientId: docItem.holderId,
          recipientEmail: holder.email,
          title,
          message,
          type: isExpired ? 'document_expired' : 'expiry_warning',
          relatedRequirementId: docItem.requirementId,
          relatedCompetencyId: docItem.id,
          relatedPersonId: docItem.holderId,
          thresholdDays: threshold,
          isRead: false,
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'notifications'), {
          ...newNotif,
          createdAt: serverTimestamp()
        });

        existingNotifs.add(notifKey);
        notificationsCreated++;
      }
    }
  }

  return { scannedCount: docsList.length, notificationsCreated };
}
