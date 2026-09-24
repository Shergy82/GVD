import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Building, 
  MapPin, 
  Calendar, 
  User, 
  Lock, 
  Unlock, 
  KeyRound, 
  Phone, 
  Mail, 
  Users, 
  FileText, 
  Camera, 
  CheckSquare, 
  DollarSign, 
  AlertCircle, 
  Sparkles, 
  Clock, 
  RefreshCw, 
  Archive, 
  Upload, 
  Plus, 
  MessageSquare,
  Shield,
  Eye,
  FileCheck,
  CheckCircle2,
  Trash2,
  Maximize2
} from 'lucide-react';
import type { 
  ProjectRecord, 
  ProjectCommercial, 
  ProjectDocument, 
  ProjectPhoto, 
  ProjectAction,
  UserProfile,
  OperationalProjectStatus,
  BookingRecord
} from '../types';
import { 
  fetchProjectById, 
  fetchProjectCommercial, 
  fetchProjectDocuments, 
  fetchProjectPhotos, 
  fetchProjectActions,
  updateProjectStatus,
  toggleArchiveProject,
  removeProjectMember,
  updateActionStatus,
  addActionComment,
  formatPenceToGBP
} from '../services/projectService';
import { fetchBookings, formatDayHeader } from '../services/plannerService';
import { getProjectLabourCosts } from '../services/claimsService';
import { QuoteExtractionModal } from '../components/projects/QuoteExtractionModal';
import { ProjectDocumentUploadModal } from '../components/projects/ProjectDocumentUploadModal';
import { ProjectPhotoUploadModal } from '../components/projects/ProjectPhotoUploadModal';
import { AddMemberModal } from '../components/projects/AddMemberModal';
import { ActionModal } from '../components/projects/ActionModal';
import type { ProjectLabourCost } from '../types';

