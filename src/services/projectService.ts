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
  runTransaction, 
  doc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { 
  ProjectRecord, 
  ProjectCommercial, 
  ProjectDocument, 
  ProjectPhoto, 
  ProjectAction,
  ProjectMember,
  OperationalProjectStatus,
  ProjectDocumentVisibility,
  ProjectDocumentCategory,
  ProjectPhotoCategory,
  UserProfile,
  ActionComment
} from '../types';

/**
 * Formats integer minor pence (£1,500.50 -> 150050 pence) to a formatted GBP string.
 */
export function formatPenceToGBP(pence?: number | null): string {
  if (pence === null || pence === undefined) return 'Not Confirmed';
  const pounds = pence / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pounds);
}

/**
 * Parses a GBP string or number into integer minor pence.
 */
export function parseGBPToPence(val: string | number): number {
  if (typeof val === 'number') return Math.round(val * 100);
  const clean = val.replace(/[^0-9.-]+/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Atomically generates a unique project reference (e.g., GVD-2026-0001) using Firestore transaction.
 */
export async function generateProjectReference(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const counterRef = doc(db, 'counters', `project_ref_${currentYear}`);

  const newRef = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let lastSeq = 0;
    if (counterSnap.exists()) {
      lastSeq = counterSnap.data().lastSeq || 0;
    }
    const nextSeq = lastSeq + 1;
    transaction.set(counterRef, { lastSeq: nextSeq, year: currentYear }, { merge: true });

    const formattedSeq = String(nextSeq).padStart(4, '0');
    return `GVD-${currentYear}-${formattedSeq}`;
  });

  return newRef;
}

/**
 * Checks for existing active projects with similar address/postcode to warn user before project creation.
 */
export async function checkAddressProximityWarning(address: string, postcode: string): Promise<ProjectRecord[]> {
  const cleanPostcode = postcode.trim().toLowerCase().replace(/\s+/g, '');
  if (!cleanPostcode) return [];

  const projectsSnap = await getDocs(query(collection(db, 'projects'), where('isArchived', '==', false)));
  const matches: ProjectRecord[] = [];

  projectsSnap.forEach((docSnap) => {
    const proj = { id: docSnap.id, ...docSnap.data() } as ProjectRecord;
    const projPostcode = (proj.postcode || '').trim().toLowerCase().replace(/\s+/g, '');
    
    if (projPostcode === cleanPostcode) {
      matches.push(proj);
    } else if (address.trim().length > 5 && proj.siteAddress.toLowerCase().includes(address.trim().toLowerCase().slice(0, 10))) {
      matches.push(proj);
    }
  });

  return matches;
}

/**
 * Fetches projects based on current user role and filters.
 */
export async function fetchProjects(user: UserProfile, filters: {
  searchQuery?: string;
  status?: string;
  projectType?: string;
  managerUid?: string;
  isArchived?: boolean;
}): Promise<ProjectRecord[]> {
  let q = query(collection(db, 'projects'));
  
  const isArchivedTarget = filters.isArchived ?? false;
  q = query(q, where('isArchived', '==', isArchivedTarget));

  if (filters.status && filters.status !== 'All') {
    q = query(q, where('status', '==', filters.status));
  }

  if (filters.managerUid) {
    q = query(q, where('responsibleManagerUid', '==', filters.managerUid));
  }

  const snap = await getDocs(q);
  let projects: ProjectRecord[] = [];

  snap.forEach((docSnap) => {
    projects.push({ id: docSnap.id, ...docSnap.data() } as ProjectRecord);
  });

  // Security Filtering: Contractors see ONLY projects where their UID is in assignedUserIds
  if (user.role === 'IndividualContractor' || user.role === 'ContractorCompany') {
    projects = projects.filter(p => (p.assignedUserIds || []).includes(user.uid));
  }

  // Client-side text search (Ref, Address, Postcode, Client name)
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const term = filters.searchQuery.trim().toLowerCase();
    projects = projects.filter(p => 
      p.reference.toLowerCase().includes(term) ||
      p.siteAddress.toLowerCase().includes(term) ||
      p.postcode.toLowerCase().includes(term) ||
      (p.siteInfo?.clientName || '').toLowerCase().includes(term) ||
      (p.siteInfo?.clientOrg || '').toLowerCase().includes(term) ||
      p.title.toLowerCase().includes(term)
    );
  }

  if (filters.projectType && filters.projectType !== 'All') {
    projects = projects.filter(p => p.projectType === filters.projectType);
  }

  return projects;
}

