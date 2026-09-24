import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { RequirementConfig, CompetencyDocument } from '../../types';
import { Upload, X, CheckCircle2, AlertCircle, FileText, Calendar, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';

interface UploadEvidenceModalProps {
  requirementConfigs: RequirementConfig[];
  targetHolderId?: string;
  targetHolderName?: string;
  targetHolderType?: 'individual' | 'company';
  preselectedRequirementId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadEvidenceModal: React.FC<UploadEvidenceModalProps> = ({
  requirementConfigs,
  targetHolderId,
  targetHolderName,
  targetHolderType = 'individual',
  preselectedRequirementId,
  onClose,
  onSuccess
}) => {
  const { currentUser, recordAuditLog } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [selectedReqId, setSelectedReqId] = useState<string>(preselectedRequirementId || '');
  
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Metadata state
  const [issuerProvider, setIssuerProvider] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [doesNotExpire, setDoesNotExpire] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const holderId = targetHolderId || currentUser?.uid || '';
  const holderName = targetHolderName || currentUser?.fullName || 'User';

  const selectedReq = requirementConfigs.find(r => r.id === selectedReqId);

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];

      // Validate size (15MB max)
      if (selected.size > 15 * 1024 * 1024) {
        setFileError("File size exceeds the 15MB maximum limit. Please choose a smaller file.");
        return;
      }

      // Validate type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
      if (!validTypes.includes(selected.type) && !selected.name.match(/\.(pdf|jpg|jpeg|png|webp|heic)$/i)) {
        setFileError("Unsupported file type. Please upload a PDF document or a JPEG/PNG image.");
        return;
      }

      setFile(selected);
    }
  };

  // Form submission & upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedReq) {
      setErrorMsg("Please select a requirement type.");
      return;
    }

    if (!file && selectedReq.evidenceRequired) {
      setErrorMsg("Please select a certificate evidence file to upload.");
      return;
    }

    if (!issuerProvider.trim()) {
      setErrorMsg("Please enter the Issuer or Training Provider name.");
      return;
    }

    // Date validations
    if (selectedReq.expiryRequired && !doesNotExpire && !expiryDate) {
      setErrorMsg("Please enter an expiry date or check 'Does not expire'.");
      return;
    }

    if (issueDate && expiryDate && !doesNotExpire) {
      if (expiryDate <= issueDate) {
        setErrorMsg("Expiry date must be strictly after the issue date.");
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      let documentUrl = '';

      // Upload file to Cloud Storage if provided
      if (file) {
        const storagePath = targetHolderType === 'company' 
          ? `company_documents/${holderId}/${Date.now()}_${file.name}`
          : `competencies/${holderId}/${Date.now()}_${file.name}`;
        
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 90);
              setUploadProgress(progress);
            },
            (err) => reject(err),
            async () => {
              documentUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      setUploadProgress(95);

      // Save document record to Firestore `/competencies`
      const newDoc: Partial<CompetencyDocument> = {
        requirementId: selectedReq.id,
        requirementName: selectedReq.name,
        requirementCategory: selectedReq.category,
        target: selectedReq.target,
        holderId: holderId,
        holderName: holderName,
        holderType: targetHolderType,
        issuerProvider: issuerProvider.trim(),
        referenceNumber: referenceNumber.trim() || 'N/A',
        issueDate: issueDate || undefined,
        expiryDate: doesNotExpire ? null : (expiryDate || null),
        doesNotExpire: doesNotExpire,
        documentUrl: documentUrl || undefined,
        fileName: file ? file.name : undefined,
        fileSizeBytes: file ? file.size : undefined,
        mimeType: file ? file.type : undefined,
        notes: notes.trim() || undefined,
        reviewStatus: 'Awaiting Review',
        version: 1,
        isCurrentVersion: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'competencies'), {
        ...newDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Audit Log
      await recordAuditLog(
        'Upload Certificate Evidence',
        'CompetencyDocument',
        docRef.id,
        `Uploaded evidence for ${selectedReq.name} (${holderName})`,
        null,
        newDoc
      ).catch(() => {});

      setUploadProgress(100);
      setSuccessMsg("Certificate evidence uploaded successfully! It is now Awaiting GVD Review.");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMsg(err.message || "Failed to upload evidence file. Please try again.");
      setIsUploading(false);
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
        maxWidth: '560px',
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
              Upload Certificate / Document Evidence
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Holder: <strong>{holderName}</strong> ({targetHolderType})
            </div>
          </div>
          <button onClick={onClose} disabled={isUploading} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Progress Bar */}
        {isUploading && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              <span>Uploading evidence to private storage...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--brand-gold)', transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}

        {/* Multi-Step Form */}
        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                Step 1: Select Requirement Type
              </h4>
              <div className="form-group">
                <label className="form-label">Requirement *</label>
                <select
                  className="form-select"
                  value={selectedReqId}
                  onChange={(e) => setSelectedReqId(e.target.value)}
                  disabled={isUploading}
                  required
                >
                  <option value="">-- Choose Requirement --</option>
                  {requirementConfigs.map(req => (
                    <option key={req.id} value={req.id}>
                      {req.name} ({req.category} {req.isMandatory ? '— Mandatory' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {selectedReq && (
                <div style={{ padding: '14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  <strong>Description:</strong> {selectedReq.description || 'N/A'}<br />
                  <strong>Category:</strong> {selectedReq.category.replace('_', ' ')} | <strong>Mandatory:</strong> {selectedReq.isMandatory ? 'Yes' : 'No (Advisory)'}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-navy"
                  onClick={() => {
                    if (!selectedReqId) setErrorMsg("Please select a requirement.");
                    else { setErrorMsg(null); setStep(2); }
                  }}
                  disabled={!selectedReqId}
                >
                  <span>Next: Select File</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                Step 2: Upload Certificate File
              </h4>

              <div className="form-group">
                <label className="form-label">Select Document File (PDF, JPEG, PNG max 15MB)</label>
                <div style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-subtle)',
                  cursor: 'pointer'
                }}>
                  <Upload size={32} style={{ color: 'var(--brand-gold)', marginBottom: '8px' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                    {file ? file.name : "Click or tap to choose document/photo"}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Supports PDF documents & mobile camera photos"}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,image/heic"
                    onChange={handleFileChange}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                  />
                </div>
                {fileError && <div style={{ fontSize: '0.8rem', color: 'var(--status-danger-text)', marginTop: '6px' }}>{fileError}</div>}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '20px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  className="btn btn-navy"
                  onClick={() => {
                    if (!file && selectedReq?.evidenceRequired) {
                      setErrorMsg("File upload is required for this certificate.");
                    } else {
                      setErrorMsg(null);
                      setStep(3);
                    }
                  }}
                >
                  <span>Next: Certificate Details</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                Step 3: Dates & Certificate Details
              </h4>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Issuer / Training Provider *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CITB, City & Guilds, Aviva"
                    value={issuerProvider}
                    onChange={(e) => setIssuerProvider(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Certificate / Ref Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CERT-998877"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Issue Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={doesNotExpire}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={doesNotExpire}
                    onChange={(e) => setDoesNotExpire(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>This certificate/document does not expire</span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Optional User Note</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Add any relevant comments regarding this upload..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '20px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setStep(2)} disabled={isUploading}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" className="btn btn-navy" disabled={isUploading} style={{ fontWeight: 700 }}>
                  {isUploading ? "Uploading Evidence..." : "Submit for GVD Review"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
