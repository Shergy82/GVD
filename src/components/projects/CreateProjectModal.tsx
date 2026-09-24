import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, setDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { generateProjectReference, checkAddressProximityWarning } from '../../services/projectService';
import type { ProjectRecord, UserProfile, OperationalProjectStatus } from '../../types';
import { Briefcase, X, AlertCircle, CheckCircle2, MapPin, User, Calendar, Info, ShieldAlert } from 'lucide-react';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: (project: ProjectRecord) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ onClose, onSuccess }) => {
  const { currentUser, recordAuditLog } = useAuth();

  // Form State
  const [title, setTitle] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [clientName, setClientName] = useState('');
  const [responsibleManagerUid, setResponsibleManagerUid] = useState(currentUser?.uid || '');

  // Optional Fields
  const [projectType, setProjectType] = useState('Commercial Refurbishment');
  const [clientOrg, setClientOrg] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [targetFinishDate, setTargetFinishDate] = useState('');
  const [description, setDescription] = useState('');

  // Resident / Site Contact
  const [showResidentSection, setShowResidentSection] = useState(false);
  const [residentName, setResidentName] = useState('');
  const [residentPhone, setResidentPhone] = useState('');
  const [residentEmail, setResidentEmail] = useState('');
  const [residentAccessNotes, setResidentAccessNotes] = useState('');
  const [keySafeCode, setKeySafeCode] = useState('');

  // Manager Options
  const [gvdManagers, setGvdManagers] = useState<UserProfile[]>([]);

  // Proximity warning state
  const [proximityWarnings, setProximityWarnings] = useState<ProjectRecord[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch GVD staff users for responsible manager selection
    const fetchManagers = async () => {
      const snap = await getDocs(query(collection(db, 'users'), where('status', '==', 'approved')));
      const list: UserProfile[] = [];
      snap.forEach(d => {
        const u = { uid: d.id, ...d.data() } as UserProfile;
        if (u.role === 'Owner' || u.role === 'Admin' || u.role === 'ProjectManager') {
          list.push(u);
        }
      });
      setGvdManagers(list);
    };
    fetchManagers();
  }, []);

  // Auto-suggest title when address or postcode changes
  const handleAddressBlur = async () => {
    if (siteAddress && !title) {
      setTitle(`${siteAddress.split(',')[0]} Project`);
    }

    if (siteAddress || postcode) {
      const matches = await checkAddressProximityWarning(siteAddress, postcode);
      setProximityWarnings(matches);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!siteAddress.trim()) {
      setErrorMsg("Site address is required.");
      return;
    }
    if (!postcode.trim()) {
      setErrorMsg("Postcode is required.");
      return;
    }
    if (!clientName.trim()) {
      setErrorMsg("Customer/Client name is required.");
      return;
    }
    if (!responsibleManagerUid) {
      setErrorMsg("Please select a responsible GVD Project Manager.");
      return;
    }

    if (targetStartDate && targetFinishDate && targetFinishDate < targetStartDate) {
      setErrorMsg("Target finish date must be on or after target start date.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Generate permanent atomic reference (e.g. GVD-2026-0001)
      const reference = await generateProjectReference();
      const newProjectId = `prj_${Date.now()}`;
      const manager = gvdManagers.find(m => m.uid === responsibleManagerUid) || currentUser;

      const projectTitle = title.trim() || `${siteAddress.trim().split(',')[0]} Project`;

      // Assigned users array initially includes manager and creator
      const initialAssignedUids = Array.from(new Set([currentUser?.uid || '', responsibleManagerUid])).filter(Boolean);

      const newProject: ProjectRecord = {
        id: newProjectId,
        reference,
        title: projectTitle,
        siteAddress: siteAddress.trim(),
        postcode: postcode.trim().toUpperCase(),
        projectType,
        description: description.trim() || undefined,
        responsibleManagerUid,
        responsibleManagerName: manager?.fullName || 'GVD Manager',
        targetStartDate: targetStartDate || undefined,
        targetFinishDate: targetFinishDate || undefined,
        status: 'Draft',
        isArchived: false,
        siteInfo: {
          clientName: clientName.trim(),
          clientOrg: clientOrg.trim() || undefined,
          clientEmail: clientEmail.trim() || undefined,
          clientPhone: clientPhone.trim() || undefined,
          residentName: residentName.trim() || undefined,
          residentPhone: residentPhone.trim() || undefined,
          residentEmail: residentEmail.trim() || undefined,
          residentAccessNotes: residentAccessNotes.trim() || undefined,
          keySafeCode: keySafeCode.trim() || undefined
        },
        assignedUserIds: initialAssignedUids,
        members: [
          {
            uid: currentUser?.uid || '',
            fullName: currentUser?.fullName || 'Creator',
            email: currentUser?.email || '',
            role: currentUser?.role || 'Owner',
            accessPreset: 'GVD Project Team',
            addedAt: new Date().toISOString(),
            addedBy: currentUser?.uid || 'system'
          },
          ...(responsibleManagerUid !== currentUser?.uid ? [{
            uid: manager?.uid || '',
            fullName: manager?.fullName || 'Manager',
            email: manager?.email || '',
            role: manager?.role || 'ProjectManager',
            accessPreset: 'GVD Project Team' as const,
            addedAt: new Date().toISOString(),
            addedBy: currentUser?.uid || 'system'
          }] : [])
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'projects', newProjectId), {
        ...newProject,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Create initial Commercial record (empty confirmed value)
      await setDoc(doc(db, 'project_commercials', newProjectId), {
        projectId: newProjectId,
        projectReference: reference,
        hasConfirmedValue: false,
        provisionalSums: [],
        exclusions: [],
        extractionStatus: 'None',
        correctionsHistory: [],
        updatedAt: serverTimestamp()
      });

      await recordAuditLog(
        'Create Project',
        'ProjectRecord',
        newProjectId,
        `Created project ${reference}: ${projectTitle} (${siteAddress})`,
        null,
        newProject
      );

      onSuccess(newProject);
      onClose();

    } catch (err: any) {
      console.error("Failed to create project:", err);
      setErrorMsg(err.message || "Failed to create project. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 150,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        maxWidth: '680px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 2px 0', fontFamily: 'var(--font-heading)' }}>
              Create New Project Workspace
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Generates a unique permanent reference (e.g. GVD-2026-0001)
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <ShieldAlert size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Proximity Warning Alert */}
        {proximityWarnings.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Proximity Warning:</strong> An active project exists at or near this postcode/address:
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {proximityWarnings.map(p => (
                  <li key={p.id}>{p.reference} — {p.title} ({p.siteAddress})</li>
                ))}
              </ul>
              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Separate works at the same location are permitted. Proceed if this is a distinct job.</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Site Address & Postcode */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Site Address *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 42 High Street, Manchester"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                onBlur={handleAddressBlur}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Postcode *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. M1 2AB"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                onBlur={handleAddressBlur}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Project Title */}
          <div className="form-group">
            <label className="form-label">Project Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Manchester High St Store Fitout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Customer / Client Details */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Customer / Client Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Northern Retail Group"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Responsible GVD Manager *</label>
              <select
                className="form-select"
                value={responsibleManagerUid}
                onChange={(e) => setResponsibleManagerUid(e.target.value)}
                disabled={isSubmitting}
                required
              >
                {gvdManagers.map(m => (
                  <option key={m.uid} value={m.uid}>
                    {m.fullName} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Type & Client Org */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project Type</label>
              <select
                className="form-select"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="Commercial Refurbishment">Commercial Refurbishment</option>
                <option value="Retail Fit-out">Retail Fit-out</option>
                <option value="Residential Works">Residential Works</option>
                <option value="Maintenance & Remedial">Maintenance & Remedial</option>
                <option value="Specialist Subcontract">Specialist Subcontract</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Client Organisation / Billing Contact</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Manchester City Council"
                value={clientOrg}
                onChange={(e) => setClientOrg(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Target Dates (Provisional Target Dates) */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Target Start Date (Provisional)</label>
              <input
                type="date"
                className="form-input"
                value={targetStartDate}
                onChange={(e) => setTargetStartDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Finish Date (Provisional)</label>
              <input
                type="date"
                className="form-input"
                value={targetFinishDate}
                onChange={(e) => setTargetFinishDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Optional Site / Resident Contact Section */}
          <div style={{ marginTop: '10px', marginBottom: '20px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowResidentSection(!showResidentSection)}
            >
              {showResidentSection ? "— Hide Resident / Site Contact Details" : "+ Add Site Contact / Resident Details"}
            </button>

            {showResidentSection && (
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginTop: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>
                  Site Contact / Resident Information
                </h4>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Resident / Site Contact Name</label>
                    <input type="text" className="form-input" placeholder="e.g. Sarah Jenkins" value={residentName} onChange={(e) => setResidentName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Resident Phone</label>
                    <input type="tel" className="form-input" placeholder="e.g. 07700 900456" value={residentPhone} onChange={(e) => setResidentPhone(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Key-Safe Code (Restricted Access Info)</label>
                  <input type="text" className="form-input" placeholder="e.g. 4321" value={keySafeCode} onChange={(e) => setKeySafeCode(e.target.value)} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Hidden by default from routine displays and notification previews.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-navy" disabled={isSubmitting} style={{ fontWeight: 700 }}>
              {isSubmitting ? "Creating Project..." : "Create Project Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
