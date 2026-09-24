import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { CompetencyDocument } from '../../types';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { ShieldCheck, CheckCircle2, XCircle, Eye, AlertCircle, FileText, Lock } from 'lucide-react';

interface ReviewEvidenceModalProps {
  competencyDoc: CompetencyDocument | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewEvidenceModal: React.FC<ReviewEvidenceModalProps> = ({
  competencyDoc,
  onClose,
  onSuccess
}) => {
  const { currentUser, isOwner, isAdmin, recordAuditLog } = useAuth();

  if (!competencyDoc) return null;

  // Metadata correction state
  const [issuerProvider, setIssuerProvider] = useState(competencyDoc.issuerProvider || '');
  const [referenceNumber, setReferenceNumber] = useState(competencyDoc.referenceNumber || '');
  const [issueDate, setIssueDate] = useState(competencyDoc.issueDate || '');
  const [expiryDate, setExpiryDate] = useState(competencyDoc.expiryDate || '');
  const [doesNotExpire, setDoesNotExpire] = useState(competencyDoc.doesNotExpire || false);
  
  // Reviewer fields
  const [rejectionReason, setRejectionReason] = useState(competencyDoc.rejectionReason || '');
  const [privateInternalNotes, setPrivateInternalNotes] = useState(competencyDoc.privateInternalNotes || '');

  const [showPreview, setShowPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Self-approval prevention check
  const isSelfReview = currentUser?.uid === competencyDoc.holderId;

  const handleApprove = async () => {
    if (!currentUser) return;
    setErrorMsg(null);

    if (isSelfReview && !isOwner) {
      setErrorMsg("Self-approval prevention: You cannot approve your own submitted evidence. Please route to another GVD Administrator.");
      return;
    }

    if (issueDate && expiryDate && !doesNotExpire) {
      if (expiryDate <= issueDate) {
        setErrorMsg("Expiry date must be strictly after issue date.");
        return;
      }
    }

    setIsProcessing(true);
    try {
      const docRef = doc(db, 'competencies', competencyDoc.id);
      const updates = {
        issuerProvider: issuerProvider.trim(),
        referenceNumber: referenceNumber.trim(),
        issueDate: issueDate || undefined,
        expiryDate: doesNotExpire ? null : (expiryDate || null),
        doesNotExpire: doesNotExpire,
        reviewStatus: 'Valid',
        reviewedBy: currentUser.uid,
        reviewedByName: currentUser.fullName,
        reviewedAt: new Date().toISOString(),
        rejectionReason: undefined,
        privateInternalNotes: privateInternalNotes.trim() || undefined,
        updatedAt: serverTimestamp()
      };

      await updateDoc(docRef, updates);

      await recordAuditLog(
        'Approve Competency Evidence',
        'CompetencyDocument',
        competencyDoc.id,
        `Approved ${competencyDoc.requirementName} for ${competencyDoc.holderName}`,
        { reviewStatus: competencyDoc.reviewStatus },
        updates
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Approval failed:", err);
      setErrorMsg(err.message || "Failed to approve document.");
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!currentUser) return;
    setErrorMsg(null);

    if (!rejectionReason.trim()) {
      setErrorMsg("Please provide a user-facing rejection reason so the holder knows what to correct.");
      return;
    }

    setIsProcessing(true);
    try {
      const docRef = doc(db, 'competencies', competencyDoc.id);
      const updates = {
        issuerProvider: issuerProvider.trim(),
        referenceNumber: referenceNumber.trim(),
        reviewStatus: 'Rejected',
        reviewedBy: currentUser.uid,
        reviewedByName: currentUser.fullName,
        reviewedAt: new Date().toISOString(),
        rejectionReason: rejectionReason.trim(),
        privateInternalNotes: privateInternalNotes.trim() || undefined,
        updatedAt: serverTimestamp()
      };

      await updateDoc(docRef, updates);

      await recordAuditLog(
        'Reject Competency Evidence',
        'CompetencyDocument',
        competencyDoc.id,
        `Rejected ${competencyDoc.requirementName} for ${competencyDoc.holderName}. Reason: ${rejectionReason}`,
        { reviewStatus: competencyDoc.reviewStatus },
        updates
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Rejection failed:", err);
      setErrorMsg(err.message || "Failed to reject document.");
      setIsProcessing(false);
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
        maxWidth: '640px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>
              GVD Review: {competencyDoc.requirementName}
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Holder: <strong>{competencyDoc.holderName}</strong> | Status: <span className="badge badge-pending">{competencyDoc.reviewStatus}</span>
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPreview(true)}>
            <Eye size={16} />
            <span>Preview File</span>
          </button>
        </div>

        {/* Self-approval Warning Alert */}
        {isSelfReview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <Lock size={16} />
            <span>Self-approval Notice: This document belongs to your account. Self-approval is restricted.</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Metadata Correction Section */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
            Verify & Correct Document Metadata
          </h4>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Issuer / Training Provider</label>
              <input
                type="text"
                className="form-input"
                value={issuerProvider}
                onChange={(e) => setIssuerProvider(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reference / Cert Number</label>
              <input
                type="text"
                className="form-input"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Issue Date</label>
              <input
                type="date"
                className="form-input"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input
                type="date"
                className="form-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={doesNotExpire || isProcessing}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={doesNotExpire}
                onChange={(e) => setDoesNotExpire(e.target.checked)}
                disabled={isProcessing}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)' }}
              />
              <span>Does Not Expire</span>
            </label>
          </div>
        </div>

        {/* User-facing Rejection Reason */}
        <div className="form-group">
          <label className="form-label">User-Facing Rejection Reason (If rejecting)</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Image unreadable; please re-upload clear photo of certificate."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Private Internal GVD Note */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Private Internal GVD Note (Hidden from applicant)</label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Internal reviewer comments..."
            value={privateInternalNotes}
            onChange={(e) => setPrivateInternalNotes(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </button>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleReject}
              disabled={isProcessing}
            >
              <XCircle size={16} />
              <span>Reject Evidence</span>
            </button>
            <button
              type="button"
              className="btn btn-navy"
              onClick={handleApprove}
              disabled={isProcessing || (isSelfReview && !isOwner)}
              style={{ fontWeight: 700 }}
            >
              <CheckCircle2 size={16} />
              <span>Approve Evidence</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded File Preview Modal */}
      {showPreview && (
        <DocumentPreviewModal
          doc={competencyDoc}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