/* Labour Cost Section (embedded in commercial) */
const ProjectLabourCostSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [costs, setCosts] = React.useState<ProjectLabourCost | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getProjectLabourCosts(projectId).then(data => {
      setCosts(data);
      setLoading(false);
    });
  }, [projectId]);

  if (loading) {
    return <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: '#94A3B8' }}>Loading labour costs...</div>;
  }

  if (!costs) {
    return (
      <div style={{
        padding: '20px', borderRadius: '12px', background: '#F8FAFC',
        border: '1px solid #E2E8F0', textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>No labour claims recorded yet</div>
        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
          Contractor claims allocated to this project will appear here
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Submitted (Pending)', amount: costs.submittedPendingPence, color: '#3B82F6' },
    { label: 'Approved (Not Invoiced)', amount: costs.approvedNotInvoicedPence, color: '#059669' },
    { label: 'Invoiced (Unpaid)', amount: costs.invoicedUnpaidPence, color: '#D97706' },
    { label: 'Paid', amount: costs.paidPence, color: '#059669' },
  ];

  return (
    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1E293B' }}>
        <Users className="w-4 h-4" style={{ color: '#059669' }} />
        Labour & Claims Costs
      </h3>
      <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: '12px' }}>
        ⚠ Labour costs only. Materials and company subcontract costs are not yet included.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {rows.map(row => (
          <div key={row.label} style={{
            padding: '12px', borderRadius: '8px', background: '#F8FAFC',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
              {row.label}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: row.color }}>
              {formatPenceToGBP(row.amount)}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '12px 16px', borderRadius: '8px',
        background: 'linear-gradient(135deg, #0F172A, #1E293B)',
        color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Total Recognised Cost</span>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34D399' }}>
          {formatPenceToGBP(costs.totalRecognisedCostPence)}
        </span>
      </div>
    </div>
  );
};

/* Stage 6: Materials & Purchasing Section (embedded in commercial) */
const ProjectMaterialsCostSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [materialsCost, setMaterialsCost] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Load requests, POs, invoices, credits for this project
    Promise.all([
      import('../services/firebase').then(m => import('firebase/firestore').then(fs => fs.getDocs(fs.collection(m.db, 'materials_requests')))),
      import('../services/firebase').then(m => import('firebase/firestore').then(fs => fs.getDocs(fs.collection(m.db, 'purchase_orders')))),
      import('../services/firebase').then(m => import('firebase/firestore').then(fs => fs.getDocs(fs.collection(m.db, 'supplier_invoices')))),
      import('../services/firebase').then(m => import('firebase/firestore').then(fs => fs.getDocs(fs.collection(m.db, 'supplier_credit_notes'))))
    ]).then(([reqSnap, poSnap, invSnap, cnSnap]) => {
      const reqList = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const poList = poSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const invList = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const cnList = cnSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      import('../services/purchasingService').then(ps => {
        const costData = ps.calculateProjectMaterialsCost(projectId, reqList, poList, invList, cnList);
        setMaterialsCost(costData);
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: '#94A3B8' }}>Loading materials costs...</div>;
  }

  const mat = materialsCost || {
    pendingRequestsPence: 0,
    openCommitmentsPence: 0,
    postedInvoicesPence: 0,
    postedCreditsPence: 0,
    netMaterialsCostPence: 0,
    totalCommittedAndActualPence: 0,
    invoicedPaidPence: 0,
    invoicedOutstandingPence: 0
  };

  const matRows = [
    { label: 'Pending Requests', amount: mat.pendingRequestsPence, color: '#3B82F6' },
    { label: 'Open Commitments (Headroom)', amount: mat.openCommitmentsPence, color: '#D97706' },
    { label: 'Posted Invoices (Cost)', amount: mat.postedInvoicesPence, color: '#059669' },
    { label: 'Credits Applied', amount: mat.postedCreditsPence, color: '#6366F1' },
    { label: 'Outstanding Payable', amount: mat.invoicedOutstandingPence, color: '#E11D48' },
    { label: 'Recorded Paid', amount: mat.invoicedPaidPence, color: '#059669' }
  ];

  return (
    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px', marginTop: '20px' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1E293B' }}>
        <DollarSign className="w-4 h-4" style={{ color: '#D97706' }} />
        Materials & Purchasing Costs (Stage 6)
      </h3>
      <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '12px' }}>
        Commitments, actual costs and cash movements tracked separately with zero double-counting.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {matRows.map(row => (
          <div key={row.label} style={{
            padding: '12px', borderRadius: '8px', background: '#F8FAFC',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
              {row.label}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: row.color }}>
              {formatPenceToGBP(row.amount)}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '12px 16px', borderRadius: '8px',
        background: 'linear-gradient(135deg, #1E293B, #0F172A)',
        color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '10px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Combined Recognised Cost & Remaining Commitments</span>
          <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Actual Net Invoiced (£{(mat.netMaterialsCostPence / 100).toFixed(2)}) + Open POs (£{(mat.openCommitmentsPence / 100).toFixed(2)})</span>
        </div>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38BDF8' }}>
          {formatPenceToGBP(mat.totalCommittedAndActualPence)}
        </span>
      </div>

      <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '0.7rem', color: '#92400E' }}>
        ⚠ <strong>Cost View Incomplete:</strong> Subcontract orders, variations and interim payment applications are not yet implemented. Final project profit is not definitive.
      </div>
    </div>
  );
};


