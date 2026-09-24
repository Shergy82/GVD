import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { CompanyProfile, UserProfile, CompetencyDocument, RequirementConfig } from '../../types';
import { UploadEvidenceModal } from '../competencies/UploadEvidenceModal';
import { DocumentPreviewModal } from '../competencies/DocumentPreviewModal';
import { Building2, Users, FileText, CheckCircle2, ArrowLeft, Plus, UserPlus, Eye, ShieldCheck } from 'lucide-react';

interface CompanyProfileViewProps {
  companyId: string;
  onBack?: () => void;
}

export const CompanyProfileView: React.FC<CompanyProfileViewProps> = ({ companyId, onBack }) => {
  const { currentUser, isAdmin, recordAuditLog } = useAuth();

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [associatedUsers, setAssociatedUsers] = useState<UserProfile[]>([]);
  const [allApprovedUsers, setAllApprovedUsers] = useState<UserProfile[]>([]);
  const [companyDocs, setCompanyDocs] = useState<CompetencyDocument[]>([]);
  const [reqConfigs, setReqConfigs] = useState<RequirementConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Active section
  const [activeSection, setActiveSection] = useState<'overview' | 'business' | 'contacts' | 'documents'>('overview');
  
  // Worker association dropdown state
  const [selectedUserToAssociate, setSelectedUserToAssociate] = useState<string>('');
  const [isAssociating, setIsAssociating] = useState(false);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CompetencyDocument | null>(null);

  useEffect(() => {
    const companyRef = doc(db, 'companies', companyId);
    const unsubCompany = onSnapshot(companyRef, (snap) => {
      if (snap.exists()) {
        setCompany({ id: snap.id, ...snap.data() } as CompanyProfile);
      }
    });

    const usersQuery = query(collection(db, 'users'), where('status', '==', 'approved'));
    const unsubUsers = onSnapshot(usersQuery, (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as UserProfile));
      setAllApprovedUsers(list);
    });

    const docsQuery = query(collection(db, 'competencies'), where('holderId', '==', companyId));
    const unsubDocs = onSnapshot(docsQuery, (snap) => {
      const list: CompetencyDocument[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CompetencyDocument));
      setCompanyDocs(list);
    });

    const reqUnsub = onSnapshot(collection(db, 'requirement_configs'), (snap) => {
      const list: RequirementConfig[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as RequirementConfig));
      setReqConfigs(list.filter(r => r.target === 'company' && r.isActive));
      setLoading(false);
    });

    return () => {
      unsubCompany();
      unsubUsers();
      unsubDocs();
      reqUnsub();
    };
  }, [companyId]);

  useEffect(() => {
    if (company && allApprovedUsers.length > 0) {
      const ids = company.associatedUserIds || [];
      setAssociatedUsers(allApprovedUsers.filter(u => ids.includes(u.uid) || u.companyId === company.id));
    }
  }, [company, allApprovedUsers]);

  const handleAssociateUser = async () => {
    if (!company || !selectedUserToAssociate) return;
    setIsAssociating(true);

    try {
      const currentIds = company.associatedUserIds || [];
      if (!currentIds.includes(selectedUserToAssociate)) {
        const updatedIds = [...currentIds, selectedUserToAssociate];
        
        await updateDoc(doc(db, 'companies', company.id), {
          associatedUserIds: updatedIds,
          updatedAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'users', selectedUserToAssociate), {
          companyId: company.id,
          companyName: company.companyName,
          updatedAt: serverTimestamp()
        });

        await recordAuditLog('Associate Worker to Company', 'CompanyProfile', company.id, `Associated user ${selectedUserToAssociate} with ${company.companyName}`, null, { updatedIds });
      }
      setSelectedUserToAssociate('');
    } catch (err: any) {
      console.error("Failed to associate user:", err);
    } finally {
      setIsAssociating(false);
    }
  };

  if (loading) return <div className="card" style={{ padding: '30px', textAlign: 'center' }}>Loading company profile...</div>;
  if (!company) return <div className="card" style={{ padding: '30px', textAlign: 'center' }}>Company profile not found.</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {onBack && (
              <button type="button" className="btn btn-outline btn-sm" onClick={onBack} title="Back">
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--brand-navy)',
              color: '#FFF',
              fontWeight: 800,
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
                {company.companyName}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Main Contact: <strong>{company.mainContactName}</strong> | Email: {company.businessEmail}
              </div>
            </div>
          </div>

          <span className="badge badge-approved">
            {company.status === 'active' ? 'Active Subcontractor Firm' : 'Inactive Firm'}
          </span>
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
          <button type="button" className={`btn btn-sm ${activeSection === 'overview' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setActiveSection('overview')}>
            Overview
          </button>
          <button type="button" className={`btn btn-sm ${activeSection === 'business' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setActiveSection('business')}>
            Business Details
          </button>
          <button type="button" className={`btn btn-sm ${activeSection === 'contacts' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setActiveSection('contacts')}>
            Associated Workers ({associatedUsers.length})
          </button>
          <button type="button" className={`btn btn-sm ${activeSection === 'documents' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setActiveSection('documents')}>
            Company Insurance ({companyDocs.length})
          </button>
        </div>
      </div>

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              Company Info
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Trading Name:</span><strong>{company.tradingName || company.companyName}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Business Phone:</span><strong>{company.businessPhone}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Main Contact:</span><strong>{company.mainContactName}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Address:</span><strong>{company.businessAddress || 'N/A'}</strong></div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              Company Insurance Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Insurance Records:</span>
                <span className="badge badge-info">{companyDocs.length} policies</span>
              </div>
              <button type="button" className="btn btn-navy" onClick={() => setShowUploadModal(true)} style={{ marginTop: '10px', fontWeight: 700 }}>
                <UploadEvidenceModal requirementConfigs={reqConfigs} targetHolderId={companyId} targetHolderName={company.companyName} targetHolderType="company" onClose={() => {}} onSuccess={() => {}} />
                <span>Upload Company Insurance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUSINESS DETAILS */}
      {activeSection === 'business' && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            Company Registration & Tax Identifiers
          </h3>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Company Number</label><div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{company.companyNumber || 'N/A'}</div></div>
            <div className="form-group"><label className="form-label">Unique Taxpayer Reference (UTR)</label><div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{company.utr || 'N/A'}</div></div>
            <div className="form-group"><label className="form-label">VAT Registration</label><div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{company.vatRegistered ? `Registered (${company.vatNumber || 'N/A'})` : 'Not Registered'}</div></div>
          </div>
        </div>
      )}

      {/* CONTACTS / WORKERS */}
      {activeSection === 'contacts' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Associated Operatives & Workers</h3>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', backgroundColor: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <select className="form-select" value={selectedUserToAssociate} onChange={(e) => setSelectedUserToAssociate(e.target.value)} style={{ flex: 1 }}>
                <option value="">-- Associate Approved Worker Account --</option>
                {allApprovedUsers.map(u => (
                  <option key={u.uid} value={u.uid}>{u.fullName} ({u.email})</option>
                ))}
              </select>
              <button type="button" className="btn btn-navy btn-sm" onClick={handleAssociateUser} disabled={!selectedUserToAssociate || isAssociating}>
                <UserPlus size={16} /> Associate
              </button>
            </div>
          )}

          {associatedUsers.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No workers associated with this company profile yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Worker Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Primary Trade</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {associatedUsers.map(worker => (
                    <tr key={worker.uid}>
                      <td style={{ fontWeight: 700 }}>{worker.fullName}</td>
                      <td>{worker.email}</td>
                      <td>{worker.phone || 'N/A'}</td>
                      <td>{worker.primaryTrade || 'General'}</td>
                      <td><span className="badge badge-info">{worker.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS */}
      {activeSection === 'documents' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Company Policies & Insurance Documents</h3>
            <button type="button" className="btn btn-navy btn-sm" onClick={() => setShowUploadModal(true)}>
              Upload Company Document
            </button>
          </div>

          {companyDocs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No company-level documents uploaded yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Issuer / Ref</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {companyDocs.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.requirementName}</td>
                      <td>{d.issuerProvider} (Ref: {d.referenceNumber})</td>
                      <td>{d.doesNotExpire ? 'Does Not Expire' : d.expiryDate}</td>
                      <td><span className="badge badge-approved">{d.reviewStatus}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {d.documentUrl && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreviewDoc(d)}>
                            <Eye size={14} /> Preview
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showUploadModal && (
        <UploadEvidenceModal
          requirementConfigs={reqConfigs}
          targetHolderId={companyId}
          targetHolderName={company.companyName}
          targetHolderType="company"
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => setShowUploadModal(false)}
        />
      )}

      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
};
