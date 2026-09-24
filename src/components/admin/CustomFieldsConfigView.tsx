import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { CustomFieldConfig, CustomFieldType, CustomFieldVisibility, ApplicationCategory } from '../../types';
import { Settings, Plus, Edit3, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

export const CustomFieldsConfigView: React.FC = () => {
  const { currentUser, isAdmin, recordAuditLog } = useAuth();

  const [fieldConfigs, setFieldConfigs] = useState<CustomFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState<CustomFieldConfig | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form state
  const [label, setLabel] = useState('');
  const [helpText, setHelpText] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [optionsStr, setOptionsStr] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [viewPermission, setViewPermission] = useState<CustomFieldVisibility>('self_and_gvd');
  const [editPermission, setEditPermission] = useState<'admin_only' | 'self_and_admin'>('self_and_admin');
  const [isActive, setIsActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fieldsRef = collection(db, 'custom_field_configs');
    const unsubscribe = onSnapshot(fieldsRef, (snapshot) => {
      const list: CustomFieldConfig[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CustomFieldConfig);
      });
      setFieldConfigs(list);
      setLoading(false);
    }, (err) => {
      console.error("Custom fields snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenCreate = () => {
    setSelectedField(null);
    setIsCreatingNew(true);
    setLabel('');
    setHelpText('');
    setFieldType('text');
    setOptionsStr('');
    setIsRequired(false);
    setViewPermission('self_and_gvd');
    setEditPermission('self_and_admin');
    setIsActive(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleOpenEdit = (field: CustomFieldConfig) => {
    setSelectedField(field);
    setIsCreatingNew(false);
    setLabel(field.label);
    setHelpText(field.helpText || '');
    setFieldType(field.fieldType);
    setOptionsStr(field.options ? field.options.join(', ') : '');
    setIsRequired(field.isRequired);
    setViewPermission(field.viewPermission || 'self_and_gvd');
    setEditPermission(field.editPermission || 'self_and_admin');
    setIsActive(field.isActive);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!label.trim()) {
      setErrorMsg("Field label is required.");
      return;
    }

    setIsSaving(true);
    try {
      const parsedOptions = fieldType === 'selection' 
        ? optionsStr.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      if (isCreatingNew) {
        // Generate stable field ID
        const stableId = `field_${label.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
        const newConfig: CustomFieldConfig = {
          id: stableId,
          label: label.trim(),
          helpText: helpText.trim() || undefined,
          fieldType,
          options: parsedOptions,
          applicableAccountTypes: ['GVD Employee', 'Individual Contractor', 'Contractor Company'],
          isRequired,
          viewPermission,
          editPermission,
          isActive,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'custom_field_configs', stableId), {
          ...newConfig,
          createdAt: serverTimestamp()
        });

        await recordAuditLog('Create Custom Field Config', 'CustomFieldConfig', stableId, `Created custom field ${label}`, null, newConfig);
        setSuccessMsg("Custom field created successfully!");
      } else if (selectedField) {
        const docRef = doc(db, 'custom_field_configs', selectedField.id);
        const updates = {
          label: label.trim(),
          helpText: helpText.trim() || undefined,
          fieldType,
          options: parsedOptions,
          isRequired,
          viewPermission,
          editPermission,
          isActive,
          updatedAt: serverTimestamp()
        };

        await updateDoc(docRef, updates);
        await recordAuditLog('Update Custom Field Config', 'CustomFieldConfig', selectedField.id, `Updated custom field ${label}`, { label: selectedField.label }, updates);
        setSuccessMsg("Custom field updated successfully!");
      }

      setTimeout(() => {
        setIsCreatingNew(false);
        setSelectedField(null);
      }, 1200);

    } catch (err: any) {
      console.error("Failed to save custom field config:", err);
      setErrorMsg(err.message || "Failed to save custom field.");
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
            <Settings size={22} style={{ color: 'var(--brand-navy)' }} />
            <span>Admin-Defined Profile Fields</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Define custom profile questions and business details with safe visibility permissions.
          </p>
        </div>

        <button type="button" className="btn btn-navy" onClick={handleOpenCreate}>
          <Plus size={16} />
          <span>Add Custom Field</span>
        </button>
      </div>

      {/* Fields List */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading custom field definitions...
          </div>
        ) : fieldConfigs.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No custom fields configured yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Field Label (Stable ID)</th>
                  <th>Type</th>
                  <th>Visibility</th>
                  <th>Editable By</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fieldConfigs.map(field => (
                  <tr key={field.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{field.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {field.id}</div>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                        {field.fieldType}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem' }}>
                        {field.viewPermission === 'gvd_staff_only' ? 'Private (GVD Staff Only)' : 'Self & GVD Staff'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem' }}>
                        {field.editPermission === 'admin_only' ? 'Admin Only' : 'Self & Admin'}
                      </span>
                    </td>
                    <td>
                      {field.isActive ? (
                        <span className="badge badge-valid">Active</span>
                      ) : (
                        <span className="badge badge-blocked">Inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpenEdit(field)}
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
      {(isCreatingNew || selectedField) && (
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
              {isCreatingNew ? "Create Custom Profile Field" : `Edit Field: ${selectedField?.label}`}
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
                <label className="form-label">Field Label *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Emergency Contact Relationship"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Help Text</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Short guidance text shown under the field..."
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Field Type</label>
                  <select
                    className="form-select"
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
                    disabled={isSaving}
                  >
                    <option value="text">Text Input</option>
                    <option value="number">Numeric Input</option>
                    <option value="date">Date Input</option>
                    <option value="selection">Dropdown Selection</option>
                    <option value="yes_no">Yes / No Toggle</option>
                  </select>
                </div>

                {fieldType === 'selection' && (
                  <div className="form-group">
                    <label className="form-label">Options (Comma separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Option A, Option B, Option C"
                      value={optionsStr}
                      onChange={(e) => setOptionsStr(e.target.value)}
                      disabled={isSaving}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Who Can View This Field?</label>
                  <select
                    className="form-select"
                    value={viewPermission}
                    onChange={(e) => setViewPermission(e.target.value as CustomFieldVisibility)}
                    disabled={isSaving}
                  >
                    <option value="self_and_gvd">Self & GVD Staff (Normal)</option>
                    <option value="gvd_staff_only">GVD Staff Only (Private)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Who Can Edit This Field?</label>
                  <select
                    className="form-select"
                    value={editPermission}
                    onChange={(e) => setEditPermission(e.target.value as 'admin_only' | 'self_and_admin')}
                    disabled={isSaving}
                  >
                    <option value="self_and_admin">Self & Admin</option>
                    <option value="admin_only">Admin Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    disabled={isSaving}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>Required field</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={isSaving}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>Field is Active</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setIsCreatingNew(false); setSelectedField(null); }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-navy" disabled={isSaving} style={{ fontWeight: 700 }}>
                  {isSaving ? "Saving..." : "Save Field Definition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