interface ProjectWorkspaceViewProps {
  projectId: string;
  currentUser: UserProfile;
  onBack: () => void;
}

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  projectId,
  currentUser,
  onBack
}) => {
  const isContractor = currentUser.role === 'IndividualContractor' || currentUser.role === 'ContractorCompany';
  const isAdmin = currentUser.role === 'Owner' || currentUser.role === 'Admin';
  const isGvdStaff = currentUser.applicationCategory === 'GVD Employee';

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [commercial, setCommercial] = useState<ProjectCommercial | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [actions, setActions] = useState<ProjectAction[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workspace Nav Section
  const [activeSection, setActiveSection] = useState<'overview' | 'people' | 'files' | 'actions' | 'programme' | 'commercial'>('overview');
  const [fileSubTab, setFileSubTab] = useState<'documents' | 'photos'>('documents');

  // Key-safe code reveal state
  const [revealKeySafe, setRevealKeySafe] = useState(false);

  // Modals
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState<ProjectDocument | null>(null);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  
  // PDF Viewer Modal
  const [viewingDoc, setViewingDoc] = useState<ProjectDocument | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<ProjectPhoto | null>(null);

  // Action Comment input state
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    loadWorkspaceData();
  }, [projectId]);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const projData = await fetchProjectById(projectId, currentUser);
      if (!projData) {
        setError('Project workspace not found or you lack permission to view it.');
        return;
      }
      setProject(projData);

      // Load Documents, Photos, Actions & Bookings
      const [docsData, photosData, actionsData, bookingsData] = await Promise.all([
        fetchProjectDocuments(projectId, currentUser),
        fetchProjectPhotos(projectId, currentUser),
        fetchProjectActions(projectId, currentUser),
        fetchBookings({
          startDate: '2026-01-01',
          endDate: '2027-12-31',
          projectId,
          userRole: currentUser.role,
          userUid: currentUser.uid
        })
      ]);

      setDocuments(docsData);
      setPhotos(photosData);
      setActions(actionsData);
      setBookings(bookingsData);

      // Load Commercial IF Owner/Admin
      if (isAdmin) {
        try {
          const commData = await fetchProjectCommercial(projectId, currentUser);
          setCommercial(commData);
        } catch (commErr) {
          console.error("Commercial read info:", commErr);
        }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load project workspace.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: OperationalProjectStatus) => {
    if (!project) return;
    try {
      await updateProjectStatus(project.id, newStatus, currentUser);
      await loadWorkspaceData();
    } catch (err: any) {
      alert(err.message || 'Failed to update project status.');
    }
  };

  const handleToggleArchive = async () => {
    if (!project) return;
    const reason = prompt(project.isArchived ? "Reason for restoring project:" : "Reason for archiving project:");
    if (!reason) return;

    try {
      await toggleArchiveProject(project.id, !project.isArchived, reason, currentUser);
      await loadWorkspaceData();
    } catch (err: any) {
      alert(err.message || 'Failed to update project archive status.');
    }
  };

  const handleRemoveMember = async (memberUid: string, name: string) => {
    if (!project) return;
    if (!confirm(`Are you sure you want to remove ${name} from this project workspace? Their subsequent access to job documents and photos will be revoked immediately.`)) return;

    try {
      await removeProjectMember(project.id, memberUid, currentUser);
      await loadWorkspaceData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    }
  };

  const handleAddComment = async (actionId: string) => {
    const text = commentInputs[actionId];
    if (!text || !text.trim()) return;

    try {
      await addActionComment(actionId, text.trim(), currentUser);
      setCommentInputs({ ...commentInputs, [actionId]: '' });
      const actionsData = await fetchProjectActions(projectId, currentUser);
      setActions(actionsData);
    } catch (err: any) {
      alert(err.message || 'Failed to add comment.');
    }
  };

  const handleActionStatusChange = async (actionId: string, status: 'Open' | 'In Progress' | 'Done') => {
    try {
      await updateActionStatus(actionId, status, currentUser);
      const actionsData = await fetchProjectActions(projectId, currentUser);
      setActions(actionsData);
    } catch (err: any) {
      alert(err.message || 'Failed to update action status.');
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <Clock className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
        <p className="text-sm text-slate-600 font-medium">Opening project workspace...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs text-indigo-600 font-semibold flex items-center space-x-1">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <strong>Workspace Error</strong>
          <p className="mt-1 text-xs">{error || 'Project record does not exist.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      
      {/* Top Banner & Title Bar */}
      <div className="bg-slate-900 text-white rounded-xl shadow-lg p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="text-xs text-slate-300 hover:text-white font-semibold flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Projects Directory</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-400/30">
              {project.reference}
            </span>
            {project.isArchived && (
              <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-400/30">
                ARCHIVED
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800 pt-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{project.title}</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{project.siteAddress}, <strong>{project.postcode}</strong></span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status Select for GVD Staff/Admin */}
            {isGvdStaff ? (
              <select
                value={project.status}
                onChange={(e) => handleStatusChange(e.target.value as OperationalProjectStatus)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Draft">Status: Draft</option>
                <option value="Planned">Status: Planned</option>
                <option value="In Progress">Status: In Progress</option>
                <option value="Site Complete">Status: Site Complete</option>
                <option value="Cancelled">Status: Cancelled</option>
              </select>
            ) : (
              <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-indigo-300">
                {project.status}
              </span>
            )}

            {isAdmin && (
              <button
                onClick={handleToggleArchive}
                className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition"
                title={project.isArchived ? "Restore Project" : "Archive Project"}
              >
                <Archive className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION NAV NAVIGATION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-xs font-bold text-slate-700">
        <button
          onClick={() => setActiveSection('overview')}
          className={`py-3 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSection === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveSection('people')}
          className={`py-3 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSection === 'people' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>People ({project.members?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSection('files')}
          className={`py-3 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSection === 'files' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Files & Photos ({documents.length + photos.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('actions')}
          className={`py-3 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSection === 'actions' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Actions ({actions.filter(a => a.status !== 'Done').length})</span>
        </button>

        <button
          onClick={() => setActiveSection('programme')}
          className={`py-3 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSection === 'programme' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Programme ({bookings.filter(b => b.status !== 'Cancelled').length})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSection('commercial')}
            className={`py-3 px-3 rounded-lg flex items-center justify-center space-x-2 transition col-span-2 sm:col-span-1 ${
              activeSection === 'commercial' ? 'bg-emerald-700 text-white shadow-sm' : 'hover:bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Commercial</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: OVERVIEW                                       */}
      {/* ========================================================= */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
                <span>Project & Site Details</span>
                <span className="text-xs text-slate-500 font-normal">Type: <strong>{project.projectType}</strong></span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Responsible GVD Manager:</span>
                  <strong className="text-slate-800 text-sm">{project.responsibleManagerName}</strong>
                </div>

                <div>
                  <span className="text-slate-500 block">Provisional Target Dates:</span>
                  <div className="text-slate-800 font-medium">
                    Target Start: <strong>{project.targetStartDate || 'Unconfirmed'}</strong> | Finish: <strong>{project.targetFinishDate || 'Unconfirmed'}</strong>
                  </div>
                  <span className="text-[11px] text-slate-400 italic">Provisional target dates — not confirmed operative programme bookings.</span>
                </div>
              </div>

              {project.description && (
                <div className="pt-2">
                  <span className="text-xs text-slate-500 block font-semibold mb-1">Project Scope & Summary</span>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg leading-relaxed">{project.description}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b pb-2">Client & Site Contacts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!isContractor && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-indigo-900 flex items-center space-x-1.5">
                      <User className="w-4 h-4 text-indigo-600" />
                      <span>Client / Ordering Customer</span>
                    </div>
                    <div>
                      <strong className="block text-slate-800 text-sm">{project.siteInfo.clientName}</strong>
                      {project.siteInfo.clientOrg && <span className="text-slate-500 text-xs block">{project.siteInfo.clientOrg}</span>}
                    </div>
                  </div>
                )}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <Building className="w-4 h-4 text-slate-600" />
                    <span>Site Occupant / Resident Contact</span>
                  </div>
                  <div>
                    <strong className="block text-slate-800 text-sm">{project.siteInfo.residentName || 'Same as client'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
                <span>Outstanding Actions</span>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                  {actions.filter(a => a.status !== 'Done').length} Open
                </span>
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION: PROGRAMME (PROJECT SCHEDULE BOOKINGS)             */}
      {/* ========================================================= */}
      {activeSection === 'programme' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Site Work Programme</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live operative work bookings scheduled for this project</p>
            </div>
            <div className="text-xs text-slate-500">
              Target Finish: <strong>{project.targetFinishDate || 'Unconfirmed'}</strong>
            </div>
          </div>

          {bookings.filter(b => b.status !== 'Cancelled').length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic">
              No live operative bookings scheduled on this project yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bookings.filter(b => b.status !== 'Cancelled').map(b => (
                <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {formatDayHeader(b.localDate)} ({b.localDate}) — <strong className="text-indigo-600">{b.slot}</strong>
                      </div>
                      <p className="text-slate-600 mt-0.5">
                        Operative: <strong>{b.personName}</strong> ({b.personTrade}) {b.companyName ? `• ${b.companyName}` : ''}
                      </p>
                      {b.instructions && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">"{b.instructions}"</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <span className={`px-2.5 py-1 font-bold rounded-full text-[10px] ${
                      b.acknowledgement === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                      b.acknowledgement === 'Declined' ? 'bg-amber-100 text-amber-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {b.acknowledgement}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION: COMMERCIAL (Owner/Admin Only)                   */}
      {/* ========================================================= */}
      {activeSection === 'commercial' && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Commercial & Quotation Values</span>
              </h2>
            </div>

            <button
              onClick={() => setShowQuoteModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 shadow transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>{commercial?.hasConfirmedValue ? 'Edit / Confirm Contract Value' : 'Upload Quote & Extract AI'}</span>
            </button>
          </div>

          <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl space-y-2 shadow-lg">
            <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Confirmed Original Contract Value Gross</span>
            <div className="text-3xl font-extrabold text-emerald-400">
              {commercial?.hasConfirmedValue 
                ? formatPenceToGBP(commercial.confirmedContractValuePence)
                : 'Not Confirmed'
              }
            </div>
          </div>

          {/* Labour & Claims Costs */}
          <ProjectLabourCostSection projectId={projectId} />

          {/* Materials & Purchasing Costs (Stage 6) */}
          <ProjectMaterialsCostSection projectId={projectId} />
        </div>
      )}

      {/* Modals */}
      {showQuoteModal && (
        <QuoteExtractionModal
          projectId={project.id}
          projectReference={project.reference}
          existingCommercial={commercial}
          currentUser={currentUser}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={() => {
            setShowQuoteModal(false);
            loadWorkspaceData();
          }}
        />
      )}

      {showDocUploadModal && (
        <ProjectDocumentUploadModal
          projectId={project.id}
          projectMembers={project.members || []}
          currentUser={currentUser}
          replacingDocId={replacingDoc?.id}
          replacingDocTitle={replacingDoc?.title}
          replacingDocVersion={replacingDoc?.version}
          onClose={() => { setShowDocUploadModal(false); setReplacingDoc(null); }}
          onSuccess={() => {
            setShowDocUploadModal(false);
            setReplacingDoc(null);
            loadWorkspaceData();
          }}
        />
      )}

      {showPhotoUploadModal && (
        <ProjectPhotoUploadModal
          projectId={project.id}
          currentUser={currentUser}
          onClose={() => setShowPhotoUploadModal(false)}
          onSuccess={() => {
            setShowPhotoUploadModal(false);
            loadWorkspaceData();
          }}
        />
      )}

      {showAddMemberModal && (
        <AddMemberModal
          projectId={project.id}
          existingMemberUids={(project.members || []).map(m => m.uid)}
          currentUser={currentUser}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={() => {
            setShowAddMemberModal(false);
            loadWorkspaceData();
          }}
        />
      )}

      {showActionModal && (
        <ActionModal
          projectId={project.id}
          projectReference={project.reference}
          responsibleManagerUid={project.responsibleManagerUid}
          responsibleManagerName={project.responsibleManagerName}
          projectMembers={project.members || []}
          currentUser={currentUser}
          onClose={() => setShowActionModal(false)}
          onSuccess={() => {
            setShowActionModal(false);
            loadWorkspaceData();
          }}
        />
      )}

    </div>
  );
};
