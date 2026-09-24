import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { PrivateBusinessDetails, CompetencyDocument, RequirementConfig } from '../types';
import { calculateCompetencyStatus } from '../services/competencyLogic';
import { UploadEvidenceModal } from '../components/competencies/UploadEvidenceModal';
import { DocumentPreviewModal } from '../components/competencies/DocumentPreviewModal';
import { 
  User, 
  Phone, 
  Mail, 
  Building2, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Eye, 
  Clock, 
  FileText 
} from 'lucide-react';

export const MyAccountView: React.FC = () => {
  const { currentUser, updateMyContactDetails, sendPasswordReset, recordAuditLog } = useAuth();

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [isEditingContact, setIsEditingContact] = useState(false);

  // Private business details
  const [tradingName, setTradingName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [utr, setUtr] = useState('');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [bizSuccess, setBizSuccess] = useState<string | null>(null);

  // Documents & Requirements
  const [myDocs, setMyDocs] = useState<CompetencyDocument[]>([]);
  const [reqConfigs, setReqConfigs] = useState<RequirementConfig[]>([]);
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CompetencyDocument | null>(null);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isResetSending, setIsResetSending] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to private business details
    const bizRef = doc(db, 'private_business_details', currentUser.uid);
    const unsubBiz = onSnapshot(bizRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PrivateBusinessDetails;
        setTradingName(data.tradingName || '');
        setBusinessAddress(data.businessAddress || '');
        setUtr(data.utr || '');
        setVatRegistered(data.vatRegistered || false);
        setVatNumber(data.vatNumber || '');
      }
    });

    // Listen to my competency docs
    const docsQuery = query(collection(db, 'competencies'), where('holderId', '==', currentUser.uid));
    const unsubDocs = onSnapshot(docsQuery, (snap) => {
      const list: CompetencyDocument[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CompetencyDocument));
      setMyDocs(list);
    });

    // Listen to requirement configs
    const reqUnsub = onSnapshot(collection(db, 'requirement_configs'), (snap) => {
      const list: RequirementConfig[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as RequirementConfig));
      setReqConfigs(list.filter(r => r.isActive));
    });

    return () => {
      unsubBiz();
      unsubDocs();
      reqUnsub();
    };
  }, [currentUser]);

  const validatePhone = (val: string): boolean => {
    const clean = val.trim();
    const phoneRegex = /^(\+[\d\s\-\(\)]{7,20}|0[\d\s\-\(\)]{9,14})$/;
    return phoneRegex.test(clean);
  };

  const handleSaveContactDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg("Full Name cannot be empty.");
      return;
    }

    if (!phone.trim() || !validatePhone(phone)) {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }

    setIsSavingContact(true);
    try {
      await updateMyContactDetails(fullName, phone);
      setStatusMsg("Contact details updated successfully!");
      setIsEditingContact(false);
    } catch (err: any) {
      console.error("Failed to update contact details:", err);
      setErrorMsg(err.message || "Failed to update contact details.");
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleSaveBizDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setBizSuccess(null);
    setIsSavingBiz(true);

    try {
      const bizRef = doc(db, 'private_business_details', currentUser.uid);
      const bizData: PrivateBusinessDetails = {
        uid: currentUser.uid,
        tradingName: tradingName.trim() || undefined,
        businessAddress: businessAddress.trim() || undefined,
        utr: utr.trim() || undefined, // Stored as text preserving leading zeroes
        vatRegistered,
        vatNumber: vatRegistered ? vatNumber.trim() : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid
      };

      await setDoc(bizRef, {
        ...bizData,
        updatedAt: serverTimestamp()
      });

      await recordAuditLog('Update Private Business Details', 'PrivateBusinessDetails', currentUser.uid, `Updated own business details`, null, bizData);
      setBizSuccess("Private business details saved successfully!");
    } catch (err: any) {
      console.error("Failed to save business details:", err);
    } finally {
      setIsSavingBiz(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    setStatusMsg(null);
    setErrorMsg(null);
    setIsResetSending(true);
    try {
      await sendPasswordReset(currentUser.email);
      setStatusMsg(`Password reset link sent to ${currentUser.email}.`);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setErrorMsg(err.message || "Could not send password reset link.");
    } finally {
      setIsResetSending(false);
    }
  };

  // User-facing personal action items
  const awaitingReviewDocs = myDocs.filter(d => d.reviewStatus === 'Awaiting Review');
  const expiredDocs = myDocs.filter(d => d.reviewStatus === 'Valid' && calculateCompetencyStatus(d) === 'Expired');
  const expiringDocs = myDocs.filter(d => d.reviewStatus === 'Valid' && calculateCompetencyStatus(d) === 'Expiring Soon');

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* Personal Action Items Banner */}
      {(awaitingReviewDocs.length > 0 || expiredDocs.length > 0 || expiringDocs.length > 0) && (
        <div className="card" style={{ backgroundColor: 'var(--status-warning-bg)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--status-warning-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px 0' }}>
            <AlertCircle size={20} />
            <span>Account Action Items</span>
          </h3>
          <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.875rem', color: 'var(--status-warning-text)', lineHeight: '1.6' }}>
            {expiredDocs.map(d => (
              <li key={d.id}><strong>{d.requirementName}</strong> certificate has expired. Please upload a replacement.</li>
            ))}
            {expiringDocs.map(d => (
              <li key={d.id}><strong>{d.requirementName}</strong> expires in less than 60 days ({new Date(d.expiryDate!).toLocaleDateString('en-GB')}).</li>
            ))}
            {awaitingReviewDocs.map(d => (
              <li key={d.id}>Replacement document for <strong>{d.requirementName}</strong> is awaiting GVD review.</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={22} style={{ color: 'var(--brand-gold)' }} />
            <span>My Profile & Contact Details</span>
          </h2>
          <span className="badge badge-approved">{currentUser?.role}</span>
        </div>

        {statusMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', fontSize: '0.875rem', marginBottom: '16px' }}>
            <CheckCircle2 size={18} />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', fontSize: '0.875rem', marginBottom: '16px' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveContactDetails}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="my-fullname">Full Name</label>
              {isEditingContact ? (
                <input id="my-fullname" type="text" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              ) : (
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>{currentUser?.fullName}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="my-phone">Contact Number</label>
              {isEditingContact ? (
                <input id="my-phone" type="tel" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              ) : (
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>{currentUser?.phone || 'Not provided'}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>{currentUser?.email}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Company Association (Read-only)</label>
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>{currentUser?.companyName || 'N/A'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            {isEditingContact ? (
              <>
                <button type="submit" className="btn btn-navy" disabled={isSavingContact} style={{ fontWeight: 700 }}>
                  {isSavingContact ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setIsEditingContact(false)} disabled={isSavingContact}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => setIsEditingContact(true)}>
                Edit Contact Details
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Competencies & Documents Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: 'var(--brand-gold)' }} />
            <span>My Qualifications & Documents</span>
          </h3>
          <button type="button" className="btn btn-navy btn-sm" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} /> Upload Certificate
          </button>
        </div>

        {myDocs.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No certificates or document evidence uploaded yet. Click "Upload Certificate" to submit your evidence.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Issuer / Ref</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Preview</th>
                </tr>
              </thead>
              <tbody>
                {myDocs.map(d => {
                  const status = d.reviewStatus === 'Awaiting Review' ? 'Awaiting Review' : calculateCompetencyStatus(d);
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.requirementName}</td>
                      <td>{d.issuerProvider} (Ref: {d.referenceNumber})</td>
                      <td>{d.doesNotExpire ? 'Does Not Expire' : (d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('en-GB') : 'N/A')}</td>
                      <td><span className={`badge badge-${status === 'Valid' ? 'valid' : status === 'Awaiting Review' ? 'pending' : 'expired'}`}>{status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {d.documentUrl && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreviewDoc(d)}>
                            <Eye size={14} /> Preview
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Private Business Details Card (For Contractors) */}
      {currentUser?.applicationCategory !== 'GVD Employee' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} style={{ color: 'var(--brand-navy)' }} />
              <span>Private Business & Tax Identifiers</span>
            </h3>
            <span className="badge badge-info">Private to You & GVD</span>
          </div>

          {bizSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
              <CheckCircle2 size={16} />
              <span>{bizSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveBizDetails}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Trading / Business Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Contracting Services"
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  disabled={isSavingBiz}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unique Taxpayer Reference (UTR)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 0123456789 (10-digit string)"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  disabled={isSavingBiz}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Stored as text to preserve leading zeroes.
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Registered Business Address</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Full business trading address..."
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  disabled={isSavingBiz}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={vatRegistered}
                    onChange={(e) => setVatRegistered(e.target.checked)}
                    disabled={isSavingBiz}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>VAT Registered Business</span>
                </label>
              </div>

              {vatRegistered && (
                <div className="form-group">
                  <label className="form-label">VAT Registration Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GB 123 4567 89"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    disabled={isSavingBiz}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button type="submit" className="btn btn-navy" disabled={isSavingBiz} style={{ fontWeight: 700 }}>
                {isSavingBiz ? "Saving Business Details..." : "Save Business Details"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Reset Section */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} style={{ color: 'var(--brand-navy)' }} />
            <span>Security & Password Reset</span>
          </h3>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Change your account password securely via official Firebase Authentication.
        </p>
        <button type="button" className="btn btn-navy" onClick={handlePasswordReset} disabled={isResetSending}>
          <span>{isResetSending ? "Sending Link..." : "Send Password Reset Link"}</span>
        </button>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadEvidenceModal
          requirementConfigs={reqConfigs}
          targetHolderId={currentUser?.uid}
          targetHolderName={currentUser?.fullName}
          targetHolderType="individual"
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