/**
 * Fetches a single project by ID with security check.
 */
export async function fetchProjectById(projectId: string, user: UserProfile): Promise<ProjectRecord | null> {
  const docRef = doc(db, 'projects', projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;

  const proj = { id: snap.id, ...snap.data() } as ProjectRecord;

  if (user.role === 'IndividualContractor' || user.role === 'ContractorCompany') {
    if (!(proj.assignedUserIds || []).includes(user.uid)) {
      throw new Error('Access denied: You are not assigned to this project workspace.');
    }
  }

  return proj;
}

/**
 * Updates operational status of a project.
 */
export async function updateProjectStatus(projectId: string, status: OperationalProjectStatus, actor: UserProfile): Promise<void> {
  const projRef = doc(db, 'projects', projectId);
  await updateDoc(projRef, {
    status,
    updatedAt: new Date().toISOString()
  });

  await addDoc(collection(db, 'project_audit_logs'), {
    projectId,
    action: 'STATUS_CHANGE',
    actorUid: actor.uid,
    actorName: actor.fullName,
    details: `Project status updated to ${status}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Archives or Restores a project.
 */
export async function toggleArchiveProject(projectId: string, archive: boolean, reason: string, actor: UserProfile): Promise<void> {
  const projRef = doc(db, 'projects', projectId);
  await updateDoc(projRef, {
    isArchived: archive,
    archivedAt: archive ? new Date().toISOString() : null,
    archivedBy: archive ? actor.fullName : null,
    updatedAt: new Date().toISOString()
  });

  await addDoc(collection(db, 'project_audit_logs'), {
    projectId,
    action: archive ? 'PROJECT_ARCHIVED' : 'PROJECT_RESTORED',
    actorUid: actor.uid,
    actorName: actor.fullName,
    details: `${archive ? 'Archived' : 'Restored'} project. Reason: ${reason}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Adds a member to a project.
 */
export async function addProjectMember(projectId: string, member: ProjectMember, actor: UserProfile): Promise<void> {
  const projRef = doc(db, 'projects', projectId);
  const snap = await getDoc(projRef);
  if (!snap.exists()) return;

  const proj = snap.data() as ProjectRecord;
  const currentMembers = proj.members || [];
  const currentAssignedIds = proj.assignedUserIds || [];

  if (currentMembers.some(m => m.uid === member.uid)) {
    throw new Error(`${member.fullName} is already a member of this project.`);
  }

  const updatedMembers = [...currentMembers, member];
  const updatedAssignedIds = Array.from(new Set([...currentAssignedIds, member.uid]));

  await updateDoc(projRef, {
    members: updatedMembers,
    assignedUserIds: updatedAssignedIds,
    updatedAt: new Date().toISOString()
  });

  await addDoc(collection(db, 'project_audit_logs'), {
    projectId,
    action: 'MEMBER_ADDED',
    actorUid: actor.uid,
    actorName: actor.fullName,
    details: `Added member ${member.fullName} (${member.accessPreset})`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Removes a member from a project while maintaining audit attribution.
 */
export async function removeProjectMember(projectId: string, memberUid: string, actor: UserProfile): Promise<void> {
  const projRef = doc(db, 'projects', projectId);
  const snap = await getDoc(projRef);
  if (!snap.exists()) return;

  const proj = snap.data() as ProjectRecord;
  const currentMembers = proj.members || [];
  const removedMember = currentMembers.find(m => m.uid === memberUid);
  
  const updatedMembers = currentMembers.filter(m => m.uid !== memberUid);
  const updatedAssignedIds = updatedMembers.map(m => m.uid);

  await updateDoc(projRef, {
    members: updatedMembers,
    assignedUserIds: updatedAssignedIds,
    updatedAt: new Date().toISOString()
  });

  await addDoc(collection(db, 'project_audit_logs'), {
    projectId,
    action: 'MEMBER_REMOVED',
    actorUid: actor.uid,
    actorName: actor.fullName,
    details: `Removed member ${removedMember?.fullName || memberUid} from project`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Fetches commercial record for Owner/Admin only.
 */
export async function fetchProjectCommercial(projectId: string, user: UserProfile): Promise<ProjectCommercial | null> {
  if (user.role !== 'Owner' && user.role !== 'Admin') {
    throw new Error('Access denied: Commercial section is restricted to Owner and Admin users.');
  }

  const docRef = doc(db, 'project_commercials', projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;

  return snap.data() as ProjectCommercial;
}

/**
 * Updates or confirms commercial contract value with mandatory audit history.
 */
export async function updateProjectCommercial(
  projectId: string, 
  data: Partial<ProjectCommercial>, 
  correctionReason: string | undefined, 
  actor: UserProfile
): Promise<void> {
  if (actor.role !== 'Owner' && actor.role !== 'Admin') {
    throw new Error('Access denied: Commercial section is restricted to Owner and Admin users.');
  }

  const docRef = doc(db, 'project_commercials', projectId);
  const existingSnap = await getDoc(docRef);

  let existing = existingSnap.exists() ? (existingSnap.data() as ProjectCommercial) : null;
  const history = existing?.correctionsHistory || [];

  if (correctionReason && data.confirmedContractValuePence !== undefined && data.confirmedContractValuePence !== existing?.confirmedContractValuePence) {
    history.push({
      timestamp: new Date().toISOString(),
      actorUid: actor.uid,
      actorName: actor.fullName,
      previousValuePence: existing?.confirmedContractValuePence,
      newValuePence: data.confirmedContractValuePence,
      reason: correctionReason
    });
  }

  const payload: Partial<ProjectCommercial> = {
    ...data,
    correctionsHistory: history,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.fullName
  };

  await setDoc(docRef, payload, { merge: true });
}

/**
 * Fetches documents for a project filtered by user permissions.
 */
export async function fetchProjectDocuments(projectId: string, user: UserProfile): Promise<ProjectDocument[]> {
  const q = query(
    collection(db, 'project_documents'),
    where('projectId', '==', projectId)
  );

  const snap = await getDocs(q);
  let docs: ProjectDocument[] = [];

  snap.forEach((d) => {
    docs.push({ id: d.id, ...d.data() } as ProjectDocument);
  });

  // Filter visibility
  docs = docs.filter(docItem => {
    if (user.role === 'Owner' || user.role === 'Admin') return true;
    if (docItem.visibility === 'All Authorised Project Participants') return true;
    if (docItem.visibility === 'GVD Project Team Only') {
      return user.applicationCategory === 'GVD Employee';
    }
    if (docItem.visibility === 'Selected Project People') {
      return (docItem.allowedUserIds || []).includes(user.uid);
    }
    return false;
  });

  return docs.sort((a, b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());
}

/**
 * Uploads a new document or document revision.
 */
export async function uploadProjectDocument(
  projectId: string,
  file: File,
  details: {
    title: string;
    category: ProjectDocumentCategory;
    visibility: ProjectDocumentVisibility;
    description?: string;
    allowedUserIds?: string[];
    replacingDocId?: string;
  },
  actor: UserProfile
): Promise<void> {
  const fileExt = file.name.split('.').pop() || 'file';
  const timestamp = Date.now();
  const storagePath = `project_documents/${projectId}/${timestamp}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  let version = 1;
  let replacingDoc: ProjectDocument | null = null;

  if (details.replacingDocId) {
    const prevSnap = await getDoc(doc(db, 'project_documents', details.replacingDocId));
    if (prevSnap.exists()) {
      replacingDoc = prevSnap.data() as ProjectDocument;
      version = (replacingDoc.version || 1) + 1;
      
      // Mark previous version as superseded
      await updateDoc(doc(db, 'project_documents', details.replacingDocId), {
        isCurrentVersion: false
      });
    }
  }

  const newDocRef = doc(collection(db, 'project_documents'));
  const newDocRecord: ProjectDocument = {
    id: newDocRef.id,
    projectId,
    title: details.title,
    category: details.category,
    originalFilename: file.name,
    fileUrl: downloadUrl,
    fileType: file.type || fileExt,
    fileSizeBytes: file.size,
    uploaderUid: actor.uid,
    uploaderName: actor.fullName,
    uploadTimestamp: new Date().toISOString(),
    version,
    isCurrentVersion: true,
    visibility: details.visibility,
    allowedUserIds: details.allowedUserIds || [],
    description: details.description || ''
  };

  await setDoc(newDocRef, newDocRecord);

  if (replacingDoc) {
    await updateDoc(doc(db, 'project_documents', details.replacingDocId!), {
      supersededBy: newDocRef.id
    });
  }
}

/**
 * Fetches project photos filtered by user permissions.
 */
export async function fetchProjectPhotos(projectId: string, user: UserProfile): Promise<ProjectPhoto[]> {
  const q = query(
    collection(db, 'project_photos'),
    where('projectId', '==', projectId)
  );

  const snap = await getDocs(q);
  let photos: ProjectPhoto[] = [];

  snap.forEach(d => {
    photos.push({ id: d.id, ...d.data() } as ProjectPhoto);
  });

  photos = photos.filter(photo => {
    if (user.role === 'Owner' || user.role === 'Admin') return true;
    if (photo.visibility === 'All Authorised Project Participants') return true;
    if (photo.visibility === 'GVD Project Team Only') {
      return user.applicationCategory === 'GVD Employee';
    }
    return false;
  });

  return photos.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

/**
 * Uploads a site photo.
 */
export async function uploadProjectPhoto(
  projectId: string,
  file: File,
  details: {
    category: ProjectPhotoCategory;
    caption?: string;
    capturedAt?: string;
    visibility?: ProjectDocumentVisibility;
  },
  actor: UserProfile
): Promise<void> {
  const timestamp = Date.now();
  const storagePath = `project_photos/${projectId}/${timestamp}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const photoUrl = await getDownloadURL(storageRef);

  const photoRef = doc(collection(db, 'project_photos'));
  const photoRecord: ProjectPhoto = {
    id: photoRef.id,
    projectId,
    photoUrl,
    category: details.category,
    caption: details.caption || '',
    uploaderUid: actor.uid,
    uploaderName: actor.fullName,
    capturedAt: details.capturedAt || new Date().toISOString().split('T')[0],
    uploadedAt: new Date().toISOString(),
    visibility: details.visibility || 'All Authorised Project Participants'
  };

  await setDoc(photoRef, photoRecord);
}

/**
 * Fetches actions for a project filtered by permissions.
 */
export async function fetchProjectActions(projectId: string, user: UserProfile): Promise<ProjectAction[]> {
  const q = query(
    collection(db, 'project_actions'),
    where('projectId', '==', projectId)
  );

  const snap = await getDocs(q);
  let actions: ProjectAction[] = [];

  snap.forEach(d => {
    actions.push({ id: d.id, ...d.data() } as ProjectAction);
  });

  actions = actions.filter(act => {
    if (user.role === 'Owner' || user.role === 'Admin') return true;
    if (act.assignedUserUid === user.uid || act.createdByUid === user.uid) return true;
    if (act.visibility === 'All Authorised Project Participants') return true;
    if (act.visibility === 'GVD Project Team Only' && user.applicationCategory === 'GVD Employee') return true;
    return false;
  });

  return actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Creates a new project action or query.
 */
export async function createProjectAction(
  projectId: string,
  projectReference: string,
  data: {
    title: string;
    description?: string;
    assignedUserUid: string;
    assignedUserName: string;
    dueDate?: string;
    visibility: ProjectDocumentVisibility;
  },
  actor: UserProfile
): Promise<void> {
  const actionRef = doc(collection(db, 'project_actions'));
  const actionRecord: ProjectAction = {
    id: actionRef.id,
    projectId,
    projectReference,
    title: data.title,
    description: data.description || '',
    assignedUserUid: data.assignedUserUid,
    assignedUserName: data.assignedUserName,
    dueDate: data.dueDate || '',
    status: 'Open',
    visibility: data.visibility,
    createdByUid: actor.uid,
    createdByName: actor.fullName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: []
  };

  await setDoc(actionRef, actionRecord);
}

/**
 * Adds a comment thread reply to a project action.
 */
export async function addActionComment(
  actionId: string,
  commentText: string,
  actor: UserProfile,
  attachmentUrl?: string
): Promise<void> {
  const actionRef = doc(db, 'project_actions', actionId);
  const snap = await getDoc(actionRef);
  if (!snap.exists()) return;

  const action = snap.data() as ProjectAction;
  const newComment: ActionComment = {
    id: `cmt_${Date.now()}`,
    authorUid: actor.uid,
    authorName: actor.fullName,
    commentText,
    attachmentUrl,
    createdAt: new Date().toISOString()
  };

  const updatedComments = [...(action.comments || []), newComment];

  await updateDoc(actionRef, {
    comments: updatedComments,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Updates the status of an action (Open, In Progress, Done).
 */
export async function updateActionStatus(actionId: string, status: 'Open' | 'In Progress' | 'Done', actor: UserProfile): Promise<void> {
  const actionRef = doc(db, 'project_actions', actionId);
  await updateDoc(actionRef, {
    status,
    updatedAt: new Date().toISOString()
  });
}
