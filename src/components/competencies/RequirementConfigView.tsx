import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { RequirementConfig, RequirementCategory, RequirementTarget, ApplicationCategory } from '../../types';
import { ShieldCheck, Plus, Edit3, CheckCircle2, AlertCircle, FileText, Lock } from 'lucide-react';

export const RequirementConfigView: React.FC = () => {
  const { currentUser, isOwner, isAdmin, recordAuditLog } = useAuth();

  const [configs, setConfigs] = useState<RequirementConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<RequirementConfig | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RequirementCategory>('competency');
  const [target, setTarget] = useState<RequirementTarget>('individual');
  const [isMandatory, setIsMandatory] = useState(true);
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [expiryRequired, setExpiryRequired] = useState(true);
  const [allowDoesNotExpire, setAllowDoesNotExpire] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const reqRef = collection(db, 'requirement_configs');
    const unsubscribe = onSnapshot(reqRef, (snapshot) => {
      const list: RequirementConfig[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as RequirementConfig);
      });
      setConfigs(list);
      setLoading(false);
    }, (err) => {
      console.error("Requirements snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenCreate = () => {
    setSelectedConfig(null);
    setIsCreatingNew(true);
    setName('');
    setDescription('');
    setCategory('competency');
    setTarget('individual');
    setIsMandatory(true);
    setEvidenceRequired(true);
    setExpiryRequired(true);
    setAllowDoesNotExpire(true);
    setIsActive(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleOpenEdit = (config: RequirementConfig) => {
    setSelectedConfig(config);
    setIsCreatingNew(false);
    setName(config.name);
    setDescription(config.description || '');
    setCategory(config.category || 'competency');
    setTarget(config.target || 'individual');
    setIsMandatory(config.isMandatory ?? true);
    setEvidenceRequired(config.evidenceRequired ?? true);
    setExpiryRequired(config.expiryRequired ?? true);
    setAllowDoesNotExpire(config.allowDoesNotExpire ?? true);
    setIsActive(config.isActive ?? true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg("Requirement Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      if (isCreatingNew) {
        const newId = `req_${Date.now()}`;
        const newConfig: RequirementConfig = {
          id: newId,
          name: name.trim(),
          description: description.trim(),
          category,
          target,
          applicableAccountTypes: ['GVD Employee', 'Individual Contractor', 'Contractor Company'],
          applicableTrades: [],
          isMandatory,
          evidenceRequired,
          expiryRequired,
          allowDoesNotExpire,
          reminderThresholdsDays: [60, 30, 7, 0],
          isActive,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'requirement_configs', newId), {
          ...newConfig,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        await recordAuditLog('Create Requirement Config', 'RequirementConfig', newId, `Created requirement ${name}`, null, newConfig);
        setSuccessMsg("Requirement type created successfully!");
      } else if (selectedConfig) {
        const docRef = doc(db, 'requirement_configs', selectedConfig.id);
        const updates = {
          name: name.trim(),
          description: description.trim(),
          category,
          target,
          isMandatory,
          evidenceRequired,
          expiryRequired,
          allowDoesNotExpire,
          isActive,
          updatedAt: serverTimestamp()
        };

        await updateDoc(docRef, updates);
        await recordAuditLog('Update Requirement Config', 'RequirementConfig', selectedConfig.id, `Updated requirement ${name}`, { name: selectedConfig.name }, updates);
        setSuccessMsg("Requirement type updated successfully!");
      }

      setTimeout(() => {
        setIsCreatingNew(false);
        setSelectedConfig(null);
      }, 1200);

    } catch (err: any) {
      console.error("Failed to save requirement config:", err);
      setErrorMsg(err.message || "Failed to save requirement.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
        <Lock size={32} style={{ color: 'var(--status-danger-text)' }} />
        <p>Access restricted to GVD Administrators.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={22} style={{ color: 'var(--brand-gold)' }} />
            <span>Competency & Document Requirement Types</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Configure mandatory and advisory qualifications, insurance types, and renewal thresholds.
          </p>
        </div>

        <button type="button" className="btn btn-navy" onClick={handleOpenCreate}>
          <Plus size={16} />
          <span>Add New Requirement</span>
        </button>
      </div>

      {/* Configs List */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading requirement types...
          </div>
        ) : configs.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No requirement types configured yet. Click "Add New Requirement" to create one.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Requirement Name</th>
                  <th>Category</th>
                  <th>Target</th>
                  <th>Mandatory</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(config => (
                  <tr key={config.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{config.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{config.description}</div>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                        {config.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                        {config.target}
                      </span>
                    </td>
                    <td>
                      {config.isMandatory ? (
                        <span className="badge badge-expired">Mandatory</span>
                      ) : (
                        <span className="badge badge-draft">Advisory</span>
                      )}
                    </td>
                    <td>
                      {config.isActive ? (
                        <span className="badge badge-valid">Active</span>
                      ) : (
                        <span className="badge badge-blocked">Inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpenEdit(config)}
                      >
                        <Edit3 size={14} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {(isCreatingNew || selectedConfig) && (
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
            maxWidth: '540px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0', fontFamily: 'var(--font-heading)' }}>
              {isCreatingNew ? "Create Requirement Type" : `Edit Requirement: ${selectedConfig?.name}`}
            </h3>

            {errorMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Requirement Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Asbestos Awareness, Public Liability Insurance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Guidance</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Help text for applicants uploading evidence..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as RequirementCategory)}
                    disabled={isSaving}
                  >
                    <option value="competency">Competency Qualification</option>
                    <option value="insurance">Insurance Policy</option>
                    <option value="supporting_document">Supporting Document</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Entity</label>
                  <select
                    className="form-select"
                    value={target}
                    onChange={(e) => setTarget(e.target.value as RequirementTarget)}
                    disabled={isSaving}
                  >
                    <option value="individual">Individual Worker</option>
                    <option value="company">Subcontractor Company</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isMandatory}
                    onChange={(e) => setIsMandatory(e.target.checked)}
                    disabled={isSaving}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span><strong>Mandatory</strong> (Required to satisfy eligibility)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={expiryRequired}
                    onChange={(e) => setExpiryRequired(e.target.checked)}
                    disabled={isSaving}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>Expiry date required</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={allowDoesNotExpire}
                    onChange={(e) => setAllowDoesNotExpire(e.target.checked)}
                    disabled={isSaving}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>Permit 'Does Not Expire' checkbox</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={isSaving}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>Requirement is Active</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setIsCreatingNew(false); setSelectedConfig(null); }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-navy" disabled={isSaving} style={{ fontWeight: 700 }}>
                  {isSaving ? "Saving..." : "Save Requirement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
